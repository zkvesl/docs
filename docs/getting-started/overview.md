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
| **Hoon (in-kernel)** | `kv-graft`       | 3 (state) | Loose key-value store: `@t` keys, opaque atom values; overwrite-on-set, idempotent delete. |
| **Hoon (in-kernel)** | `counter-graft`  | 3 (state) | Named `@ud` counters; init-on-touch, saturate at `2^64-1`. |
| **Hoon (in-kernel)** | `queue-graft`    | 3 (state) | FIFO job queue with monotonic IDs; opaque body, polling-friendly empty-pop. |
| **Hoon (in-kernel)** | `rbac-graft`     | 3 (state) | Pubkey-keyed permission table; two-level capacity guard; auto-clear empty pubkeys. |
| **Hoon (in-kernel)** | `registry-graft` | 3 (state) | Strict structured registry: create-only put, modify-only update, error-on-missing delete. |
| **Hoon (in-kernel)** | `validate-graft` | 4 (behavior) | Pre-flight rule check on poke causes; rules install per cause-tag at runtime. v0.1 ships `%non-empty` rule only. First consumer of the poke-prelude marker. |
| **Hoon (in-kernel)** | `log-graft`      | 4 (behavior) | Append-only audit trail with monotonic seq + caller-tag; retention cap 100k entries. |
| **Hoon (in-kernel)** | `clock-graft`    | 4 (behavior) | Deterministic event-counter clock; `[%clock-now ~]` returns the current `@da`. event-count source only. |
| **Hoon (in-kernel)** | `batch-graft`    | 4 (behavior) | Settlement-flush buffer; emits one `%batch-flushed` per N intents (count trigger only in v0.1). |
| **Hoon (in-kernel)** | `intent-graft` | 5 (intent — placeholder) | Reserved slot for multi-party coordination. Crashes on invocation until canonical upstream lands. |

The commitment, state, and behavior grafts are composable. Install any subset; `graft-inject` wires them into your kernel in one command. The four commitment grafts share a unified `hull=@` key — mint, guard, and settle can address the same logical cell across primitives. State grafts are domain-keyed (each picks the key shape that fits its use case), so they layer cleanly alongside commitment grafts without namespace collision. Behavior grafts wrap or observe poke flow via the `poke-prelude` and `poke-postlude` markers — validate's prelude short-circuits before the cause switch runs; batch and log accumulate effects out of band. Commitments do not require intents — family 5 is optional coordination above the commitment layer, not a dependency of families 1–4.

### The agnostic Hull — a template for your own harness

The `hull/` crate in vesl-core is a minimal Rust harness that boots a kernel and exposes commit/verify endpoints. Fork it to wrap a kernel in a process of your own. See [Building a Hull](/guides/building-a-hull).

### Reference hulls

For a concrete worked example, see [zkvesl/hull-llm](https://github.com/zkvesl/hull-llm) — a Hull that does verified RAG: ingest, retrieve, Ollama inference, on-chain settlement.

## Architecture at a glance

| Component | What it does |
|-----------|-------------|
| **Hull** | Rust harness that runs a Hoon kernel and exposes the API |
| **Hoon kernels** | Verification and settlement logic, executed off-chain in an embedded Nock interpreter |
| **vesl-core** | Rust SDK: Mint, Guard, tip5 Merkle primitives, plus `build_*_poke` helpers for every graft cause tag |
| **Grafts** | Thirteen shipped graft libraries — four commitment (`settle-graft`, `mint-graft`, `guard-graft`, `forge-graft`), five state (`kv-graft`, `counter-graft`, `queue-graft`, `rbac-graft`, `registry-graft`), and four behavior (`validate-graft`, `log-graft`, `clock-graft`, `batch-graft`) — plus the family-5 `intent-graft` placeholder; wired into your kernel by `graft-inject` |
| **vesl.toml** | Configuration for settlement mode, network, and kernel paths |

See the [Quick Start](/getting-started/quickstart) to get running, or the [Architecture](/architecture/hull) for implementation details.

## Contact

Questions, bugs, or ideas: [sobchek@zkvesl.org](mailto:sobchek@zkvesl.org)
