---
title: Initialize a project
description: Scaffold with nockup, then apply the three Cargo.toml fixups required before vesl deps will compile.
outline: deep
---

# Initialize a project

`nockup project init` produces a minimal scaffold; vesl deps need three Cargo fixups before the project will compile. This page covers the fixups in detail. The [Install](/setup/install) page covers the toolchain prerequisites.

## `nockapp.toml`

From whatever directory you want your project to live under, write the manifest and let nockup create the subdir:

```bash
cat > nockapp.toml <<'TOML'
[package]
name = "my-app"
version = "0.1.0"
description = "grafted NockApp"
template = "basic"
TOML

nockup project init
cd my-app
```

The filename must be exactly `nockapp.toml`. nockup reads it from the current directory and writes `my-app/` containing `hoon/app/app.hoon`, `src/main.rs`, `Cargo.toml`, and `build.rs`.

## Project layout

```
my-app/
├── Cargo.toml          # needs three fixups — see below
├── build.rs            # collapsed to a one-line no-op
├── src/main.rs         # rewritten in Step 6 of the quickstart
├── hoon/
│   └── app/app.hoon    # marker template lands here in Install grafts
└── nockapp.toml
```

## Cargo.toml — three fixups

The vesl-core / nock-noun-rs crates live in the [vesl-core](https://github.com/zkvesl/vesl-core) repo, not in vesl-nockup. To resolve them locally — and to keep nockchain's transitive git deps from competing with your local checkout — replace the scaffolded `[dependencies]` with path deps and add two `[patch]` blocks:

```toml
[dependencies]
nockapp       = { path = "../../nockchain/crates/nockapp", default-features = false }
nockvm        = { path = "../../nockchain/crates/nockvm/rust/nockvm" }
nockvm_macros = { path = "../../nockchain/crates/nockvm/rust/nockvm_macros" }

vesl-core    = { path = "../../vesl-core/crates/vesl-core" }
nock-noun-rs = { path = "../../vesl-core/crates/nock-noun-rs" }

tokio = { version = "1", features = ["rt-multi-thread", "macros"] }

[patch."https://github.com/nockchain/nockchain.git"]
nockapp         = { path = "../../nockchain/crates/nockapp" }
nockvm          = { path = "../../nockchain/crates/nockvm/rust/nockvm" }
nockvm_macros   = { path = "../../nockchain/crates/nockvm/rust/nockvm_macros" }
nockchain-math  = { path = "../../nockchain/crates/nockchain-math" }
nockchain-types = { path = "../../nockchain/crates/nockchain-types" }
noun-serde      = { path = "../../nockchain/crates/noun-serde" }
ibig            = { path = "../../nockchain/crates/nockvm/rust/ibig" }

[patch.crates-io]
ibig = { path = "../../nockchain/crates/nockvm/rust/ibig" }
```

Adjust `../../` to wherever your `nockchain` and `vesl-core` checkouts live relative to the project. The `[patch.crates-io] ibig` block is mandatory; see [Install — the ibig block](/setup/install#the-patch-crates-io-ibig-block) for the rationale.

If `nockup package add zkvesl/vesl-graft` resolves for you, the two `vesl-core` / `nock-noun-rs` lines under `[dependencies]` will be written by the registry — leave them out of this block. Everything else stays.

## build.rs

vesl compiles `out.jam` via an explicit `hoonc` call (see [Build & run](/build/build-run)). Collapse `build.rs` to a no-op that just declares the rebuild dependency:

```rust
fn main() {
    println!("cargo:rerun-if-changed=out.jam");
}
```

## src/main.rs

The scaffolded driver wraps the CLI in `Some(cli)` and imports a handful of unused symbols. Step 6 of the [quickstart](/setup/quickstart#6-exercise-the-lifecycle) replaces this file wholesale; leave it alone for now.

## See also

- [vesl-nockup README — Step 1](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#step-1--scaffold-a-project) — the canonical version of this section.
