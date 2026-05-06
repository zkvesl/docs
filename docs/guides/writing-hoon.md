# Writing Hoon for Vesl

Graft users don't need to be Hoon experts. The scaffold template handles the hard parts. This page covers the minimum needed to customize a grafted kernel.

If you've never written Hoon before, read [Custom Domain Hoon](./custom-domain) first — it's a syntax-and-aura foundation calibrated to the same custom-domain patterns that show up across every dogfood profile, with deep-links into the canonical Hoon reference. This page assumes that vocabulary and focuses on the recipes (imports, multi-graft coordination, peeks, slog).

## Imports

Hoon import order matters. Libraries (`/+`) must come after structure files (`/-`), and both must come before subject imports (`/=`):

```hoon
/-  *vesl              :: structure file (only for RAG gates)
/+  *settle-graft      :: library
/+  *vesl-merkle       :: library
/=  *  /common/wrapper  :: subject (state versioning)
```

Mixing order causes cryptic syntax errors in `hoonc`.

## Types

### Defining state

State is a labeled tuple using `$:`:

```hoon
+$  versioned-state
  $:  %v1                              :: version tag
      settle=settle-state              :: grafted state (settle-graft)
      items=(map @ @t)                 :: your fields
      count=@ud
  ==
```

`@` is an unsigned integer. `@t` is a text cord. `@ud` is an unsigned decimal. `(map @ @t)` is a map from integers to text.

### Tagged unions

Causes (poke types) are tagged unions using `$%`:

```hoon
+$  cause
  $%  [%my-action data=@t]     :: your domain poke
      settle-cause              :: brings %settle-register, %settle-verify, %settle-note
  ==
```

Each variant starts with a tag atom (`%my-action`). The kernel dispatches on `-.cause` (the head — the tag).

## Poke dispatch

The `++poke` arm uses `?-` to match on the cause tag:

```hoon
++  poke
  |=  =ovum:moat
  ^-  [(list effect) _state]
  =/  act  ((soft cause) cause.input.ovum)
  ?~  act  [~ state]                    :: unknown cause, ignore
  ?-  -.u.act                           :: switch on tag
    ::
      %my-action
    ::  ... handle domain poke ...
    ::
      %settle-register
    ::  ... delegate to graft ...
  ==
```

`(soft cause)` tries to parse the raw noun as your `cause` type. Returns `~` (null) if it doesn't match. `?~` checks for null.

## Multi-graft coordination

Single-graft arms are the easy case. When your domain coordinates **multiple** grafts in one arm — increment a counter, write to a `kv` slot, audit-log the write, then emit a domain effect — the hand-coded shape repeats the same three lines per graft:

```hoon
=/  cause=<graft>-cause  [%<graft>-action arg1 arg2]
=/  [efx=(list <graft>-effect) new=<graft>-state]
  (<graft>-poke <graft>.state cause)
::  ... once per graft, then a state field-list update + (weld …) at the bottom
```

`vesl-core` ships a small Hoon library, `domain-patterns`, that bundles these shapes into one-line helpers. Import it manually — it has no graft manifest, so `graft-inject` doesn't auto-wire it:

```hoon
/+  *domain-patterns
```

`vesl-merkle` and `vesl-gates` follow the same import convention.

### `apply-<graft>` — state threading in one line

One wet-gate per shipped data/behavior graft:

| Helper | Wraps | Use when |
|---|---|---|
| `apply-counter` | `counter-poke` | tracking named counters |
| `apply-kv` | `kv-poke` | loose key-value writes |
| `apply-queue` | `queue-poke` | FIFO job pushes/pops |
| `apply-rbac` | `rbac-poke` | grant/revoke perms |
| `apply-registry` | `registry-poke` | strict registry writes |
| `apply-log` | `log-poke` | append-only audit entries |
| `apply-clock` | `clock-poke` | tick-based event counters |
| `apply-validate` | `validate-poke` | install/clear validate rules |
| `apply-batch` | `batch-poke` | accumulator with count trigger |

Each takes the graft's cause + your `versioned-state`, calls the underlying `<graft>-poke`, and returns `[(list <graft>-effect) versioned-state]` suitable for `=^` binding:

```hoon
=^  efx-c  state  (apply-counter [%counter-increment 'requests'] state)
=^  efx-k  state  (apply-kv [%kv-set 'last-request' (jam request-id)] state)
[(weld efx-c efx-k) state]
```

The state-threading convention — `apply-counter` reads `counter.state`, `apply-kv` reads `kv.state`, etc. — matches every shipped graft's `Usage:` block AND what `graft-inject` emits, so the helpers compose with anything `graft-inject` produces. If your kernel renames the field (`cnt.state` instead of `counter.state`), `hoonc` rejects with `find . counter` at the `apply-counter` call site — loud, attributable.

### `audit-write` — storage + log in one call

The "delegate to a storage graft (kv / registry / queue) + append to the log graft" pattern is so common that `audit-write` bundles it into a single helper:

```hoon
=^  efx  state
  (audit-write state [%kv-set key value] %tag (jam log-body))
```

The signature is `[state target-cause log-tag log-body]`. `target-cause` dispatches statically on the head atom (the helper recognizes `%kv-set`, `%kv-delete`, `%registry-put`, `%registry-update`, `%registry-del`, `%queue-push`, `%queue-pop`, `%queue-clear`). `log-tag` and `log-body` go straight into a `[%log-append tag body]` poke after the storage write succeeds.

`log-tag` and `log-body` are separate so the **write payload** and the **audit-log payload** can differ. A typical pattern: `%revoke-license` writes a `%registry-del` (key only) but logs the human-readable name as the audit body. Pass `log-body=(jam <write-body>)` if they're the same.

The returned effect list is `(weld storage-effects log-effect)`. Caller welds in their own domain effect after, if any.

### Worked example — multi-graft arm with both helpers

```hoon
::  in the cause $% union, alongside the graft-injected variants:
[%audited-set key=@t value=@]
```

```hoon
::  in the domain-effect $% union:
[%set-audited key=@t]
```

```hoon
::  inside ?-, alongside the graft-injected arms:
::
  %audited-set
=^  efx-c  state  (apply-counter [%counter-increment key.u.act] state)
=^  efx-aw  state
  (audit-write state [%kv-set key.u.act value.u.act] %set (jam value.u.act))
:_  state
(welp efx-c (welp efx-aw ~[[%set-audited key.u.act]]))
```

Five lines for three graft pokes plus a domain effect — the same arm written without the helpers runs to twelve lines (each graft poke gets its own `=/  cause`, `=/  [efx state]  (poke …)`, and the `state(counter …, kv …, log …)` update threads three field-updates on the bottom line).

### Out of scope for the helpers

`apply-<graft>` is shipped only for the **9 data and behavior grafts** above. The kernel-composite grafts (`settle`, `mint`, `guard`, `forge`, `intent`) are deliberately excluded:

- `settle-poke` takes a third `verify-gate` argument, so the 2-arg helper shape doesn't fit without leaking the verify-gate dependency to every caller.
- `forge-poke` is stateless (cause → effects only), so there's nothing to thread.
- `mint`, `guard`, and `intent` are kernel composites, not modular state shards — a hand-written delegation is the right shape for them.

For commitment-family kernels, hand-write the `(settle-poke settle.state cause hash-gate)` style as the scaffold template demonstrates.

## Peek dispatch

`graft-inject` wires each graft's peek handler into a chain: `settle-peek`, then `mint-peek`, then `guard-peek`, each one returning `~` to defer to the next. Your domain peek arm goes at the tail of that chain, below the last `?.  =(~ <graft>-res)  <graft>-res` line.

Worked example — a `[%artifact-by-name @t ~]` lookup against a `artifacts=(map @t artifact-meta)` state field:

```hoon
::  inside ++peek, below the vesl peek chain:
?.  ?=([%artifact-by-name @t ~] path)
  ~
=/  got  (~(get by artifacts.state) i.t.path)
?~  got  [~ ~]
``u.got
```

`?=` pattern-matches the path shape; `i.t.path` is standard list traversal (`t.path` drops `%artifact-by-name`, `i.t.path` is the `@t` second element). The `(unit (unit *))` return-type convention has three shapes:

- **`~`** — "this path is not for me, let the next arm try." Use this on any path your arm doesn't recognize.
- **`[~ ~]`** — "I recognize this path, but there is no value here." The standard map-lookup miss.
- **`` ``x ``** — shorthand for `[~ ~ x]`, "I recognize this path and the value is `x`." `x` must be a noun (`*`).

The vesl peek chain follows the same convention, so composing arms is just a list of `?.  =(~ <res>)  <res>` guards. Put your arm at the tail; put a bare `~` fallthrough below it if nothing else matches.

## Loobeans

Hoon booleans are inverted from most languages:

| Hoon | Meaning | Nock value |
|------|---------|-----------|
| `%.y` | yes / true | `0` |
| `%.n` | no / false | `1` |

`?:` is if-then-else: `?:(test if-yes if-no)`.

`?>` asserts true (crashes if false — produces an unprovable STARK).

`?.` is inverted if: `?.(test if-no if-yes)`. Used for guard clauses:

```hoon
?.  (some-check)
  :: this runs if check is FALSE
  :_  state
  ~[[%error 'check failed']]
:: this runs if check is TRUE (fall through)
```

## State updates

`:_` is "put the second thing first" — it builds `[effects new-state]` with the state expression on the right:

```hoon
:_  state(items new-items, count +(count.state))
^-  (list effect)
~[[%my-actioned id data]]
```

`state(items new-items)` creates a copy of `state` with the `items` field replaced. Multiple fields can be updated: `state(items new-items, count new-count)`.

## Slog (debug logging)

Print a message to the console:

```hoon
~>  %slog.[0 'my debug message']
```

Priority levels: `0` = info, `1` = warning, `2` = debug, `3` = error.

Use `(cat 3 'prefix ' (scot %ud value))` to format numbers into log messages:

```hoon
~>  %slog.[0 (cat 3 'count: ' (scot %ud count.state))]
```

## Map and set operations

```hoon
::  map operations
(~(put by my-map) key value)       :: insert/update
(~(get by my-map) key)             :: lookup (returns unit)
(~(got by my-map) key)             :: lookup (crashes if missing)
(~(has by my-map) key)             :: membership check

::  set operations
(~(put in my-set) value)           :: insert
(~(has in my-set) value)           :: membership check
~(wyt in my-set)                   :: count elements
```

## Compilation

```bash
hoonc --new hoon/app/app.hoon hoon/
```

`--new` forces a fresh compile (no cache). The second argument is the library search path. All imports (`/+`, `/-`, `/=`) resolve relative to this path.

If `hoonc` says "no panic!" but produces no `out.jam`, a dependency is missing from the search path. Two common causes:

- **Missing `hoon/common/`** — `zeke.hoon` and `ztd/` need to be present at `hoon/common/zeke.hoon` and `hoon/common/ztd/`. Consumers who installed via `nockup package add zkvesl/vesl-graft` get this automatically; hand-assembled trees sometimes miss it.
- **New library, no entry in `hoon/lib/`** — only relevant if you are authoring a new `.hoon` under a vesl-style repo where `hoon/lib/` is a symlink tree into `protocol/lib/` (the `vesl-core` repo itself works this way). Dropping a file into `protocol/lib/` alone is invisible to hoonc; `/+ *foo` won't resolve until you also `ln -s ../../protocol/lib/foo.hoon hoon/lib/foo.hoon`. The failure trace blames hoonc internals rather than your file, so check the symlink tree before chasing type errors. Users who install grafts through `nockup package add` or copy them from `vesl-nockup/hoon/lib/` are immune — that tree is populated with real files, not symlinks.

