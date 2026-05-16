---
title: Domain Pokes
description: Testing grafts beyond settle-graft — harness.poke_slab with the build_<graft>_<verb>_poke family, peek_handle for reading state, and the nested-unit peek_raw.
outline: deep
---

# Domain Pokes

For grafts beyond settle-graft, the harness gives you a universal poke and peek pair. The pattern is:

1. Build a poke slab with a `build_<verb>_poke` helper from `vesl-core`.
2. Drive the cause via `harness.poke_slab(slab)`. It returns the effect-tag list the kernel emitted.
3. Peek kernel state via `harness.peek_handle(path)` to confirm the side effect landed.
4. Assert on both the effect-tag and the peeked value.

## Driving Causes

`harness.poke_slab(slab)` is the universal poke. It sends a fully-built `NounSlab` to the kernel's `++poke` arm and returns a `Vec<String>` of head-tags from the kernel's effect list.

You don't build the slab by hand. Every graft family exports a `build_<verb>_poke` helper per cause-tag it adds to the kernel; each helper returns the right `NounSlab` shape:

```rust
// Example: counter-graft increment in your test
use vesl_core::build_counter_increment_poke;

let tags = harness.poke_slab(build_counter_increment_poke("requests")).await?;
assert!(tags.iter().any(|t| t == "counter-incremented"));
```

The naming follows a convention: builders are `build_<graft>_<verb>_poke`, and effect tags are `<graft>-<verb-past-tense>`. Each graft also emits `<graft>-error` (with `msg=@t`) for any failure path. counter-graft's increment builds via `build_counter_increment_poke` and emits `%counter-incremented`; on saturation or capacity it emits `%counter-error`.

The full shipping set:

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
