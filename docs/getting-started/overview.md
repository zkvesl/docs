# What is vesl?

You shouldn't need to trust an API to know your retrieval was honest.

vesl is a verified RAG (Retrieval-Augmented Generation) system built on Nockchain. Every chunk lookup, every retrieval step, every proof — verifiable on-chain.

## The problem

Standard RAG pipelines are black boxes. You send a query, you get chunks back, and you trust that:
- The right documents were searched
- The retrieval wasn't tampered with
- The chunks weren't swapped, filtered, or hallucinated

You have no proof. Just faith in an API.

## What vesl does

vesl makes retrieval verifiable:

- **Chunk store with commitments** — every document chunk is committed on-chain with a cryptographic proof
- **Verified lookups** — retrieval produces a proof that the returned chunks match what was committed
- **Nockchain native** — built on Nock's deterministic computation model, so verification doesn't require re-execution

## Architecture at a glance

| Component | What it does |
|-----------|-------------|
| **Hull** | Rust harness that runs the Hoon kernel and exposes the API |
| **Hoon kernels** | On-chain logic for chunk commitment and retrieval verification |
| **Chunk store** | Document storage with cryptographic commitments |
| **vesl.toml** | Configuration for settlement mode, network, and kernel paths |

Read the [Quick Start](/getting-started/quickstart) to get running, or dive into the [Architecture](/architecture/hull) for the full picture.

~
