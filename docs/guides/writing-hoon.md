# Writing Hoon for Vesl

Graft users don't need to be Hoon experts. The scaffold template handles the hard parts. This page covers the minimum needed to customize a grafted kernel.

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
- **New library, no entry in `hoon/lib/`** — only relevant if you are authoring a new `.hoon` under a vesl-style repo where `hoon/lib/` is a symlink tree into `protocol/lib/` (the vesl repo itself works this way). Dropping a file into `protocol/lib/` alone is invisible to hoonc; `/+ *foo` won't resolve until you also `ln -s ../../protocol/lib/foo.hoon hoon/lib/foo.hoon`. The failure trace blames hoonc internals rather than your file, so check the symlink tree before chasing type errors. Users who install grafts through `nockup package add` or copy them from `vesl-nockup/hoon/lib/` are immune — that tree is populated with real files, not symlinks.

