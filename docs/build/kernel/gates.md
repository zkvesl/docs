---
title: Replacing a Verification Gate
description: Replace the default hash-comparison gate inside each %settle-* arm with a Merkle, signature, or STARK gate. Five named gates ship in vesl-gates.hoon.
outline: deep
---

# Replacing a Verification Gate

**After reading:** you'll swap the default hash gate for a signature, Merkle, set-membership, or bounded-value check via one `[graft.gates]` line — no Hoon edits.

A verification gate is the boolean check inside each `%settle-*` arm that decides whether a payload is acceptable. The default ships from `nockup graft inject` and tip5-hashes the payload bytes for equality against the registered root; richer checks (Merkle manifests, signatures, STARK proofs) need a replacement gate body.

## Anatomy

A gate body has six structural concerns:

```
verify-gate (inline replacement)
├── declaration     =/  gate=verify-gate                      let-binding with type
├── signature       |=  [note-id=@ data=* expected-root=@]    three named atoms
├── return cast     ^-  ?                                     loobean (%.y / %.n)
├── safe extract    ;;(<type> data) in (mule |.<body>)        crash-safe data extraction
├── (opt) binding   =((hash-leaf <key>) expected-root)        tie payload to registered key
└── verify          verify-chunk / signature / range / ..     actual verification logic
```

Every gate body follows this skeleton. The signature (`|=` plus the return cast) is fixed by the `verify-gate` type; everything else varies. The crash-safety idiom is `;;`-inside-`mule`: the soft-cast would crash on malformed `data`, and wrapping in `mule` converts that crash to `%.n`.

## Worked Example

Replace the gate body inside each `%settle-*` arm:

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

## More Examples

Three gate shapes from the named-gate catalog, simplified to show the binding pattern.

### Set Membership

The payload is `[elem proof]`; the gate verifies `elem`'s Merkle path resolves to the registered root. Used for allowlists, voter rolls, blocklists.

```hoon
::  replacement gate body in a %settle-* arm:
=/  set-gate=verify-gate
  |=  [note-id=@ data=* expected-root=@]
  ^-  ?
  =/  attempt
    %-  mule  |.
    =/  p=[elem=@ proof=(list [hash=@ side=?])]
      ;;([elem=@ proof=(list [hash=@ side=?])] data)
    (verify-chunk elem.p proof.p expected-root)
  ?:  ?=(%| -.attempt)  %.n
  p.attempt
```

`;;(<type> data)` is a soft-cast: it stamps `data` (a raw `*` noun) with the named type, crashing the gate if the shape doesn't match. The body is wrapped in `(mule |.<body>)` so a malformed `data` returns `%.n` rather than crashing the kernel.

### Bounded Value

The payload is `[value bounds proof]`; the gate confirms `value` lies in `[lo, hi]` AND its Merkle path checks against the root. Used for age gates, balance brackets, score windows.

```hoon
::  replacement gate body:
=/  range-gate=verify-gate
  |=  [note-id=@ data=* expected-root=@]
  ^-  ?
  =/  attempt
    %-  mule  |.
    =/  p=[value=@ bounds=[lo=@ hi=@] proof=(list [hash=@ side=?])]
      ;;([value=@ bounds=[lo=@ hi=@] proof=(list [hash=@ side=?])] data)
    ?&  (gte value.p lo.bounds.p)
        (lte value.p hi.bounds.p)
        (verify-chunk (jam [value.p bounds.p]) proof.p expected-root)
    ==
  ?:  ?=(%| -.attempt)  %.n
  p.attempt
```

`?&` is short-circuiting logical AND. The leaf hashed for the Merkle check is `(jam [value bounds])`. Value and bounds are committed together so a caller cannot substitute their own range over an attested value.

### Signature

The payload is `[data sig pubkey]`; the gate checks the signature is valid AND the registered root commits to that pubkey. Used for off-chain attestations, signed timestamps.

```hoon
::  replacement gate body:
=/  sig-gate=verify-gate
  |=  [note-id=@ data=* expected-root=@]
  ^-  ?
  =/  attempt
    %-  mule  |.
    =/  p=[data=@ sig=@ pubkey=@]
      ;;([data=@ sig=@ pubkey=@] data)
    ?&  =((hash-leaf pubkey.p) expected-root)
        (veri:ed:crypto sig.p data.p pubkey.p)
    ==
  ?:  ?=(%| -.attempt)  %.n
  p.attempt
```

The binding `expected-root == hash-leaf(pubkey)` is what stops the gate from degenerating into a pure oracle. The registered root IS the public key's leaf-hash, so the gate enforces that the signature came from that specific registered key.

## Conventions & Composing

### Selecting via manifest

Five named gates ship in `vesl-gates.hoon` and are selectable per-graft via `[graft.gates] gate = "..."` in a manifest: `sig-verify-ed25519`, `sig-verify-schnorr`, `manifest-verify`, `set-membership-verify`, `bounded-value-verify`. The composer splices the selected gate into each `%settle-*` arm at inject time, replacing the default hash-comparison body. To swap a selection mid-project, change the manifest line and re-run `nockup graft inject --apply`; the composer detects manifest drift via the sha256 in each begin-banner and re-injects from the new gate.

### Where gates run

The gate fires inside `%settle-note` (active verification) and `%settle-verify` (side-effect-free preflight). `%settle-register` binds a hull-id to a root without invoking a gate.

::: info Stuck?

Something broken? The breakage is probably already in [Common Pitfalls](/troubleshooting/common-pitfalls).

:::
