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

## Architecture at a glance

| Component | What it does |
|-----------|-------------|
| **Hull** | Rust harness that runs the Hoon kernel and exposes the API |
| **Hoon kernels** | Verification and settlement logic, executed off-chain in an embedded Nock interpreter (pre-compiled) |
| **Chunk store** | Data storage with cryptographic commitments |
| **vesl.toml** | Configuration for settlement mode, network, and kernel paths |

See the [Quick Start](/getting-started/quickstart) to get running, or the [Architecture](/architecture/hull) for implementation details.

## Contact

Questions, bugs, or ideas: [sobchek@zkvesl.org](mailto:sobchek@zkvesl.org)

~
