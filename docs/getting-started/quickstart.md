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
make build
make run
```

::: tip
vesl requires a local Nockchain source tree. Set `$NOCK_HOME` to point at it, or configure the path in `vesl.toml`.
:::

## What just happened?

`make build` compiled the Hoon kernel to a JAM file and built the Hull (Rust harness). `make run` starts the Hull, which loads the kernel and exposes the HTTP API.

Next: [Installation](/getting-started/installation) for the full dependency list, or [Configuration](/guides/configuration) to understand `vesl.toml`.

~
