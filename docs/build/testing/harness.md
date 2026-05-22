---
title: The Rust Harness
description: The GraftTestHarness Rust API — booting a compiled out.jam, running the standard 8-op settle-graft suite, and extending it with the public fixtures.
outline: deep
---

# The Rust Harness

After `nockup project init`, the project ships `tests/graft_lifecycle.rs`: a `#[tokio::test]` that boots the kernel via `GraftTestHarness` and runs the standard suite.

Compile the kernel first (`hoonc hoon/app/app.hoon hoon/`), then `cargo test`. `run_standard_suite()` reports per-op pass/fail without panicking — `report.is_success()` is the gate.

## The Standard Suite

Of every graft vesl ships, only settle-graft gets a pre-baked suite. Two reasons:

- **settle-graft is the foundation.** Every vesl-template kernel composes it, and its 8-op lifecycle is identical regardless of what domain you build on top. A single suite works against all of them.
- **Every other graft varies too much.** `kv-graft` keys state by cord. `counter-graft` carries the new value in its effect. `queue-graft`'s grammar differs by push vs. pop. `rbac-graft` is permission-bearing. A unified suite would either reduce to "does the kernel boot" (useless) or balloon into per-graft branches (a maintenance trap).

Test the other grafts via `harness.poke_slab` plus the `build_<graft>_<verb>_poke` family. The pattern is covered on [Domain Pokes](/build/testing/domain-pokes).

::: info Heads up

Per-graft harness suites are possible in principle. Vesl-nockup's lifecycle tests already encode what each would cover, so the upstream work is mostly lifting those into harness methods. vesl 1.0 doesn't ship them: each method bakes in a "what does the suite test" decision that isn't domain-specific. Including them would add maintenance overhead to v1.0, which isn't worth taking on unless the risk/reward is clearly there. If real projects need them, they can land in a future version.

:::

`run_standard_suite()` exercises settle-graft's 8-op lifecycle. It uses three fixtures the crate exposes as public constants so your own tests can build on the state the suite leaves behind:

```rust
// test/vesl-test/src/lib.rs:30-32
pub const TEST_HULL_A: u64 = 1;
pub const TEST_HULL_B: u64 = 2;
pub const TEST_PAYLOAD: &[u8] = b"vesl-test fixture payload";
```

A [hull](/reference/glossary#hull) is a `u64` namespace key in settle-graft's state. Each hull keys its own registered Merkle root, independent from other hulls. Any `u64` is a valid hull id; an application uses as many distinct hulls as its domain needs (see [the trellis pattern](/build/grafts/trellis-pattern) for multi-hull designs).

The standard suite registers both `TEST_HULL_A` and `TEST_HULL_B` to cover trellis-pattern testing. Registering hull A doesn't affect hull B's state, and a note targeted at B lands in B's lifecycle. A single-hull app needs only `TEST_HULL_A`; importing `TEST_HULL_B` anyway is harmless, since it's just an unused `u64` constant. Your tests can import these constants to assert against state the suite populated.

`TEST_PAYLOAD` is the byte string the suite commits to and replays; using a fixed value keeps the Merkle root deterministic across runs.

Internally the suite mints a single-leaf Merkle root over `TEST_PAYLOAD` with `vesl_core::Mint`, then walks every settle-graft path:

| Op | Inputs | Expected effect |
|----|--------|-----------------|
| `register` | hull A, root | `%settle-registered` |
| `duplicate-register` | hull A, root (again) | `%settle-error` |
| `verify` | fresh note-id, hull A, root | `%settle-verified` |
| `register-b` | hull B, root | `%settle-registered` |
| `note` | fresh note-id, hull B, root | `%settle-noted` |
| `replay-note` | same note-id as `note` | `%settle-error` |
| `unregistered-hull` | hull 99,999 (never registered) | `%settle-error` |
| `root-mismatch` | hull A, payload root ≠ registered | `%settle-error` |

A `note-id` is the unique-identifier dimension settle-graft tracks for replay protection — every settled note within a hull's lifetime must carry an id no prior note used. The actual values the suite picks for its verify and note ops are inline fixtures (`1` and `42`); pick any unused id for your own follow-up pokes.

When the suite returns success the kernel state is fully determined:

- `TEST_HULL_A` and `TEST_HULL_B` are both registered against the same root.
- Note-id `1` is verified under hull A.
- Note-id `42` is settled under hull B.

Any kernel composed with `settle-graft` and the default single-leaf hash gate passes the standard suite as-is.

settle-graft's verify and note arms call whichever gate is installed as a Hoon function. settle-graft itself is gate-agnostic: it doesn't know which gate shape (single-leaf hash, multi-leaf, signed, STARK, or custom) is in the slot.

Only one gate is installed at a time, set at composition time via `[graft.gates]` in the manifest. The standard suite's payloads are shaped for the default single-leaf gate. If you replace the gate, write a custom lifecycle test with payloads shaped for your gate instead of relying on `run_standard_suite()`.

Each shipped gate has a matching poke builder:

- `build_settle_note_poke` — default single-leaf hash. (vesl-core)
- `build_settle_note_manifest_poke` — multi-leaf (manifest-verify). (vesl-core)
- `build_settle_note_membership_poke` — set membership. (vesl-core)
- `build_settle_note_ed25519_poke` — ed25519 signature. (vesl-core)
- `build_settle_note_schnorr_poke` — Schnorr signature. (vesl-core)
- `build_settle_note_bounded_poke` — bounded gate. (vesl-core)

Pick the builder for your gate and pass its gate-specific arguments (e.g., signature and pubkey for Schnorr, Merkle proof for manifest), then feed the resulting slab to `harness.poke_slab`. See [Build / Kernel — replacing a verification gate](/build/kernel/gates) for the replacement mechanics.

## Extending the Suite

The three fixtures are `pub` so a follow-up test can assert against suite-populated state, or drive more pokes against the same hulls without re-deriving the root. The tools you'll reach for:

- **`vesl_core::Mint`** — rebuilds the same Merkle root when fed `TEST_PAYLOAD`.
- **`vesl_core::build_graft_single_leaf_payload_jammed(note_id, hull, root, data)`** — builds the `[note=[id hull root [%pending ~]] data expected-root]` shape settle-graft expects.
- **`harness.register(hull, root)`**, **`harness.verify(payload)`**, **`harness.note(payload)`** — typed shortcuts that wrap each settle-graft cause-tag so you don't construct it by hand.

```rust
// tests/graft_lifecycle.rs (extending the starter test)
use vesl_core::{build_graft_single_leaf_payload_jammed, build_hull_peek_path, Mint};
use vesl_test::{TEST_HULL_A, TEST_PAYLOAD};

// ... after run_standard_suite() ...

// 1. Confirm hull A is registered.
let path = build_hull_peek_path("settle-registered", TEST_HULL_A);
let registered = harness.peek_handle(path).await?;
assert!(registered.is_some(), "hull A should be registered after the suite");

// 2. Add a new note (id 7) against the same hull and root.
let mut mint = Mint::new();
let root = mint.commit(&[TEST_PAYLOAD]);
let payload = build_graft_single_leaf_payload_jammed(7, TEST_HULL_A, &root, TEST_PAYLOAD);
let tags = harness.note(&payload).await?;
assert!(tags.iter().any(|t| t == "settle-noted"));
```
