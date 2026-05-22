---
title: Swapping a Gate
description: Edit [graft.gates], re-inject, verify via /status.
outline: deep
---

# Swapping a Gate

Edit `[graft.gates]` in your manifest and re-run `nockup graft inject --apply`. The composer rewrites the splice point at every `%settle-*` arm and prepends `/+  vesl-gates` to the imports body. The full deltas (root semantics, payload shape, Rust builder, behavior of pre-existing roots) are in [Grafts / Manifest Schema — Swapping a Gate](/build/grafts/manifest-schema#swapping-a-gate).

After re-compiling and restarting the hull, verify the swap landed via [`GET /status`](/build/build-run/serve#verifying-a-gate-swap-via-status) — the `gate` field reflects the new selection, and `manifest_shas` updates for any graft whose TOML body changed.

::: info See Also

- [Catalog Gates from Rust](/build/catalog-gates/) — per-gate root and payload bindings to plan the swap.
- [Grafts / Manifest Schema — Swapping a Gate](/build/grafts/manifest-schema#swapping-a-gate) — manifest-side delta walkthrough.
- [Serve — Verifying a gate swap via /status](/build/build-run/serve#verifying-a-gate-swap-via-status) — HTTP-side confirmation.

:::
