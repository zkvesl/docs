---
title: Kernel
description: The three Hoon patterns you write between the markers — domain causes, peek paths, and verification-gate replacement.
outline: deep
---

# Kernel

Most of your kernel is composed for you by `nockup graft`: commitment, state, and behavior primitives ship as graft libraries that drop into any nockapp. The behavior unique to your app's domain is the Hoon you write between the markers — the cause that says "register an artifact" or "issue a badge," the state field that tracks it, the `?-` arm that wires the primitives together. Generic graft libraries are built for reuse across many apps; the domain-specific layer stays in your kernel so each app can shape it independently.

Typically the amount is small: one or two custom causes, the `?-` arms that handle them, optional peek paths, and (sometimes) a replacement verification gate. The subpages cover those three patterns.

::: info Heads up

This is a basic Hoon-and-kernel guide: enough syntax and patterns to write custom domain logic in a vesl kernel. For a deeper Hoon education, work through [Hoon School](https://docs.urbit.org/courses/hoon-school/). The [Hoon Cheatsheet](#hoon-cheatsheet) below is a quick reference for the runes, auras, and stdlib gates used in the worked examples.

:::

## Hoon Cheatsheet

A skim-able reference for the syntax used throughout these pages. For a fuller introduction, see [Hoon School](https://docs.urbit.org/courses/hoon-school/).

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
| **Mote** | An error class — a short `@tas` printed in stderr traces (e.g. `mote=Exit`, `mote=Fail`). Soft-cast (`;;`) and assertion (`?>`) failures raise `Exit`; `mule` catches them as `%.n`. |
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
| <code>&#96;</code> | Unit-wrap shorthand. `&#96;value` is `[~ value]`. Used to return `(unit *)` succinctly. |
| <code>&#96;&#96;</code> | Twice-unit-wrap. `&#96;&#96;value` is `[~ ~ value]`. Peek arms return `(unit (unit *))`. |
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
| `;;` | Soft-cast / mold-check. `;;(type expr)` re-checks `expr` against `type` and exits on a shape mismatch. The standard guard for `*`-typed inputs. |
| `^*` | Default value of a type. |
| `~(arm core arg)` | Method-call shape: invoke `arm` on `core` with sample `arg`. |
| `|.` | Trap — a zero-argument core. `|.  expr` is a thunk evaluated by its `$` arm. `mule` wraps a trap to catch crashes. |
| `%-` | Function call (slam). `(gate arg)` is the irregular form. |
| `%=` | Record update by name. `a(b c)` is the irregular form. |
| `:_` | Cell constructor. `:_  X  Y` is `[Y X]` — writes the tail-half first. |
| `+(x)` | Increment. |
| `~[a b c]` | List literal. |
| `$%` | Tagged-union type constructor. Closes with `==`. |
| `$:` | Record-type constructor. Closes with `==`. |
| `+$` | Type alias declaration. |
| `$-` | Gate-type constructor. `$-(sample return)` is the type of a gate from `sample` to `return`. `verify-gate` is `$-([note-id=@ data=* expected-root=@] ?)`. |
| `++` | Arm declaration in a core. |

### Stdlib Gates

Hoon stdlib gates the worked examples and reference pages use. The `by` door operates on maps; `in` operates on sets.

| Gate | Call | Behavior |
|---|---|---|
| `wyt` | `~(wyt by m)` / `~(wyt in s)` | Cardinality — count of entries in a map or members in a set. |
| `gut` | `(~(gut by m) key fallback)` | Get-or-default. Returns `m[key]` if present, else `fallback`. |
| `has` | `(~(has by m) key)` / `(~(has in s) elem)` | Membership test. Returns `?`. |
| `put` | `(~(put by m) key value)` / `(~(put in s) elem)` | Insert (or overwrite). |
| `scag` | `(scag n list)` | List take — first `n` elements. |
| `slag` | `(slag n list)` | List drop — elements after position `n`. |
| `turn` | `(turn list f)` | List map — apply `f` to each element. |
| `lent` | `(lent list)` | List length. |
| `welp` | `(welp a b)` | List concatenate (type-tolerant). |
| `weld` | `(weld a b)` | List concatenate (stricter — same element type). |
| `shax` | `(shax atom)` | SHA-256 hash → atom. |
| `mule` | `(mule |. expr)` | Run a trap; `[%.y val]` on success or `[%.n trace]` on crash. The crash-catcher. |

## Writing Hoon for vesl

Three places where you'll write Hoon, in order of how often you'll touch them.

### A New Domain Cause

The kernel handles `[%my-action ...]` by adding a state field, a cause variant, and a `?-` arm. Most apps live here. Walked on [Adding a Domain Cause](/build/kernel/causes).

### A Custom Peek Path

The kernel answers `[%my-query ...]` by walking your state and returning a `(unit (unit *))`. Walked on [Adding a Domain Peek](/build/kernel/peeks).

### A Replacement Verification Gate

Swap the default hash-comparison gate when you need Merkle manifests, signatures, or STARK proofs. Walked on [Replacing a Verification Gate](/build/kernel/gates).

Each `?-` arm has the same shape:

```
domain arm in the ?- switch
├── cause-tag         %issue-badge              matched by ?-
├── reads             subject.u.act             dotted-axis off u.act
├── reads/writes      state(badges <new>)       record update by name
├── (opt) gate-call   (verify-gate arg)         swappable verify-gate (commitment causes)
├── emits             ~[[%badge-issued n]]      a list of effect variants
└── returns           :_  state(...)  ~[...]    cell, tail-first: [(list effect) new-state]
```

For domain arms that thread state through more than one graft at once, [Coordinating Multiple Grafts in One Arm](/build/kernel/multi-graft) walks the `apply-<graft>` wet-gate pattern from `domain-patterns`.

## How a Poke Updates State

A nockapp kernel handles each poke as a pure transformation: `(cause, state)` in, `[effects new-state]` out. The whole `versioned-state` value is the kernel's memory. Pokes receive it by value, compute the next version, and return it as the tail-half of an `[effects new-state]` cell. The runtime takes that returned state and uses it for the next poke; subsequent pokes see the post-update value because the runtime holds the "current" pointer for you.

`versioned-state` is the type your kernel declares at the `nockup:state` marker — a tagged record listing every field the kernel knows about. Each graft adds the fields it owns there; your domain appends its own at the bottom.

In practice, "modifying" state means constructing a copy with the fields you want different. Hoon's `state(field new-value)` record-update syntax is the shorthand: a copy of `state` with one field replaced. It plays the role of `State { field: new-value, ..state }` in Rust. The modifications go at the start of the expression and the base goes inside the parens.

## Settle-Graft

`settle-graft` is the lowest-priority graft in the commitment family, so its arms top the `?-` (exhaustive switch) block in dispatch order.

| Graft | Priority |
|---|---|
| `settle` | 10 |
| `mint` | 20 |
| `guard` | 30 |
| `forge` | 40 |

Of the four it owns the fullest lifecycle: register a hull-id to a root (`%settle-register`), verify each payload through a swappable gate (`%settle-verify`), and record settled notes for replay protection (`%settle-note`). The other three are smaller-scope tiers (`mint-graft` registers a root with no verification, `guard-graft` adds a hash-leaf check, `forge-graft` generates a STARK proof over the hashing). settle is also the only graft whose poke body declares the gate splice point that lets a manifest swap the default verification gate via `[graft.gates]`; [Replacing a Verification Gate](/build/kernel/gates) walks the swap.

Each arm has its own success effect:

- **`%settle-register`** emits `[%settle-registered hull root]`. One-shot bind of a hull-id to a Merkle root. No gate is run. The `registered=(map @ @)` field is mutated; re-registering the same hull is rejected.
- **`%settle-note`** emits `[%settle-noted note=[id hull root [%settled ~]]]`. Verifies the payload through the active gate, then records the note-id in the `settled` set for replay protection. State mutates (`settled`, `settle-count`). When `settle-count` hits the per-epoch cap, the arm also emits `[%settle-epoch-rotated old-epoch new-epoch]` and rotates the active epoch before recording the note.
- **`%settle-verify`** emits `[%settle-verified ok=?]`. Soft preflight; leaves state unchanged. Runs the same verification path as `%settle-note` and reports whether a `%settle-note` with the same payload would succeed.

All three convert failure into `[%settle-error msg=@t]` rather than crashing.

## What's Out of Scope

Hoon as a general-purpose language is documented at [docs.urbit.org/hoon](https://docs.urbit.org/hoon). The patterns covered here and on the subpages handle almost everything a typical vesl nockapp writes; for deeper Hoon — runes, generics, mark types, the Hoon compiler's type system — go upstream.

::: info See Also

- [vesl-nockup README — Add your own domain pokes](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#add-your-own-domain-pokes) — cause/state/arm walkthrough.
- [vesl-nockup README — Add your own peek paths](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#add-your-own-peek-paths) — domain peek-arm walkthrough.
- [vesl-nockup README — Replace the default verification gate](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#replace-the-default-verification-gate) — gate-replacement walkthrough.

:::
