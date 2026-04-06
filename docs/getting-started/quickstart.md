# Quick Start

## Prerequisites

[Nockchain](https://github.com/zorp-corp/nockchain) monorepo cloned and built at a sibling path, with `hoonc` and `nockchain` in your PATH. Rust nightly `2025-11-26` (pinned in `hull/rust-toolchain`).

## 1. Clone and configure

```bash
git clone https://github.com/zkVesl/vesl.git
cd vesl
cp vesl.toml.example vesl.toml     # edit nock_home if your layout differs
```

## 2. Build

```bash
make setup                          # create hoon symlinks
make build                          # compile hull
```

## 3. Run the demo

```bash
make demo-local                     # local pipeline, no chain needed
```

## What just happened?

`make setup` created symlinks from `hoon/` into the nockchain monorepo so the compiler can find dependencies. `make build` compiled the Hull (Rust harness). The Hoon kernel ships pre-compiled as `assets/vesl.jam` — no Hoon compilation needed unless you're modifying kernel source (see `make kernel`).

`make demo-local` runs the full pipeline: ingest sample documents, retrieve chunks against a query, verify in the Hoon kernel, and settle locally. No chain interaction.

## Next steps

- Run `make help` for all available targets
- Try `make demo-fakenet` for live on-chain settlement (requires `nockchain` in PATH)
- See [Configuration](/guides/configuration) for settlement modes and `vesl.toml` options
- See [Installation](/getting-started/installation) for the full dependency list

~
