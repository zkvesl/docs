---
title: Shape of a nockapp
description: How a vesl nockapp is structured — Rust driver, hull, grafts, your domain — and how graft-inject composes them into one kernel.
outline: deep
---

# Shape of a nockapp

A nockapp is a compiled Hoon kernel (`out.jam`) booted inside a Rust driver. vesl supplies most of the kernel as a graft library and gives you a CLI that splices those grafts into the source you compile.

## A basic walk through Hoon

Two kinds of message flow between the driver and the kernel:

- **Poke** — a write. The driver sends a tagged command (called a *cause*); the kernel may update state and emits a list of *effects* (events) back. The closest Rust analog is a method on `&mut self`.
- **Peek** — a read. The driver queries kernel state at a path; the kernel returns the value (or `~` for none) without modifying anything. The closest Rust analog is a method on `&self`.

A poke is how you *do* something to the kernel; a peek is how you *ask* it something.

Inside the kernel, one Hoon-specific term:

- **Gate** — a Hoon function. A *verification gate* takes a payload and returns true or false — the kernel uses gates to decide whether to accept something (e.g. "does this proof verify against this Merkle root?").

The rest of this page (and most of the rest of the guide) uses these words constantly.

## Anatomy

```mermaid
flowchart TB
    subgraph rust["Rust"]
        driver["Your driver<br/>(src/main.rs)"]
        core["vesl-core<br/>poke builders<br/>Mint, Guard"]
        hull["Hull<br/>(NockApp wrapper)"]
        driver --> core --> hull
    end
    subgraph hoon["Hoon (compiled into out.jam)"]
        grafts["Grafts<br/>commitment, state,<br/>behavior"]
        domain["Your domain<br/>causes, peeks,<br/>verification gates"]
    end
    hull -->|boot, poke, peek| grafts
    hull -->|boot, poke, peek| domain
```

Your driver (`src/main.rs`) is where you write the application; it imports `vesl-core` for `Mint`, `Guard`, and a poke builder per graft operation, then hands the resulting messages to the hull. The hull is a thin Rust wrapper around nockchain's `NockApp` that boots the compiled kernel and shuttles pokes and peeks across the Rust-to-Hoon boundary. Inside the kernel sit the grafts — Hoon libraries installed into `hoon/lib/` and composed in at the `::  nockup:*` marker comments — and your domain: the cause tags, peek paths, and verification gates you write between those markers. The domain is where your app logic lives — if the grafts are the contract, the domain is the app.

## The hull

The hull is the Rust process that hosts the kernel. It boots the compiled JAM as an embedded `NockApp`, routes inbound requests into pokes and peeks, and surfaces effects back to the caller. The kernel is pure logic; the hull does the I/O — HTTP, the chain client, the filesystem, persistent checkpoints.

In a vesl nockapp, the hull is whatever your `src/main.rs` builds with `nockapp::kernel::boot::setup`. The [Rust driver](/build/rust-driver) page covers the canonical shape; for a thin reference harness, [vesl-core](https://github.com/zkvesl/vesl-core) ships a `hull/` template with kernel boot and `/commit` / `/verify` endpoints — fork it when you want a generic process around a vesl kernel.

## Grafts

Grafts are pre-written Hoon libraries that ship as `<name>-graft.hoon` plus a sibling `<name>-graft.toml` manifest. Each manifest declares blocks of Hoon code keyed to specific marker comments — imports, state fields, cause-union variants, poke arms, peek arms, effect variants. `graft-inject` discovers manifests under `hoon/lib/`, splices their blocks into your `app.hoon` at the markers, and writes the result.

Thirteen grafts ship today across four families plus a placeholder:

- **Commitment** — `settle-graft`, `mint-graft`, `guard-graft`, `forge-graft`. Merkle trees, root registration, payload verification, STARK proving.
- **State** — `kv-graft`, `counter-graft`, `queue-graft`, `rbac-graft`, `registry-graft`. Domain-keyed state primitives.
- **Behavior** — `validate-graft`, `log-graft`, `clock-graft`, `batch-graft`. Pre-flight checks, audit trail, deterministic clock, settlement-flush buffer.
- **Intent (placeholder)** — `intent-graft`. Reserved for multi-party coordination; crashes on invocation until upstream lands.

[Grafts](/build/grafts) covers the family taxonomy with priority bands.

## Your domain

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

Anything that involves network I/O, disk persistence, environment variables, or external APIs stays in the Rust driver. The kernel is pure logic; your domain is the small slice of that logic that's specific to your app.

More on this in [Write the kernel (Hoon)](/build/kernel-hoon), which walks each domain pattern in detail.

## How they compose

```
my-app/
├── Cargo.toml          # path deps + [patch] blocks
├── build.rs            # no-op (hoonc runs in Step 4)
├── src/main.rs         # your driver
├── hoon/
│   ├── app/app.hoon    # marker template + grafts + your domain
│   ├── lib/            # graft libraries (.hoon + .toml manifests)
│   └── common/         # shared libs (zeke.hoon, ztd/, ...)
└── out.jam             # compiled kernel (after hoonc)
```

`graft-inject inject --apply hoon/app/app.hoon` splices graft blocks into the source file at the markers; `hoonc` compiles the result to `out.jam`; the driver loads it via `boot::setup`. The CLI is preview-by-default (the supply-chain guardrail described in [Wire with graft-inject](/build/wire)); nothing lands on disk until you pass `--apply`.

## What's deterministic and why

Nock is [nockchain](https://github.com/nockchain/nockchain)'s combinator calculus, JAM is its serialization format, and the deterministic interpreter that gives a kernel exactly one possible output for any given input is part of the nockchain runtime. STARK proving (used by `forge-graft`) is also nockchain's stack — `vesl-prover.hoon` and the constraint tables under `hoon/dat/` ride on the upstream prover. vesl runs a Hoon kernel inside the nockchain `NockApp` and ships a graft library and a CLI on top: it does not invent determinism, proving, or the noun model.

The vesl-core entry types (`Mint`, `Guard`, the four primitives) are documented at [`crates/vesl-core/src/lib.rs#L1-L40`](https://github.com/zkvesl/vesl-core/blob/11d110d/crates/vesl-core/src/lib.rs#L1-L40); start there if you want to read source.
