---
title: Custom Gates
description: Using a verify-gate that isn't in the shipped catalog.
outline: deep
---

# Custom Gates

A custom verify-gate — one that isn't in the Tier 1a catalog — currently faces three coupled obstacles. The catalog is intentionally closed; if you need a gate that isn't shipped, the path is "fork and contribute back" rather than "register a plugin."

## 1. `nockup graft inject` hard-rejects unknown gate names

The CLI validates `[graft.gates].gate` and `[graft.gates].gate-chain` entries against an allowlist (`TIER_1A_GATES`) at manifest discovery. A name outside that allowlist fails immediately:

```
[graft.gates].gate `my-custom-gate` in hoon/lib/settle-graft.toml is not a known catalog gate.
Tier 1a (currently shipping): sig-verify-ed25519, sig-verify-schnorr,
manifest-verify, set-membership-verify, bounded-value-verify
```

There is no `--allow-custom-gate` flag today. To get past this you either (a) add your name to `TIER_1A_GATES` in `tools/graft-inject/src/gates.rs` in a local fork, or (b) skip the `[graft.gates]` table entirely and hand-write your gate directly in `settle-graft`'s poke body (the composer leaves hand-written gates untouched — see the `apply_gate_selection` mismatch guard).

## 2. `vesl-gates.hoon` must contain a matching arm

The composer rewrites the default hash-gate block to `=/  hash-gate=verify-gate  <name>:vesl-gates`, so `<name>` must resolve as an arm in `vesl-gates.hoon` with the required `[note-id=@ data=* expected-root=@] -> ?` signature. A name with no matching arm produces a `hoonc` `find . <name>:vesl-gates` failure at compile time. If you forked `TIER_1A_GATES`, you must also ship the hoon arm.

## 3. `vesl_hull::payload_builder_for_gate` has no impl for your name

Stock `/settle` dispatches through `SettlePayloadBuilder`. The library's `payload_builder_for_gate(name)` only knows `default-hash` and `manifest-verify`; every other name hits the fallback arm, prints a stderr warning, and returns `DefaultHashPayloadBuilder` — which will dead-deny against your custom gate. You have two ways out:

- **Wire your impl in the template.** The scaffolded `templates/vesl/src/main.rs::build_app_state` owns the dispatch. Replace the call to `payload_builder_for_gate` with your own match:

  ```rust
  let settle_builder: Arc<dyn vesl_hull::SettlePayloadBuilder> =
      match manifest.gate.as_str() {
          "my-custom-gate" => Arc::new(MyCustomPayloadBuilder),
          _ => vesl_hull::payload_builder_for_gate(&manifest.gate),
      };
  ```

  `AppState.settle_builder` is `Arc<dyn SettlePayloadBuilder>`, so any user impl works once the template chooses it. The trait shape and an example impl are on [Catalog Gates — Implementing a `SettlePayloadBuilder`](/build/catalog-gates/#implementing-a-settlepayloadbuilder).

- **Skip stock `/settle` entirely.** Mount your own `POST /settle-my-gate` route via [`serve_with_extra_routes`](/build/build-run/serve#composing-custom-routes) and use the per-gate poke builders in `vesl-core/src/graft_pokes/settle.rs` directly (e.g. `build_settle_note_poke_with_data` for arbitrary payload shapes). The stock `/settle` will still dead-deny if anyone hits it, but your route bypasses the dispatcher.

::: tip Need a gate the catalog doesn't have?

Most "custom verify-gate" needs are actually shape-validation or authorization checks that belong in a [validate-graft prelude](/build/grafts/inject#cause-dispatch-semantics) or a separate graft's poke arm — not in the verify-gate. The verify-gate is narrow on purpose: it answers "does this payload prove authority over the registered root?" If your need doesn't fit that shape, a graft is usually the right surface.

If you do need a true custom verify-gate, open an issue describing the shape — recurring patterns are candidates for inclusion in the catalog rather than per-user forks.

:::

::: info See Also

- [Catalog Gates from Rust](/build/catalog-gates/) — the shipped gates and the `SettlePayloadBuilder` trait shape.
- [Serve — Composing Custom Routes](/build/build-run/serve#composing-custom-routes) — `serve_with_extra_routes` for the bypass path.
- [Grafts / Manifest Schema — Gate Selection](/build/grafts/manifest-schema#graft-gates-gate-selection) — `[graft.gates]` validation contract.

:::
