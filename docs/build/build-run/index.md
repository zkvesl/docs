---
title: Build & Run
description: Compile the kernel with hoonc, build the hull with cargo, run the Demo arm or one of the three settlement modes.
outline: deep
---

# Build & Run

Two compile steps: `hoonc` produces `out.jam` from your composed Hoon, then `cargo +nightly build --release` produces the hull binary that loads it. `cargo +nightly run --release` does both (assuming `out.jam` is already current). `--release` is non-optional — see [Quickstart → Why `--release`?](/setup/quickstart#why-release) for the underlying `nockvm::is_in_frame` debug-assertion that requires it.

```d2
direction: right

src: "hoon/app/app.hoon\n+ hoon/lib/* + hoon/common/*"
hoonc
jam: "out.jam"
check: "[ -s out.jam ]" {
  shape: diamond
}
fail: "error: silent-failed compile"
cargo: "cargo +nightly build --release"
bin: "target/.../hull"
run: "cargo +nightly run --release"

src -> hoonc -> jam -> check
check -> fail: empty
check -> cargo: present
cargo -> bin -> run
```

## Compile the Kernel

```bash
./compile.sh
```

`compile.sh` ships in the scaffold. It runs `hoonc hoon/app/app.hoon hoon/`, then checks the `out.jam` artifact — structural type errors during eager-parse can leave hoonc with no panic message, exit 0, and no `out.jam` written, so the exit code alone is not trustworthy. `compile.sh` fails loud when hoonc produced nothing, instead of letting the next step run against a stale kernel.

Run `hoonc hoon/app/app.hoon hoon/` directly to skip the wrapper; add `--new` to bypass hoonc's cache.

## verify-jam — Structured Alternative

For the silent-fail case AND the case where `out.jam` exists but is stale (kernel sources edited without recompile), pair the compile with `vesl-test verify-jam`:

```bash
./compile.sh
sha256sum hoon/app/app.hoon hoon/lib/*.hoon hoon/lib/*.toml > .out-jam-source-fingerprint
vesl-test verify-jam .   # exit 0 fresh, 1 stale, 2 no fingerprint
```

The fingerprint sidecar pins the source bytes the current `out.jam` was compiled from. Most useful right before driving a kernel that took 10+ minutes to compile.

## Build the Hull

```bash
cargo +nightly build --release
```

First build compiles the full nockchain stack — expect 2–5 minutes with path deps (faster on subsequent builds), or longer if any nockchain git deps resolve over the network.

## Run

The scaffolded binary is a clap dispatch with two arms — both boot `out.jam`, then hand the booted `NockApp` to the selected arm:

```bash
cargo +nightly run --release                # Demo arm (default): register a root, settle a note
cargo +nightly run --release -- serve       # Serve arm: HTTP API on http://127.0.0.1:3000
```

Expected Demo-arm output for the canonical [quickstart hull](/setup/quickstart#_4-exercise-the-lifecycle):

```
  effect: %settle-registered
  effect: %settle-noted
```

Each line is one effect from the kernel, parsed via `vesl_core::effect_head_tags(&effects)` in the hull. The Serve arm and its flag / endpoint catalog live on [Serve Subcommand](/build/build-run/serve).

## Settlement Modes

A nockapp can run kernel-only (no chain interaction) or with full settlement against a nockchain endpoint. Two surfaces select the mode:

- `--settlement-mode <mode>` — CLI flag on the hull binary. Per-invocation override; reach for it when you want a single run to depart from the project default.
- `settlement_mode = "<mode>"` — field in `vesl.toml`. The committed project default that applies whenever the CLI flag is absent.

The CLI flag wins over the TOML field. With neither set, `--chain-endpoint` or `--submit` infer `fakenet`; otherwise the mode is `local`. The three modes:

| Mode | What happens | Chain required | Walkthrough |
|------|-------------|----------------|-------------|
| `local` | Kernel verifies, no chain interaction. Default. | No | (this page) |
| `fakenet` | Sign, build tx, submit to a local nockchain fakenet. | Yes (local) | [Fakenet Walkthrough](/build/build-run/fakenet) |
| `dumbnet` | Same as fakenet but uses a real seed phrase for key derivation. | Yes (live) | [Dumbnet Walkthrough](/build/build-run/dumbnet) |

A minimal `vesl.toml` for local-mode runs:

```toml
nock_home = "../nockchain"
api_port = 3000
settlement_mode = "local"
```

`nock_home` points to your nockchain monorepo checkout. `api_port` is read by hulls that expose an HTTP shell (e.g. the Serve arm). The full field list lives in [Reference / vesl.toml](/reference/vesl-toml).

::: info See Also

- [Serve Subcommand](/build/build-run/serve) — flags, auth model, endpoint catalog, custom router composition.
- [Fakenet Walkthrough](/build/build-run/fakenet) — hub + miner + signing key wiring for the local testnet.
- [Dumbnet Walkthrough](/build/build-run/dumbnet) — seed-phrase resolution and live-network settings.
- [vesl-nockup README — Step 4 (compile)](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#step-4--compile-the-kernel) — hoonc invocation and the staleness guard.
- [vesl-nockup README — Step 5 (build/run)](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#step-5--build-and-run) — cargo build, run flags, settlement-mode selection.
- [Reference / vesl.toml](/reference/vesl-toml) — full field list including the `[wallet]` schema.

:::
