---
title: Kernel
description: The three Hoon patterns you write between the markers — domain causes, peek paths, and verification-gate replacement.
outline: deep
---

# Kernel

Most of your kernel is composed for you by `nockup graft`: commitment, state, and behavior primitives ship as graft libraries that drop into any nockapp. The behavior unique to your app's domain is the Hoon you write between the markers — the cause that says "register an artifact" or "issue a badge," the state field that tracks it, the `?-` arm that wires the primitives together. Generic graft libraries are built for reuse across many apps; the domain-specific layer stays in your kernel so each app can shape it independently.

Typically the amount is small: one or two custom causes, the `?-` arms that handle them, optional peek paths, and (sometimes) a replacement verification gate. This page covers those three patterns.

::: info Heads up

This page is a basic Hoon-and-kernel guide: enough syntax and patterns to write custom domain logic in a vesl kernel. It's long. For a deeper Hoon education, work through [Hoon School](https://docs.urbit.org/courses/hoon-school/). The [Hoon Cheatsheet](#hoon-cheatsheet) below is a quick reference for the runes and auras used in the worked examples.

:::

::: info Hoon Cheatsheet

A skim-able reference for the syntax used on the rest of the page. For a fuller introduction, see [Hoon School](https://docs.urbit.org/courses/hoon-school/).

### Syntax and Semantics

| Term | Meaning |
|---|---|
| **Noun** | Hoon's universal value type. Either an *atom* or a *cell*. |
| **Atom** | A non-negative integer. The primitive scalar. |
| **Cell** | An ordered pair of nouns, written `[a b]`. Nests right: `[1 2 3]` parses as `[1 [2 3]]`. |
| **Aura** | A tag on an atom that says how to read it. Bits stay the same; the aura is metadata for the printer and parser. |
| **Tagged union** | A type with multiple variants, each marked by a head tag. Hoon's `$%(...)` constructor builds one; `?-` is the exhaustive switch over the tag. The same concept as Rust's `enum`. |
| **Loobean** | Hoon's boolean type, written `?`. Two values: `%.y` (true) and `%.n` (false). |
| **Core** | A piece of code (the *battery*) plus its closed-over data (the *payload*). Hoon's closest thing to a class. |
| **Arm** | A function on a core. Invoked via `~(arm core arg)` or dotted-axis (`arm.core`). |
| **Gate** | A function. A specialized core with one arm (`$`) and a sample slot. |
| **Sample** | A gate's argument slot. `|=  sample  body` binds the sample at call time; the body reads it by name. |
| **Wet-gate** | A polymorphic gate, declared with `|*`. Its sample type isn't fixed at declaration — each call site re-checks the body against the actual sample shape. `vesl-core`'s `domain-patterns` ships these. |
| **Door** | A core used as a module-style API; arms accessed via `~(arm door arg)`. Examples: `by` (map ops), `in` (set ops). |
| **Subject** | The lexical scope at a point in source: every name visible there. |
| **`++poke`** | The kernel's top-level write entrypoint. Takes `(cause, state)`, returns `[effects new-state]`. |
| **`++peek`** | The kernel's top-level read entrypoint. Takes a path, returns `(unit (unit *))`. |

### Auras

The aura is a tag on an atom describing how to read its integer value. Bits stay the same; the aura changes how it prints and parses.

| Aura | Reading | Example |
|---|---|---|
| `@` | bare atom (no read-as) | `5`, `123` |
| `@ud` | unsigned decimal | `5`, `100` |
| `@ux` | unsigned hex | `0x10`, `0xdead` |
| `@t` | UTF-8 cord | `'hello'` |
| `@tas` | lowercase-and-dashes symbol | `%settle`, `%mint-graft`, `%my-action` |
| `@da` | absolute date | `~2026.5.10` |

### Syntactic Marks

The single-character and two-character marks Hoon uses for literals, punctuation, and access:

| Mark | Meaning |
|---|---|
| `::` | Line comment. Everything after the two colons to end-of-line is ignored. |
| `%name` | Symbol literal — an `@tas` atom. The `%` is the syntactic mark; the name is what follows. |
| `'text'` | Cord literal — UTF-8 text packed into a `@t` atom. |
| `0xNN` | Hex literal — `@ux` atom. |
| `~` | Null. Used as the empty unit, the end-of-list marker, and the "no result" return. |
| `~YYYY.MM.DD` | Absolute date literal — `@da` atom. |
| `[a b ...]` | Cell literal. Right-associative: `[1 2 3]` parses as `[1 [2 3]]`. |
| `name.subject` | Dotted-axis access. Reach a named field inside `subject`. |
| `name=type` | Field or binding declaration. Same shape in records, gate arguments, and `=/` let-bindings. |
| `==` | Block terminator. Closes `$%`, `?-`, and `$:` blocks. |
| `--` | Core terminator. Closes `|%`. |

### Runes

Hoon's two-character syntactic forms. The ones you'll see in vesl kernel code:

| Rune | Purpose |
|---|---|
| `=/` | Typed let-binding: `=/  name=type  expr`. |
| `=>` | Compose: evaluate the second expression with the first in scope. |
| `?-` | Exhaustive switch on a tagged union. Closes with `==`. |
| `?:` | If-then-else. |
| `?.` | If-not (inverse condition). |
| `?~` | Branch on null vs non-null `(unit)`. |
| `?>` | Assertion. Deterministic exit (`Exit` mote) if the test fails. |
| `?=` | Type-pattern match. |
| `^-` | Type cast (downcast). |
| `^*` | Default value of a type. |
| `~(arm core arg)` | Method-call shape: invoke `arm` on `core` with sample `arg`. |
| `:_` | Cell constructor. `:_  X  Y` is `[Y X]` — writes the tail-half first. |
| `+(x)` | Increment. |
| `~[a b c]` | List literal. |
| `$%` | Tagged-union type constructor. Closes with `==`. |
| `$:` | Record-type constructor. Closes with `==`. |
| `+$` | Type alias declaration. |
| `++` | Arm declaration in a core. |

:::

## Writing Hoon for vesl

Three places, in order of how often you'll touch them:

1. **A new domain cause** — the kernel handles `[%my-action ...]` by adding a state field, a cause variant, and a `?-` arm. Most apps live here.
2. **A custom peek path** — the kernel answers `[%my-query ...]` by walking your state and returning a `(unit (unit *))`.
3. **A replacement verification gate** — when the default hash-comparison gate isn't what you need (Merkle manifests, signatures, STARK proofs).

## How a Poke Updates State

A nockapp kernel handles each poke as a pure transformation: `(cause, state)` in, `[effects new-state]` out. The whole `versioned-state` value is the kernel's memory. Pokes receive it by value, compute the next version, and return it as the tail-half of an `[effects new-state]` cell. The runtime takes that returned state and uses it for the next poke; subsequent pokes see the post-update value because the runtime holds the "current" pointer for you.

`versioned-state` is the type your kernel declares at the `nockup:state` marker — a tagged record listing every field the kernel knows about. Each graft adds the fields it owns there; your domain appends its own at the bottom.

In practice, "modifying" state means constructing a copy with the fields you want different. Hoon's `state(field new-value)` record-update syntax is the shorthand: a copy of `state` with one field replaced. It plays the role of `State { field: new-value, ..state }` in Rust. The modifications go at the start of the expression and the base goes inside the parens.

## Adding a Domain Cause

Three Hoon blocks per command: one state field (if needed), one cause variant, one arm. Worked example — a **badge issuer** that increments a per-subject counter and emits `%badge-issued`:

```hoon
::  in versioned-state, after `settle=settle-state`:
badges=(map @ud @ud)
```

Walking the declaration:

- `badges` is the field name you pick.
- `(map @ud @ud)` is the type: a map from `@ud` keys to `@ud` values. `(map K V)` is the parametric map type.
- The whole `name=type` shape is the standard field declaration. The line goes at the `nockup:state` marker, inside `versioned-state`, after the graft state fields.

```hoon
::  in the cause $% union, alongside settle-cause:
[%issue-badge subject=@ud]
```

Walking the variant:

- `[%issue-badge subject=@ud]` is a cell. Head is the tag (`%issue-badge`, a symbol-style `@tas` atom); tail is one named field (`subject` typed `@ud`).
- The variant goes inside the `$%` tagged-union at the `nockup:cause` marker, alongside the graft cause-variants. `$%` is the tagged-union type constructor.
- Adding a variant here is the same idea as adding a variant to a Rust `enum`; the `?-` switch in `++poke` (below) is the exhaustive match over the tag.

```hoon
::  inside ?-, alongside the vesl arms:
  %issue-badge
=/  n=@ud  +((~(gut by badges.state) subject.u.act 0))
:_  state(badges (~(put by badges.state) subject.u.act n))
^-  (list effect)
~[[%badge-issued subject.u.act n]]
```

The arm runs when the cause's tag is `%issue-badge` and returns `[effects new-state]`. The idioms it uses:

- `?-` is an exhaustive switch on the cause's tag.
- `=/  n=@ud  <expr>` is a typed let-binding: declare `n` typed `@ud`, set it to the value of `<expr>`.
- `u.act` is the unwrapped cause cell; `subject.u.act` reaches the `subject` field by dotted-axis access.
- `~(arm core arg)` is Hoon's "invoke `arm` on `core` with `arg`" shape. `~(gut by m)` reads `m` with a key and a default; `~(put by m)` returns a new map with one entry replaced.
- `+(x)` is increment-by-one.
- `state(badges <new-map>)` is record-update syntax: a copy of `state` with `badges` swapped.
- `:_  X  Y` is a cell constructor that writes the tail-half first in source. It produces `[Y X]`, which is `NockApp`'s required `[effects state]` return shape.
- `^-  (list effect)` ascribes the type of the cell head that follows.
- `~[X]` is single-element list literal syntax.

The worked example is seven lines of custom Hoon for a one-argument cause (eleven for three-argument). Two of those are pure type declarations — the state field and the cause variant. The rest is the arm body.

The vesl-injected arms stay in place. Domain causes occupy new variants alongside them: the grafted arms (`%settle-register`, `%mint-commit`, etc.) implement primitives the kernel depends on, while your custom cause is app-specific behavior that extends the kernel's repertoire. Both kinds of arm live in the same `?-` switch as separate tag variants, so `%settle-register` and `%issue-badge` are routed by the same match.

The Rust side that calls this poke lives on the [Hull](/build/hull) page. `vesl-core` ships one `build_*_poke` helper per cause (`build_settle_register_poke`, `build_mint_commit_poke`, and so on); each takes typed Rust primitives (`u64`, `&Tip5Hash`, `&[u8]`) and returns a `NounSlab` ready to feed into `app.poke(SystemWire, slab).await`. The helpers exist because the raw noun-construction API has three footguns: long-tag encoding (vesl cause tags exceed the direct-atom limit and need indirect-atom construction), the `Bytes` re-export (so callers don't add `bytes` as a separate Cargo dep just to pass byte slices), and wide `u64` atoms (which need `atom_from_u64` rather than a direct constant). Reach for the helpers; the [Hull](/build/hull) page walks through what each one builds.

## Adding a Domain Peek

`nockup graft inject` wires graft peek handlers into a chain: each returns `~` to defer to the next. Your domain arm goes at the tail. Worked example — a `[%artifact-by-name @t ~]` lookup against an `artifacts=(map @t artifact-meta)` state field:

```hoon
::  inside ++peek, below the vesl peek chain:
?.  ?=([%artifact-by-name @t ~] path)
  ~
=/  got  (~(get by artifacts.state) i.t.path)
?~  got  [~ ~]
``u.got
```

Walking the arm top-to-bottom:

- `?.  ?=([%artifact-by-name @t ~] path)  ~` — if `path` doesn't pattern-match `[%artifact-by-name @t ~]`, return `~` to defer to the next arm. `?=` is type-pattern match; `?.` is if-not.
- `=/  got  (~(get by artifacts.state) i.t.path)` — typed let-binding. `~(get by m)` is the map's get, returning `(unit value)`. `i.t.path` is dotted-axis access: `t.path` is the tail of `path`, `i.t.path` is the head of that tail (i.e., the `@t` name from the path).
- `?~  got  [~ ~]` — if `got` is null (key not in map), return `[~ ~]` ("path recognized, no value").
- `` ``u.got `` — value case. `u.got` unwraps the unit; the double-backtick wraps it as `[~ ~ value]`.

The `(unit (unit *))` return-type convention has three shapes:

- **`~`** — "this path is not for me, let the next arm try." Use on any path your arm doesn't recognize.
- **`[~ ~]`** — "I recognize this path, but there is no value." The standard map-lookup miss.
- **`` ``x ``** — shorthand for `[~ ~ x]`, "I recognize this path and the value is `x`." `x` must be a noun.

Put your arm at the tail of the chain; put a bare `~` fallthrough below it if nothing else matches.

## Replacing a Verification Gate

The composer installs a gate that tip5-hashes the raw payload bytes and checks equality against the registered root. That handles single-leaf commitments. For richer cases — Merkle manifests, signatures, STARK proofs — replace the gate body inside each `%settle-*` arm:

```hoon
=/  hash-gate=verify-gate
  |=  [note-id=@ data=* expected-root=@]
  ^-  ?
  (my-custom-verify note-id data expected-root)
```

Walking the replacement:

- `=/  hash-gate=verify-gate  <expr>` — typed let-binding: declare `hash-gate` of type `verify-gate`. `verify-gate` is `$-([note-id=@ data=* expected-root=@] ?)`, a gate that takes three named atoms and returns a loobean.
- `|=  [note-id=@ data=* expected-root=@]` — gate declaration. `|=  sample  body` defines a function whose argument tuple is `sample`. `*` (in `data=*`) is the any-noun type, so `data` accepts whatever shape the Rust side jammed into the payload.
- `^-  ?` — cast the gate's return type to `?` (Hoon's loobean: `%.y` true, `%.n` false).
- `(my-custom-verify note-id data expected-root)` — function call. Parentheses are how you invoke a gate with arguments.

Two design points the shape encodes:

- `note-id` is bound deliberately. Domain gates can enforce `note-id == deterministic-fn(data)`, closing the pre-commit race.
- `data` arrives as `*` (any noun). Cast it with `;;(<type> data)` before using (e.g., `;;(manifest data)`, `;;(my-intent data)`).

Five named gates ship in `vesl-gates.hoon` and are selectable per-graft via `[graft.gates] gate = "..."` in a manifest: `sig-verify-ed25519`, `sig-verify-schnorr`, `manifest-verify`, `set-membership-verify`, `bounded-value-verify`. To swap a selection mid-project, change the manifest line and re-run `nockup graft inject --apply` — the composer detects manifest drift via the sha256 in each begin-banner and re-injects from the new gate.

## Coordinating Multiple Grafts in One Arm

When a domain arm threads state through more than one graft (increment a counter, write to `kv`, append to the audit log), the hand-coded shape gets repetitive. `vesl-core` ships a small library, `domain-patterns`, with `apply-<graft>` wet-gates that bundle each graft's three-line poke shape into a single line:

```hoon
::  near the top of your app.hoon, alongside the other /+ lines:
/+  *domain-patterns
```

Walking the import:

- `/+` is Hoon's import rune: import a named library from `hoon/lib/`.
- The `*` prefix on the library name pulls all exposed names into the subject (`*domain-patterns` vs. selective import like `/+  domain-patterns`).
- `domain-patterns` is the library — it lives at `hoon/lib/domain-patterns.hoon`.

A worked arm that fans a single domain cause out to three grafts — assuming the cause variant is `[%record-event name=@t]`:

```hoon
::  inside ?-, a %record-event arm that increments a counter,
::  writes to kv, and appends to the audit log:
  %record-event
=^  efx-c  state  (apply-counter [%counter-increment 'events'] state)
=^  efx-k  state  (apply-kv [%kv-set name.u.act 1] state)
=^  efx-l  state  (apply-log [%log-append name.u.act] state)
:_  state
^-  (list effect)
(welp efx-c (welp efx-k efx-l))
```

Walking the arm:

- `%record-event` is the cause tag this arm matches.
- `=^  efx-c  state  (apply-counter ...)` is the threading rune. It evaluates the expression, binds the head of the returned cell to `efx-c` (the counter's effects list), and rebinds `state` to the tail (the post-counter state). The next line sees the updated `state`.
- Each `apply-<graft>` call takes the graft's cause noun and the current `state`, internally routes through the underlying `<graft>-poke` arm, and returns `[effects new-state]`.
- After three `=^` lines, `state` reflects all three graft updates and each `efx-*` binding holds that graft's effect list.
- `(welp efx-c (welp efx-k efx-l))` concatenates the three lists into the single `(list effect)` the arm returns. `welp` is list concatenation; the nested call performs a three-way concat.
- `:_  state` returns `[effects state]` in `NockApp`'s required `[effects new-state]` shape.
- `^-  (list effect)` ascribes the head's type.

Each `apply-<graft>` takes `[cause versioned-state]` and returns `[(list <graft>-effect) versioned-state]`, suitable for direct `=^` binding. See [`hoon/lib/domain-patterns.hoon`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/hoon/lib/domain-patterns.hoon) for the full helper list.

## What's Out of Scope

Hoon as a general-purpose language is documented at [docs.urbit.org/hoon](https://docs.urbit.org/hoon). The patterns above cover almost everything a typical vesl nockapp writes; for deeper Hoon — runes, generics, mark types, the Hoon compiler's type system — go upstream.

## See Also

- [vesl-nockup README — Add your own domain pokes](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#add-your-own-domain-pokes)
- [vesl-nockup README — Add your own peek paths](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#add-your-own-peek-paths)
- [vesl-nockup README — Replace the default verification gate](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#replace-the-default-verification-gate)
