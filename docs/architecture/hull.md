# Hull (Rust Harness)

A Hull is the Rust process that hosts a Vesl kernel. It boots the compiled Hoon JAM as an embedded NockApp, exposes an API, and mediates between the kernel and the outside world (HTTP clients, the chain, the filesystem). The kernel is pure logic — the Hull does the I/O.

Think of it as the engine block — the Hoon kernel is the logic, the Hull is what makes it run.

## The agnostic Hull template

[zkvesl/vesl-core](https://github.com/zkvesl/vesl-core) ships a minimal Hull template at `hull/` — kernel boot, HTTP shell, `/commit` and `/verify` endpoints, nothing domain-specific. Fork it when you want to wrap a Vesl kernel in a process of your own. The generic shell is deliberately thin; domain semantics (what to ingest, what to retrieve, what to prove) live in the hull that embeds it.

## Responsibilities

- Boot the Hoon kernel as an embedded NockApp
- Route HTTP (or other transport) requests into kernel pokes/peeks
- Maintain persistent state (checkpoints) on disk
- Construct and submit settlement transactions via Nockchain gRPC (when applicable)
- Surface errors with context (which poke, which input, likely cause)

## Request flow (generic)

```
client → HTTP → api module
              → domain modules (ingest, retrieve, ...)
              → noun_builder → kernel poke
              → kernel verify
              → signing / tx_builder / chain (if settling)
              → nockchain
```

## Where intents fit

The Hull serves the commitment layer — family 1 in vesl's 5-family graft catalog. Family 5 (intent coordination: declare / match / cancel / expire) sits *above* commitments and is optional. A NockApp can settle through a Hull without ever declaring an intent. When the Nockchain monorepo publishes a canonical intent structure, vesl swaps the placeholder `intent-graft` for the real primitive; Hull endpoints don't need to change. See the [Grafting Guide](/guides/grafting) for the full family taxonomy.

## Reference hulls

- **hull-llm** ([zkvesl/hull-llm](https://github.com/zkvesl/hull-llm)) — verified RAG: ingest, retrieve, Ollama, on-chain settlement. The main worked example of what a Vesl Hull looks like when wired end-to-end.
