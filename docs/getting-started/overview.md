# What is vesl?

vesl is a Verifiable Execution and Settlement Layer built on Nockchain. Computation, state transitions, and proofs are verifiable on-chain.

## The problem

Standard application infrastructure requires trust. You send a request, get a result, and assume that:
- The correct logic was executed
- The computation wasn't tampered with
- The state transition actually happened as reported

There's no cryptographic proof that any of it happened correctly.

## What vesl does

vesl makes execution verifiable:

- **Cryptographic commitments** — every state transition is verified locally and committed on-chain
- **Verifiable execution** — operations produce verifiable results; STARK proofs are available via the `/prove` endpoint for cryptographic verification
- **Nockchain native** — built on Nock's unique deterministic computation model, so verification doesn't require re-execution
- **On-chain proof settlement** — when the intents upgrade is released, the chain will be able to verify the proof committed off-chain

## Two ways to use vesl

### The Hull — full product

The Hull is a Rust harness that runs the full vesl kernel. It handles data ingestion, retrieval, LLM inference, manifest verification, and on-chain settlement through a REST API. Run `make demo-local` and you have a working verified-RAG pipeline.

Best for: deploying the vesl product, running a verified-RAG service, or building on top of the full stack.

### The SDK — graft onto your NockApp

The vesl SDK lets you add verifiable data commitment to any NockApp. Rust-side primitives are pure math; kernel-side grafts add on-kernel state:

| Where | Name | What it does |
|---|---|---|
| **Rust** | `Mint` | Build Merkle trees, get roots, generate proofs. No kernel. |
| **Rust** | `Guard` | Verify proofs against trusted roots locally. No kernel. |
| **Hoon (in-kernel)** | `settle-graft` | Register roots, verify payloads against a gate, settle notes with replay protection. |
| **Hoon (in-kernel)** | `mint-graft` | Append-only commitment of a Merkle root per `hull=@`. |
| **Hoon (in-kernel)** | `guard-graft` | Register a root per hull, check leaves against it (soft verify). |
| **Hoon (in-kernel)** | `forge-graft` | STARK-prove a Nock computation over committed data. Stateless. |

The four grafts are composable. Install any subset; `graft-inject` wires them into your kernel in one command. All four commitment-bearing grafts key on a unified `hull=@`, so mint, guard, and settle can address the same logical cell across primitives.

Best for: adding tamper-evident data commitment to your own NockApp. See the [Grafting Guide](/guides/grafting) to get started.

## Architecture at a glance

| Component | What it does |
|-----------|-------------|
| **Hull** | Rust harness that runs the Hoon kernel and exposes the API |
| **Hoon kernels** | Verification and settlement logic, executed off-chain in an embedded Nock interpreter (pre-compiled) |
| **vesl-core** | Rust SDK: Mint, Guard, tip5 Merkle primitives, plus `build_*_poke` helpers for every graft cause tag |
| **Grafts** | Four composable Hoon libraries — `settle-graft`, `mint-graft`, `guard-graft`, `forge-graft` — wired into your kernel by `graft-inject` |
| **vesl.toml** | Configuration for settlement mode, network, and kernel paths |

See the [Quick Start](/getting-started/quickstart) to get running, or the [Architecture](/architecture/hull) for implementation details.

## Contact

Questions, bugs, or ideas: [sobchek@zkvesl.org](mailto:sobchek@zkvesl.org)

~
