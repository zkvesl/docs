# Quick Start

## 1. Clone the repo

```bash
git clone https://github.com/zkVesl/vesl.git
cd vesl
```

## 2. Install dependencies

```bash
make setup
```

## 3. Configure

```bash
cp vesl.toml.example vesl.toml
# Edit vesl.toml — set your settlement mode and paths
```

## 4. Build and run

```bash
make build       # compiles the Hull (Rust harness)
make demo-local  # runs the full pipeline locally (no chain)
```

::: tip
vesl requires a local Nockchain source tree. Set `$NOCK_HOME` to point at it, or configure the path in `vesl.toml`.
:::

## What just happened?

`make build` compiled the Hull (Rust harness). The Hoon kernels ship pre-compiled as JAM files — you don't need to build them unless you're modifying Hoon source (see `make kernel`). `make demo-local` starts the Hull, which loads the kernel and runs the pipeline in local mode (no chain interaction).

Next: [Installation](/getting-started/installation) for the full dependency list, or [Configuration](/guides/configuration) to understand `vesl.toml`.

~
