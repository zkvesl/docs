---
title: Library Catalog
description: Index of grafts, support Hoon libraries, and Rust crates shipped with vesl-nockup.
outline: deep
head:
  - - meta
    - name: keywords
      content: vesl library, vesl-nockup modules, graft catalog, vesl-core crates, vesl-wallet, vesl-checkpoint, vesl-signing, vesl-merkle, vesl-gates, vesl-prover, domain-patterns
---

# Library Catalog

vesl-nockup ships three layers of code: grafts (a Hoon library plus a TOML manifest, spliced into your kernel by `nockup graft inject`), support Hoon libraries (imported by grafts and reusable from your own kernel code), and Rust crates (linked by your driver, harness, or tooling). This page indexes all three.

## Grafts

Family-level orientation, priority bands, and composition rules live at [Grafts](/build/grafts/). Each row links to the library's source; the matching `<name>-graft.toml` manifest sits next to it on disk.

| Graft | Family | Role |
|---|---|---|
| [`mint-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/mint-graft.hoon) | Commitment | Root-only commitment per hull. One-shot per `hull=@`; no verification, no settlement. |
| [`guard-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/guard-graft.hoon) | Commitment | Register a root, then verify `hash-leaf(data) == root`. No replay protection. |
| [`settle-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/settle-graft.hoon) | Commitment | Gate-driven verification with epoch-rotated replay protection; one-shot registration per hull. |
| [`forge-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/forge-graft.hoon) | Commitment | Leaf hashing plus a nockchain STARK proof bound to `hull` and `root` via Fiat-Shamir. Stateless. |
| [`kv-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/kv-graft.hoon) | State | Opaque atom values. Overwrite on set; noop on delete-missing. |
| [`counter-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/counter-graft.hoon) | State | Named counters. Init-on-touch; saturates at 2^64 so Rust `u64` callers can represent every value. |
| [`queue-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/queue-graft.hoon) | State | FIFO with monotonic IDs. Mule-wraps `cue` on push so malformed jam returns `%queue-error` instead of crashing the kernel. |
| [`rbac-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/rbac-graft.hoon) | State | Pubkey → permission-set table. Two-level capacity caps: 10M entries in the outer roles map, 1000 perms per role. Overflow on either cap emits `%rbac-error 'rbac-graft: roles map at capacity'` or `'rbac-graft: perms-per-role at capacity'`. Auto-clears a pubkey from the map when revoke leaves it with zero perms. |
| [`registry-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/registry-graft.hoon) | State | Strict structured records. Errors on duplicate `put`, missing `update`, missing `del`. |
| [`validate-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/validate-graft.hoon) | Behavior | Cause-level rule checks via `poke-prelude`. On rule failure, short-circuits with `%validate-rejected` and leaves state untouched. |
| [`log-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/log-graft.hoon) | Behavior | Append-only audit trail with monotonic seq. 100k entry retention. |
| [`clock-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/clock-graft.hoon) | Behavior | Deterministic event-counter clock advanced by explicit `%clock-tick`. No host wall-clock. |
| [`batch-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/batch-graft.hoon) | Behavior | Buffer caller intents and emit `%batch-flushed` once a count trigger fires. Pairs with downstream settlement orchestration. |
| [`intent-graft`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/intent-graft.hoon) | Intent | Family-5 placeholder. Every arm crashes until upstream publishes a canonical intent shape. |

## Support Hoon Libraries

Plain Hoon libraries (no TOML manifest, no `nockup graft inject` codegen). Grafts import these; your own kernel code can too.

| Library | Used by | Role |
|---|---|---|
| [`vesl-merkle`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/vesl-merkle.hoon) | mint, guard, settle, forge | tip5 Merkle primitives: `hash-leaf`, `hash-leaf-digest`, `hash-pair`, `verify-chunk`, root construction. |
| [`vesl-gates`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/vesl-gates.hoon) | settle (selectable) | Named verification-gate arms: ed25519, Schnorr-over-Cheetah, manifest, set-membership, bounded-value. Selected via `[graft.gates]` in a settle manifest. |
| [`vesl-prover`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/vesl-prover.hoon) | forge | nockchain STARK prover, forked from `nock-prover.hoon` to accept `[subject formula root hull]` directly. |
| [`vesl-lower`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/vesl-lower.hoon) | forge | Nock formula lowering pass — opcodes 9/10/11 rewritten to 0–8 so `fink:fock` can execute the formula under STARK. |
| [`domain-patterns`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/domain-patterns.hoon) | your kernel | Wet-gate helpers. One `apply-<graft>` arm per shipped data/behavior graft, plus `audit-write` (bundles delegate-to-storage + `%log-append`). |

## Rust Crates

Workspace members under `crates/` (and `test/` for the harness). Link from your driver, wallet, or test crate.

| Crate | Role |
|---|---|
| [`vesl-core`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-core/src/lib.rs) | High-level Vesl SDK. Four primitives (Mint, Guard, Settle, Forge), each a different weight class on a shared API. Mint users never touch a kernel; Forge users get the full pipeline. |
| [`vesl-signing`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-signing/src/lib.rs) | Schnorr-over-Cheetah signing, Tip5 domain separators, SIWN (CAIP-122 sign-in). Foundation primitive for `vesl-wallet`; usable standalone. |
| [`vesl-wallet`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-wallet/src/lib.rs) | BIP-39 mnemonic ↔ seed, a BIP-32 analog over Tip5 (`vesl-hd-v1` domain separator), BIP-44 5-level role layout. |
| [`vesl-wallet-spec`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-wallet-spec/src/lib.rs) | Role-number constants and typed `DerivationPath` only. No curve, no seed handling, no signing API. |
| [`vesl-checkpoint`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-checkpoint/src/lib.rs) | Snapshot / resume wrapper for live NockApps. `snapshot()` writes a `state.jam` plus a `meta.toml` carrying the source `app.hoon` SHA-256; `resume()` parses the meta and boots from the snapshot. |
| [`vesl-test`](https://github.com/zkvesl/vesl-nockup/blob/main/test/vesl-test/src/lib.rs) | Rust harness plus a standard lifecycle suite for grafted kernels. Reuses poke shapes from `vesl-core` and `nock-noun-rs`; no kernel knowledge required from the caller. |
| [`nockchain-client-rs`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/nockchain-client-rs) | Client bindings to nockchain. |
| [`nockchain-tip5-rs`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/nockchain-tip5-rs) | tip5 hash primitive for Rust. |
| [`nock-noun-rs`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/nock-noun-rs) | Nock noun encoding and decoding (`jam` / `cue`, cells, atoms). |

### Hull helpers

`vesl-hull` exports a small set of leaf-encoding and dispatch helpers usable from any custom route or test that needs to interoperate with the stock `/commit` Merkle layout or the active verify gate.

| Helper | Source | Shape |
|---|---|---|
| [`field_to_leaf_bytes`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-hull/src/verify.rs) | `vesl_hull::field_to_leaf_bytes` | `Field { key, value } → format!("{key}:{value}").into_bytes()`. The stock `/commit` handler maps every field through this before Merkle-minting. Any custom `/settle-*` route that re-derives the registered root must encode leaves byte-for-byte the same way — a mismatch produces the same root-mismatch deny path as a tampered payload. |
| [`SettlePayloadBuilder`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-hull/src/settle_builder.rs) | `vesl_hull::SettlePayloadBuilder` | Trait the stock `/settle` handler dispatches through. See [Catalog Gates — Implementing a `SettlePayloadBuilder`](/build/catalog-gates/#implementing-a-settlepayloadbuilder) for the impl pattern. |
| [`ManifestSummary`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-hull/src/manifest_summary.rs) | `vesl_hull::ManifestSummary` | Boot-time snapshot of the graft manifest dir; surfaces the active gate, the composed grafts, and per-graft TOML sha256s through `/status`. |

## On-Disk Layout

```
vesl-nockup/
├── hoon/lib/                # grafts (library + manifest) and support Hoon libraries
├── crates/                  # Rust crates
├── test/vesl-test/          # Rust harness for grafted kernels
└── tools/graft-inject/      # nockup-graft CLI sidecar
```

## Known Limits (v0.1)

The behavior-graft band (validate, log, clock, batch) shipped with a deliberately small v0.1 surface. The state grafts have hard capacity caps that the audit-acknowledged tech debt list also tracks. Knowing where the edges are saves a profile run of friction.

### validate-graft

- **Only `%non-empty` is shipped.** Four other rule shapes are reserved in the `validate-rule` type union (`length`, `in-set`, `range`, `unique-in`) but the v0.1 graft only carries the `%non-empty` arm. Calls to `%validate-init` with an unrecognized rule head fail at composition time, not at runtime.
- **`%non-empty` checks `+.u.act` for sig only.** Multi-field cause bodies (e.g. `%registry-put key=@ payload=@`) have cell bodies, never `~`, so the rule always passes silently for them. To validate fields inside a cell body, wait for v0.2 field-level rule shapes — or open-code a Hoon prelude in a domain graft. See [Grafts → Inject → Cause Dispatch Semantics](/build/grafts/inject#cause-dispatch-semantics).
- **Rule maps cap at 10,000 cause-tags** and **64 rules per cause-tag**. Saturation emits `%validate-error 'validate-graft: rules map at capacity'` or `'validate-graft: too many rules per cause'`.

### log-graft

- **Retention cap is 100,000 entries, FIFO eviction.** Entries are stored newest-first; each `%log-append` prepends, and when the list exceeds the cap, `scag retention-cap` trims to the first 100k — silently dropping the oldest entry off the tail. No `%log-error` is emitted on rotation; the append succeeds and the eviction is invisible to the caller.
- **No saturation peek.** `[%log-len ~]` returns the current entry count; compare against 100,000 yourself.

### clock-graft

- **Event-counter only.** `clock-graft` increments a single `@ud` counter per `%clock-tick` poke and exposes it cast as `@da`. There is no host wall-clock, no boot stamp, no environmental input — determinism is the whole point for STARK soundness.
- `[%clock-now ~]` returns the counter (always present), not Unix time. The `boot-offset` and `block-time` sources from `.dev/03_BEHAVIOR_GRAFTS.md` are deferred; the latter waits on the Phase 05 chain bridge.
- This is why batch-graft's `time` trigger (below) ships deferred — there's no monotonic time source to fire on yet.

### batch-graft

- **Only the `count` trigger is shipped.** Once the pending intent list meets or exceeds the configured threshold, the next `%batch-add` flushes (a flush emits `[%batch-flushed bundle=(list *) count=@ud]` and resets the buffer). The `time` trigger (clock-driven) and `pages` trigger (kernel-event-counter delta) are reserved in the design doc but ship in v0.2.
- **`threshold=0` disables auto-flush.** Only manual `%batch-flush` pokes drain the buffer. `threshold=1` flushes on every add (no batching).
- **Pending list growth is O(n).** See [Common Pitfalls → High-Throughput Latency on queue-graft / batch-graft](/troubleshooting/common-pitfalls#high-throughput-latency-on-queue-graft-batch-graft).

::: info See Also

- [Grafts](/build/grafts/) — 5-family taxonomy with priority bands and composition rules.
- [Grafts / Manifest Schema](/build/grafts/manifest-schema) — manifest TOML fields and the priority lattice.
- [Reference / CLI (nockup graft)](/reference/cli) — subcommands the sidecar exposes.

:::
