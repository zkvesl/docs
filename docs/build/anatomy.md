---
title: NockApp Anatomy
description: How a vesl nockapp is structured — hull, grafts, your domain — and how nockup graft composes them into one kernel.
outline: deep
---

# NockApp Anatomy

A nockapp is a compiled Hoon kernel (`out.jam`) booted inside a Rust hull. vesl supplies most of the kernel as a graft library and gives you a CLI that splices those grafts into the source you compile.

::: info Before We Start

Two kinds of message flow between the hull and the kernel:

- **Poke** — a write. The hull sends a tagged command (called a *cause*); the kernel may update state and emits a list of *effects* (events) back. The closest Rust analog is a method on `&mut self`.
- **Peek** — a read. The hull queries kernel state at a path; the kernel returns the value (or `~` for none) without modifying anything. The closest Rust analog is a method on `&self`.

A poke is how you *do* something to the kernel; a peek is how you *ask* it something.

Inside the kernel, one Hoon-specific term:

- **Gate** — a Hoon function. A *verification gate* takes a payload and returns true or false — the kernel uses gates to decide whether to accept something (e.g. "does this proof verify against this Merkle root?").

The rest of this page (and most of the rest of the guide) uses these words constantly.

:::

## Anatomy

```d2
direction: down

rust: Rust {
  hull: "Hull\n(your src/main.rs)"
  core: "vesl-core\npoke builders, Mint, Guard"
  hull -> core
}

hoon: "Hoon (compiled into out.jam)" {
  grafts: "Grafts\ncommitment, state, behavior"
  domain: "Your domain\ncauses, peeks, verification gates"
}

rust.hull -> hoon: "boot, poke, peek"
```

Your hull (`src/main.rs`) is the Rust binary that hosts the kernel. It imports `vesl-core` for `Mint`, `Guard`, and a poke builder per graft operation, boots the compiled kernel via `nockapp::kernel::boot::setup`, and shuttles pokes and peeks across the Rust-to-Hoon boundary. Inside the kernel sit the grafts — Hoon libraries installed into `hoon/lib/` and composed in at the `::  nockup:*` marker comments — and your domain: the cause tags, peek paths, and verification gates you write between those markers. The domain is where your app logic lives — if the grafts are the contract, the domain is the app.

## The Hull

The hull is the Rust process that hosts the kernel. It boots the compiled JAM as an embedded `NockApp`, routes inbound requests into pokes and peeks, and surfaces effects back to the caller. The kernel is pure logic; the hull does the I/O — HTTP, the chain client, the filesystem, persistent checkpoints.

In a vesl nockapp, the hull is whatever your `src/main.rs` builds with `nockapp::kernel::boot::setup`. The [Hull](/build/hull) page covers the canonical shape; for a thin reference harness, [vesl-core](https://github.com/zkvesl/vesl-core) ships a `hull/` template with kernel boot and `/commit` / `/verify` endpoints — fork it when you want a generic process around a vesl kernel.

## Grafts

Grafts are pre-written Hoon libraries that ship as `<name>-graft.hoon` plus a sibling `<name>-graft.toml` manifest. Each manifest declares blocks of Hoon code keyed to specific marker comments — imports, state fields, cause-union variants, poke arms, peek arms, effect variants. `nockup graft inject` discovers manifests under `hoon/lib/`, splices their blocks into your `app.hoon` at the markers, and writes the result.

Fourteen grafts ship today across four families plus a placeholder. [Grafts](/build/grafts/#the-5-family-graft-taxonomy) covers the canonical taxonomy: member grafts, priority bands, and family roles.

## Your Domain

Concretely, your domain is the application-specific Hoon you write into the marker slots — usually dozens of lines, not hundreds. Imagine a simple licensing app: a publisher commits to a Merkle root over a set of license IDs, and buyers later prove they hold one. The grafts do the cryptography (Merkle math, root registration, proof verification); your domain is what's left. Each piece lands at a specific marker in `app.hoon`:

```hoon
::  nockup:cause — declare a new poke variant
[%issue-license id=@ buyer=@]

::  nockup:domain-effect — declare what the kernel emits in response
[%license-issued id=@ buyer=@]

::  nockup:poke — handle the cause, mutate state, emit the effect
%issue-license
  :_  state(licenses (~(put by licenses.state) buyer.u.act id.u.act))
  ~[[%license-issued id.u.act buyer.u.act]]

::  nockup:peek — return licenses for a buyer
[%licenses-of buyer=@ ~]  ``(~(get by licenses.state) buyer)
```

You can also swap the default hash-comparison verification gate for a signature check or STARK gate by setting `[graft.gates]` in a graft manifest — that lives in a `.toml` rather than at a marker.

Anything that involves network I/O, disk persistence, environment variables, or external APIs stays in the hull. The kernel is pure logic; your domain is the small slice of that logic that's specific to your app.

More on this in [Kernel](/build/kernel/), which walks each domain pattern in detail.

## Manifest Anatomy

A graft's manifest catalogs metadata, types, and the code blocks `nockup graft inject` splices into your kernel:

```
manifest: <name>-graft.toml
├── [graft]                metadata: name · version · priority · after
├── [graft.types]          cause-type name · effect-type name
└── [graft.blocks.*]       Hoon code keyed to kernel markers
    ├── imports            → nockup:imports
    ├── state              → nockup:state
    ├── cause              → nockup:cause
    ├── peek               → nockup:peek
    ├── poke               → nockup:poke           (≥1 arms; one per cause-tag)
    ├── poke-prelude       → nockup:poke-prelude   (validate-graft only today)
    └── poke-postlude      → nockup:poke-postlude  (no shipped graft populates yet)
```

Each `[graft.blocks.*]` table carries a `sentinel` (a documentation marker) and a `body` (the Hoon to splice). The next section catalogs where each block lands in `app.hoon`.

## Anchor Markers

`templates/app.hoon` ships with ten `::  nockup:*` anchor comments at fixed structural points. They mark the slots where `nockup graft inject` splices Hoon: seven are **content markers** that hold per-graft bodies; three are **codegen markers** the composer writes itself.

Content markers — per-graft contributions stack here:

| Marker | Purpose |
|---|---|
| `nockup:imports` | `/+` and `/=` lines that pull each graft's Hoon library into scope. |
| `nockup:state` | Per-graft state fragments inside `+$ versioned-state`. Each graft adds the field that holds its state. |
| `nockup:cause` | Cause-tag variants each graft adds to the `+$ cause $%` union (one variant per poke verb the graft handles). |
| `nockup:peek` | `++ peek` arms each graft contributes. Arms join into a single peek chain across grafts. |
| `nockup:poke-prelude` | Pre-flight checks that run before the cause switch. `validate-graft`'s prelude short-circuits rule-violating causes here. |
| `nockup:poke` | The `?-` arms each graft adds to the cause switch — one arm per cause-tag the graft handles. |
| `nockup:poke-postlude` | Post-`?-` slot where a graft can rebind the switch's `[(list effect) state]` result before the gate returns. No shipped graft populates this marker today; the slot, schema, and integration tests landed in advance of the first consumer. |

Codegen markers — the composer rewrites these on every `--apply`:

| Marker | Purpose |
|---|---|
| `nockup:domain-effect` | Your app's effect variants live below this marker as `+$ domain-effect $%(...)`. The composer reads them and merges them with each graft's effects in `nockup:effect-union`. |
| `nockup:effect-union` | Below this marker, the composer writes the typed `+$ effect $%(...)` union welding your `domain-effect` variants with each graft's effect type. The kernel's `++ poke` arm returns values of this union. |
| `nockup:load-defaults` | Below this marker, the composer writes a state-shape migration overlay used inside `++ load`. Resumed snapshots get default values at any state axes the new kernel added since the snapshot was taken. |

Multiple grafts can contribute to the same content marker; their bodies stack at that slot. Composition controls (how to narrow the graft set, what `--apply` does) live in [Inject](/build/grafts/inject); the full manifest schema is in [Manifest Schema](/build/grafts/manifest-schema).

::: tip Composing across grafts
When a domain cause needs to commit a Merkle root over another graft's state — the `%snapshot-root` shape, common in Profile G/J compositions — see [vesl-core → Committing Over Graft State](/reference/vesl-core#committing-over-graft-state). When one cause needs to drive multiple grafts in one arm, see [Kernel → Coordinating Multiple Grafts in One Arm](/build/kernel/multi-graft).
:::

## How They Compose

```
my-app/
├── Cargo.toml          # path deps + [patch] blocks
├── build.rs            # runs nockup graft doctor each build
├── src/main.rs         # your hull
├── hoon/
│   ├── app/app.hoon    # marker template + grafts + your domain
│   ├── lib/            # graft libraries (.hoon + .toml manifests)
│   └── common/         # shared libs (zeke.hoon, ztd/, ...)
└── out.jam             # compiled kernel (after hoonc)
```

`nockup graft inject --apply hoon/app/app.hoon` splices graft blocks into the source file at the markers; `hoonc` compiles the result to `out.jam`; the hull loads it via `boot::setup`. The CLI is preview-by-default (the supply-chain guardrail described in [Inject](/build/grafts/inject)); nothing lands on disk until you pass `--apply`.

## What's Deterministic and Why

Nock is [nockchain](https://github.com/nockchain/nockchain)'s combinator calculus, JAM is its serialization format, and the deterministic interpreter that gives a kernel exactly one possible output for any given input is part of the nockchain runtime. STARK proving (used by `forge-graft`) is also nockchain's stack — `vesl-prover.hoon` and the constraint tables under `hoon/dat/` ride on the upstream prover. vesl runs a Hoon kernel inside the nockchain `NockApp` and ships a graft library and a CLI on top: it does not invent determinism, proving, or the noun model.

The vesl-core entry types (`Mint`, `Guard`, the four primitives) are documented at [`crates/vesl-core/src/lib.rs#L1-L40`](https://github.com/zkvesl/vesl-core/blob/11d110d/crates/vesl-core/src/lib.rs#L1-L40); start there if you want to read source.
