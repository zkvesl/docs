---
title: Get a nockapp running
description: From an empty directory to a grafted NockApp emitting %settle-registered + %settle-noted in three commands.
outline: deep
---

# Get a nockapp running

Three commands from an empty directory to a kernel that registers a Merkle root and settles a note against it. No Cargo.toml fixups, no marker template `cp` step, no `[patch.crates-io] ibig` block to remember.

```bash
nockup project init                                    # fetches vesl template + zkvesl/vesl-graft
nockup graft inject --apply hoon/app/app.hoon          # composes grafts into the kernel
cargo +nightly run                                     # builds out.jam, runs the kernel
```

If `hoonc`, `nockchain`, `nockup`, or `vesl-core` are unfamiliar, see the [Concepts section](/welcome/what-is-vesl#concepts) first.

## Prerequisites

- **`nockup`** — installs `hoonc`, `nockchain`, and the project scaffolder. Follow the [nockchain monorepo](https://github.com/nockchain/nockchain) install instructions.
- **Rust nightly** — `rustup toolchain install nightly`. Then `cargo +nightly` resolves to it.
- **`nockup-graft`** — vesl-flavored graft composer; ships from vesl-nockup as a sidecar binary alongside `graft-inject`:
  ```bash
  cargo install --git https://github.com/zkvesl/vesl-nockup --bin nockup-graft
  ```
  Once installed, `nockup graft <subcmd>` resolves the binary via nockup's plugin discovery and dispatches to it. The standalone `graft-inject` binary stays available too.

Verify the toolchain:

```bash
hoonc --version && nockchain --version && nockup --help >/dev/null && cargo +nightly --version && nockup-graft --version
```

## 1. Scaffold from the `vesl` template

Write a `nockapp.toml` declaring the package and template source, then let `nockup` create the project:

```bash
cat > nockapp.toml <<'TOML'
[package]
name = "my-app"
version = "0.1.0"
description = "grafted NockApp"
template = "vesl"
template_git = "https://github.com/zkvesl/vesl-nockup"
template_path = "templates"

[dependencies]
"zkvesl/vesl-graft" = "latest"
TOML

nockup project init
cd my-app
```

`nockup project init` (a) fetches the `vesl` template from vesl-nockup via `template_git`, (b) renders it into `my-app/` with handlebars substitutions, then (c) runs `package install` to fetch `zkvesl/vesl-graft` and drop the graft library into `hoon/lib/`.

The scaffolded `Cargo.toml` already has the path-deps for `nockchain/` and `vesl-core/` (sibling checkouts to your project) plus the two `[patch]` blocks (the nockchain git unifier and the `[patch.crates-io] ibig` block). No fixups required.

::: tip Layout
The template assumes:
```
<root>/
├── nockchain/         # https://github.com/nockchain/nockchain
├── vesl-core/         # https://github.com/zkvesl/vesl-core
└── my-app/            # this project
```
If your layout differs, adjust the `../../...` prefixes in `Cargo.toml`.
:::

## 2. Wire the kernel

```bash
nockup graft inject hoon/app/app.hoon            # preview
nockup graft inject --apply hoon/app/app.hoon    # write
```

The template's `app.hoon` ships with nine `::  nockup:*` markers at fixed structural points. `nockup graft inject` discovers every `<name>-graft.toml` under `hoon/lib/`, composes their per-marker blocks, and (with `--apply`) writes the result. About 80 lines per graft.

Preview is the default. Nothing lands on disk until you pass `--apply` — this keeps a compromised `hoon/lib/` from silently composing hostile Hoon into your kernel source. See [Wire with graft-inject](/build/wire) for marker semantics, lint families, and the per-graft sha256 banner.

## 3. Build and run

```bash
hoonc hoon/app/app.hoon hoon/ && [ -s out.jam ] || \
  (echo "hoonc: silent-failed — exit 0 but no out.jam" >&2; exit 1)

cargo +nightly run
```

The `[ -s out.jam ]` guard is load-bearing: hoonc can exit 0 with no jam written under structural type errors. See [Build & run](/build/build-run) for `vesl-test verify-jam`, the structured alternative.

First Cargo build compiles the full nockchain stack — expect 2–5 minutes with path deps.

## Expected output

```
  effect: %settle-registered
  effect: %settle-noted
```

You now have a grafted NockApp with on-kernel Merkle verification and replay-protected settlement.

## What just happened

- The `vesl` template's `src/main.rs` constructed a Merkle commitment over input data, registered the root under `hull = 1`, and settled a note that proves a leaf belongs to the committed set.
- Each poke produced a tagged effect; `vesl_core::effect_head_tags` extracted them.

## Where to go next

- [Shape of a nockapp](/build/shape) — what the hull, grafts, and your domain are doing under the hood.
- [Customizing](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#customizing) — multi-leaf gates, signed gates, STARK gates, custom domain pokes.
- [State grafts](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#state-grafts-app-state-primitives-without-writing-hoon) — `kv-graft`, `counter-graft`, `queue-graft`, `rbac-graft`, `registry-graft`.
- [`mint_lifecycle.rs`](https://github.com/zkvesl/vesl-nockup/blob/main/tools/graft-inject/tests/mint_lifecycle.rs) — Rust-native end-to-end test that mirrors the lifecycle above.

## Troubleshooting

- **`No dependencies to install`** but graft files missing — check `NOCKUP_REGISTRY_URL`. If `zkvesl/vesl-graft` isn't yet in the upstream typhoon registry, point nockup at a local fork:
  ```bash
  NOCKUP_REGISTRY_URL=file:///path/to/local-registry.toml nockup project init
  ```
  See `vesl-nockup/tools/test-registry/local-registry.toml.tmpl` for the expected shape.

- **`Template 'vesl' not found at <cache>/...`** — the resolved commit may not contain the template. Pin `template_commit = "<sha>"` in `nockapp.toml` to a known-good commit on a feature branch, or omit `template_git` to use the channel cache.

- **`unknown command: graft`** — `nockup-graft` isn't on your `$PATH`. Re-run `cargo install --git ... --bin nockup-graft` and verify with `which nockup-graft`.
