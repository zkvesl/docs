# Building a Hull

The Hull is the Rust harness that boots and runs a Hoon kernel. The vesl Hull handles data ingestion, retrieval, LLM inference, and on-chain settlement through a REST API. This page covers building and customizing the Hull for your deployment.

## Build from source

```bash
git clone https://github.com/zkVesl/vesl.git
cd vesl
make setup    # symlinks hoon deps
make build    # compile Rust harness
```

`make setup` creates symlinks from `hoon/` into `$NOCK_HOME/hoon/` so the Hoon compiler can resolve shared dependencies (tip5 primitives, nockchain types). `make build` compiles the Hull binary.

## Project layout

```
hull/                 Rust harness source
  src/
    api.rs            Axum HTTP routes (/ingest, /query, /prove, /status, /health)
    chain.rs          Nockchain gRPC client for settlement
    config.rs         vesl.toml parsing and config precedence
    ingest.rs         Document ingestion into tip5 Merkle tree
    llm.rs            Ollama LLM integration
    merkle.rs         Tip5 Merkle tree operations
    noun_builder.rs   Nock noun construction for kernel pokes
    retrieve.rs       Chunk retrieval with keyword scoring
    signing.rs        Schnorr key derivation and transaction signing
    tx_builder.rs     Nockchain transaction construction
protocol/             Hoon kernel source
  lib/
    vesl-kernel.hoon  Full kernel (register, verify, settle, prove)
    vesl-graft.hoon   Composable graft library (for SDK users)
    vesl-merkle.hoon  Tip5 Merkle primitives
    vesl-prover.hoon  STARK proof generation
    vesl-verifier.hoon  STARK verification (Level 1 + Level 2)
assets/
  vesl.jam            Pre-compiled kernel (~18 MB)
```

## Compilation targets

| Target | What it does |
|--------|-------------|
| `make build` | Compile the Rust Hull |
| `make kernel` | Recompile the Hoon kernel to `assets/vesl.jam` |
| `make build-dumbnet` | Compile with mainnet features enabled |
| `make clean` | Remove build artifacts |

## Settlement modes

The Hull supports three modes, set via CLI flag, environment variable, or `vesl.toml`:

- **local** — kernel verifies, no chain interaction (default)
- **fakenet** — full pipeline with a local nockchain fakenet
- **dumbnet** — live chain with real seed phrase

See [Configuration](/guides/configuration) for details.

## Running

```bash
# Local mode (default)
make demo-local

# Fakenet (requires nockchain in PATH)
make demo-fakenet

# Custom
./target/debug/hull --settlement-mode local --port 3000
```

## HTTP API

The Hull exposes five endpoints. See [CLI Reference](/reference/cli) for full details.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ingest` | POST | Ingest documents into Merkle tree |
| `/query` | POST | Retrieve + infer + verify + settle |
| `/prove` | POST | Query with STARK proof (64+ GB RAM) |
| `/status` | GET | Tree state, settled notes, root |
| `/health` | GET | Liveness check |

## Customizing the Hull

The Hull is designed to be extended. Common customization points:

- **`api.rs`** — add endpoints for your domain
- **`ingest.rs`** — change how documents are chunked and indexed
- **`llm.rs`** — swap Ollama for a different inference provider
- **`retrieve.rs`** — customize retrieval scoring
- **`config.rs`** — add configuration fields to `vesl.toml`

The kernel interaction (`noun_builder.rs`, `merkle.rs`) and settlement pipeline (`chain.rs`, `tx_builder.rs`, `signing.rs`) should rarely need modification.

~
