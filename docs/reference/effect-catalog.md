---
title: Effect Catalog
description: Every shipped effect across the graft library — payload shape, when emitted, and the per-graft error message strings.
outline: deep
head:
  - - meta
    - name: keywords
      content: vesl effects, effect catalog, effect payload shape, settle-error, mint-error, batch-flushed, validate-rejected, settle-noted
---

# Effect Catalog

This page enumerates every effect head tag and its full payload shape across the shipped grafts. Each section is one graft, with two tables: success effects (cell shapes) and error effects (verbatim message strings from the Hoon source). For the teaching version of how effects are emitted, see [Kernel → Domain Causes](/build/kernel/causes). For Rust-side decoding patterns (the loobean-inversion footgun, cell payload extraction, unit returns), see [Hull → Decoding Effect Payloads](/build/hull#decoding-effect-payloads).

The matching read surface is [Peek Catalog](/reference/peek-catalog).

::: tip Typed Rust mapping

Every effect class on this page has a matching variant on a typed per-graft outcome enum the test harness ships. `%<graft>-error msg=@t` decodes to `<Graft>Outcome::Error { msg }`, `%<graft>-denied reason=@t` to `Denied { reason }`, and each typed rejection (e.g. `%settle-register-rejected`) to a named struct variant. The kernel's success effects collapse to `Accepted { effect_tags }`. See [Harness → Typed Per-Graft Methods](/build/testing/harness#typed-per-graft-methods) for the generated surface; tests match on the variant via `outcome.as_<graft>_outcome()`.

:::

---

## settle-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%settle-registered` | `[hull=@ root=@]` | `%settle-register` lands; hull is now registered against `root`. |
| `%settle-noted` | `note=[id=@ hull=@ root=@ state=[%settled ~]]` | `%settle-note` lands and the verify gate accepted the payload. |
| `%settle-verified` | `ok=?` | `%settle-verify` runs (a pure preflight; no state transition). `ok` is loobean — atom `0` = passed, atom `1` = failed. |
| `%settle-epoch-rotated` | `[old-epoch=@ new-epoch=@]` | Emitted alongside `%settle-noted` when `settle-count` hits `epoch-cap` (1M settles per epoch) and the settled set rotates. |

**Typed rejections** (cell payload, not a `%settle-error` cord):

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%settle-register-rejected` | `[hull=@ existing-root=@]` | `%settle-register` against a hull that already has a root (registration is one-shot per hull). `existing-root` is the currently-registered root atom — callers can pattern-match the typed tag instead of parsing the legacy `%settle-error` cord. (Audit L-09; post-`settle-graft 0.2.0`.) |

**Errors** (all emit `[%settle-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'settle-graft: registered map at capacity'` | `~(wyt by registered)` reached the 10M-entry cap. |
| `'settle-graft: malformed payload'` | `%settle-note` or `%settle-verify` payload atom failed to `cue` (mule-wrapped at the boundary). |
| `'settle-graft: root not registered'` | Payload references a hull that has no registered root. |
| `'settle-graft: root mismatch'` | Payload's `expected-root` doesn't match the registered root for the hull. |
| `'settle-graft: note root does not match expected root'` | Payload's `note.root` doesn't match `expected-root` (cross-check H-04). |
| `'settle-graft: note already settled'` | `note.id` is already in the current-epoch `settled` set. |
| `'settle-graft: note already settled (prior epoch)'` | `note.id` is in `prior-settled` — the rotated lookback set. |
| `'settle-graft: verify gate crashed'` | Verify gate panicked inside `mule` (caught crash, vs. a clean `?>` deterministic Exit). |

A clean `?>` rejection from the gate emits **zero** effects, not `%settle-error`; see [Common Pitfalls → Distinguishing Denial Paths](/troubleshooting/common-pitfalls#distinguishing-denial-paths).

## mint-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%mint-committed` | `[hull=@ root=@]` | `%mint-commit` lands. |

**Errors** (all emit `[%mint-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'mint-graft: hull already committed'` | `%mint-commit` against a hull that already has a root (commitments are one-shot). |
| `'mint-graft: commits map at capacity'` | `~(wyt by commits)` reached the 10M-entry cap. |

## guard-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%guard-registered` | `[hull=@ root=@]` | `%guard-register` lands. |
| `%guard-checked` | `[hull=@ ok=?]` | `%guard-check` runs; `ok` is loobean — atom `0` = `hash-leaf(data) == registered-root`, atom `1` = mismatch. |

**Errors** (all emit `[%guard-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'guard-graft: hull already registered'` | `%guard-register` re-applied to a registered hull. |
| `'guard-graft: roots map at capacity'` | `~(wyt by roots)` reached the 10M-entry cap. |
| `'guard-graft: hull not registered'` | `%guard-check` against a hull with no registered root. |

## forge-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%forge-proved` | `[hull=@ note-id=@ proof=*]` | `%forge-prove` succeeded; `proof` is the opaque STARK proof noun bound to `hull` and `root = hash-leaf(data)` via the Fiat-Shamir transcript. |

**Errors** (all emit `[%forge-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'forge-graft: prove-computation crashed'` | The prover bombed inside `mule` (e.g. malformed `data`, internal `;;` rejection). |

## kv-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%kv-stored` | `key=@t` | `%kv-set` lands (overwrite-on-existing; bypasses the capacity cap on overwrite). |
| `%kv-deleted` | `key=@t` | `%kv-delete` lands. Always emits, even for missing keys (noop is silent on the state side but visible on the effect side). |

**Errors** (all emit `[%kv-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'kv-graft: store map at capacity'` | `~(wyt by store)` reached the 10M-entry cap on a **new-key** insertion. |

## counter-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%counter-incremented` | `[name=@t value=@ud]` | `%counter-increment` advanced `name`. `value` is the post-increment value. |
| `%counter-reset` | `name=@t` | `%counter-reset` set `name` to 0 (init-on-touch). |
| `%counter-set` | `[name=@t value=@ud]` | `%counter-set` overwrote `name`. Note the head-tag collision: `%counter-set` (past-participle) and the cause `%counter-set` (imperative) read identically; spec keeps them. |

**Errors** (all emit `[%counter-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'counter-graft: counter saturated at 2^64'` | `%counter-increment` would push the counter past `2^64 - 1`. State unchanged; caller must `%counter-reset` first. |
| `'counter-graft: counters map at capacity'` | New-name insertion would push `~(wyt by counters)` past the 10M cap. |

## queue-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%queue-pushed` | `id=@ud` | `%queue-push` appended; `id` is the monotonic id assigned. |
| `%queue-popped` | `job=(unit [id=@ud body=*])` | `%queue-pop` ran. `job=~` if the queue was empty; `job=[~ [id body]]` if a job was dequeued. |
| `%queue-cleared` | `~` | `%queue-clear` ran (idempotent; emits even for already-empty queues). |

**Errors** (all emit `[%queue-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'queue-graft: malformed payload'` | The jammed body atom failed to `cue` (C1 mule-wrap boundary). |
| `'queue-graft: pending list at capacity'` | `(lent pending)` reached the 10M-entry cap. |

## rbac-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%rbac-granted` | `[pubkey=@ added=(list @t)]` | `%rbac-grant` ran. `added` is the **set difference** (asked − held) — only the newly-added perms, not the full post-state. |
| `%rbac-revoked` | `[pubkey=@ removed=(list @t)]` | `%rbac-revoke` ran. `removed` is the **intersection** (asked ∩ held) — only the perms that were actually present and got dropped. |

**Errors** (all emit `[%rbac-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'rbac-graft: roles map at capacity'` | New-pubkey insertion would push `~(wyt by roles)` past the 10M outer cap. |
| `'rbac-graft: perms-per-role at capacity'` | The post-grant perms set would exceed the 1000-perm inner cap. Applies to overwrites too, not just new pubkeys. |

Two-level capacity is load-bearing — the inner cap stops a single attacker pubkey from fanning out perms unbounded inside one row. See [Library Catalog → rbac-graft](/reference/library#grafts).

## registry-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%registry-stored` | `key=@` | `%registry-put` lands (strict create — errors on duplicate key, not overwrite). |
| `%registry-updated` | `[key=@ old=* new=*]` | `%registry-update` lands. Both old and new records surface in the effect, so audit-style callers don't need a peek round-trip. |
| `%registry-deleted` | `key=@` | `%registry-del` lands (strict — errors on missing key). |

**Errors** (all emit `[%registry-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'registry-graft: key already present'` | `%registry-put` against an existing key. Use `%registry-update` to overwrite. |
| `'registry-graft: entries map at capacity'` | `~(wyt by entries)` reached the 10M-entry cap. |
| `'registry-graft: malformed payload'` | The jammed record atom failed to `cue` (both `%registry-put` and `%registry-update`). |
| `'registry-graft: key not present; use put'` | `%registry-update` against a missing key. |
| `'registry-graft: key not present'` | `%registry-del` against a missing key. |

## validate-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%validate-rules-installed` | `[cause-tag=@ta count=@ud]` | `%validate-init` lands. `count` is the number of rules in the installed list (post-replace). |
| `%validate-rules-cleared` | `cause-tag=@ta` | `%validate-clear` drops the rules for `cause-tag`. Idempotent. |
| `%validate-rejected` | `[cause-tag=@ta reason=@t]` | The `poke-prelude` block short-circuited a poke before the `?-` switch. State is untouched. Fires for **any** poke whose cause-tag has installed rules and at least one rule fails. |

**Errors** (all emit `[%validate-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'validate-graft: too many rules per cause'` | `(lent rules)` exceeds the 64-rule per-cause cap. |
| `'validate-graft: rules map at capacity'` | New cause-tag insertion would push `~(wyt by state)` past the 10k cap. |

The `%validate-rejected` effect is the prelude-driven denial signal; see [Grafts → Inject → Cause Dispatch Semantics](/build/grafts/inject#cause-dispatch-semantics) for prelude semantics.

## log-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%log-appended` | `seq=@ud` | `%log-append` prepended an entry. `seq` is the monotonic id assigned. Eviction of an oldest entry past the 100k retention cap is silent (no error emitted). |

**Errors** (all emit `[%log-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'log-graft: malformed payload'` | The jammed `data` atom failed to `cue`. |

## clock-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%clock-ticked` | `now=@da` | `%clock-tick` advanced the counter by 1. `now` is the post-tick value cast as `@da`. |

**Errors** (`[%clock-error msg=@t]`):

The `%clock-error` variant is declared in the effect union but no current arm emits it — reserved for future config-validation needs. `%clock-tick` has no payload to cue and no capacity to exceed, so there is no v0.1 failure path.

## batch-graft

**Success effects:**

| Effect | Payload shape | Emitted when |
|---|---|---|
| `%batch-initialized` | `threshold=@ud` | `%batch-init` set the count trigger. `threshold=0` disables auto-flush. |
| `%batch-added` | `id=@ud` | `%batch-add` accepted an intent and assigned `id`. |
| `%batch-flushed` | `[bundle=(list *) count=@ud]` | The buffer drained. Two triggers: (a) `%batch-add` pushed the pending length to `>= threshold` (auto-flush, emitted **alongside** the `%batch-added`); (b) `%batch-flush` was poked manually (always emits, even for empty buffers — observers can mark the boundary). |

**Errors** (all emit `[%batch-error msg=@t]`):

| `msg` cord | Emitted when |
|---|---|
| `'batch-graft: threshold exceeds pending cap'` | `%batch-init threshold=X` with `X > 10_000_000` — a threshold higher than the buffer cap can never fire. |
| `'batch-graft: malformed intent payload'` | The jammed intent atom failed to `cue` (C1 mule-wrap boundary). |
| `'batch-graft: pending list at capacity'` | `(lent pending)` reached the 10M-entry cap before threshold could trigger. |

## intent-graft

intent-graft is the family-5 placeholder. The effect union reserves `%intent-declared id=@ hull=@`, `%intent-matched id=@`, `%intent-cancelled id=@`, `%intent-expired id=@`, and `%intent-error msg=@t`, but every poke-arm crashes with `~|  %intent-graft-placeholder  !!`. Composing the graft is supported (so callers don't trip up on the namespace); driving it is not. Watch the [`hoon/lib/intent-graft.hoon`](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/intent-graft.hoon) header for when upstream lands the canonical primitive.

---

::: info See Also

- [Kernel → Domain Causes](/build/kernel/causes) — how to emit an effect from a graft arm.
- [Hull → Decoding Effect Payloads](/build/hull#decoding-effect-payloads) — Rust-side decoding patterns including loobean inversion and cell-payload extraction.
- [Peek Catalog](/reference/peek-catalog) — the matching read surface.
- [Testing → Domain Pokes](/build/testing/domain-pokes) — driving causes and watching effects from a test harness.
- [Common Pitfalls → Distinguishing Denial Paths](/troubleshooting/common-pitfalls#distinguishing-denial-paths) — gate clean-deny vs. gate crash vs. pre-gate failure vs. rbac vs. validate-prelude — and how the effect list tells them apart.

:::
