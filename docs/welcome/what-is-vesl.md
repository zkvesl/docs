---
title: What Is VESL
description: Overview of vesl — what it ships, where it sits relative to nockchain, and where to start.
outline: deep
---

# What Is VESL

Building on [**Nockchain**](/reference/glossary#nockchain) means writing a [**Hoon**](/reference/glossary#hoon) [**kernel**](/reference/glossary#kernel) hosted by a Rust process — the kernel does deterministic logic, the [**hull**](/reference/glossary#hull) does I/O. Underneath, nockchain gives you Nock, [**JAM**](/reference/glossary#jam), [**tip5**](/reference/glossary#tip5), and the NockApp runtime. On top, your domain code does whatever makes the app yours.

[**vesl**](/reference/glossary#vesl) is the layer in between — the part of a NockApp you compose rather than hand-write. It ships verifiable primitives (Merkle commitments, replay-protected settlement, STARK-backed proving), durable state (key-value, counters, queues, RBAC, structured registries), behavioral observers (audit log, deterministic clock, settlement batching), signing helpers, an HTTP server, and a test harness. A Rust SDK turns each [**graft**](/reference/glossary#graft) [**cause**](/reference/glossary#cause) into a typed [**poke**](/reference/glossary#poke) and decodes the [**effects**](/reference/glossary#effect) back into typed results.

[**nockup**](/reference/glossary#nockup) is Nockchain's official project CLI — the one tool that handles scaffolding, plugin discovery, and package management across the ecosystem. vesl-nockup is built for it, not adjacent to it: [**`nockup graft`**](/reference/glossary#nockup-graft) is a nockup-discovered plugin, the templates scaffold via `nockup project init`, and graft distribution rides `nockup package` machinery. Picking up vesl gets you a stack that's coherent end-to-end, not a sidecar tool wired in by hand.

```d2
direction: down

domain: "Your domain\napp-specific causes, peeks, Rust handlers"
vesl: "vesl\ngraft library, vesl-core SDK, vesl-hull HTTP, nockup graft CLI"
nockchain: "Nockchain\nNock, Hoon, hoonc, NockApp, JAM, tip5"

domain -- vesl
vesl -- nockchain
```

::: tip Linked terms
Bolded terms across this page link to their full entries on the [Glossary](/reference/glossary). Hover or click anywhere a term is bolded.
:::

## Rust SDK — `vesl-core`

The [**`vesl-core`**](/reference/glossary#vesl-core) crate is the import target for every Rust hull in this ecosystem. It exports:

- **`Mint`** — build cryptographic commitments (Merkle trees) over your data and produce roots and proofs.
- **`Guard`** — verify those proofs locally, before sending anything to the kernel.
- **`Settle`** — pre-flight payloads against a locally-mirrored root + replay history before sending the poke; catches replay-id reuse and root-mismatch without a kernel round trip.
- **Poke builders** — one helper per operation a [**graft**](/reference/glossary#graft) supports, so you don't construct Hoon [**causes**](/reference/glossary#cause) by hand from Rust. Examples: `build_settle_register_poke`, `build_kv_set_poke`, `build_forge_prove_poke`.
- **Effect decoders** — `effect_head_tag` / `effect_head_tags` for routing on the [**effect**](/reference/glossary#effect) head; typed decoders (`decode_settle_error`, `decode_queue_popped`) for cell-payload effects.

[Reference / vesl-core](/reference/vesl-core) walks the full surface.

## Hoon Graft Library

Fourteen grafts ship today, organized into three [**families**](/reference/glossary#family). Each is a Hoon library plus a sibling [**manifest**](/reference/glossary#manifest); drop them into your kernel and they compose at injection time.

**Commitment family** — work with Merkle commitments and proofs.
- `mint-graft` — publish a Merkle root that future proofs verify against.
- `guard-graft` — publish a root and check whether items belong to it.
- [**`settle-graft`**](/reference/glossary#settle) — publish a root, verify items against it, and record each settlement once (no double-counting).
- `forge-graft` — generate zero-knowledge (STARK) proofs over committed data.

**State family** — durable application state primitives.
- `kv-graft` — string-keyed key-value store.
- `counter-graft` — named integer counters.
- `queue-graft` — FIFO job queue with stable IDs.
- `rbac-graft` — public-key role and permission table.
- `registry-graft` — strict structured registry with create / update / delete.

**Behavior family** — observe or constrain how the kernel processes incoming messages.
- `validate-graft` — pre-flight checks before a message reaches [**domain**](/reference/glossary#domain) logic.
- `log-graft` — append-only audit trail.
- `clock-graft` — deterministic event clock.
- `batch-graft` — buffer settlements and flush in batches.

Reserved: `intent-graft`, for future multi-party coordination. Not yet active. The [**trellis**](/reference/glossary#trellis) pattern (one kernel, multiple `hull=@` namespaces) layers cleanly across all three families.

## CLI — `nockup graft`

The [**`nockup graft`**](/reference/glossary#nockup-graft) command composes your chosen grafts into your kernel. You pick the grafts you want; the CLI splices them in so you never assemble graft glue code by hand. See [Inject](/build/grafts/inject) and the [CLI reference](/reference/cli) for the depth pages.

## HTTP Server — `vesl-hull`

Your kernel gets an HTTP API out of the box. The endpoints `/commit`, `/settle`, `/verify`, `/tx/{tx_id}`, `/status`, and `/health` cover the full commit → settle → verify lifecycle — anything that speaks HTTP can drive your app: a web frontend, a mobile client, a `curl` command, a script. The scaffold ships a `serve` mode that boots the kernel and exposes these endpoints. Full flag / auth / endpoint catalog on [Build & Run / Serve Subcommand](/build/build-run/serve).

## Scaffolds and Templates

Templates live under `templates/` and are scaffolded into a fresh project directory by `nockup project init`:

- **`templates/vesl/`** — the canonical starter. Ships markered Hoon, a clap `Demo`/`Serve` dispatch, and `vesl-test` in `[dev-dependencies]`.
- **`templates/graft-{mint,settle,scaffold,hash-gate,intent}/`** — focused single-primitive demos for learning a specific graft.
- **`templates/{counter,data-registry,settle-report}/`** — full example apps illustrating end-to-end domain integrations.

## Test Harness — `vesl-test`

Tests run against a real kernel. Your test suite boots the same kernel binary your app does, sends it the same operations, and verifies the same outputs — what your tests cover is what your users actually get. A companion CLI lets you inspect a running kernel from the outside, and catches the most common build-time mistake: a compiled kernel that's silently out of date with your source. See [Build / Testing](/build/testing/).

## State and Settlement Plumbing

Three smaller crates round out the bundle:

- **`vesl-checkpoint`** — periodic [**snapshot**](/reference/glossary#snapshot) persistence so a kernel resumes without replaying every [**poke**](/reference/glossary#poke) since boot.
- **`vesl-signing`** — Schnorr-over-Cheetah signing helpers for catalog [**verification gates**](/reference/glossary#verification-gate) (`sig-verify-schnorr`, etc.).
- **`vesl-wallet`** / **`vesl-wallet-spec`** — BIP-39/BIP-44 wallet for dumbnet key derivation. See [Build & Run / Dumbnet Walkthrough](/build/build-run/dumbnet).

## Where vesl Ends and nockchain Begins

Nock is [**nockchain**](/reference/glossary#nockchain)'s combinator calculus. [**JAM**](/reference/glossary#jam) serialization, [**tip5**](/reference/glossary#tip5) hashing, the STARK proving stack, and the deterministic Nock interpreter are all nockchain's primitives — not vesl's. vesl runs a Hoon kernel inside nockchain's `NockApp` and ships a graft library on top: it does not invent determinism, proving, or the [**noun**](/reference/glossary#noun) model. See the [vesl-core README](https://github.com/zkvesl/vesl-core/blob/main/README.md) for a longer walk through the boundary.

## What's Next

- [Get started](/setup/quickstart) — three commands from empty directory to `%settle-registered` + `%settle-noted`.
- [NockApp Anatomy](/build/anatomy) — the conceptual layout (hull, grafts, domain) every other page assumes.
- [Glossary](/reference/glossary) — the term sheet linked from every bolded word on this page.
