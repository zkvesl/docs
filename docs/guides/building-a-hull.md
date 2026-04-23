# Building a Hull

A Hull is the Rust process that hosts a Vesl kernel. This page covers the agnostic Hull template shipped in [zkvesl/vesl](https://github.com/zkvesl/vesl) `hull/` — a minimal kernel-runner you fork to build your own harness.

## Build from source

```bash
git clone https://github.com/zkVesl/vesl.git
cd vesl
make setup    # symlinks hoon deps
make build    # compile Rust harness
```

`make setup` creates symlinks from `hoon/` into `$NOCK_HOME/hoon/` so the Hoon compiler can resolve shared dependencies (tip5 primitives, nockchain types). `make build` compiles the Hull binary.

## What the template provides

The agnostic `hull/` crate is intentionally thin — kernel boot, HTTP shell, minimal `/commit` and `/verify` endpoints, config resolution for `vesl.toml`. Domain semantics (what you ingest, what you retrieve, what you prove) are left to your implementation.

## Project layout

```
hull/                 Rust harness source
  src/
    api.rs            Axum HTTP routes
    config.rs         vesl.toml parsing and config precedence
    signing.rs        Schnorr key derivation and transaction signing
    verify.rs         FieldVerifier template — replace with your domain logic
kernels/settle/       Minimal settlement kernel (no STARK prover)
assets/               Compiled kernel JAMs (mint, guard, settle)
```

## Compilation targets

| Target | What it does |
|--------|-------------|
| `make build` | Compile the Rust Hull |
| `make test` | Run all tests |
| `make test-unit` | Run unit tests only |
| `make clean` | Remove build artifacts |

## Settlement modes

The Hull supports three modes, set via CLI flag, environment variable, or `vesl.toml`:

- **local** — kernel verifies, no chain interaction (default)
- **fakenet** — full pipeline with a local nockchain fakenet
- **dumbnet** — live chain with real seed phrase

See [Configuration](/guides/configuration) for details.

## Customizing the Hull

The Hull is designed to be extended. Common customization points:

- **`api.rs`** — add endpoints for your domain
- **`verify.rs`** — replace `FieldVerifier` with domain-specific verification
- **`config.rs`** — add configuration fields to `vesl.toml`

The kernel interaction (noun builders, Merkle primitives from `vesl-core`) and settlement pipeline (via `nockchain-client-rs`) should rarely need modification.

## Reference implementations

For a fully-wired worked example, see [zkvesl/hull-llm](https://github.com/zkvesl/hull-llm) — a Hull that does verified RAG (ingest, retrieve, Ollama, on-chain settlement). Its `src/` tree demonstrates how the agnostic template grows into a production harness.
