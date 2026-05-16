---
title: Peek Catalog
description: Every shipped peek path across the graft library — path shape, Rust builder, return type, and a decoder hint.
outline: deep
head:
  - - meta
    - name: keywords
      content: vesl peek paths, peek catalog, build_keyless_peek_path, build_hull_peek_path, build_keyed_peek_path, peek_raw, peek_loobean
---

# Peek Catalog

This page enumerates every peek path exposed by a shipped graft. Each section is one graft. For the teaching version of how peek arms compose (path shape, three keying schemes, multi-arg paths), see [Kernel → Domain Peeks](/build/kernel/peeks). For how the harness decodes the wrapped return, see [Testing → Domain Pokes → Reading State](/build/testing/domain-pokes#reading-state).

## Rust Builders for Single-Arg Paths

The three builders that cover the single-arg cases. They construct a `NounSlab` ready for `harness.peek_handle(path)`:

| Path shape | Builder | When grafts use it |
|---|---|---|
| `[%<tag> ~]` (keyless) | `build_keyless_peek_path("<tag>")` | Singletons (counts, epochs, the clock) |
| `[%<tag> hull ~]` (hull-keyed) | `build_hull_peek_path("<tag>", hull)` | Per-hull state (commitment grafts) |
| `[%<tag> @t %<key> ~]` (cord-keyed) | `build_keyed_peek_path("<tag>", key)` | Per-name state (kv, counter) |

Multi-arg paths (rbac's `[%rbac-has-perm pubkey perm ~]`) are hand-rolled — there's no shipped builder. See [vesl-core → Driving rbac-graft](/build/vesl-core#driving-rbac-graft) for the canonical pattern and [Kernel → Domain Peeks → Multi-Arg Path](/build/kernel/peeks#multi-arg-path) for the kernel side.

## Return-Shape Cheat Sheet

`harness.peek_handle(path)` unwraps the standard two-level `(unit (unit *))`:

- `Err` — kernel returned bare `~`; path malformed or graft not composed.
- `Ok(None)` — path recognized, value absent (kernel returned `[~ ~]`).
- `Ok(Some(slab))` — path recognized, value present (kernel returned `[~ [~ value]]`); `slab` contains the inner `value`.

A subset of shipped peeks return `(unit (unit (unit *)))` — three levels — because the inner `(unit *)` carries its own present/absent signal. For those, `peek_handle`'s `Ok(Some(_))` always fires (because the path is always recognized + the outer wrap is always present), but the inner unit still has to be inspected. Use `harness.peek_raw(path)` or `vesl_core::unwrap_triple_unit_atom(&result)` (which collapses both layers onto `Option<&[u8]>`).

The tables below tag each peek's return shape as **flat** (2-level: `peek_handle` returns the value directly) or **nested** (3-level: caller must unwrap the inner unit).

---

## settle-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%settle-registered hull=@ ~]` | `build_hull_peek_path("settle-registered", hull)` | flat — loobean | `peek_loobean(&result)` |
| `[%settle-noted note-id=@ ~]` | `build_hull_peek_path("settle-noted", note_id)` | flat — loobean (in-current-or-prior-epoch) | `peek_loobean(&result)` |
| `[%settle-root hull=@ ~]` | `build_hull_peek_path("settle-root", hull)` | nested — `(unit @)` (root present or absent) | `unwrap_triple_unit_atom(&result)` or `peek_raw` |
| `[%settle-epoch ~]` | `build_keyless_peek_path("settle-epoch")` | flat — `@ud` | `peek_atom_u64(&result)` |
| `[%settle-count ~]` | `build_keyless_peek_path("settle-count")` | flat — `@ud` | `peek_atom_u64(&result)` |

`%settle-registered` and `%settle-noted` both surface as loobeans because their underlying state operations are `~(has by ...)` (registration check) and `~(has in ...)` (membership check). `%settle-root` is the only one whose inner value can be absent (the hull is registered but holds no root yet during the registration race window).

## mint-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%mint-commit hull=@ ~]` | `build_hull_peek_path("mint-commit", hull)` | nested — `(unit @)` (committed root, or absent) | `unwrap_triple_unit_atom(&result)` |

## guard-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%guard-root hull=@ ~]` | `build_hull_peek_path("guard-root", hull)` | nested — `(unit @)` (registered root, or absent) | `unwrap_triple_unit_atom(&result)` |

## forge-graft

forge-graft is stateless — it generates a STARK proof from a single `%forge-prove` poke and emits the proof as `%forge-proved`. There is no state to peek.

## kv-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%kv-value key=@t ~]` | `build_keyed_peek_path("kv-value", key)` | nested — `(unit @)` (atom value, or absent) | `unwrap_triple_unit_atom(&result)` |

## counter-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%counter-value name=@t ~]` | `build_keyed_peek_path("counter-value", name)` | nested — `(unit @ud)` (counter value, or absent if name never touched) | `unwrap_triple_unit_atom(&result)` + `u64::from_le_bytes` |

`counter-value` returns `None` (in the nested-unit sense) only for names that have never been incremented, reset, or set. Init-on-touch means any prior poke against `name` makes the peek return a value.

## queue-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%queue-len ~]` | `build_keyless_peek_path("queue-len")` | nested — `[~ @ud]` (always-present sentinel; never absent) | `peek_raw` + flatten, or `unwrap_triple_unit_atom` |

The always-present sentinel pattern (the `[~ ...]` literal inside the wrap) keeps `len=0` from being mis-decoded as "queue not composed" by the standard two-level unwrap. The inner unit is *always* `Some` for `queue-len`.

## rbac-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%rbac-perm-count pubkey=@ ~]` | `build_hull_peek_path("rbac-perm-count", pubkey)` | nested — `[~ @ud]` (always-present; 0 for unregistered pubkeys) | `unwrap_triple_unit_atom(&result)` |
| `[%rbac-has-perm pubkey=@ perm=@t ~]` | **hand-rolled** (multi-arg) — see [vesl-core → Driving rbac-graft](/build/vesl-core#driving-rbac-graft) | nested — `[~ ?]` (always-present loobean; `%.n` for unregistered) | `peek_loobean(&result)` |

The auto-clear invariant on `%rbac-revoke` (a revoke that empties the perms set deletes the pubkey entry) means "zero perms" and "unregistered pubkey" are the same observable state. `perm-count` returns 0 for both; `has-perm` returns `%.n` for both.

## registry-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%registry-entry key=@ ~]` | `build_hull_peek_path("registry-entry", key)` | nested — `(unit *)` (opaque record noun, or absent) | `peek_raw` (caller `;;` to its schema) |

Records are returned as opaque nouns. The Rust caller is expected to `;;` against their domain schema (or destructure manually) after the peek.

## validate-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%validate-rules cause-tag=@ta ~]` | `build_keyed_peek_path("validate-rules", cause_tag)` | nested — `(unit (list rule))` (rule list, or absent for cause-tags with no installed rules) | `peek_raw` + walk list |

Returned for debugging which rules are currently active on a given cause-tag. The shipped `+$ rule` union has one variant (`%non-empty`); see [Library Catalog → Known Limits → validate-graft](/reference/library#validate-graft).

## log-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%log-by-seq seq=@ud ~]` | `build_keyless_peek_path` form: caller must pass a fully-built path (no shipped builder) | nested — `(unit log-entry)` (entry or absent if seq evicted) | `peek_raw` |
| `[%log-tail count=@ud ~]` | (caller-built path, like above) | nested — `[~ (list log-entry)]` (always-present, possibly empty) | `peek_raw` |
| `[%log-len ~]` | `build_keyless_peek_path("log-len")` | nested — `[~ @ud]` (always-present) | `unwrap_triple_unit_atom(&result)` |

`%log-by-seq` walks the entries list — O(retention), bounded by the 100k cap. A seq that's been evicted (rotated out by the FIFO trim — see [Library Catalog → Known Limits → log-graft](/reference/library#log-graft)) returns `None`. The audit-log invariant is that `log-len` answers "how many entries are live" without revealing which seqs were evicted.

## clock-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%clock-now ~]` | `build_keyless_peek_path("clock-now")` | nested — `[~ @da]` (always-present; cast `@ud` event-counter as `@da`) | `unwrap_triple_unit_atom(&result)` |

`@da` here is a thin cast over the underlying `@ud` event counter; there's no host wall-clock translation. See [Library Catalog → Known Limits → clock-graft](/reference/library#clock-graft).

## batch-graft

| Path | Rust builder | Return shape | Decoder |
|---|---|---|---|
| `[%batch-pending-len ~]` | `build_keyless_peek_path("batch-pending-len")` | nested — `[~ @ud]` (always-present; 0 if empty) | `unwrap_triple_unit_atom(&result)` |
| `[%batch-threshold ~]` | `build_keyless_peek_path("batch-threshold")` | nested — `[~ @ud]` (always-present; 0 = auto-flush disabled) | `unwrap_triple_unit_atom(&result)` |

`%batch-threshold` returns 0 when `%batch-init` hasn't been called (or was called with `threshold=0`); manual `%batch-flush` is then the only drain.

## intent-graft

intent-graft is a family-5 placeholder. Every cause-arm crashes with `%intent-graft-placeholder` (see [intent-graft.hoon](https://github.com/zkvesl/vesl-nockup/blob/main/hoon/lib/intent-graft.hoon)); the peek arm returns `~` for every path so the host kernel's peek chain falls through to the next graft. No peek paths are live in v0.1.

---

::: info See Also

- [Kernel → Domain Peeks](/build/kernel/peeks) — how to write a peek arm in Hoon.
- [Effect Catalog](/reference/effect-catalog) — the matching effect surface for each graft.
- [Hull → Decoding Effect Payloads](/build/hull#decoding-effect-payloads) — Rust-side decoding patterns including the unit-shape footgun.
- [Testing → Domain Pokes → Reading State](/build/testing/domain-pokes#reading-state) — using `peek_handle` and `peek_raw` from the harness.

:::
