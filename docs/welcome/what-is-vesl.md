---
title: What is vesl
description: Overview of vesl — what it ships, where it sits relative to nockchain, and where to start.
outline: deep
---

# What is vesl

vesl is a Rust SDK and Hoon graft library for building verifiable apps on Nockchain. You write a [Rust driver](/build/rust-driver) and a small [Hoon kernel](/build/kernel-hoon); vesl supplies the commitment, state, and verification primitives in between, plus a [CLI](/reference/cli) that composes them into your kernel.

```mermaid
flowchart LR
    driver["Rust driver"]
    core["vesl-core<br/>(Mint, Guard, builders)"]
    kernel["Kernel (Hoon)<br/>composed grafts + your domain"]
    effects["effects"]
    driver --> core --> kernel
    kernel --> effects --> driver
```

## Concepts

Definitions for terms used through the rest of the guide. The [glossary](/reference/glossary) lists them alphabetically for quick reference.

**Nock** — Nockchain's combinator calculus; the deterministic primitive that gives a computation exactly one output for any given input.

**Hoon** — Nockchain's source language. Compiles to Nock; kernel files are Hoon.

**Kernel** — your compiled Hoon (`out.jam`). Pure logic, no I/O — receives pokes, returns effects plus new state, serves peeks.

**NockApp** — Nockchain's Rust harness type. Owns a kernel's boot lifecycle and effect broadcast; your driver wraps a `NockApp`.

**Driver / hull** — the Rust process that hosts the kernel (your `src/main.rs`). Mediates I/O between the outside world and the kernel; sometimes called *hull*. See [The Rust driver](/build/rust-driver).

**Graft** — a Hoon library plus a sibling TOML manifest that drops cleanly into your kernel. Thirteen ship today; `graft-inject` composes them. See [Install grafts](/build/install-grafts).

**`graft-inject`** — the CLI that discovers grafts under `hoon/lib/`, splices their declared blocks into your kernel at marker comments, and writes the result. Preview by default. See the [CLI reference](/reference/cli).

**Manifest** — a graft's `<name>-graft.toml`. Declares which Hoon blocks land at which markers, which gates the graft uses, and metadata. See [Graft manifest schema](/reference/graft-manifest).

**`vesl-core`** — vesl's Rust SDK crate: `Mint`, `Guard`, builder helpers, and poke constructors for every shipped graft. See [vesl-core orientation](/going-deeper/vesl-core).

**`vesl-nockup`** — the recommended development environment for building nockapps; the subject of this guide. Ships the templates, `graft-inject`, and the example apps.

**`nockup`** — Nockchain's developer CLI. `vesl-nockup` will eventually ship as a package within it.

**nockchain** — the upstream runtime. Provides Nock, Hoon, the `NockApp` harness, JAM, and tip5. vesl runs on top.

**`vesl.toml`** — runtime config: settlement modes, key derivation, chain settings. See [vesl.toml reference](/reference/vesl-toml).

**JAM** — Nockchain's noun serialization format. `out.jam` is the jammed compiled kernel your driver loads.

## What you get

### A Rust SDK (`vesl-core`)

`Mint` and `Guard` for Merkle commitment math, plus `build_*_poke` helpers for every shipped graft cause tag. See [vesl-core](/going-deeper/vesl-core) for an orientation; the canonical API lives in rustdoc.

### A Hoon graft library

Thirteen shipped grafts across four families, plus a family-5 placeholder:

| Where | Name | Family | What it does |
|---|---|---|---|
| **Rust** | `Mint` | — (SDK) | Build Merkle trees, get roots, generate proofs. No kernel. |
| **Rust** | `Guard` | — (SDK) | Verify proofs against trusted roots locally. No kernel. |
| **Hoon** | `settle-graft` | 1 (commitment) | Register roots, verify payloads against a gate, settle notes with replay protection. |
| **Hoon** | `mint-graft` | 1 (commitment) | Append-only commitment of a Merkle root per `hull=@`. |
| **Hoon** | `guard-graft` | 1 (commitment) | Register a root per hull, check leaves against it (soft verify). |
| **Hoon** | `forge-graft` | 1 (commitment) | STARK-prove a Nock computation over committed data. Stateless. |
| **Hoon** | `kv-graft` | 3 (state) | Loose key-value store: `@t` keys, opaque atom values; overwrite-on-set, idempotent delete. |
| **Hoon** | `counter-graft` | 3 (state) | Named `@ud` counters; init-on-touch, saturate at `2^64-1`. |
| **Hoon** | `queue-graft` | 3 (state) | FIFO job queue with monotonic IDs; opaque body, polling-friendly empty-pop. |
| **Hoon** | `rbac-graft` | 3 (state) | Pubkey-keyed permission table; two-level capacity guard; auto-clear empty pubkeys. |
| **Hoon** | `registry-graft` | 3 (state) | Strict structured registry: create-only put, modify-only update, error-on-missing delete. |
| **Hoon** | `validate-graft` | 4 (behavior) | Pre-flight rule check on poke causes; rules install per cause-tag at runtime. |
| **Hoon** | `log-graft` | 4 (behavior) | Append-only audit trail with monotonic seq + caller-tag; retention cap 100k entries. |
| **Hoon** | `clock-graft` | 4 (behavior) | Deterministic event-counter clock; `[%clock-now ~]` returns the current `@da`. |
| **Hoon** | `batch-graft` | 4 (behavior) | Settlement-flush buffer; emits one `%batch-flushed` per N intents. |
| **Hoon** | `intent-graft` | 5 (placeholder) | Reserved for multi-party coordination. Crashes on invocation until upstream lands. |

The four commitment grafts share a unified `hull=@` key, so mint, guard, and settle can address the same logical cell. State grafts are domain-keyed and layer alongside commitment grafts without namespace collision. Behavior grafts wrap or observe poke flow via the `poke-prelude` and `poke-postlude` markers.

### A CLI (`graft-inject`)

Discovers manifests under `hoon/lib/`, splices each graft's blocks into your kernel at the marker comments, and writes the result. Preview by default; `--apply` writes to disk. See [Wire with graft-inject](/build/wire) and the [CLI reference](/reference/cli).

## Where vesl ends and nockchain begins

Nock is [nockchain](https://github.com/nockchain/nockchain)'s combinator calculus. JAM serialization, the STARK proving stack, and the deterministic Nock interpreter are all nockchain's primitives — not vesl's. vesl runs a Hoon kernel inside nockchain's `NockApp` and ships a graft library on top: it does not invent determinism, proving, or the noun model. See the [vesl-core README](https://github.com/zkvesl/vesl-core/blob/main/README.md) for a longer walk through the boundary.

## What's next

- [Install](/setup/install) — toolchain prerequisites and the `[patch.crates-io] ibig` block every developer hits on first build.
- [Your first nockapp](/setup/quickstart) — six steps end-to-end.
- [Shape of a nockapp](/build/shape) — the conceptual layout (hull, grafts, domain) every other page assumes.
