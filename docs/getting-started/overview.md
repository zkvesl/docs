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
- **Verifiable execution** — operations produce verifiable results; STARK proofs commit arbitrary Nock computation
- **Nockchain native** — built on Nock's unique deterministic computation model, so verification doesn't require re-execution
- **On-chain proof settlement** — when the intents upgrade is released, the chain will be able to verify the proof committed off-chain

## What vesl ships

### The SDK — graft onto your NockApp

The vesl SDK lets you add verifiable data commitment to any NockApp. Rust-side primitives are pure math; kernel-side grafts add on-kernel state. Grafts are organized into five families — see the [Grafting Guide](/guides/grafting) for the full lattice.

| Where | Name | Family | What it does |
|---|---|---|---|
| **Rust** | `Mint` | — (SDK) | Build Merkle trees, get roots, generate proofs. No kernel. |
| **Rust** | `Guard` | — (SDK) | Verify proofs against trusted roots locally. No kernel. |
| **Hoon (in-kernel)** | `settle-graft` | 1 (commitment) | Register roots, verify payloads against a gate, settle notes with replay protection. |
| **Hoon (in-kernel)** | `mint-graft` | 1 (commitment) | Append-only commitment of a Merkle root per `hull=@`. |
| **Hoon (in-kernel)** | `guard-graft` | 1 (commitment) | Register a root per hull, check leaves against it (soft verify). |
| **Hoon (in-kernel)** | `forge-graft` | 1 (commitment) | STARK-prove a Nock computation over committed data. Stateless. |
| **Hoon (in-kernel)** | `intent-graft` | 5 (intent — placeholder) | Reserved slot for multi-party coordination. Crashes on invocation until canonical upstream lands. |

The four commitment grafts are composable. Install any subset; `graft-inject` wires them into your kernel in one command. All four commitment-bearing grafts key on a unified `hull=@`, so mint, guard, and settle can address the same logical cell across primitives. Commitments do not require intents — family 5 is optional coordination above the commitment layer, not a dependency of families 1–4.

### The agnostic Hull — a template for your own harness

The `hull/` crate in vesl is a minimal Rust harness that boots a kernel and exposes commit/verify endpoints. Fork it to wrap a kernel in a process of your own. See [Building a Hull](/guides/building-a-hull).

### Reference hulls

For a concrete worked example, see [zkvesl/hull-llm](https://github.com/zkvesl/hull-llm) — a Hull that does verified RAG: ingest, retrieve, Ollama inference, on-chain settlement.

## Architecture at a glance

| Component | What it does |
|-----------|-------------|
| **Hull** | Rust harness that runs a Hoon kernel and exposes the API |
| **Hoon kernels** | Verification and settlement logic, executed off-chain in an embedded Nock interpreter |
| **vesl-core** | Rust SDK: Mint, Guard, tip5 Merkle primitives, plus `build_*_poke` helpers for every graft cause tag |
| **Grafts** | Four shipped commitment-family libraries — `settle-graft`, `mint-graft`, `guard-graft`, `forge-graft` — plus the family-5 `intent-graft` placeholder; wired into your kernel by `graft-inject` |
| **vesl.toml** | Configuration for settlement mode, network, and kernel paths |

See the [Quick Start](/getting-started/quickstart) to get running, or the [Architecture](/architecture/hull) for implementation details.

## Contact

Questions, bugs, or ideas: [sobchek@zkvesl.org](mailto:sobchek@zkvesl.org)
