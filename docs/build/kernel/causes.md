---
title: Adding a Domain Cause
description: Three Hoon blocks per command — state field, cause variant, ?- arm. Worked example walks a badge-issuer cause that increments a per-subject counter.
outline: deep
---

# Adding a Domain Cause

A domain cause is a poke verb you handle in the kernel: the hull sends a tagged `[%my-action ...]` command; your arm in the `?-` switch reads cause fields, mutates state, and emits effects. Each cause typically touches three Hoon blocks at the `nockup:state`, `nockup:cause`, and `nockup:poke` markers: one state field (if needed), one cause variant, one `?-` arm.

## Anatomy

A cause arm has six structural concerns:

```
domain arm in the ?- switch
├── cause-tag         %issue-badge              matched by ?-
├── reads             subject.u.act             dotted-axis off u.act
├── reads/writes      state(badges <new>)       record update by name
├── (opt) gate-call   (verify-gate arg)         swappable verify-gate (commitment causes)
├── emits             ~[[%badge-issued n]]      a list of effect variants
└── returns           :_  state(...)  ~[...]    cell, tail-first: [(list effect) new-state]
```

Every `?-` arm follows this skeleton. The cause-tag selects the arm; the body reads cause fields off `u.act`, computes the new state, and returns the `[effects state]` cell.

## Worked Example

A **badge issuer** that increments a per-subject counter and emits `%badge-issued`:

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

## More Examples

Three more domain-cause shapes, beyond the badge issuer above.

### Bounded Counter

A single atomic state field with four arms that mutate it. Demonstrates conditional logic with `?:` and bounded decrement (no underflow).

```hoon
::  in versioned-state:
count=@ud
```

```hoon
::  in the cause $% union:
[%inc ~]
[%dec ~]
[%set n=@ud]
[%reset ~]
```

```hoon
::  inside ?-:
  %inc
:_  state(count +(count.state))
~[[%count-changed +(count.state)]]
::
  %dec
=/  new=@ud  ?:((gth count.state 0) (dec count.state) 0)
:_  state(count new)
~[[%count-changed new]]
::
  %set
:_  state(count n.u.act)
~[[%count-changed n.u.act]]
::
  %reset
:_  state(count 0)
~[[%count-changed 0]]
```

`?:  cond  then  else` is if-then-else; `gth` is "greater than"; `+(x)` is increment. The `%dec` arm clamps to zero rather than underflowing.

### Hash-and-Register

A name-keyed registry of content hashes with an entry counter. Demonstrates `(map @t @)` state, the SHA-256 primitive `shax`, and a multi-field state update.

```hoon
::  in versioned-state:
registry=(map @t @)
entries=@ud
```

```hoon
::  in the cause $% union:
[%register-doc name=@t data=@]
```

```hoon
::  inside ?-:
  %register-doc
=/  hash=@  (shax data.u.act)
=/  new-reg  (~(put by registry.state) name.u.act hash)
:_  state(registry new-reg, entries +(entries.state))
~[[%doc-registered name.u.act hash]]
```

`state(registry new-reg, entries +(entries.state))` is record-update by name with two fields at once. The arm hashes the payload, stores it under the supplied name, and bumps the entry counter in the same expression.

### Atomic Transfer

Moves an amount between two account keys with an overdraft guard. Demonstrates validation, conditional rejection emit, and an atomic two-key update.

```hoon
::  in versioned-state:
balances=(map @ @ud)
```

```hoon
::  in the cause $% union:
[%transfer from=@ to=@ amount=@ud]
```

```hoon
::  inside ?-:
  %transfer
=/  src=@ud  (~(gut by balances.state) from.u.act 0)
?:  (lth src amount.u.act)
  :_  state
  ~[[%transfer-rejected from.u.act 'insufficient']]
=/  dst=@ud  (~(gut by balances.state) to.u.act 0)
=/  b1  (~(put by balances.state) from.u.act (sub src amount.u.act))
=/  b2  (~(put by b1) to.u.act (add dst amount.u.act))
:_  state(balances b2)
~[[%transferred from.u.act to.u.act amount.u.act]]
```

The early `?:` returns `:_  state  ~[<rejection>]` (state unchanged, one rejection effect) when the source balance falls below the requested amount. The success path threads two `~(put by ...)` calls to build the updated balance map, then returns the final state with one `%transferred` effect.

## Conventions & Composing

### Arms share the ?- switch

The vesl-injected arms stay in place. Domain causes occupy new variants alongside them: the grafted arms (`%settle-register`, `%mint-commit`, etc.) implement primitives the kernel depends on, while your custom cause is app-specific behavior that extends the kernel's repertoire. Both kinds of arm live in the same `?-` switch as separate tag variants, so `%settle-register` and `%issue-badge` are routed by the same match.

This is forced by Hoon's type system: `?-` is an exhaustive switch over a single tagged union, and `cause` is exactly one such union, so every variant has to be an arm of the same switch. The Rust analogue is `match e: MyEnum`, which can't be split into two `match` expressions over disjoint subsets of variants because `e` has one type and the compiler wants one exhaustive match.

### Calling From Rust

The Rust side that calls this poke lives on the [Hull](/build/hull) page. `vesl-core` ships one `build_*_poke` helper per cause (`build_settle_register_poke`, `build_mint_commit_poke`, and so on); each takes typed Rust primitives (`u64`, `&Tip5Hash`, `&[u8]`) and returns a `NounSlab` ready to feed into `app.poke(SystemWire, slab).await`. The helpers exist because the raw noun-construction API has three footguns: long-tag encoding (vesl cause tags exceed the direct-atom limit and need indirect-atom construction), the `Bytes` re-export (so callers don't add `bytes` as a separate Cargo dep just to pass byte slices), and wide `u64` atoms (which need `atom_from_u64` rather than a direct constant). Reach for the helpers; the [Hull](/build/hull) page walks through what each one builds.

### Denying a Cause Without Crashing

When an arm needs to reject user-driven input (insufficient balance, missing permission, malformed payload), return a typed `[%<name>-error reason=@t]` effect with state unchanged — the `%transfer` arm above is the canonical shape. The kernel surfaces an `Accepted` outcome carrying the rejection effect, and the Rust hull pattern-matches on the head tag.

Bare `?>  <test>` is the wrong shape for user-input rejection. A failing `?>` raises an `Exit` mote, which the kernel propagates as a crash. `app.poke(...)` then returns `Ok(vec![])` with no effects rather than a typed `PokeOutcome::Rejected`, and the hull can't tell denial from graft error from runtime panic. Use `?>` only for invariants that hold by construction; reach for an explicit `?:` or `?.` branch when the test depends on caller input.

settle-graft wraps fallible Hoon in `(mule |.(<expr>))` to catch any `Exit` and emit `[%settle-error msg=@t]` — the typed-rejection shape, routed through the crash-catcher. Use that pattern only when the failing code can't be refactored to branch cleanly; the explicit-branch form is the default.

::: info See Also

- [vesl-core → Committing Over Graft State](/reference/vesl-core#committing-over-graft-state) — the canonical pattern for a domain cause that builds a Merkle root over another graft's state (e.g. `%snapshot-root` arms that commit a tip5 root over `kv-graft` or `counter-graft` state in one poke).
- [Kernel → Coordinating Multiple Grafts in One Arm](/build/kernel/multi-graft) — threading state through several graft pokes from one domain cause via `apply-<graft>` helpers.
- [Hull → Peek-Then-Poke Gating](/build/hull#peek-then-poke-gating) — orchestrator-side admission pattern that pairs naturally with a domain cause.

:::
