---
title: The CLI
description: The vesl-test CLI — installing it, plus the inspect peek, watch, and verify-jam subcommands for ad-hoc kernel inspection.
outline: deep
---

# The CLI

The `vesl-test` binary boots a compiled `out.jam` and exposes three subcommands for inspection without writing a Rust hull.

## Installing `vesl-test`

The binary is bundled in the vesl-nockup repo at `test/vesl-test/`. It depends on nockchain crates via sibling-path deps, so install it from a local vesl-nockup checkout with a sibling `nockchain/` clone (the layout the [quickstart](/setup/quickstart) describes):

```bash
cd vesl-nockup
cargo install --path test/vesl-test --locked
```

`cargo install --git` does not work for this binary because the sibling-path deps don't resolve from cargo's git cache.

## `inspect peek` — One-Shot Kernel Inspection

```bash
# keyless: [%log-len ~]
vesl-test inspect peek out.jam --path-tag log-len

# hull-keyed: [%settle-registered hull=1 ~]
vesl-test inspect peek out.jam --path-tag settle-registered --hull 1

# cord-keyed: [%kv-value @t %greeting ~]
vesl-test inspect peek out.jam --path-tag kv-value --key greeting

# stable JSON for downstream tooling
vesl-test inspect peek out.jam --path-tag log-len --json
```

Each peek returns one of three states:

- **unrecognized** — `++peek` returned bare `~`. Either the path is malformed or the graft owning the tag isn't composed.
- **present-but-empty** — `[~ ~]`. Path is recognized; no value at that key.
- **present** — `[~ [~ value]]`. Atoms render as both Hoon-style decimal-with-dots and (when LE bytes form printable UTF-8) ASCII.

Hoon-literal paths (e.g. `[%kv-value @t %my-key]` typed directly) are out of scope; the `--path-tag` + `--hull` / `--key` form covers every shape the shipped grafts use.

## `watch` — Live-Trace REPL

`inspect peek` is one-shot. When you need to see the kernel reacting to a sequence of pokes — what cause came in, what effects went out, which slogs fired — `vesl-test watch <out.jam>` is the live-trace surface:

```bash
# interactive: type pokes at the prompt, watch effects render below
vesl-test watch out.jam

# pipe a script of pokes
cat pokes.txt | vesl-test watch out.jam --json

# filter by cause-tag
vesl-test watch out.jam --filter cause=settle-register
```

Stdin grammar covers tag-only pokes (`poke-tag <tag>`), hex-encoded pre-jammed pokes (`poke-jam <hex> [tag=<name>]`), keyless / hull-keyed / cord-keyed peeks, a `state` heartbeat, and `quit` for clean shutdown. The README has the full table and the JSON event schema.

When the spawned `app.run()` task panics or returns an error, `watch` prints a `kernel-died: <reason>` row instead of crashing itself. That kernel-died case is the main reason to reach for `watch` over `inspect peek`. Any time you can't tell from a bare poke return whether the kernel saw what you sent, `watch` puts the cause and effect-list on the wire.

## `verify-jam` — Build Staleness Check

Confirm `out.jam` is fresh against the source files it was compiled from:

```bash
vesl-test verify-jam .        # exit 0 fresh, 1 stale, 2 no fingerprint
vesl-test verify-jam . --json # structured output for CI
```

The fingerprint sidecar (`.out-jam-source-fingerprint`) is a `sha256sum` listing of `hoon/app/app.hoon` and each `hoon/lib/*.toml`. Generate it after a clean compile; check it before booting a long-built kernel. See [Build / Build & Run — verify-jam](/build/build-run/#verify-jam-structured-alternative) for the full hoonc + fingerprint pipeline.
