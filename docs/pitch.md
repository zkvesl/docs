---
title: vesl at a glance
description: Single-page pitch — what vesl is, what ships, a 10-line code example, and where to start.
outline: deep
---

# vesl at a glance

**Fourteen verifiable primitives, one composition command, typed at every seam.** The hard parts ship as grafts; you write the application.

Building a verifiable app means weeks of crypto code, custom state machines, replay-attack logic, and a hand-rolled HTTP server — before you ship a feature. vesl-nockup gives you all four as composable primitives. Drop in Merkle commitments, STARK proofs, RBAC, an audit log, or a settlement queue with one command. Drive the kernel from typed Rust with compile-time drift detection. Test against the real kernel, not a mock. Boot a production HTTP server out of the box.

## What ships

- **14 grafts** across four families plus a placeholder: commitment (`settle`, `mint`, `guard`, `forge`), state (`kv`, `counter`, `queue`, `rbac`, `registry`), behavior (`validate`, `log`, `clock`, `batch`), and intent (`intent` — placeholder).
- **Typed Rust SDK** — `vesl-core` exports `Mint`, `Guard`, `Settle`, one `build_*_poke` per cause, and effect decoders for every cell-payload variant.
- **Real-kernel test harness** — `vesl-test` boots the same `out.jam` your app does. What you test is what your users get.
- **HTTP server out of the box** — `vesl-hull` mounts `/commit`, `/settle`, `/verify`, `/tx/{tx_id}`, `/status`, `/health`. API-key auth, body-limit, rate-limit included.
- **Live updates preserve state** — edit Hoon, recompile, restart; accumulated state survives via PMA. A new feature is a sub-minute deploy.
- **Loud failures** — `compile.sh` verifies its artifact, lints refuse to compose corrupted Hoon, `verify-jam` detects stale kernels, `assert_kernel_cause_tag!` turns hull/kernel drift into a compile error.

## Ten lines, end to end

```rust
// Example: register a Merkle root, settle a note against it.
use vesl_core::{Mint, build_settle_register_poke, build_settle_note_poke};

let mut mint = Mint::new();
let root = mint.commit(&[b"first-license"]);

app.poke(SystemWire.to_wire(), build_settle_register_poke(1, &root)).await?;
app.poke(SystemWire.to_wire(), build_settle_note_poke(1, 1, &root, b"first-license")).await?;
// %settle-registered + %settle-noted — Merkle-rooted, replay-protected.
```

## Three commands to a running verifiable kernel

```bash
nockup project init                              # scaffold from the vesl template
nockup graft inject --apply hoon/app/app.hoon    # compose the grafts in
cargo +nightly run --release                     # boot the hull
```

About 80 lines per graft. Your domain logic stays five to ten lines of Hoon per cause; everything else is composed.

## Where vesl ends and nockchain begins

Nock is nockchain's combinator calculus. JAM serialization, tip5 hashing, the STARK proving stack, and the deterministic Nock interpreter are all nockchain's primitives — not vesl's. vesl runs a Hoon kernel inside nockchain's `NockApp` and ships a graft library plus a Rust SDK on top. It does not invent determinism, proving, or the noun model. The foundation's properties (post-quantum cryptographic primitives, transparent STARKs without trusted setup, byte-for-byte reproducible execution) are inherited — vesl makes them composable into your app surface.

## Where to start

- [Quickstart](/setup/quickstart) — three commands from empty directory to `%settle-registered` + `%settle-noted`.
- [Build a Real App](/build/real-app) — compose five grafts into a license registry, end to end.
- [What Is vesl](/welcome/what-is-vesl) — the longer-form orientation.
- [Grafts](/build/grafts/) — the 14-graft catalog with per-graft Rust snippets.
- [Production Checklist](/build/build-run/production-checklist) — pre-ship verification surface.

::: info See Also

- [vesl-nockup on GitHub](https://github.com/zkvesl/vesl-nockup) — the canonical source repo.
- [vesl-core on GitHub](https://github.com/zkvesl/vesl-core) — the Rust SDK crate.
- [Glossary](/reference/glossary) — every term used on this page, defined.

:::
