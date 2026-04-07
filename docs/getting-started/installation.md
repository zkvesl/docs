# Installation

## Prerequisites

- **Rust** nightly `2025-11-26` (pinned in `hull/rust-toolchain`)
- **Nockchain monorepo** — cloned and built at a sibling path, with `hoonc` and `nockchain` binaries in your PATH
- **$NOCK_HOME** — set to the nockchain monorepo root, or configure `nock_home` in `vesl.toml`

## Hardware

`/query` and `/settle` run on modest hardware (4 GB RAM). `/prove` generates a STARK proof and requires 64+ GB RAM. See [CLI Reference](/reference/cli) for stack size flags.

## Building from source

```bash
git clone https://github.com/zkVesl/vesl.git
cd vesl
cp vesl.toml.example vesl.toml     # edit nock_home if your layout differs
make setup                          # create hoon symlinks to $NOCK_HOME
make build                          # compile hull (Rust harness)
```

The Hoon kernel ships pre-compiled as `assets/vesl.jam`. `make build` only compiles the Rust hull. To recompile the kernel after modifying Hoon source, run `make kernel`.

## Verifying your install

```bash
make test-unit                      # 99 unit tests
make test                           # all tests (unit + 17 e2e)
```

Fakenet integration (requires `nockchain` in PATH):

```bash
./scripts/fakenet-harness.sh run    # boot nodes, run 20 integration tests, tear down
```

If `hoonc` panics with "Failed to canonicalize path," the library root argument is missing — make sure `$NOCK_HOME` points at a valid Nockchain tree and run `make setup` to create the symlinks.

~
