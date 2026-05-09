---
title: Write the kernel (Hoon)
description: The three Hoon patterns you write between the markers — domain causes, peek paths, and verification-gate replacement.
outline: deep
---

# Write the kernel (Hoon)

Most of your kernel is composed for you by `graft-inject`. You write a small amount of Hoon between the markers — typically: one or two custom causes, the `?-` arms that handle them, optional peek paths, and (sometimes) a replacement verification gate. This page covers those three patterns. Hoon as a general-purpose language is documented at [docs.urbit.org/hoon](https://docs.urbit.org/hoon).

## When you write Hoon

Three places, in order of how often you'll touch them:

1. **A new domain cause** — the kernel handles `[%my-action ...]` by adding a state field, a cause variant, and a `?-` arm. Most apps live here.
2. **A custom peek path** — the kernel answers `[%my-query ...]` by walking your state and returning a `(unit (unit *))`.
3. **A replacement verification gate** — when the default hash-comparison gate isn't what you need (Merkle manifests, signatures, STARK proofs).

## Adding a domain cause

Three Hoon blocks per command: one state field (if needed), one cause variant, one arm. Worked example — a **badge issuer** that increments a per-subject counter and emits `%badge-issued`:

```hoon
::  in versioned-state, after `settle=settle-state`:
badges=(map @ud @ud)
```

```hoon
::  in the cause $% union, alongside settle-cause:
[%issue-badge subject=@ud]
```

```hoon
::  inside ?-, alongside the vesl arms:
  %issue-badge
=/  n=@ud  +((~(gut by badges.state) subject.u.act 0))
:_  state(badges (~(put by badges.state) subject.u.act n))
^-  (list effect)
~[[%badge-issued subject.u.act n]]
```

Seven lines of custom Hoon for a 1-arg cause; eleven for 3-arg. Two of those (state field + cause variant) are pure type declarations; the rest is the arm body.

The `:_ state(...)` / `^- (list effect)` / `~[[...]]` shape is `NockApp`'s required `[effects state]` return — the same in any nockapp, graft or no graft. The vesl arms stay put; you're adding arms, not replacing them.

The Rust side that pokes this cause lives on [The Rust driver](/build/rust-driver), including the three rules `build_*_poke` helpers hide for you (long tags, `Bytes` re-export, wide `u64` values via `atom_from_u64`).

## Adding a domain peek

`graft-inject` wires graft peek handlers into a chain: each returns `~` to defer to the next. Your domain arm goes at the tail. Worked example — a `[%artifact-by-name @t ~]` lookup against an `artifacts=(map @t artifact-meta)` state field:

```hoon
::  inside ++peek, below the vesl peek chain:
?.  ?=([%artifact-by-name @t ~] path)
  ~
=/  got  (~(get by artifacts.state) i.t.path)
?~  got  [~ ~]
``u.got
```

The `(unit (unit *))` return-type convention has three shapes:

- **`~`** — "this path is not for me, let the next arm try." Use on any path your arm doesn't recognize.
- **`[~ ~]`** — "I recognize this path, but there is no value." The standard map-lookup miss.
- **`` ``x ``** — shorthand for `[~ ~ x]`, "I recognize this path and the value is `x`." `x` must be a noun.

Put your arm at the tail of the chain; put a bare `~` fallthrough below it if nothing else matches.

## Replacing a verification gate

The composer installs a gate that tip5-hashes the raw payload bytes and checks equality against the registered root. That handles single-leaf commitments. For richer cases — Merkle manifests, signatures, STARK proofs — replace the gate body inside each `%settle-*` arm:

```hoon
=/  hash-gate=verify-gate
  |=  [note-id=@ data=* expected-root=@]
  ^-  ?
  (my-custom-verify note-id data expected-root)
```

`verify-gate` is `$-([note-id=@ data=* expected-root=@] ?)`. `note-id` is bound so domain gates can enforce `note-id == deterministic-fn(data)`, closing the pre-commit race. `data` is whatever your Rust side jammed into the `payload` atom; your gate casts it (`;;(manifest data)`, `;;(my-intent data)`, etc.) and returns a loobean.

Five named gates ship in `vesl-gates.hoon` and are selectable per-graft via `[graft.gates] gate = "..."` in a manifest: `sig-verify-ed25519`, `sig-verify-schnorr`, `manifest-verify`, `set-membership-verify`, `bounded-value-verify`. To swap a selection mid-project, change the manifest line and re-run `graft-inject inject --apply` — the composer detects manifest drift via the sha256 in each begin-banner and re-injects from the new gate.

## Coordinating multiple grafts in one arm

When a domain arm threads state through more than one graft (increment a counter, write to `kv`, append to the audit log), the hand-coded shape gets repetitive. `vesl-core` ships a small library, `domain-patterns`, with `apply-<graft>` wet-gates that bundle each graft's three-line poke shape into a single line:

```hoon
::  near the top of your app.hoon, alongside the other /+ lines:
/+  *domain-patterns
```

Each `apply-<graft>` takes the graft's cause + your `versioned-state`, calls the underlying `<graft>-poke`, and returns `[(list <graft>-effect) versioned-state]` suitable for `=^` binding. See [`hoon/lib/domain-patterns.hoon`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/hoon/lib/domain-patterns.hoon) for the helper list.

## What's out of scope

Hoon as a general-purpose language is documented at [docs.urbit.org/hoon](https://docs.urbit.org/hoon). The patterns above cover almost everything a typical vesl nockapp writes; for deeper Hoon — runes, generics, mark types, the Hoon compiler's type system — go upstream.

## See also

- [vesl-nockup README — Add your own domain pokes](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#add-your-own-domain-pokes)
- [vesl-nockup README — Add your own peek paths](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#add-your-own-peek-paths)
- [vesl-nockup README — Replace the default verification gate](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#replace-the-default-verification-gate)
