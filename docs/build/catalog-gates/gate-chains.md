---
title: Gate Chains
description: AND-folding multiple verification gates in [graft.gates].gate-chain.
outline: deep
---

# Gate Chains

`gate-chain = ["a", "b"]` in `[graft.gates]` AND-folds the listed gates: the chain accepts only when every gate returns `%.y`. The chain is AND-only; OR and short-circuit variants are not yet shipped.

The same `[note-id=@ data=* expected-root=@]` is passed to every chain element. Each gate `;;`-casts `data` internally to its own expected shape, so chains work only when every element accepts a compatible payload shape. Mixing payload shapes within a chain causes every element except the matching one to return `%.n`, and the AND-fold rejects.

No convenience builder exists for chained payloads. Use `build_settle_note_poke_with_data` and write a closure that emits a noun every chain element can accept.

::: tip Picking compatible elements
Two gates are chain-compatible when they cast `data` to the same shape *and* bind `expected-root` to the same digest. For example, `sig-verify-schnorr` and `sig-verify-ed25519` both expect `[data sig pubkey]` and both bind `hash-leaf(pubkey)` to the root — but they hash different pubkeys, so you cannot chain them against a single registered root. Chain only gates that agree on both axes.
:::

::: info See Also

- [Catalog Gates from Rust](/build/catalog-gates/) — per-gate payload shapes the chain has to agree on.
- [Grafts / Manifest Schema — Gate Selection](/build/grafts/manifest-schema#graft-gates-gate-selection) — `[graft.gates]` syntax for `gate-chain`.
- [`build_settle_note_poke_with_data`](https://github.com/zkvesl/vesl-core/blob/11d110d/crates/vesl-core/src/graft_pokes/settle.rs) — the closure-based builder for assembling arbitrary `data` cells.

:::
