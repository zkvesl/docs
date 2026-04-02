# What is vesl?

You shouldn't need to trust an API to know your computation was honest.

vesl is a Verifiable Execution and Settlement Layer built on Nockchain. Every computation, every state transition, every proof — verifiable on-chain.

## The problem

Standard application infrastructure is a black box. You send a request, you get a result, and you trust that:
- The correct logic was executed
- The computation wasn't tampered with
- The state transition actually happened as reported

You have no proof. Just faith in an API.

## What vesl does

vesl makes execution verifiable:

- **Cryptographic commitments** — every state transition is committed on-chain with a proof
- **Verified execution** — operations produce proofs that the results match what was committed
- **Nockchain native** — built on Nock's deterministic computation model, so verification doesn't require re-execution
- **On-chain proof settlement** — when the intents upgrade is released, the chain will be able to verify the proof committed off-chain

## Architecture at a glance

| Component | What it does |
|-----------|-------------|
| **Hull** | Rust harness that runs the Hoon kernel and exposes the API |
| **Hoon kernels** | On-chain logic for commitment and verification (pre-compiled) |
| **Chunk store** | Data storage with cryptographic commitments |
| **vesl.toml** | Configuration for settlement mode, network, and kernel paths |

Read the [Quick Start](/getting-started/quickstart) to get running, or dive into the [Architecture](/architecture/hull) for the full picture.

~
