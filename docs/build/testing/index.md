---
title: Testing
description: Driving vesl-test — the Rust harness and standard suite, domain pokes for any graft, slog diagnostics, and the CLI for ad-hoc kernel inspection.
outline: deep
---

# Testing

`vesl-test` ships with vesl-nockup as both a Rust library (for `cargo test` integration tests) and a CLI (for ad-hoc kernel inspection). The vesl template wires the Rust dependency into `[dev-dependencies]` and lands a starter `tests/graft_lifecycle.rs` you can extend.

## The Rust Library

Three pages cover the `vesl-test` crate.

### The Rust Harness

`GraftTestHarness` boots a compiled `out.jam` and runs the standard 8-op settle-graft suite. Walked on [The Rust Harness](/build/testing/harness).

### Domain Pokes

For grafts beyond settle-graft, `harness.poke_slab` plus the `build_<graft>_<verb>_poke` family drives any cause, and `harness.peek_handle` reads state back. Walked on [Domain Pokes](/build/testing/domain-pokes).

### Slog Diagnostics

When the effect list alone can't tell a gate-deny from a cause-shape rejection, `poke_slab_report` captures the slogs the kernel emitted during the poke. Walked on [Slog Diagnostics](/build/testing/slog-diagnostics).

## The CLI

The `vesl-test` binary boots a compiled `out.jam` and exposes `inspect peek`, `watch`, and `verify-jam` for inspection without writing a Rust hull. Walked on [The CLI](/build/testing/cli).

::: info See Also

- [vesl-nockup README — Testing with vesl-test](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#testing-with-vesl-test) — harness API and standard-suite walkthrough.
- [`test/vesl-test/src/lib.rs`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/test/vesl-test/src/lib.rs) — `GraftTestHarness` API, the standard-suite definition, `PokeReport` and slog parsing.

:::
