---
title: Install
description: Toolchain prerequisites, graft-inject install, and the [patch.crates-io] ibig block every project needs.
outline: deep
---

# Install

## Prerequisites

- **`hoonc`, `nockchain`, `nockup`** — all four ship from the [nockchain monorepo](https://github.com/nockchain/nockchain). Follow that repo's install instructions; the binaries land on your PATH.
- **Rust nightly** — pinned in vesl-nockup's `rust-toolchain.toml` (current pin: `2025-11-26`). `cargo +nightly` resolves to it once `rustup` is installed.
- **Local checkouts of `vesl-core` and `vesl-nockup`**, siblings to your `nockchain` checkout (e.g. `~/projects/nockchain/{vesl-core,vesl-nockup,nockchain}`). The Cargo path-deps in your project's `Cargo.toml` resolve through this layout.
- **`$NOCK_HOME`** — set to the nockchain monorepo root, or configure `nock_home` in your project's `vesl.toml`. `hoonc` reads this to resolve `/lib/`, `/sys/`, and jet builds; if unset it panics with `Failed to canonicalize path`.

## Install `graft-inject`

`graft-inject` is the CLI that composes Hoon graft libraries into your kernel. Install it from the vesl-nockup checkout:

```bash
cd vesl-nockup/tools/graft-inject && cargo install --path .
```

This drops the binary in `~/.cargo/bin/`, which is already on the Rust-nightly PATH.

## Verify the toolchain

```bash
hoonc --version && nockchain --version && nockup --help >/dev/null && cargo +nightly --version && graft-inject --version
```

If all five resolve, you're ready to [scaffold a project](/setup/quickstart).

## The `[patch.crates-io] ibig` block

Every project's `Cargo.toml` needs this. The vesl-core / `nock-noun-rs` crates live in the [vesl-core](https://github.com/zkvesl/vesl-core) repo, not in vesl-nockup. vesl-core's transitive `vesl-signing` dep declares `ibig = "0.3"` from crates.io; vesl-core's signing module uses the nockchain-vendored `ibig` at a local path. Same upstream code, but Cargo treats the two as distinct crates and `signing.rs` fails to type-check unless you unify them:

```toml
[patch.crates-io]
ibig = { path = "../../nockchain/crates/nockvm/rust/ibig" }
```

This goes in your project's `Cargo.toml` alongside the `[patch."https://github.com/nockchain/nockchain.git"]` block. The full fixup (path deps, both `[patch]` blocks) lives on [Initialize a project](/build/initialize).

## See also

- [vesl-nockup README — Prerequisites](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#prerequisites)
- [vesl-core README](https://github.com/zkvesl/vesl-core/blob/main/README.md) — settlement modes, `vesl.toml`, and the EVM ↔ Nockchain mapping.
