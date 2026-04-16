# Quick Start

Pick the path that matches your situation.

## Path A: Run the full vesl product (Hull)

For evaluating vesl or deploying the verified-RAG pipeline.

**Prerequisites:** [Nockchain](https://github.com/zorp-corp/nockchain) monorepo cloned and built at a sibling path, with `hoonc` and `nockchain` in your PATH. Rust nightly (pinned in `hull/rust-toolchain`).

```bash
git clone https://github.com/zkVesl/vesl.git
cd vesl
cp vesl.toml.example vesl.toml     # edit nock_home if your layout differs
make setup                          # create hoon symlinks
make build                          # compile hull
make demo-local                     # full pipeline, no chain needed
```

`make demo-local` runs the full pipeline: ingest documents, retrieve chunks, verify in the Hoon kernel, settle locally.

## Path B: Add vesl to your NockApp (Graft)

For developers building a NockApp who want verifiable data commitment.

**Prerequisites:** Nockchain monorepo built, `hoonc` in PATH, Rust nightly.

**Starting fresh:**

```bash
cp -r vesl/templates/graft-scaffold my-project
cd my-project
hoonc --new hoon/app/app.hoon hoon/   # compile kernel (all deps bundled)
cargo +nightly build
cargo +nightly run
```

**Adding to an existing project:** Copy `vesl-graft.hoon` and `vesl-merkle.hoon` into your `hoon/lib/`, compose `vesl-state` into your kernel state, delegate the three `%vesl-*` pokes. Full walkthrough in the [Grafting Guide](/guides/grafting).

## Path C: Docker container

For developers who don't want to build nockchain from source.

```bash
docker pull ghcr.io/zkvesl/vesl-dev:latest
docker run -it -v $(pwd):/workspace ghcr.io/zkvesl/vesl-dev:latest
```

The container includes Rust nightly, `hoonc`, and all vesl SDK crates. Follow Path A or B inside the container.

::: warning
The Docker image is not yet published. Until then, build from source per [Installation](/getting-started/installation).
:::

## Next steps

- [Grafting Guide](/guides/grafting) — full walkthrough for all three developer paths
- [SDK Reference](/reference/sdk) — Mint, Guard, and tip5 encoding API
- [Configuration](/guides/configuration) — settlement modes and `vesl.toml`
- [Writing Hoon](/guides/writing-hoon) — minimum Hoon needed for graft customization
- Run `make help` for all hull targets

~
