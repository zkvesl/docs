---
title: Testing
description: Lifecycle tests with vesl-test, one-shot kernel inspection via `inspect peek`, and the live-trace `watch` REPL.
outline: deep
---

# Testing

`vesl-test` is the integration-test harness and CLI that ships with vesl-nockup. The vesl template wires it into `[dev-dependencies]`:

```toml
vesl-test = { git = "https://github.com/zkvesl/vesl-nockup" }
```

## A Lifecycle Test

```rust
use vesl_test::GraftTestHarness;

#[tokio::test]
async fn graft_lifecycle() -> anyhow::Result<()> {
    let mut h = GraftTestHarness::boot("out.jam").await?;
    let report = h.run_standard_suite().await;
    assert!(report.is_success(), "{:?}", report.failed);
    Ok(())
}
```

The standard suite covers register, duplicate-register, verify, settle, replay, unregistered-hull, and root-mismatch. For raw pokes outside the suite, use `h.poke_slab(slab)`.

## `inspect peek` — One-Shot Kernel Inspection

Once a kernel is compiled, `vesl-test inspect peek` boots `out.jam` and runs a single peek against it without writing a Rust hull:

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

Stdin grammar covers tag-only pokes, hex-encoded pre-jammed pokes (with optional `tag=<name>` annotation), keyless / hull-keyed / cord-keyed peeks, a `state` heartbeat, and `quit` for clean shutdown. The README has the full table and the JSON event schema.

When the spawned `app.run()` task panics or returns an error, `watch` prints a `kernel-died: <reason>` row instead of crashing itself — the kernel-died case is the main reason to reach for `watch` over `inspect peek`. Any time you can't tell from a bare poke return whether the kernel saw what you sent, `watch` puts the cause and effect-list on the wire.

## See Also

- [vesl-nockup README — Testing with vesl-test](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#testing-with-vesl-test)
- [`test/vesl-test/src/lib.rs`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/test/vesl-test/src/lib.rs) — `GraftTestHarness` API and the standard-suite definition.
- [`tools/graft-inject/tests/mint_lifecycle.rs`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/tools/graft-inject/tests/mint_lifecycle.rs) — a real lifecycle test that exercises the full compose → compile → boot → poke → assert chain.
