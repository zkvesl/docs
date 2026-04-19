# The Trellis Pattern

One kernel, one root, one replay boundary — fine, until the day an app needs two. Different tenants. Different app versions. Different audit periods. Different credential subjects. Settle-graft's `registered=(map @ @)` already supports it; pick a scheme for `hull-id` and use it.

A **trellis** is the shape that falls out: a grid of independent commitment buckets sharing a single kernel. Each cell is its own root, its own lifecycle, its own `%settle-register` / `%settle-verify` / `%settle-note` namespace. The kernel glues the cells together at exactly one place — a global `settled` set, rotated per epoch — and leaves everything else isolated.

## Why reach for it

One hull works until the day the app needs to:

- Split commitments by tenant (each customer gets their own root)
- Split by version (app-v1 SBOM vs app-v2 SBOM — any build attests independently)
- Split by period (Q1 audit trail, Q2 audit trail, each with its own root-of-roots)
- Split by domain (license roots alongside credential roots in the same kernel)

The trellis gives the isolation of separate kernels without the overhead of booting separate NockApps. `hull-id` is the only axis needed.

## Shape

Post-H-01, `settle-state` is five fields. The new fields (`epoch`, `settle-count`, `prior-settled`) support count-based epoch rotation — the settled set no longer fills up and permanently bricks; it rotates after 1M settles per epoch, keeping a two-epoch lookback window for replay detection.

```hoon
+$  settle-state
  $:  epoch=@                     ::  current epoch number
      registered=(map @ @)        ::  hull-id -> merkle-root (persists across epochs)
      settled=(set @)             ::  current-epoch note-ids (replay protection)
      settle-count=@              ::  notes settled in the current epoch
      prior-settled=(set @)       ::  previous epoch's set (kept for lookback)
  ==
```

The trellis lives in `registered`. Each `hull-id` keys a distinct root. `settled` ∪ `prior-settled` is *global* across the trellis — note-ids are unique across the whole kernel, not per-hull. When per-hull note-id namespaces are needed, key notes as `note-id = hash(hull, local-id)` on the caller side before sending.

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
│   epoch = 3                               │
│   settled       = { 101, 201, 301, 401 } │  ← current
│   prior-settled = { 13, 29, 47, 59 }     │  ← previous epoch
│                                           │
└───────────────────────────────────────────┘
```

## Lifecycle: two cells in parallel

Register, verify, and settle are all keyed by `hull-id`. Running two in parallel is just two sets of calls with different hull arguments — no extra wiring, no lookup table, no per-hull state on the caller side:

```rust
use vesl_core::{
    build_settle_register_poke,
    build_settle_note_poke,
    build_settle_verify_poke,
    Mint,
};

let root_v1 = mint_v1.commit(&[sbom_v1][..]);
let root_v2 = mint_v2.commit(&[sbom_v2][..]);

app.poke(build_settle_register_poke(1, &root_v1)).await?;
app.poke(build_settle_register_poke(2, &root_v2)).await?;

app.poke(build_settle_verify_poke(101, 1, &root_v1, sbom_v1)).await?;
app.poke(build_settle_verify_poke(201, 2, &root_v2, sbom_v2)).await?;

app.poke(build_settle_note_poke(101, 1, &root_v1, sbom_v1)).await?;
app.poke(build_settle_note_poke(201, 2, &root_v2, sbom_v2)).await?;
```

Two independent lifecycles, one kernel. Swap `1` and `2` for any identifier scheme — tenant IDs, vault IDs, credential subjects, period numbers, git SHAs truncated to `u64` (or routed through `atom_from_u64` if above `DIRECT_MAX`).

## Cross-cell guardrails

The graft catches cross-cell mistakes without crashing. Each check is independent per hull, except for the global `settled` set.

**Replay (current epoch)** — a note-id already in `settled` errors regardless of hull:

```rust
app.poke(build_settle_note_poke(101, 1, &root_v1, sbom_v1)).await?;
//   → effect: %settle-error   (note already settled)
```

**Replay (prior epoch)** — after rotation, note-ids stay blocked for one additional epoch:

```rust
// epoch 3 rotated; 101 was settled in epoch 2, now lives in prior-settled
app.poke(build_settle_note_poke(101, 1, &root_v1, sbom_v1)).await?;
//   → effect: %settle-error   (note already settled in prior epoch)
```

**Root mismatch** — presenting hull 1's root under hull 2 errors because hull 2's registered root differs:

```rust
app.poke(build_settle_note_poke(301, 2, &root_v1, sbom_v1)).await?;
//   → effect: %settle-error   (root mismatch)
```

**Unregistered hull** — any settle against a hull-id that was never registered errors cleanly:

```rust
app.poke(build_settle_note_poke(999, 99, &root_v1, sbom_v1)).await?;
//   → effect: %settle-error   (root not registered)
```

Each guard returns `%settle-error` with a diagnostic cord. None crash the kernel, and none leak state between cells.

## Unified `hull=@` across primitives

All three commitment-bearing grafts key on the same `hull=@`:

| Graft | Trellis field | Example peek |
|---|---|---|
| `settle-graft` | `registered=(map @ @)` | `[%settle-registered hull=@ ~]` → `%.y`/`%.n` |
| `mint-graft`   | `commits=(map @ @)`    | `[%mint-commit hull=@ ~]` → `(unit @)` of the committed root |
| `guard-graft`  | `roots=(map @ @)`      | `[%guard-root hull=@ ~]` → `(unit @)` of the registered root |

Composing two or three of them in the same kernel means one `hull=7` addresses the *same logical cell* across every primitive. Nothing auto-propagates — if you want mint's root to also live in guard, register it there explicitly — but the key convention is uniform, so an app that mints a root can quickly add guard checks by calling `build_guard_register_poke(7, &same_root)` and the cross-graft peek `[%guard-root hull=7 ~]` returns the same root mint committed.

## Layering domain pokes over the trellis

Domain pokes can read from the grafted `settle=settle-state` alongside the app's own state — there's no special bridging. A typical pattern keeps a parallel per-hull log or set that mirrors the trellis:

```hoon
+$  versioned-state
  $:  %v1
      settle=settle-state
      digests=(list [hull=@ud dig=@t])    ::  a log per hull
      verified=(set @ud)                   ::  hulls the app has blessed
  ==
```

Arms like `%record-digest hull=@ud dig=@t` append to `digests`, and `%mark-verified hull=@ud` puts into `verified`. Neither touches `settle.state`, so the graft stays hands-off. The graft arms and the domain arms coexist in the same `?-` switch — [Grafting → Add your own domain pokes](/guides/grafting) walks through the 7-line-per-command shape.

## Epoch rotation

Per-epoch throughput caps at `epoch-cap` (1,000,000 settles). The settlement at that boundary auto-rotates:

```
before rotate: settled = { …1M items… },       prior-settled = { …prior epoch… }
                                                settle-count = epoch-cap (1M)

on the 1,000,001st settle:
  prior-settled := settled
  settled       := { new-note-id }
  settle-count  := 1
  epoch         += 1
  effects       := [%settle-epoch-rotated old=N new=N+1]
                   [%settle-noted …]
```

Rotation fires automatically when `settle-count` hits `epoch-cap`. There is no caller-initiated rotation — a manual arm would be unauthenticated and allow two successive pokes to empty both `settled` and `prior-settled`, collapsing replay protection.

Peek `[%settle-epoch ~]` reports the current epoch number; `[%settle-count ~]` reports how many notes have settled in it.

## When not to trellis

- **Single-tenant apps with one root forever.** One hull is fine; don't add ceremony.
- **Apps that need per-hull replay namespaces.** `settled` is global. For note-id `101` to be settle-able once per hull, hash the hull-id into the note-id before calling `build_settle_note_poke`.
- **Apps near the settled-set capacity.** The graft caps `settled` at 1M per epoch (`++epoch-cap`), rotating automatically on overflow. Over long enough horizons that's billions of settles, but deployments expecting >1M/epoch throughput should provision multiple kernels or tune `++epoch-cap` at compile time.
- **Apps that want per-hull verification gates.** The gate is wired once per `%settle-*` arm; when hull 1 needs signature verification and hull 2 needs STARK verification, fork the arms or write a dispatching gate that branches on `hull`.
