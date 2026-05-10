---
title: A Quick Note
description: From an empty directory to a grafted NockApp emitting %settle-registered + %settle-noted in three commands.
outline: deep
---

# A Quick Note

vesl ships in two repos. [vesl-core](/going-deeper/vesl-core) is the Rust SDK and Hoon library — drop it into your own Cargo workspace if you'd rather not depend on `nockup`. [vesl-nockup](https://github.com/zkvesl/vesl-nockup) is the recommended starting point: a self-contained distribution that pairs with `nockup`, the project scaffolder shipped from the nockchain monorepo. Most of this guide assumes you're using nockup; if you've chosen the standalone path, the [vesl-core orientation](/going-deeper/vesl-core) is the page to read instead.

## Lets get started

Three commands from an empty directory to a kernel that registers a Merkle root and settles a note against it:

```bash
nockup project init                                    # fetches vesl template + zkvesl/vesl-graft
nockup graft inject --apply hoon/app/app.hoon          # composes grafts into the kernel
cargo +nightly run                                     # builds out.jam, runs the kernel
```

If `hoonc`, `nockchain`, `nockup`, or `vesl-core` are unfamiliar, see the [Concepts section](/welcome/what-is-vesl#concepts) first.

## Prerequisites

1. **Clone the nockchain monorepo** — source for `nockup`, and for the `nockchain` binary later if you run against fakenet/dumbnet (the three-command flow below doesn't need the chain binary on `PATH`):

   ```bash
   git clone https://github.com/nockchain/nockchain.git
   ```

2. **Install `nockup`** — the project scaffolder. `nockup install` downloads `hoon`, `hoonc`, and `nockup` itself into `~/.nockup/bin/` and prepends that to your `PATH`. Either script install or build from the cloned monorepo:

   ```bash
   # Script install
   curl -fsSL https://raw.githubusercontent.com/nockchain/nockchain/refs/heads/master/crates/nockup/install.sh | bash

   # Or build from source
   cd nockchain && cargo install --path crates/nockup --locked
   ```

3. **Rust nightly** — `rustup toolchain install nightly`. Then `cargo +nightly` resolves to it.

4. **`nockup-graft`** — vesl-flavored graft composer; ships from vesl-nockup as a sidecar binary alongside `graft-inject`:

   ```bash
   cargo install --git https://github.com/zkvesl/vesl-nockup --bin nockup-graft
   ```

   Once installed, `nockup graft <subcmd>` resolves the binary via nockup's plugin discovery and dispatches to it. The standalone `graft-inject` binary stays available too.

Verify the toolchain:

```bash
hoonc --version && nockup --help >/dev/null && cargo +nightly --version && nockup-graft --version
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

`nockup project init` does three things:

1. Creates the `my-app/` project directory.
2. Pulls in the vesl graft library.
3. Configures `Cargo.toml` so the project builds standalone — you'll see a confirmation prompt; press `y`.

::: tip Running this in a script
The confirmation prompt in step 3 blocks unattended runs. To pre-approve, pipe consent:

```bash
yes y | nockup project init
```
:::

## 2. Wire the kernel

```bash
nockup graft inject hoon/app/app.hoon            # preview
nockup graft inject --apply hoon/app/app.hoon    # write
```

The template's `app.hoon` ships with ten `::  nockup:*` markers at fixed structural points. `nockup graft inject` discovers every `<name>-graft.toml` under `hoon/lib/`, composes their per-marker blocks, and (with `--apply`) writes the result. About 80 lines per graft.

Preview is the default. Nothing lands on disk until you pass `--apply` — this keeps a compromised `hoon/lib/` from silently composing hostile Hoon into your kernel source. See [Wire with graft-inject](/build/wire) for marker semantics, lint families, and the per-graft sha256 banner.

## 3. Build and run

```bash
hoonc hoon/app/app.hoon hoon/ && [ -s out.jam ] || \
  (echo "hoonc: silent-failed — exit 0 but no out.jam" >&2; exit 1)

cargo +nightly run
```

The `[ -s out.jam ]` guard is load-bearing: hoonc can exit 0 with no jam written under structural type errors. See [Build & run](/build/build-run) for `vesl-test verify-jam`, the structured alternative.

First Cargo build fetches and compiles the full nockchain stack — expect 2–5 minutes.

## Expected output

The last two lines should be:

```
  effect: %settle-registered
  effect: %settle-noted
```

Each `effect:` line is a tagged event the kernel emitted back to the driver:

- **`%settle-registered`** — the kernel accepted a Merkle root under a namespace (called a `hull`). The root is a fingerprint of a set of items; once registered, only items that hash into it can later be proven to belong.
- **`%settle-noted`** — the driver then submitted one item from that set along with a Merkle proof, and the kernel verified the proof matches the registered root. The item is now recorded as settled, and the same item can't be settled twice.

This commit-then-prove cycle is the canonical vesl pattern. The same shape powers asset registries, licensing flows, and audit logs — anywhere a kernel needs cryptographic evidence that an item belongs to a published set. The template's `src/main.rs` is a 30-line driver that walks the lifecycle once; you'll extend it to your domain in [Build / The Rust driver](/build/rust-driver).

## Where to go next

- [Shape of a nockapp](/build/shape) — what the hull, grafts, and your domain are doing under the hood.
- [Customizing](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#customizing) — multi-leaf gates, signed gates, STARK gates, custom domain pokes.
- [State grafts](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#state-grafts-app-state-primitives-without-writing-hoon) — `kv-graft`, `counter-graft`, `queue-graft`, `rbac-graft`, `registry-graft`.
- [`mint_lifecycle.rs`](https://github.com/zkvesl/vesl-nockup/blob/main/tools/graft-inject/tests/mint_lifecycle.rs) — Rust-native end-to-end test that mirrors the lifecycle above.

## Troubleshooting

- **`Template 'vesl' not found at <path>`** — nockup fetched the template repo via `template_git` but couldn't find `<template_path>/<template>/` inside it. Verify the `template_git`, `template_path`, and `template` fields all line up. If you're working against a branch where the template doesn't exist yet, pin `template_commit = "<sha>"` to a known-good commit. Omitting `template_git` falls back to the channel cache populated by `nockup channel update`.

- **`unknown command: graft`** — `nockup-graft` isn't on your `$PATH`. Re-run `cargo install --git ... --bin nockup-graft` and verify with `which nockup-graft`.
