# The Trellis Pattern

One kernel, one root, one replay boundary — fine, until the day an app needs two. Different tenants. Different app versions. Different audit periods. Different credential subjects. The graft's `registered=(map @ @)` already supports it; pick a scheme for `hull-id` and use it.

A **trellis** is the shape that falls out: a grid of independent commitment buckets sharing a single kernel. Each cell is its own root, its own lifecycle, its own `%vesl-register` / `%vesl-verify` / `%vesl-settle` namespace. The kernel glues the cells together at exactly one place — a global `settled` set — and leaves everything else isolated.

## Why reach for it

One hull works until the day the app needs to:

- Split commitments by tenant (each customer gets their own root)
- Split by version (app-v1 SBOM vs app-v2 SBOM — any build attests independently)
- Split by period (Q1 audit trail, Q2 audit trail, each with its own root-of-roots)
- Split by domain (license roots alongside credential roots in the same kernel)

The trellis gives the isolation of separate kernels without the overhead of booting separate NockApps. `hull-id` is the only axis needed.

## Shape

`vesl-state` is two fields:

```hoon
+$  vesl-state
  $:  registered=(map @ @)    ::  hull-id -> merkle-root
      settled=(set @)         ::  note-ids (global across the trellis)
  ==
```

The trellis lives in `registered`. Each `hull-id` keys a distinct root. `settled` is *global* — note-ids are unique across the whole trellis, not per-hull. When per-hull note-id namespaces are needed, key notes as `note-id = hash(hull, local-id)` on the caller side before sending them.

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

## Lifecycle: two cells in parallel

Register, verify, and settle are all keyed by `hull-id`. Running two in parallel is just two sets of calls with different hull arguments — no extra wiring, no lookup table, no per-hull state on the caller side:

```rust
use vesl_core::{
    build_vesl_register_poke,
    build_vesl_settle_poke,
    build_vesl_verify_poke,
    Mint,
};

let root_v1 = mint_v1.commit(&[sbom_v1][..]);
let root_v2 = mint_v2.commit(&[sbom_v2][..]);

app.poke(build_vesl_register_poke(1, &root_v1)).await?;
app.poke(build_vesl_register_poke(2, &root_v2)).await?;

app.poke(build_vesl_verify_poke(101, 1, &root_v1, sbom_v1)).await?;
app.poke(build_vesl_verify_poke(201, 2, &root_v2, sbom_v2)).await?;

app.poke(build_vesl_settle_poke(101, 1, &root_v1, sbom_v1)).await?;
app.poke(build_vesl_settle_poke(201, 2, &root_v2, sbom_v2)).await?;
```

Two independent lifecycles, one kernel. Swap `1` and `2` for any identifier scheme — tenant IDs, vault IDs, credential subjects, period numbers, git SHAs truncated to `u64`.

## Cross-cell guardrails

The graft catches cross-cell mistakes without crashing. Each check is independent per hull, except for the global `settled` set.

**Replay** — a note-id already in `settled` errors regardless of hull:

```rust
// second settle of note 101 — already in settled; global check fires
app.poke(build_vesl_settle_poke(101, 1, &root_v1, sbom_v1)).await?;
//   → effect: %vesl-error   (note already settled)
```

**Root mismatch** — presenting hull 1's root under hull 2 errors because hull 2's registered root differs:

```rust
// hull 2 is registered with root_v2; presenting root_v1 under it
app.poke(build_vesl_settle_poke(301, 2, &root_v1, sbom_v1)).await?;
//   → effect: %vesl-error   (root mismatch)
```

**Unregistered hull** — any settle against a hull-id that was never registered errors cleanly:

```rust
app.poke(build_vesl_settle_poke(999, 99, &root_v1, sbom_v1)).await?;
//   → effect: %vesl-error   (root not registered)
```

Each guard returns `%vesl-error` with a diagnostic cord. None crash the kernel, and none leak state between cells.

## Layering domain pokes over the trellis

Domain pokes can read from the grafted `vesl=vesl-state` alongside the app's own state — there's no special bridging. A typical pattern keeps a parallel per-hull log or set that mirrors the trellis:

```hoon
+$  versioned-state
  $:  %v1
      vesl=vesl-state
      digests=(list [hull=@ud dig=@t])    ::  a log per hull
      verified=(set @ud)                   ::  hulls the app has blessed
  ==
```

Arms like `%record-digest hull=@ud dig=@t` append to `digests`, and `%mark-verified hull=@ud` puts into `verified`. Neither touches `vesl.state`, so the graft stays hands-off. The graft arms and the domain arms coexist in the same `?-` switch — [Grafting → Add your own domain pokes](/guides/grafting) walks through the 7-line-per-command shape.

## When not to trellis

- **Single-tenant apps with one root forever.** One hull is fine; don't add ceremony.
- **Apps that need per-hull replay namespaces.** The `settled` set is global. For note-id `101` to be settle-able once per hull, hash the hull-id into the note-id before calling `build_vesl_settle_poke`.
- **Apps near the settled-set capacity.** The graft caps `settled` at 1,000,000 across all hulls combined (`V-002` guard). Partition into separate kernels when approaching that bound.
- **Apps that want per-hull verification gates.** The gate is wired once per `%vesl-*` arm; when hull 1 needs signature verification and hull 2 needs STARK verification, fork the arms or write a dispatching gate that branches on `hull`.
