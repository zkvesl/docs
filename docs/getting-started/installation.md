# Installation

## Prerequisites

- **Rust** (stable toolchain)
- **Nockchain source** — clone from the Nockchain repo and set `$NOCK_HOME`
- **hoonc** — the Hoon compiler (ships with Nockchain)

## Building from source

```bash
git clone https://github.com/zkVesl/vesl.git
cd vesl
make setup   # installs Rust deps, checks for hoonc
make build   # compiles kernel + hull
```

## Verifying your install

```bash
make test
```

If tests pass, you're good. If `hoonc` panics with "Failed to canonicalize path," the library root argument is missing or incorrect — make sure `$NOCK_HOME` points at a valid Nockchain tree and that hoonc receives `$NOCK_HOME/hoon/` as its library path.

~
