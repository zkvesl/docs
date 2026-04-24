# Installation

## Prerequisites

- **Rust** nightly `2025-11-26` (pinned in the workspace-root `rust-toolchain.toml`)
- **Nockchain monorepo** — cloned and built at a sibling path, with `hoonc` and `nockchain` binaries in your PATH. vesl-core's `Cargo.toml` files path-dep into `../nockchain/`, so the two repos must be siblings (e.g. `~/projects/nockchain/{vesl-core,nockchain}`).
- **$NOCK_HOME** — set to the nockchain monorepo root, or configure `nock_home` in `vesl.toml`

## Building from source

```bash
git clone https://github.com/zkVesl/vesl-core.git
cd vesl-core
cp vesl.toml.example vesl.toml     # edit nock_home if your layout differs
make setup                          # create hoon symlinks to $NOCK_HOME
make build                          # cargo build --workspace --release
```

vesl-core is a single Cargo workspace with 8 members (`crates/*`, `hull/`, `kernels/*`). `make build` compiles all of them together into one `target/`. The commitment kernels ship pre-compiled as `assets/{mint,guard,settle}.jam`; to recompile a kernel after modifying Hoon source, run `hoonc --new protocol/lib/<kernel>.hoon hoon/`.

Templates under `templates/` are **not** workspace members — each is a standalone Cargo package meant to be copied out as a starter scaffold (see [Grafting Guide](/guides/grafting)).

## Verifying your install

```bash
make test-unit                      # unit tests
make test                           # all tests (unit + e2e)
```

If `hoonc` panics with "Failed to canonicalize path," the library root argument is missing — make sure `$NOCK_HOME` points at a valid Nockchain tree and run `make setup` to create the symlinks.

## Running a Hull with settlement

The agnostic `hull/` template ships with no domain logic — just kernel boot and HTTP shell. For a fully-wired example, see [zkvesl/hull-llm](https://github.com/zkvesl/hull-llm) (verified RAG).
