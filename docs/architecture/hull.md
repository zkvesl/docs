# Hull (Rust Harness)

The Hull is vesl's Rust harness. It loads a compiled Hoon kernel (JAM file), manages state, and exposes an HTTP API.

Think of it as the engine block — the Hoon kernel is the logic, the Hull is what makes it run.

## Responsibilities

- Boot the Hoon kernel as an embedded NockApp
- Ingest documents into a tip5 Merkle tree
- Retrieve chunks with keyword scoring
- Build and verify manifests (prompt integrity, proof paths)
- LLM inference (Ollama or deterministic stub)
- Schnorr signing and transaction construction
- On-chain settlement via Nockchain gRPC
- Expose REST API (`/ingest`, `/query`, `/prove`, `/status`, `/health`)
- Route between settlement modes (local, fakenet, dumbnet)

## Request flow

```
┌─────────────────────────────────────┐
│  client                             │
└─────────────────┬───────────────────┘
                  │ HTTP
┌─────────────────┴───────────────────┐
│  api.rs                       axum  │
│  /ingest  /query  /prove  /status   │
└──┬─────────┬─────────┬──────────────┘
   │         │         │
   ▼         ▼         │
┌──────┐ ┌────────┐    │
│ingest│ │retrieve│    │
│ .rs  │ │  .rs   │    │
└──┬───┘ └───┬────┘    │
   │         ▼         │
   │    ┌────────┐     │
   │    │ llm.rs │     │
   │    └───┬────┘     │
   │        │          │
   ▼        ▼          ▼
┌─────────────────────────────────────┐
│  merkle.rs       tip5 Merkle tree   │
│  noun_builder.rs → kernel poke      │
│  ┌───────────────────────────────┐  │
│  │ vesl.jam      hoon kernel     │  │
│  │ verify manifest + merkle root │  │
│  └───────────────────────────────┘  │
└─────────────────┬───────────────────┘
                  │
   ┌──────────────┼──────────────┐
   ▼              ▼              ▼
┌────────┐ ┌───────────┐ ┌──────────┐
│signing │ │tx_builder │ │ chain.rs │
│  .rs   │ │   .rs     │ │  gRPC    │
│schnorr │ │ assemble  │ │  submit  │
└────────┘ └───────────┘ └──────────┘
   │              │              │
   └──────────────┼──────────────┘
                  ▼
┌─────────────────────────────────────┐
│  nockchain                          │
│  mode: local │ fakenet │ dumbnet    │
└─────────────────────────────────────┘
```

## Key modules

| Module | What it does |
|--------|-------------|
| `merkle.rs` | tip5 Merkle tree, cross-runtime aligned with Hoon |
| `chain.rs` | On-chain settlement + confirmation via gRPC |
| `api.rs` | HTTP API server (axum) with 10 MB body limit |
| `tx_builder.rs` | Settlement transaction construction |
| `signing.rs` | Schnorr signing (returns `Result`, no panics) |
| `ingest.rs` | Document chunking into the tree |
| `llm.rs` | LLM integration (trait-based: Ollama or stub) |
| `noun_builder.rs` | Nock noun construction for kernel pokes |
| `retrieve.rs` | Keyword-based chunk retrieval with scoring |
| `config.rs` | Settlement config resolution (CLI > env > toml > defaults) |

## Server defaults

The HTTP server binds to `127.0.0.1:3000` by default. Pass `--bind-addr 0.0.0.0` to expose to the network. See the [CLI Reference](/reference/cli) for all flags.

~
