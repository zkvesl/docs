# Custom Domain Hoon: A Foundation

When you wire a vesl kernel together, `graft-inject` writes most of the Hoon for you — imports, state fields, cause variants, poke arms, peek branches, the typed effect union. The Hoon you still write by hand is your **custom domain**: the state fields, cause variants, poke arms, and peek branches that describe *your* application, sitting beside the graft-injected ones.

This page is a syntax-and-aura foundation calibrated to what those custom-domain blocks actually need. It's the page to read first if you've never written Hoon before. The companion page, [Writing Hoon](./writing-hoon), is the task-focused walkthrough — how the imports stack, how to delegate to a graft, how the `apply-*` wet-gates fit. Read this page for the vocabulary, then that one for the recipes.

The scope is the union of every custom-domain pattern across the dogfood profiles (artifact registry, license registry, validated state, throttled settlement, signed ledger, queue worker, hull-keyed kv, signed audit log, validated pipeline, manifest-verified vault). Patterns outside that scope — agents, generators, parsers, HTML — aren't covered. For those, the [Urbit Hoon docs](https://docs.urbit.org/hoon) are the reference; each section below ends with a **Learn more** pointer to the canonical page.

## What you actually write

Your custom-domain code lives in four slots in `hoon/app/app.hoon`. The graft-injected blocks live alongside them. Schematically:

```hoon
+$  versioned-state
  $:  %v1
      ::  graft-injected:        kv=kv-state, log=log-state, ...
      ::  your custom-domain:    licenses=(map @t [grant=@ issuer=@ux])
  ==

+$  cause
  $%  ::  graft-injected:        kv-cause, log-cause, ...
      ::  your custom-domain:    [%issue-license name=@t grant=@ issuer=@ux]
  ==

+$  domain-effect
  $%  ::  your custom-domain:    [%license-issued name=@t]
  ==

++  poke
  ?-    -.u.act
      ::  graft-injected arms:   %kv-set, %log-append, ...
      ::
      %issue-license              :: your domain arm
    ::  ... your code ...
  ==

++  peek
  ::  graft-injected fallthrough chain runs first
  ?.  ?=([%license-info @t ~] path)  ~
  ::  ... your code ...
```

To write any of those four slots well, you need to read and write atoms (with their auras), cells, faces, and a small set of runes. The rest of this page covers each in turn.

## Atoms and auras

An **atom** is Hoon's only primitive datum: a single non-negative integer of unbounded size. Booleans, characters, strings, hashes, hull IDs, addresses, timestamps — all atoms. The bit pattern is the value; what an atom *means* is given by its **aura**.

An aura is a soft type tag: it tells the compiler (and human readers) how to display and parse the atom, but it doesn't change the underlying number. `0x41`, `65`, and `'A'` are all the same atom — only their auras differ. Auras start with `@` and add lowercase letters to refine the meaning.

The auras you'll see across the profiles:

| Aura | Meaning | Example literal | Where it shows up |
|---|---|---|---|
| `@` | untyped atom | (no special syntax) | opaque payloads, hashes, anything you don't need to display |
| `@t` | UTF-8 text (cord) | `'license-issued'` | string keys in `(map @t ...)`, registry names, log tags' human-readable bodies |
| `@ud` | unsigned decimal | `42`, `1.000` (dots are visual separators) | counters, sequence numbers, queue lengths |
| `@ux` | unsigned hex | `0x4142.4344` | pubkeys, tip5 hash atoms when you want hex display |
| `@da` | absolute date | `~2026.5.4..12.30.00..0000` | `clock-graft`'s `[%clock-now ~]` peek result |
| `@ta` | URL-safe text (knot) | `~.tag` (with `~.` prefix) | `log-graft`'s `tag=@ta` cause field; lowercase, no spaces |
| `@tas` | term (short symbol) | `%my-action` | the head of every cause variant — that's what a `%`-prefixed word actually is |
| `?` | loobean (boolean) | `%.y` (yes), `%.n` (no) | `guard-checked ok=?`, `(~(has by m) k)` results |

Auras are **advisory** at runtime. The compiler tracks them through type inference, but the runtime sees only the bare integer. Two consequences:

1. **Same data, different aura.** A pubkey passed in as `@ux` and read out as `@` is the same atom — the kernel just stops displaying it as hex. Cast with `^-  @ux` (see *Casting*, below) when you need the display back.
2. **Aura mismatches surface as type errors, not runtime errors.** If you write `=(name @ud-counter)` where `name` is `@t`, hoonc rejects at compile time. This catches a lot of bugs early.

Two operations come up constantly:

- **Cast** — `^-  @t  expression` says "treat the result as a `@t`." The compiler checks compatibility; the bytes don't move. You'll see `^-  (list effect)` above every poke return value to lock down the effect-list aura.
- **Soft cast** — `((soft cause) raw-noun)` tries to parse `raw-noun` against the `cause` mold. Returns `(unit cause)` — `~` if the shape doesn't match, `[~ parsed]` if it does. Every poke arm starts with this against `cause.input.ovum`. The "soft" part is that a mismatch returns `~` instead of crashing.

**Learn more:** [Auras reference](https://docs.urbit.org/hoon/auras) lists every standard aura with parsing rules. [Basic types](https://docs.urbit.org/hoon/basic#atom-pterm-qunit-atom) covers how the `$type` system tracks them.

## Cells, faces, and wings

Hoon's only composite is the **cell** — an ordered pair `[a b]`. Everything bigger is built by nesting: `[a b c]` is `[a [b c]]`, a tuple is just a right-leaning chain of cells, a list is a chain ending in `~` (the null atom).

A **face** is a name attached to a cell position. You write it as `name=value` and access it with `name.parent`:

```hoon
=/  point  [x=3 y=4]
::  point is the cell [3 4]
::  x.point is 3
::  y.point is 4
```

When the compiler tracks faces through type inference, the dotted access form (`x.point`) lets you treat the cell like a record. State updates use the same syntax: `state(items new-items, count +(count.state))` returns a copy of `state` with `items` and `count` replaced.

A **wing** is the path Hoon walks to find a face inside a structure. The most common wings you'll write:

| Wing | What it means |
|---|---|
| `state` | the whole state cell |
| `items.state` | the `items` face inside `state` |
| `-.u.act` | the head of `u.act` (`u` unwraps the unit, `.act` selects the face, `-` selects the head) |
| `i.t.path` | walk `path` past its head (`t.path`), then take the head of what remains (`i`) |
| `+<.path` | first element of the path's tail (sugar for `i.t.path`) |
| `key.u.act` | the `key` face of the action-payload variant `u.act` |

Wings read right-to-left semantically: `i.t.path` is "the head of the tail of `path`." When a peek arm pattern-matches `[%license-info name=@t ~]`, you can extract `name` either by name (`name.path`) or positionally (`+<.path` — first element of tail). The two are equivalent.

**Learn more:** [Basic types — face](https://docs.urbit.org/hoon/basic#face-pterm-qtype) explains how faces interact with type inference. [Limbs and wings](https://docs.urbit.org/hoon/limbs) covers the wing search rules in full.

## Molds (types)

A **mold** is a function from any noun to a noun of a specific shape (or a crash). You define molds with `+$  name  shape`. The shapes you'll write:

### Cell molds — `$:`

Tuple of named slots. This is the shape of `versioned-state` and most cause-variant payloads:

```hoon
+$  versioned-state
  $:  %v1                              :: literal head, doubles as version tag
      settle=settle-state              :: graft-injected
      licenses=(map @t license-rec)    :: your custom field
      issuer-count=@ud                 :: your custom field
  ==
```

The `%v1` head atom is constant — only nouns whose head matches will type-check as this mold. When you bump to `v2`, the `++load` arm pattern-matches on the head and migrates.

### Tagged unions — `$%`

A union of cell molds, each starting with a unique `@tas` head atom. This is the shape of `cause`, `effect`, and every graft's effect type:

```hoon
+$  cause
  $%  [%issue-license name=@t grant=@ issuer=@ux]
      [%revoke-license name=@t]
      [%register key=@t payload=@]
      registry-cause                   :: graft-injected: bring in a whole sub-union
  ==
```

Each variant is a `[%tag field=type ...]` cell. The `?-` switch (below) dispatches on the head atom. You can also embed an entire sub-union (like `registry-cause`) by name — its variants get folded into yours. That's how graft-injected causes coexist with your domain causes.

### Container molds

Built-in parameterized molds you'll use everywhere:

| Mold | Shape | Common use |
|---|---|---|
| `(list V)` | null-terminated chain of `V`s | `(list effect)` for poke return; arguments to `weld` |
| `(map K V)` | balanced tree of `K`→`V` | state fields like `(map @t @)`, `(map @ud @ud)` |
| `(set V)` | balanced tree of unique `V`s | `(set @)` for "have we seen this id" tracking |
| `(unit V)` | `~` (null) or `[~ V]` (some) | result of `~(get by m)` — present-or-absent |
| `?` | `%.y` or `%.n` | loobean fields like `valid=?` |

A `(unit V)` is "maybe a `V`." Pattern-match with `?~  unit  ...` ("is it null?"), then read `u.unit` for the inner `V`. This is the standard map-lookup idiom:

```hoon
=/  found  (~(get by licenses.state) name.u.act)
?~  found
  :_  state                    :: missing
  ~[[%not-found name.u.act]]
:_  state                       :: present
~[[%found name.u.act u.found]]
```

### Loobeans — the inverted boolean

Hoon's boolean is `?` with `%.y` (yes, value `0`) and `%.n` (no, value `1`). The encoding is inverted from most languages because Nock's "test for zero" is the cheap operation. You rarely produce loobeans directly; you read them from comparisons (`=(a b)`), map-membership (`(~(has by m) k)`), and graft results (`%guard-checked ok=?`).

**Learn more:** [`$:` cell molds (buccol)](https://docs.urbit.org/hoon/rune/buc#buccol), [`$%` tagged unions (buccen)](https://docs.urbit.org/hoon/rune/buc#buccen), [`+$` mold arm definition (lusbuc)](https://docs.urbit.org/hoon/rune/lus#lusbuc). Container molds are documented under the [standard library](https://docs.urbit.org/hoon/stdlib) — sets in [2h](https://docs.urbit.org/hoon/stdlib/2h), maps in [2i](https://docs.urbit.org/hoon/stdlib/2i), units in [2a](https://docs.urbit.org/hoon/stdlib/2a).

## The runes you need

Hoon's syntax is rune-driven: every multi-line construct opens with a two-character sigil. The runes split into families by first character — `?` for conditionals, `=` for binding, `|` for cores, `:` for cells, `^` for casts, `~` for hints, `+` for arm definitions, `$` for molds.

You won't need every rune. You will need this set:

### Conditionals — `?` family

| Rune | Name | Shape | Use |
|---|---|---|---|
| `?-` | wuthep | `?-  wing  arm-1  expr  arm-2  expr  ==` | exhaustive switch on a tagged union (the `cause` head) |
| `?+` | wutlus | `?+  wing  default  arm  expr  ==` | switch with a default branch |
| `?:` | wutcol | `?:  test  if-yes  if-no` | classic if-then-else |
| `?.` | wutdot | `?.  test  if-no  if-yes` | inverted if; reads as "guard clause: bail if not" |
| `?>` | wutgar | `?>  test  expression` | assert true; crash and produce no STARK if false |
| `?~` | wutsig | `?~  unit  if-null  if-some` | pattern-match a `(unit V)` for null |
| `?=` | wuttis | `?=  pattern  noun` | shape-test against a mold; returns a loobean |

`?-` is the workhorse — every `++poke` arm is one big `?-  -.u.act  ...  ==`. `?>` matters for security: when a verify-gate returns `%.n`, the kernel falls through to a `?>(%.y ...)` that intentionally crashes, producing zero effects and an unprovable STARK. That's the gate-deny path for `settle-graft`.

**Learn more:** [`?` rune family](https://docs.urbit.org/hoon/rune/wut). The page anchors map one-to-one with the table above (`#wuthep`, `#wutcol`, etc.).

### Binding — `=` family

| Rune | Name | Shape | Use |
|---|---|---|---|
| `=/` | tisfas | `=/  name  value  body` | let-bind a name in scope for `body` |
| `=^` | tisket | `=^  out  state  expr  body` | run `expr` returning `[out new-state]`, bind `out`, replace `state`, continue |
| `=>` | tisgar | `=>  subject  body` | compose a new subject (used in the template's outer wrapping) |

`=/` is the standard "compute a thing, name it, use it." `=^` is the state-threading bind: it expects `expr` to return a cell `[output new-state]`, names the output, swaps your `state` for the new one, and continues. This is exactly what every `apply-<graft>` helper returns, which is why the helpers chain so naturally:

```hoon
=^  efx-c  state  (apply-counter [%counter-increment 'requests'] state)
=^  efx-k  state  (apply-kv [%kv-set 'last-id' (jam id)] state)
[(weld efx-c efx-k) state]
```

After two `=^` calls, `state` has been replaced twice and the two effect lists are welded into one return value. This is the fast path for multi-graft arms — see [Writing Hoon → Multi-graft coordination](./writing-hoon#multi-graft-coordination).

**Learn more:** [`=` rune family](https://docs.urbit.org/hoon/rune/tis). Anchors: [`#tisfas`](https://docs.urbit.org/hoon/rune/tis#tisfas), [`#tisket`](https://docs.urbit.org/hoon/rune/tis#tisket), [`#tisgar`](https://docs.urbit.org/hoon/rune/tis#tisgar).

### Cells — `:` family

| Rune | Name | Shape | Use |
|---|---|---|---|
| `:-` | colhep | `:-  a  b` | build the cell `[a b]` (rare; `[a b]` literal is shorter) |
| `:_` | colcab | `:_  b  a` | build the cell `[a b]` with `b` written first; the standard `[effects new-state]` return form |
| `:~` | colsig | `:~  a  b  c  ==` | build the null-terminated list `~[a b c]`; usually you just write `~[a b c]` |

`:_` is the canonical poke return idiom because it lets you put the new-state expression first (where the reader looks for it) and the effect list below:

```hoon
:_  state(licenses (~(put by licenses.state) name.u.act new-rec))
^-  (list effect)
~[[%license-issued name.u.act]]
```

That cell is `[(list effect) new-state]` — exactly what `++poke` returns. The `^-  (list effect)` cast in the middle locks the type so the effect literal below is checked against the typed effect union.

**Learn more:** [`:` rune family](https://docs.urbit.org/hoon/rune/col). Anchors: [`#colhep`](https://docs.urbit.org/hoon/rune/col#colhep), [`#colcab`](https://docs.urbit.org/hoon/rune/col#colcab), [`#colsig`](https://docs.urbit.org/hoon/rune/col#colsig).

### Casts and hints

| Rune | Name | Shape | Use |
|---|---|---|---|
| `^-` | kethep | `^-  type  expr` | cast `expr` to `type`; type-only, no runtime cost |
| `;;` | micmic | `;;(type expr)` | hard cast: coerce or crash; used in `;;(@ data)` to assert raw payload is an atom |
| `~>` | siggar | `~>  %hint.payload  expr` | attach a hint to `expr`; `%slog` writes to the console |

`~>  %slog.[priority message]` is your debug-print. Priority `0` is info, `3` is error. Format numbers into messages with `(scot %ud n)` and concatenate cords with `(cat 3 a b)`:

```hoon
~>  %slog.[0 (cat 3 'issued ' name.u.act)]
~>  %slog.[3 (cat 3 'rejected: ' (scot %ud reason-code))]
```

`%slog` runs on every poke whether or not the proof is generated, so use it freely during development. It does not affect the STARK.

**Learn more:** [`^-` casts](https://docs.urbit.org/hoon/rune/ket), [`~>` hints](https://docs.urbit.org/hoon/rune/sig).

### Function definition (you'll mostly read these, not write them)

The `|` family defines functions and cores. The graft-scaffold template provides the outer scaffold; you usually only add arms, not new cores. But two runes show up in custom verify-gates:

| Rune | Name | Use |
|---|---|---|
| `|=` | bartis | dry gate (function) — `\|=  sample  body` |
| `|*` | bartar | wet gate — same shape, but the sample type defers to the call site |

A custom `verify-gate` (Profile A scaffold) uses `|=`:

```hoon
=/  hash-gate=verify-gate
  |=  [note-id=@ data=* expected-root=@]
  ^-  ?
  =((hash-leaf ;;(@ data)) expected-root)
```

The `apply-*` and `audit-write` helpers in `domain-patterns` are wet gates (`|*`) so they can thread *your* `versioned-state` shape without naming it.

**Learn more:** [`|` rune family](https://docs.urbit.org/hoon/rune/bar). [`|=` dry gate](https://docs.urbit.org/hoon/rune/bar#bartis), [`|*` wet gate](https://docs.urbit.org/hoon/rune/bar#bartar). Wet vs. dry semantics are covered in [Advanced types](https://docs.urbit.org/hoon/advanced).

## Map, set, and list operations

Hoon stdlib containers are accessed through **doors** — cores parameterized by the container they operate on. The syntax is `~(arm door container)`:

```hoon
(~(get by licenses.state) name.u.act)
::  ^^^         ^         ^
::  arm         door      container
```

Reading: "open the `by` door over `licenses.state`, then call its `get` arm with `name.u.act`."

You won't use most of the doors. The arms you'll touch:

### `by` door (maps)

| Call | Returns | Use |
|---|---|---|
| `(~(get by m) k)` | `(unit V)` | safe lookup; `~` if missing |
| `(~(got by m) k)` | `V` | crashing lookup; use after `?:  (~(has by m) k)` |
| `(~(put by m) k v)` | `(map K V)` | insert or overwrite |
| `(~(has by m) k)` | `?` | membership |
| `(~(del by m) k)` | `(map K V)` | remove (idempotent — no-op if missing) |

### `in` door (sets)

| Call | Returns | Use |
|---|---|---|
| `(~(put in s) v)` | `(set V)` | insert |
| `(~(has in s) v)` | `?` | membership |
| `~(wyt in s)` | `@ud` | element count |
| `(~(del in s) v)` | `(set V)` | remove |

Note that `~(wyt in s)` takes no extra argument — it's a zero-argument arm, so the parens are gone.

### Lists

Lists are usually built with literal syntax (`~[a b c]`) or returned by stdlib functions. The two manipulators you'll use:

| Function | Shape | Use |
|---|---|---|
| `(weld a b)` | `(list X)` | concatenate two lists of the same type |
| `(welp a b)` | `(list X)` | same but with looser type unification — use this for effect lists from different grafts |

`welp` matters when you concatenate effect lists from two grafts: their narrow per-graft types (`(list kv-effect)`, `(list log-effect)`) don't unify cleanly, but `welp` widens both to the typed effect union. This is the same widening the `apply-*` helpers do internally.

**Learn more:** [Maps reference (2i)](https://docs.urbit.org/hoon/stdlib/2i), [Sets reference (2h)](https://docs.urbit.org/hoon/stdlib/2h), [Lists reference (2b)](https://docs.urbit.org/hoon/stdlib/2b).

## Stdlib quick reference

The functions that show up across the profiles. Each is a one-liner you copy into a poke arm.

### Arithmetic and comparison

| Call | Returns | Use |
|---|---|---|
| `+(n)` | `@ud` | successor (n + 1) |
| `(dec n)` | `@ud` | predecessor; crashes on `0` |
| `(add a b)`, `(sub a b)`, `(mul a b)`, `(div a b)` | `@ud` | basic arithmetic |
| `(gth a b)`, `(lth a b)`, `(gte a b)`, `(lte a b)` | `?` | greater-than, less-than, etc. |
| `=(a b)` | `?` | equality (any aura, any shape) |

### Hashing

| Call | Returns | Use |
|---|---|---|
| `(shax atom)` | `@ux` | SHA-256 of the atom's bytes |
| `(hash-leaf atom)` | `@ux` | tip5 hash of the leaf — used in custom verify-gates |

### Text formatting

| Call | Returns | Use |
|---|---|---|
| `(scot %ud n)` | `@ta` | format `n` as decimal text |
| `(scot %ux n)` | `@ta` | format `n` as hex text |
| `(cat 3 a b)` | `@t`/`@ta` | concatenate two cords; `3` is the bit-width per character (8 bits = 2³) |
| `(crip text)` | `@t` | convert a `tape` (list of chars) to a `cord` (single atom) — rare in domain code |

`(scot %ud +(count.state))` formats the incremented counter for slog. `(cat 3 ...)` is how you build readable log messages.

### Serialization

| Call | Returns | Use |
|---|---|---|
| `(jam noun)` | `@` | serialize any noun to a single atom |
| `(cue atom)` | `*` | inverse of `jam`; deserialize an atom back into a noun |

`jam` shows up in three places: `audit-write`'s `log-body` field (`(jam <write-body>)`), `queue-graft`'s opaque body argument, and `log-graft`'s body argument. The graft stores the atom blob; when you peek it back, you `cue` it on the Rust side. Domain code rarely calls `cue` directly.

**Learn more:** [Standard library index](https://docs.urbit.org/hoon/stdlib). The numbered sections (1a–5f) progress from basic to advanced. For the functions in this section: arithmetic in [1a](https://docs.urbit.org/hoon/stdlib/1a), text in [4b](https://docs.urbit.org/hoon/stdlib/4b), serialization in [2p](https://docs.urbit.org/hoon/stdlib/2p), hashing in [3d](https://docs.urbit.org/hoon/stdlib/3d).

## Worked example — Profile B's `%issue-license` arm

Putting it all together. Here's the custom-domain Hoon for Profile B (license registry, gated by rbac, audited by log). Annotations call out which concept from above is in play.

State and cause additions:

```hoon
+$  versioned-state
  $:  %v1
      settle=settle-state              :: graft-injected
      registry=registry-state          :: graft-injected
      rbac=rbac-state                  :: graft-injected
      log=log-state                    :: graft-injected
      ::  custom domain — one map keyed by license name:
      licenses=(map @t [grant=@ issuer=@ux])
  ==

+$  cause
  $%  settle-cause                     :: graft-injected sub-union
      registry-cause                   :: graft-injected sub-union
      rbac-cause                       :: graft-injected sub-union
      log-cause                        :: graft-injected sub-union
      ::  custom domain causes:
      [%issue-license name=@t grant=@ issuer=@ux]
      [%revoke-license name=@t]
  ==

+$  domain-effect
  $%  [%license-issued name=@t]
      [%license-revoked name=@t]
  ==
```

The custom poke arm (the rbac perm-check happens orchestrator-side in Rust before this fires):

```hoon
  %issue-license
::  build the registry payload off the cause fields
=/  payload  (jam [grant.u.act issuer.u.act])
::  thread two grafts: registry-put + log-append, both via apply helpers
=^  efx-r  state
  (apply-registry [%registry-put name.u.act payload] state)
=^  efx-l  state
  (apply-log [%log-append %issue (jam name.u.act)] state)
::  also write the local face for fast peek lookup
=/  new-licenses
  (~(put by licenses.state) name.u.act [grant.u.act issuer.u.act])
:_  state(licenses new-licenses)
^-  (list effect)
(welp efx-r (welp efx-l ~[[%license-issued name.u.act]]))
```

What's happening, line by line:

- `=/  payload  (jam ...)` — bind a name (`=/`, tisfas) to a serialized noun (`jam`).
- `=^  efx-r  state  (apply-registry ...)` — call the wet-gate helper, which returns `[(list effect) new-state]`; bind `efx-r` to the effect list and replace `state` with the updated one (`=^`, tisket).
- `=^  efx-l  state  (apply-log ...)` — same pattern again; `state` now reflects both writes.
- `(~(put by licenses.state) ...)` — door-arm call to insert into a `(map @t ...)`; returns the new map.
- `:_  state(licenses new-licenses)` — build the return cell `[effects new-state]`, with the state-update expression on the right.
- `^-  (list effect)` — cast the next expression to the typed effect union so the literal below type-checks.
- `(welp efx-r (welp efx-l ~[...]))` — concatenate three effect lists into one. `welp` widens the per-graft narrow types into the union.

Six concepts in one arm: bindings (`=/`, `=^`), door arms (`~(put by ...)`), cell return (`:_`), casts (`^-`), wet-gate helpers (`apply-*`), list welding (`welp`). The arm is eight functional lines; the same logic written without the `apply-*` helpers runs to roughly twelve, with three repeats of the per-graft `=/  cause` / `=/  [efx state]  (poke)` boilerplate.

The peek arm follows the same shape — see [Writing Hoon → Peek dispatch](./writing-hoon#peek-dispatch).

## Where to go next

- [Writing Hoon](./writing-hoon) — the task-focused walkthrough: imports, multi-graft coordination, peek chains, slog. Once the vocabulary on this page feels familiar, that page is the recipe book.
- [Grafting (SDK)](./grafting) — the end-to-end walkthrough for picking grafts, running `graft-inject`, and customizing the result.
- [SDK Reference](../reference/sdk) — Rust-side primitives (`Mint`, `Guard`, the `build_*_poke` helpers).
- **Hoon school** — the original tutorial sequence, far broader than the vesl-shaped subset on this page. Start with [Why Hoon?](https://docs.urbit.org/hoon/why-hoon) for the design rationale, then [Hoon School](https://docs.urbit.org/build-on-urbit/hoon-school) for the lesson-by-lesson tutorial. The [Hoon reference index](https://docs.urbit.org/hoon) is the lookup page once you know what you're searching for.
