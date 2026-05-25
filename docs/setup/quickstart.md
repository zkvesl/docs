---
title: A Quick Note
description: From an empty directory to a grafted NockApp emitting %settle-registered + %settle-noted in three commands.
outline: deep
---

# A Quick Note

[vesl-nockup](https://github.com/zkvesl/vesl-nockup) is the recommended starting point — a self-contained distribution that pairs with `nockup`, the project scaffolder shipped from the nockchain monorepo. The rest of this guide assumes you're using both.

## Get Started

Three commands from an empty directory to a kernel that registers a Merkle root and settles a note against it:

```bash
nockup project init                                    # fetches vesl template + zkvesl/vesl-graft
nockup graft inject --apply hoon/app/app.hoon          # composes grafts into the kernel
cargo +nightly run --release                           # builds out.jam, runs the kernel
```

If `hoonc`, `nockchain`, or `nockup` are unfamiliar, see [What Is VESL](/welcome/what-is-vesl) or the [Glossary](/reference/glossary) first.

::: tip Why `--release`?
The nockvm runtime ships `debug_assert!`s in its stack-frame check (`is_in_frame`) that fire under debug-build assumptions and are compiled out in release. Booting a 14-graft kernel from a debug build panics on the first poke. `--release` is the supported development mode for vesl-nockup until the upstream assertion is loosened.
:::

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

   Once installed, `nockup graft <subcmd>` resolves the binary via nockup's plugin discovery and dispatches to it.

Verify the toolchain:

```bash
hoonc --version && nockup --help >/dev/null && cargo +nightly --version && nockup-graft --version
```

### Shell completions (optional)

Both `nockup-graft` and `vesl-test` emit completion scripts for bash, zsh, fish, elvish, and powershell via a `completions <shell>` subcommand. One-line install per shell:

```bash
# bash — drop into the user's bash-completion dir; re-source your bashrc.
nockup-graft completions bash > ~/.local/share/bash-completion/completions/nockup-graft
vesl-test    completions bash > ~/.local/share/bash-completion/completions/vesl-test

# zsh — into the first fpath entry; rebuild compinit (`exec zsh` or `compinit`).
nockup-graft completions zsh  > "${fpath[1]}/_nockup-graft"
vesl-test    completions zsh  > "${fpath[1]}/_vesl-test"

# fish — picked up automatically on next shell start.
nockup-graft completions fish > ~/.config/fish/completions/nockup-graft.fish
vesl-test    completions fish > ~/.config/fish/completions/vesl-test.fish
```

After install, tab-complete subcommands (`nockup-graft inj<TAB>` → `inject`) and flag names (`nockup-graft inject --lib-<TAB>` → `--lib-dir`). The scripts are clap-generated, so they stay in sync with the binary on every rebuild — re-run the install line after a `cargo install --force` to pick up new subcommands.

## 1. Scaffold from the `vesl` Template

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
3. Runs the package's post-install patches — `Cargo.toml` rewrites that align Rust deps with the pinned nockchain revision, plus any scaffold-file additions the package declares. You'll see a confirmation prompt that lists every patch operation; press `y` to apply. Patches are declarative — no code runs.

::: tip Running this in a script
The confirmation prompt in step 3 blocks unattended runs. To pre-approve, pipe consent:

```bash
yes y | nockup project init
```
:::

## 2. Wire the Kernel

```bash
nockup graft inject hoon/app/app.hoon            # preview
nockup graft inject --apply hoon/app/app.hoon    # write
```

The template's `app.hoon` ships with ten `::  nockup:*` markers at fixed structural points. `nockup graft inject` discovers every `<name>-graft.toml` under `hoon/lib/`, composes their per-marker blocks, and (with `--apply`) writes the result. About 80 lines per graft.

Preview is the default. Nothing lands on disk until you pass `--apply` — this keeps a compromised `hoon/lib/` from silently composing hostile Hoon into your kernel source. See [Inject](/build/grafts/inject) for marker semantics, lint families, and the per-graft sha256 banner.

Inject also refuses to compose when the project has no `nockapp.toml` — the file you wrote in [§1](#_1-scaffold-from-the-vesl-template) is the trust anchor, per [Manifest Schema → Trust Model](/build/grafts/manifest-schema#trust-model). Without it, inject would splice arbitrary Hoon from any directory into your kernel; running from inside the scaffolded project keeps this check satisfied.

## 3. Build and Run

```bash
./compile.sh
cargo +nightly run --release
```

`compile.sh` ships in the scaffold: it runs `hoonc`, then fails loud if hoonc exited 0 without writing `out.jam` — a structural type error can cause exactly that. See [Build & Run](/build/build-run/) for `vesl-test verify-jam`, the staleness check.

First Cargo build fetches and compiles the full nockchain stack — expect 2–5 minutes.

## 4. Verify Effects

The last two lines should be:

```
  effect: %settle-registered
  effect: %settle-noted
```

Each `effect:` line is a tagged event the kernel emitted back to the hull:

- **`%settle-registered`** — the kernel accepted a Merkle root under a namespace (called a `hull`). The root is a fingerprint of a set of items; once registered, only items that hash into it can later be proven to belong.
- **`%settle-noted`** — the hull then submitted one item from that set along with a Merkle proof, and the kernel verified the proof matches the registered root. The item is now recorded as settled, and the same item can't be settled twice.

This commit-then-prove cycle is the canonical vesl pattern. The same shape powers asset registries, licensing flows, and audit logs — anywhere a kernel needs cryptographic evidence that an item belongs to a published set. The template's `src/main.rs` is a clap dispatch — the `Demo` arm walks the lifecycle once; the `Serve` arm boots the same kernel and mounts the `vesl-hull` HTTP API. See [Build / Hull → Scaffold CLI: Demo and Serve](/build/hull#scaffold-cli-demo-and-serve) for the Serve flags and endpoint catalog. You'll extend the Demo arm to your domain in [Build / Hull](/build/hull).

## 5. Exercise the Lifecycle

You've watched the binary emit two effects from a startup poke. The next step is to confirm those effects landed in kernel state and to query that state from outside the lifecycle.

### Observe both effects

Re-run the binary and capture the effect list. The two head tags emitted are:

| Effect | Full payload | Meaning |
|---|---|---|
| `%settle-registered` | `[hull=@ root=@]` | A hull was registered against the configured root; the hull is now known to settle-graft. |
| `%settle-noted` | `note=[id=@ hull=@ root=@ state=[%settled ~]]` | A note was filed against the registered hull; settle-graft updated its per-hull index. |

For the full payload shape of every shipped effect, see [Effect Catalog → settle-graft](/reference/effect-catalog#settle-graft).

### Peek the registered hull

To confirm the hull registered, ask the running kernel directly. The `vesl-test` CLI (installed once via `cargo install --path test/vesl-test --locked` from your vesl-nockup checkout) sends one-shot peeks against a compiled `out.jam`:

```bash
# hull-keyed peek: did settle-graft register hull 1?
vesl-test inspect peek out.jam --path-tag settle-registered --hull 1
```

Three outcomes:

- **unrecognized** — bare `~`. The settle-graft tag isn't composed, or the path is malformed.
- **present-but-empty** — `[~ ~]`. Path recognized; no value at that hull.
- **present** — `[~ [~ value]]`. Hull is registered.

See [Testing → The CLI → inspect peek](/build/testing/cli#inspect-peek-one-shot-kernel-inspection) for the full subcommand surface, and [Peek Catalog → settle-graft](/reference/peek-catalog#settle-graft) for every shipped peek path.

### Handcraft a second poke

To go beyond the startup pair — send your own `%settle-note` cause from a test and watch a fresh `%settle-noted` effect — see [Testing → Domain Pokes](/build/testing/domain-pokes#driving-causes). That page shows the `build_settle_note_poke` builder, the harness API, and the matching peek pattern. The same shape extends to every other shipped graft.

## Where to Go Next

- [NockApp Anatomy](/build/anatomy) — what the hull, grafts, and your domain are doing under the hood.
- [Customizing](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#customizing) — multi-leaf gates, signed gates, STARK gates, custom domain pokes.
- [State grafts](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#state-grafts-app-state-primitives-without-writing-hoon) — `kv-graft`, `counter-graft`, `queue-graft`, `rbac-graft`, `registry-graft`.
- [`mint_lifecycle.rs`](https://github.com/zkvesl/vesl-nockup/blob/main/tools/graft-inject/tests/mint_lifecycle.rs) — Rust-native end-to-end test that mirrors the lifecycle above.

## Troubleshooting

- **`Template 'vesl' not found at <path>`** — nockup fetched the template repo via `template_git` but couldn't find `<template_path>/<template>/` inside it. Verify the `template_git`, `template_path`, and `template` fields all line up. If you're working against a branch where the template doesn't exist yet, pin `template_commit = "<sha>"` to a known-good commit. Omitting `template_git` falls back to the channel cache populated by `nockup channel update`.

- **`unknown command: graft`** — `nockup-graft` isn't on your `$PATH`. Re-run `cargo install --git ... --bin nockup-graft` and verify with `which nockup-graft`.
