---
title: The Trellis Pattern
description: One kernel split across multiple hull-keyed namespaces. Use when an app needs tenant / version / period / domain isolation without booting separate NockApps.
outline: deep
---

# The Trellis Pattern

One kernel, one root, one replay boundary — fine, until the day an app needs two. Different tenants. Different app versions. Different audit periods. Different credential subjects. `settle-graft`'s `registered=(map @ @)` already supports it; pick a scheme for `hull-id` and use it.

A **trellis** is the shape that falls out: a grid of independent commitment buckets sharing a single kernel. Each cell is its own root, its own lifecycle, its own `%settle-register` / `%settle-verify` / `%settle-note` namespace. The kernel glues the cells together at exactly one place: a global `settled` set. Everything else stays isolated.

## Why reach for it

One hull works until the day the app needs to:

- Split commitments by tenant (each customer gets their own root)
- Split by version (app-v1 SBOM vs app-v2 SBOM — any build attests independently)
- Split by period (Q1 audit trail, Q2 audit trail, each with its own root-of-roots)
- Split by domain (license roots alongside credential roots in the same kernel)

The trellis gives the isolation of separate kernels without booting separate `NockApp`s. `hull-id` is the only axis needed.

## Shape

`settle-state` carries the two fields the pattern keys on:

```hoon
+$  settle-state
  $:  registered=(map @ @)    ::  hull-id -> merkle-root
      settled=(set @)         ::  note-ids (global across the trellis)
      ::  ... other settle-graft fields
  ==
```

The trellis lives in `registered`. Each `hull-id` keys a distinct root. `settled` is *global*: note-ids are unique kernel-wide across all hulls. When per-hull note-id namespaces are needed, key notes as `note-id = hash(hull, local-id)` on the caller side before sending them.

```
┌───────────────── kernel ──────────────────┐
│                                           │
│   ┌─ hull 1 ──────┐   ┌─ hull 2 ──────┐  │
│   │  root₁        │   │  root₂        │  │
│   │  (tenant A)   │   │  (tenant B)   │  │
│   └───────────────┘   └───────────────┘  │
│                                           │
│   ┌─ hull 3 ──────┐   ┌─ hull 4 ──────┐  │
│   │  root₃        │   │  root₄        │  │
│   │  (version v1) │   │  (version v2) │  │
│   └───────────────┘   └───────────────┘  │
│                                           │
│   settled = { 101, 201, 301, 401 }       │  ← global
│                                           │
└───────────────────────────────────────────┘
```

## Lifecycle: Two Cells in Parallel

Register, verify, and note are all keyed by `hull-id`. Running two in parallel is just two sets of calls with different hull arguments — the caller's wiring stays the same; only the hull-id varies between cells:

```rust
use vesl_core::{
    build_settle_register_poke,
    build_settle_verify_poke,
    build_settle_note_poke,
    Mint,
};
use nockapp::wire::{SystemWire, Wire};

let root_v1 = mint_v1.commit(&[sbom_v1][..]);
let root_v2 = mint_v2.commit(&[sbom_v2][..]);

app.poke(SystemWire.to_wire(), build_settle_register_poke(1, &root_v1)).await?;
app.poke(SystemWire.to_wire(), build_settle_register_poke(2, &root_v2)).await?;

app.poke(SystemWire.to_wire(), build_settle_verify_poke(101, 1, &root_v1, sbom_v1)).await?;
app.poke(SystemWire.to_wire(), build_settle_verify_poke(201, 2, &root_v2, sbom_v2)).await?;

app.poke(SystemWire.to_wire(), build_settle_note_poke(101, 1, &root_v1, sbom_v1)).await?;
app.poke(SystemWire.to_wire(), build_settle_note_poke(201, 2, &root_v2, sbom_v2)).await?;
```

Two independent lifecycles, one kernel. Swap `1` and `2` for any identifier scheme — tenant IDs, vault IDs, credential subjects, period numbers, git SHAs truncated to `u64`.

## Cross-Cell Guardrails

The graft catches cross-cell mistakes without crashing. Each check is independent per hull, except for the global `settled` set.

**Replay** — a note-id already in `settled` errors regardless of hull:

```rust
// second note of 101 — already in settled; global check fires
app.poke(SystemWire.to_wire(), build_settle_note_poke(101, 1, &root_v1, sbom_v1)).await?;
//   → effect: %settle-error   (note already settled)
```

**Root mismatch** — presenting hull 1's root under hull 2 errors because hull 2's registered root differs:

```rust
// hull 2 is registered with root_v2; presenting root_v1 under it
app.poke(SystemWire.to_wire(), build_settle_note_poke(301, 2, &root_v1, sbom_v1)).await?;
//   → effect: %settle-error   (root mismatch)
```

**Unregistered hull** — any note against a hull-id that was never registered errors cleanly:

```rust
app.poke(SystemWire.to_wire(), build_settle_note_poke(999, 99, &root_v1, sbom_v1)).await?;
//   → effect: %settle-error   (root not registered)
```

Each guard returns `%settle-error` with a diagnostic cord. None crash the kernel, and none leak state between cells.

## Layering Domain Pokes Over the Trellis

Domain pokes can read from the grafted `settle=settle-state` alongside the app's own state; there's no special bridging. A typical pattern keeps a parallel per-hull log or set that mirrors the trellis:

```hoon
+$  versioned-state
  $:  %v1
      settle=settle-state
      digests=(list [hull=@ud dig=@t])    ::  a log per hull
      verified=(set @ud)                   ::  hulls the app has blessed
  ==
```

Arms like `%record-digest hull=@ud dig=@t` append to `digests`, and `%mark-verified hull=@ud` puts into `verified`. Neither touches `settle.state`, so the graft stays hands-off. The graft arms and the domain arms coexist in the same `?-` switch; [Kernel — Adding a Domain Cause](/build/kernel/causes) walks through the per-command shape.

## When Not to Trellis

- **Single-tenant apps with one root forever.** One hull is fine; don't add ceremony.
- **Apps that need per-hull replay namespaces.** The `settled` set is global. For note-id `101` to be note-able once per hull, hash the hull-id into the note-id before calling `build_settle_note_poke`.
- **Apps near the settled-set capacity.** The `settled` set has a fixed capacity across all hulls combined; check `settle-graft`'s manifest for the current limit. Partition into separate kernels when approaching that bound.
- **Apps that want per-hull verification gates.** The gate is wired once per `%settle-*` arm; when hull 1 needs signature verification and hull 2 needs STARK verification, fork the arms or write a dispatching gate that branches on `hull`.
