---
title: Agent Cookbook
description: Practical patterns for an AI coding agent driving vesl-nockup. Ingestion order, typed-surface advantages, the closed-loop watch harness, graft selection, and common failure modes.
outline: deep
---

# Agent Cookbook

**After reading:** you'll know which docs to fetch first, what the typed Rust SDK gives an agent over an untyped boundary, how to drive `vesl-test watch` for closed-loop feedback, and which failure modes are recoverable in-loop vs. need human review.

This page is the working companion to [Orientation](/setup/llms), which names what's published. Orientation tells you the artifacts exist; this page tells you how to use them.

## Ingestion Order

Three fetches cover most agent tasks:

- **`/llms.txt`** first. The index lists every page with a one-line description. Fetching it once tells the agent the shape of the guide.
- **Per-page `.md` mirrors** as needed. `/setup/quickstart.md`, `/build/hull.md`, etc. — fetch only what the task requires. One page costs one page of context.
- **`/llms-full.txt`** for bulk ingestion. The whole guide concatenated in sidebar order. Use when the task spans the docs surface; prefer per-page fetches otherwise.

For source-level questions, the canonical repos are linked from every page that names a primitive. SHA-pinned cross-references in the docs (e.g. `vesl-core` at `11d110d`, `vesl-nockup` at `6e2127c`) point at the exact snapshot the docs were written against. When the agent's checkout is newer, the source is authoritative.

## What the Typed Surface Gets You

The Rust SDK at the kernel boundary is typed at every seam. An agent driving it gets feedback shapes that an untyped boundary would have to discover at runtime:

- **`PokeOutcome` enum.** Every `app.poke(...)` returns one of `Accepted { effects } | Rejected { reason } | Crashed { error }`. The agent matches on the variant; an unhandled variant is a compile error, not a silent miss.
- **`assert_kernel_cause_tag!` at compile time.** With drift-detection codegen wired (see [Hull → Hull/Kernel Drift Detection](/build/hull#hull-kernel-drift-detection)), a typo in a cause tag fails `cargo build`, not at runtime as a silent `Ok(vec![])`. Wire `nockup graft codegen kernel-cause-tags` from `build.rs` to opt in.
- **Codegen-driven harness methods.** `nockup graft codegen harness-methods` generates typed `GraftTestHarness::<verb>(...)` methods from `harness-bindings.toml`. A rename in either the manifest or the binding surfaces as a codegen-time error.
- **`build_*_poke` builders.** One per cause; the canonical 14-graft surface is on [Grafts — Per-Graft Rust Snippets](/build/grafts/#per-graft-rust-snippets). Each takes typed Rust primitives and returns a `NounSlab`. The agent doesn't construct nouns by hand.

The typed surface compresses the agent's feedback loop. Where an untyped poke surfaces a problem as `Ok(vec![])` with no effects (silent), the typed shape fails `cargo build` or returns a concrete `PokeOutcome::Rejected` variant the agent can branch on.

## Closed-Loop Development

`vesl-test watch` streams effects from a running kernel, which makes for a tight read-eval-print loop:

- **Start the loop.** Boot the kernel via `cargo run`, then in a second terminal: `vesl-test watch`. The watch stream emits one line per effect.
- **Poke and observe.** Drive a poke through the hull (or via the Serve arm's HTTP routes). The watch stream prints each emitted effect as it lands.
- **Branch on the effect.** Success effects (e.g. `%settle-noted`) confirm the path. Error effects (e.g. `%settle-error msg=@t`) carry the rejection reason as a cord.
- **Iterate.** Edit Hoon, recompile, restart. State survives via PMA-resume. Boot drops from ~15s cold to ~1s warm.

For a one-shot inspection without watch, `vesl-test inspect peek <path>` returns the current value at a peek path. Full surface: [Testing / CLI](/build/testing/cli).

## Recommended File Reads Per Task

Different tasks lean on different pages. A short map:

- **"Scaffold a new nockapp."** Start at [Setup / Quickstart](/setup/quickstart). The three-command flow there scaffolds, composes, and boots a kernel.
- **"Add a new poke verb."** [Kernel / Adding a Domain Cause](/build/kernel/causes) walks state field + cause variant + arm body for a single domain cause. The denial-shape paragraph at the end is load-bearing — bare `?>` crashes the kernel where an explicit branch returns a typed rejection.
- **"Read state without a poke."** [Kernel / Adding a Domain Peek](/build/kernel/peeks) walks the `(unit (unit *))` return convention and the peek chain.
- **"Swap the verification gate."** [Kernel / Replacing a Verification Gate](/build/kernel/gates) covers the five named gates in `vesl-gates.hoon` and the `[graft.gates]` manifest line.
- **"Wire two grafts in one arm."** [Kernel / Coordinating Multiple Grafts in One Arm](/build/kernel/multi-graft) walks the `apply-<graft>` wet-gate pattern from `domain-patterns`.
- **"Run a server in production."** [Build & Run / Serve Subcommand](/build/build-run/serve) for flags, auth, and `/status` shape; [Build & Run / Production Checklist](/build/build-run/production-checklist) for the pre-ship walk.
- **"Investigate a runtime issue."** [Troubleshooting / Common Pitfalls](/troubleshooting/common-pitfalls) names every footgun in the symptom-first format: what you see, what's happening, the fix.

## Graft Selection

The 14 shipped grafts cluster by family. A short selection guide:

- **Commitment (`settle`, `mint`, `guard`, `forge`)** — pick by lifecycle. `settle` for the full register/verify/note cycle with replay protection. `mint` for one-shot root binding without verification. `guard` for hash-leaf inclusion checks. `forge` for STARK proofs over committed data.
- **State (`kv`, `counter`, `queue`, `rbac`, `registry`)** — pick by access shape. `kv` for key-value, `counter` for atomic increments, `queue` for FIFO, `rbac` for permission grants, `registry` for structured records.
- **Behavior (`validate`, `log`, `clock`, `batch`)** — pick by wrap point. `validate` for pre-`?-`-switch input rules. `log` for append-only audit. `clock` for deterministic timestamps. `batch` for settlement-flush bundling.
- **Intent (`intent-graft`)** — placeholder, no builder. Causes crash on invocation until upstream lands.

The full taxonomy with priority bands lives on [Grafts](/build/grafts/#the-5-family-graft-taxonomy). Per-graft Rust snippets — one realistic poke per graft — live on [Grafts — Per-Graft Rust Snippets](/build/grafts/#per-graft-rust-snippets).

## Common Failure Modes

A short catalog of failure shapes an agent will see, with the recovery path:

- **`Ok(vec![])` from `app.poke(...)`.** No effects came back. Likely causes: an unknown cause tag (drift detection opt-out), a kernel crash via `?>` (bare assertion on user input — see [Kernel / Causes — Denying a Cause Without Crashing](/build/kernel/causes#denying-a-cause-without-crashing)), or a `mule`-trapped panic in a graft body. Wire drift detection, refactor `?>` to `?:`/`?.` branching, and grep `vesl-test watch` output for `mote=Exit` traces.
- **Compile error `cause tag <X> not in KERNEL_CAUSE_TAGS`.** Drift detection caught a rename. Either update the hull's poke builder call site to match the kernel's renamed tag, or rerun `nockup graft codegen kernel-cause-tags` after a manifest edit. Full surface: [Hull → Hull/Kernel Drift Detection](/build/hull#hull-kernel-drift-detection).
- **`Rejected::RbacDenied` from a peek-then-poke gate.** The caller's pubkey lacks the requested permission. The peek-then-poke pattern returns a typed rejection without sending the downstream poke. Full surface: [Hull → Peek-Then-Poke Gating](/build/hull#peek-then-poke-gating).
- **`verify-jam` reports stale.** `out.jam` predates the last Hoon source edit. Re-run `./compile.sh`. The fingerprint covers both manifest TOMLs and library `.hoon` files; either surface changing triggers staleness.
- **`/health` returns 503 with `"stage":"booting"`.** The hull hasn't finished kernel boot. Cold boot is ~15s; PMA-resume is ~1s. Wait or wire `readinessProbe` to the 200.

Failure modes with `error:` prefix from `nockup graft inject --apply` are gating lints — they refuse the write. Each one names a silent-fail surface in the composer or hoonc. See [Inject Lints](/build/grafts/inject/lints) for the per-lint shape.

::: info Stuck?

Something broken? The breakage is probably already in [Common Pitfalls](/troubleshooting/common-pitfalls).

:::

::: info See Also

- [Orientation](/setup/llms) — what's published in machine-readable form.
- [Grafts — Per-Graft Rust Snippets](/build/grafts/#per-graft-rust-snippets) — one canonical poke per graft.
- [Hull](/build/hull) — typed Rust surface, drift detection, peek-then-poke gating.
- [Testing / CLI](/build/testing/cli) — `vesl-test watch` for closed-loop feedback.
- [Common Pitfalls](/troubleshooting/common-pitfalls) — symptom-first failure mode catalog.

:::
