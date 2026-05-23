---
title: Domain Pokes
description: Testing grafts beyond settle-graft — typed harness methods, harness.poke_slab as the escape hatch for unbound builders, peek_handle for reading state, and the nested-unit peek_raw.
outline: deep
---

# Domain Pokes

For grafts beyond settle-graft, the harness gives you two layered surfaces:

1. **Typed methods** — `harness.<verb>(...)` per poke arm, generated from `hoon/lib/harness-bindings.toml`. Returns a typed [`vesl_core::PokeOutcome`](https://github.com/zkvesl/vesl-core/blob/main/crates/vesl-core/src/poke.rs). Use this when the graft has a bound method (every shipped graft does for its primary arms).
2. **`harness.poke_slab`** — the universal escape hatch. Takes a fully-built `NounSlab` and returns the same `PokeOutcome`. Use this for unbound builders (the settle convenience variants, domain pokes you build by hand) or when you want the raw control.

The matching read surfaces are `harness.peek_handle(path)` for the standard unit-collapsed shape and `harness.peek_raw(path)` for nested-unit paths. Asserting on the effect head tag or the typed outcome variant proves the cause landed; peeking confirms the side effect did.

## Driving Causes — Typed Methods

Every poke arm in every shipped graft has a typed method on `GraftTestHarness`. The method name matches the snake-case form of the cause tag (e.g. `%counter-set` → `counter_set`); arg types match the underlying `build_*_poke` builder. The body returns `Result<PokeOutcome>`.

```rust
// counter-graft increment via the typed method
use vesl_core::PokeOutcome;
use vesl_test::GraftTestHarness;

let outcome = harness.counter_increment("requests").await?;
assert!(matches!(outcome, PokeOutcome::Accepted { .. }));
```

For typed routing on the specific rejection variant, use the per-graft extension trait:

```rust
use vesl_test::{CounterOutcome, CounterOutcomeExt};

// Trigger saturation and route on the typed Error variant.
let _ = harness.counter_set("max", u64::MAX).await?;
let outcome = harness.counter_increment("max").await?;
match outcome.as_counter_outcome() {
    CounterOutcome::Error { msg } => assert!(msg.contains("saturated")),
    other => panic!("expected counter saturation, got {other:?}"),
}
```

`<Graft>OutcomeExt` is generated alongside the typed methods; see [Harness → Typed Per-Graft Methods](/build/testing/harness#typed-per-graft-methods) for the full surface (32 bound methods + 13 outcome enums + 13 extension traits across the shipped grafts).

## Driving Causes — `poke_slab` Escape Hatch

When a builder isn't bound to a typed method — the settle per-gate convenience builders (`build_settle_note_schnorr_poke` and siblings, whose arg types come from `nockchain-types` which isn't re-exported by vesl-core), or a domain poke you constructed by hand — drop down to `harness.poke_slab(slab)`. Same `Result<PokeOutcome>` return; same typed match on the result.

```rust
// settle-graft Schnorr-gate note — no typed method (skipped per
// harness-bindings.toml rationale); use the SDK builder directly.
use vesl_core::{PokeOutcome, build_settle_note_schnorr_poke};

let slab = build_settle_note_schnorr_poke(note_id, hull, &root, data, &sig, &pubkey);
let outcome = harness.poke_slab(slab).await?;
assert!(matches!(outcome, PokeOutcome::Accepted { .. }));
```

The naming convention covers both surfaces: builders are `build_<graft>_<verb>_poke`, effect tags are `<graft>-<verb-past-tense>`, and each graft also emits `<graft>-error` (with `msg=@t`) for any failure path. counter-graft's increment builds via `build_counter_increment_poke`, emits `%counter-incremented` on success and `%counter-error` on saturation or capacity.

The full shipping set. Every row (except the settle per-gate variants and the intent placeholder) is also reachable as `harness.<method>(...)` per `hoon/lib/harness-bindings.toml`; method names match the snake-case form of the cause tag (`%counter-set` → `counter_set`). See [Harness → Typed Per-Graft Methods](/build/testing/harness#typed-per-graft-methods) for the typed-outcome variants.

| Graft | Builder | Cause | Success effect | Error effect |
|---|---|---|---|---|
| **settle** | `build_settle_register_poke(hull, root)` | `%settle-register` | `%settle-registered` | `%settle-error` |
|   | `build_settle_verify_poke(note_id, hull, root, payload)` | `%settle-verify` | `%settle-verified ok=?` | `%settle-error` |
|   | `build_settle_note_poke(note_id, hull, root, payload)` | `%settle-note` | `%settle-noted` (+ `%settle-epoch-rotated` on epoch boundary) | `%settle-error` |
| **settle** (per-gate `note` variants) | `build_settle_note_schnorr_poke` | `%settle-note` | `%settle-noted` | `%settle-error` |
|   | `build_settle_note_ed25519_poke` | `%settle-note` | `%settle-noted` | `%settle-error` |
|   | `build_settle_note_manifest_poke` | `%settle-note` | `%settle-noted` | `%settle-error` |
|   | `build_settle_note_membership_poke` | `%settle-note` | `%settle-noted` | `%settle-error` |
|   | `build_settle_note_bounded_poke` | `%settle-note` | `%settle-noted` | `%settle-error` |
| **mint** | `build_mint_commit_poke(hull, root)` | `%mint-commit` | `%mint-committed` | `%mint-error` |
| **guard** | `build_guard_register_poke(hull, root)` | `%guard-register` | `%guard-registered` | `%guard-error` |
|   | `build_guard_check_poke(hull, data)` | `%guard-check` | `%guard-checked ok=?` | `%guard-error` |
| **forge** | `build_forge_prove_poke(hull, note_id, data)` | `%forge-prove` | `%forge-proved` | `%forge-error` |
| **kv** | `build_kv_set_poke(key, value)` | `%kv-set` | `%kv-stored` | `%kv-error` |
|   | `build_kv_delete_poke(key)` | `%kv-delete` | `%kv-deleted` | `%kv-error` |
| **counter** | `build_counter_increment_poke(name)` | `%counter-increment` | `%counter-incremented` | `%counter-error` |
|   | `build_counter_set_poke(name, value)` | `%counter-set` | `%counter-set` | `%counter-error` |
|   | `build_counter_reset_poke(name)` | `%counter-reset` | `%counter-reset` | `%counter-error` |
| **queue** | `build_queue_push_poke(payload)` | `%queue-push` | `%queue-pushed` | `%queue-error` |
|   | `build_queue_pop_poke()` | `%queue-pop` | `%queue-popped` | `%queue-error` |
|   | `build_queue_clear_poke()` | `%queue-clear` | `%queue-cleared` | `%queue-error` |
| **rbac** | `build_rbac_grant_poke(pubkey, perms)` | `%rbac-grant` | `%rbac-granted` | `%rbac-error` |
|   | `build_rbac_revoke_poke(pubkey, perms)` | `%rbac-revoke` | `%rbac-revoked` | `%rbac-error` |
| **registry** | `build_registry_put_poke(key, record)` | `%registry-put` | `%registry-stored` | `%registry-error` |
|   | `build_registry_update_poke(key, record)` | `%registry-update` | `%registry-updated` | `%registry-error` |
|   | `build_registry_del_poke(key)` | `%registry-del` | `%registry-deleted` | `%registry-error` |
| **validate** | `build_validate_init_poke(cause_tag, rules)` | `%validate-init` | `%validate-rules-installed` | `%validate-error` |
|   | `build_validate_clear_poke(cause_tag)` | `%validate-clear` | `%validate-rules-cleared` | `%validate-error` |
|   | (prelude rejection — no Rust builder) | (fires from `poke-prelude`) | `%validate-rejected` | (silent denial) |
| **log** | `build_log_append_poke(tag, data)` | `%log-append` | `%log-appended` | `%log-error` |
| **clock** | `build_clock_tick_poke()` | `%clock-tick` | `%clock-ticked` | `%clock-error` |
| **batch** | `build_batch_init_poke(threshold)` | `%batch-init` | `%batch-initialized` | `%batch-error` |
|   | `build_batch_add_poke(intent)` | `%batch-add` | `%batch-added` | `%batch-error` |
|   | `build_batch_flush_poke()` | `%batch-flush` | `%batch-flushed` | `%batch-error` |
| **intent** (placeholder) | (no Rust builders shipped) | `%intent-declare` / `%intent-match` / `%intent-cancel` / `%intent-expire` | `%intent-declared` / `%intent-matched` / `%intent-cancelled` / `%intent-expired` | `%intent-error` |

The `_from_noun` variants exist for grafts that take pre-jammed payloads (registry, log, queue, batch); pass a `&NounSlab` instead of a `&[u8]`. The `_with_data` variants (settle only) take a closure that writes the payload directly into the slab. The source-of-truth module tree is [`crates/vesl-core/src/graft_pokes/`](https://github.com/zkvesl/vesl-core/tree/11d110d/crates/vesl-core/src/graft_pokes).

## Reading State

`harness.peek_handle(path)` reads kernel state without modifying it. It returns `Result<Option<NounSlab>>`:

- **`Err`** — kernel returned bare `~`; either the path is malformed or the graft owning the tag isn't composed.
- **`Ok(None)`** — path is recognized but the value is absent (`[~ ~]`).
- **`Ok(Some(slab))`** — value is present (`[~ [~ value]]`).

Build the path via one of three helpers in `vesl-core`, depending on the peek's keying scheme:

| Path shape | Builder | When grafts use it |
|------------|---------|--------------------|
| `[%<tag> ~]` (keyless) | `build_keyless_peek_path("log-len")` | Singletons (counts, epochs) |
| `[%<tag> hull ~]` (hull-keyed) | `build_hull_peek_path("settle-registered", hull)` | Per-hull state (commitment grafts) |
| `[%<tag> @t %<key> ~]` (cord-keyed) | `build_keyed_peek_path("counter-value", "requests")` | Per-name state (kv, counter, queue) |

For the counter increment above, the matching peek:

```rust
// Example: matching peek for the counter increment above
use vesl_core::build_keyed_peek_path;

let path = build_keyed_peek_path("counter-value", "requests");
let value = harness.peek_handle(path).await?;
assert!(value.is_some(), "counter should be present after increment");
```

## `peek_raw` — Nested-Unit Paths

A few peek paths return `(unit (unit *))` instead of flattening to `Option`. settle-graft's `%settle-root` is the canonical example: it returns `[~ [~ (unit @)]]` so the outer wrapper signals path-recognized vs. unrecognized while the inner unit lets the value itself be absent (a registered hull that doesn't have a root yet).

`harness.peek_raw(path)` returns the raw shape without unwrapping. Pattern-match on the inner unit yourself when you need that level of detail.
