# Installation

## Prerequisites

- **Rust** nightly `2025-11-26` (pinned in `hull/rust-toolchain`)
- **Nockchain monorepo** — cloned and built at a sibling path, with `hoonc` and `nockchain` binaries in your PATH
- **$NOCK_HOME** — set to the nockchain monorepo root, or configure `nock_home` in `vesl.toml`

## Building from source

```bash
git clone https://github.com/zkVesl/vesl.git
cd vesl
cp vesl.toml.example vesl.toml     # edit nock_home if your layout differs
make setup                          # create hoon symlinks to $NOCK_HOME
make build                          # compile hull (Rust harness)
```

The commitment kernels ship pre-compiled as `assets/{mint,guard,settle}.jam`. `make build` only compiles the Rust hull. To recompile a kernel after modifying Hoon source, run `hoonc --new protocol/lib/<kernel>.hoon hoon/`.

## Verifying your install

```bash
make test-unit                      # unit tests
make test                           # all tests (unit + e2e)
```

If `hoonc` panics with "Failed to canonicalize path," the library root argument is missing — make sure `$NOCK_HOME` points at a valid Nockchain tree and run `make setup` to create the symlinks.

## Running a Hull with settlement

The agnostic `hull/` template ships with no domain logic — just kernel boot and HTTP shell. For a fully-wired example, see [zkvesl/hull-llm](https://github.com/zkvesl/hull-llm) (verified RAG).
