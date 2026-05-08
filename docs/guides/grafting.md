# Grafting Vesl onto Your NockApp

Vesl attaches to a NockApp as a set of composable Hoon libraries. Your kernel keeps doing what it does — each graft you install adds a state fragment, a cause-union branch, a `?-` arm, and a peek chain entry. Writing that wiring by hand is busywork, so vesl ships `graft-inject` to do it for you.

Grafts fall into five families on a priority lattice. Families 1–4 shape what the graft *does*; family 5 is reserved for coordination. Pick any subset you need.

| # | Family | Priority band | Status | What lives there |
|---|---|---|---|---|
| 1 | Commitment | 10–40 | Shipped | `settle-graft`, `mint-graft`, `guard-graft`, `forge-graft` |
| 2 | Verification gates | n/a (library) | Tier 1a shipping | `vesl-gates.hoon` library — named gate arms consumed by commitment grafts via `[graft.gates]`. Currently ships `sig-verify-ed25519`, `sig-verify-schnorr`, `manifest-verify`, `set-membership-verify`, `bounded-value-verify`. |
| 3 | State | 50–99 | Shipped | App-state primitives — `kv-graft` (50), `counter-graft` (60), `queue-graft` (70), `rbac-graft` (80), `registry-graft` (90) |
| 4 | Behavior | 100–149 | v0.1 partial | Runtime wrappers and observers — `validate-graft` (100), `log-graft` (130), `clock-graft` (140), `batch-graft` (145). `fsm-graft` and `index-graft` deferred. |
| 5 | Intent | 200–299 | Placeholder | `intent-graft` — reserved for multi-party coordination (declare / match / cancel / expire); crashes on invocation until Nockchain upstream publishes the canonical shape |

Commitments do not require intents. A NockApp can produce a ZK proof and settle it without ever declaring an intent — the STARK pipeline itself is intent-free. Family 5 is optional coordination over state transitions, not a dependency of families 1–4.

Today's shipped grafts, by family:

**Family 1 — Commitment (hull-keyed):**

| Graft | Priority | What it does |
|---|---|---|
| `settle-graft` | 10 | Register roots, verify payloads against a gate, settle notes with replay protection and epoch rotation. The heavyweight primitive. |
| `mint-graft`   | 20 | Commit a Merkle root to a `hull=@` trellis cell. Append-only, no gate. |
| `guard-graft`  | 30 | Register a root per hull, check a leaf's hash against the registered root. Soft verify (`ok=%.y/%.n`). |
| `forge-graft`  | 40 | STARK-prove a Nock computation over the committed data. Stateless. Adds ~16MB of prover constraint tables. |

**Family 3 — State (domain-keyed app-state, no hull):**

| Graft | Priority | What it does |
|---|---|---|
| `kv-graft`       | 50 | Loose key-value store. `@t` keys, opaque atom values; overwrite-on-set, idempotent delete. |
| `counter-graft`  | 60 | Named `@ud` counters; init-on-touch, saturate at `2^64-1` so Rust `u64` callers never lose precision. |
| `queue-graft`    | 70 | FIFO job queue with monotonic IDs; opaque body, polling-friendly empty-pop. First state-graft with a C1 mule-wrap site. |
| `rbac-graft`     | 80 | Pubkey-keyed permission table; two-level capacity guard; auto-clears empty pubkeys after revoke. |
| `registry-graft` | 90 | Strict structured registry; create-only put, modify-only update, error-on-missing delete. Heaviest C1 surface (two cue sites). |

**Family 4 — Behavior (runtime wrappers and observers):**

| Graft | Priority | What it does |
|---|---|---|
| `validate-graft` | 100 | Pre-flight rule check on poke causes. Rules install per cause-tag at runtime via `%validate-init`; the prelude block short-circuits with `%validate-rejected` before the `?-` switch runs. v0.1 ships `%non-empty` rule only — `length` / `in-set` / `range` / `unique-in` deferred until graft-inject grows codegen. First consumer of the `[graft.blocks.poke-prelude]` marker. |
| `log-graft`      | 130 | Append-only audit trail with monotonic seq + caller-supplied `tag=@ta`. Newest-first; oldest evicted past the retention cap (100k entries). Three peek paths: by-seq, tail, len. C1 mule-wraps the cued payload. |
| `clock-graft`    | 140 | Deterministic event-counter clock. `%clock-tick` advances a monotonic counter; `[%clock-now ~]` returns the current `@da`. `event-count` source only — boot-offset is non-deterministic environmental input (deferred); block-time as a third source waits on chain-bridge plumbing (Phase 05). |
| `batch-graft`    | 145 | Settlement-flush buffer. Accumulates caller intents and emits one `%batch-flushed bundle=...` when the count threshold trips, amortizing on-chain settlement. v0.1 ships `count` trigger only; `pages` and `time` triggers deferred. C1 mule-wraps the cued intent payload. |

`fsm-graft` and `index-graft` from the original Phase 03 plan are deferred indefinitely — both need graft-inject codegen to wrap external map state generically (a runtime-configured wrapper can't introspect named fields of an arbitrary cause cell without compile-time knowledge of the kernel's specific shapes). Self-owned variants are shippable but overlap with kv-graft / a state-machined kv; held until friction evidence justifies the duplication.

**Family 5 — Intent (placeholder):**

| Graft | Priority | What it does |
|---|---|---|
| `intent-graft` | 200 | **Placeholder** — family-5 slot reservation. `stability = "placeholder"` in its manifest; every cause arm bangs with `%intent-graft-placeholder` so accidental adoption fails loud. Swapped for the real primitive when Nockchain upstream lands. |

A typical layered app mints, guards, and settles the same `hull=@`: mint records the commitment, guard answers inclusion queries, settle gates the transition to a durable "noted" state. The four commitment primitives share the unified `hull=@` key; the caller picks when to propagate.

State grafts are **domain-keyed, not hull-keyed**. A single kernel can host any combination of commitment grafts (sharing one hull namespace) and state grafts (each with its own domain key). Higher-level Rust crates (in Phase 05) will compose both: they bind a hull at boot and expose a per-graft domain API on top.

Three ways to start, depending on where you are.

## Path 1: Fresh project from the scaffold template

Copy `templates/graft-scaffold/` from vesl-nockup. Everything is pre-wired against `settle-graft`; add other primitives by dropping their manifests into `hoon/lib/` and re-running `graft-inject`.

```bash
cp -r /path/to/vesl-nockup/templates/graft-scaffold my-project
cd my-project
```

Compile (all Hoon deps bundled — no `$NOCK_HOME` needed):

```bash
hoonc --new hoon/app/app.hoon hoon/
```

Build and run:

```bash
cargo +nightly build
cargo +nightly run
```

The scaffold includes:

- `hoon/app/app.hoon` — grafted kernel with `CUSTOMIZE` markers
- `hoon/lib/settle-graft.hoon` + `settle-graft.toml` — state + poke dispatcher + manifest
- `hoon/lib/vesl-merkle.hoon` — tip5 Merkle primitives
- `hoon/common/` — tip5 hash tables (zeke.hoon + ztd/)
- `src/main.rs` — full lifecycle: domain poke, Mint, Guard, `build_settle_register_poke`, `build_settle_verify_poke`, `build_settle_note_poke`
- `Cargo.toml` — local path dependencies (adjust paths to your clones)

To customize: rename `%my-action` in `app.hoon`, add state fields after `settle=settle-state`, fill in domain poke logic. The three `%settle-*` delegations and the verification gate are already written. To add more primitives, copy their manifests into `hoon/lib/` and re-run `graft-inject --apply hoon/app/app.hoon` — the tool composes the new blocks alongside the existing ones. Bare `graft-inject hoon/app/app.hoon` previews without writing.

## Path 2: Add vesl to an existing NockApp

For a project that already has a working Hoon kernel and Rust driver. The flow is: install the Hoon libraries, annotate `app.hoon` with the nine markers, run `graft-inject`, recompile.

### Step 1 — Install the Hoon libraries

Copy the grafts you want into your `hoon/lib/`. Minimum is `settle-graft`; add any combination of the other three:

```bash
# mandatory: settle + merkle + tip5 tree
cp vesl-nockup/hoon/lib/settle-graft.{hoon,toml} hoon/lib/
cp vesl-nockup/hoon/lib/vesl-merkle.hoon         hoon/lib/
cp vesl-nockup/hoon/common/zeke.hoon             hoon/common/
cp -r vesl-nockup/hoon/common/ztd                hoon/common/

# optional: any subset of the other three
cp vesl-nockup/hoon/lib/mint-graft.{hoon,toml}   hoon/lib/
cp vesl-nockup/hoon/lib/guard-graft.{hoon,toml}  hoon/lib/

# forge drags in the STARK prover tree (~16MB). Skip if you don't need proofs.
cp vesl-nockup/hoon/lib/forge-graft.{hoon,toml}  hoon/lib/
cp vesl-nockup/hoon/lib/vesl-{prover,lower}.hoon hoon/lib/
cp -r vesl-nockup/hoon/{common/v2,common/stark,dat,jams} hoon/
cp vesl-nockup/hoon/common/nock-common.hoon      hoon/common/
```

Confirm `graft-inject` sees what you copied:

```bash
graft-inject --list
# settle-graft     0.1.0   priority=10   (imports, state, cause, poke, peek)
# mint-graft       0.1.0   priority=20   (imports, state, cause, poke, peek)
# guard-graft      0.1.0   priority=30   (imports, state, cause, poke, peek)
# forge-graft      0.1.0   priority=40   (imports, cause, poke)
# kv-graft         0.1.0   priority=50   (imports, state, cause, poke, peek)
# counter-graft    0.1.0   priority=60   (imports, state, cause, poke, peek)
# queue-graft      0.1.0   priority=70   (imports, state, cause, poke, peek)
# rbac-graft       0.1.0   priority=80   (imports, state, cause, poke, peek)
# registry-graft   0.1.0   priority=90   (imports, state, cause, poke, peek)
# validate-graft   0.1.0   priority=100  (imports, state, cause, poke-prelude, poke, peek)
# log-graft        0.1.0   priority=130  (imports, state, cause, poke, peek)
# clock-graft      0.1.0   priority=140  (imports, state, cause, poke, peek)
# batch-graft      0.1.0   priority=145  (imports, state, cause, poke, peek)
```

`--list --json` emits the same information as machine-readable JSON. The schema is documented in `vesl/docs/graft-manifest.md` and stable across PARAMETIZATION's lifespan.

### Step 2 — Annotate your `app.hoon` with markers

`graft-inject` looks for nine comment markers at fixed structural points — seven content markers (where graft bodies splice in) and two codegen markers (where the typed effect-union pass writes):

```
::  nockup:imports         — top of the file, near your `/+` directives
::  nockup:state           — inside `versioned-state`'s `$:` block
::  nockup:cause           — inside `cause`'s `$%` union
::  nockup:poke-prelude    — before the `?-` poke switch (Phase 03b)
::  nockup:poke            — inside the `?-` poke switch
::  nockup:poke-postlude   — after the `?-` switch (Phase 03b)
::  nockup:peek            — inside the peek `?+` default arm (or just above a bare `~` fallthrough)
::  nockup:domain-effect   — anchor for your `+$ domain-effect` declaration (Phase 03f)
::  nockup:effect-union    — codegen target for the typed `+$ effect $%(...)` union (Phase 03f)
```

The two-space law applies: `::` followed by exactly two spaces, then `nockup:<name>`. See `vesl-nockup/templates/app.hoon` for canonical placement.

The `poke-prelude` and `poke-postlude` markers (Phase 03b) bracket the `?-` switch so behavior grafts can wrap or observe poke flow without touching any other graft's arms. Preludes contribute either `?:` short-circuit guards (validate / fsm rejection paths) or `=/  pre-X` bindings (index-graft pre-state captures). Postludes rebind `out` (the switch's `[(list effect) _state]` result) to transform either field. Multiple prelude / postlude blocks compose left-to-right in priority order.

**Validate rules apply universally.** Because `validate-graft`'s prelude runs *before* the `?-` switch dispatches to any arm, a rule installed via `%validate-init` for a cause-tag fires on **every** poke matching that tag — graft-injected pokes (`%queue-push`, `%batch-add`, `%settle-note`, etc.) and domain pokes alike. Rule failure short-circuits with `%validate-rejected` and leaves state untouched. This makes validate the right primitive for kernel-wide write policies (signing requirements, body-shape guards, rate limits) regardless of whether the policy targets a user-written or a grafted poke. The corollary — install with care: an over-broad rule on a graft cause-tag (e.g. `%non-empty` on `%settle-note`) blocks every settle attempt with an empty-shape payload, regardless of who initiated it.

The `domain-effect` and `effect-union` markers (Phase 03f Lever 1) anchor the typed effect-union codegen. `domain-effect` is the placement anchor for *your* `+$ domain-effect $%(...)` declaration — graft-inject does not own the body here, only checks the marker is present. `effect-union` is the REPLACE-IF-PRESENT codegen target: graft-inject synthesizes `+$ effect $%(<each graft's effect> domain-effect ==)` between its own banner pair. Re-running with a different graft set rewrites the union to match. Kernels that pre-date Phase 03f (carrying a bare `+$ effect *` and no markers) auto-migrate on the next `graft-inject` run; pass `--no-migrate` to opt out. See [Reference / CLI](/reference/cli) for the codegen output and the `[graft.types]` schema.

### Step 3 — Run `graft-inject`

`graft-inject` is preview-only by default: a bare invocation prints the composed kernel to stdout and a per-manifest sha256 summary to stderr. Pass `--apply` to write.

```bash
# Preview — composed Hoon to stdout, report to stderr, disk untouched.
graft-inject hoon/app/app.hoon

# Apply — writes the composed kernel back to PATH.
graft-inject --apply hoon/app/app.hoon
#   settle-graft     sha256:a9c72bbe7dc1 injected 5/5 (imports, state, cause, poke, peek)
#   mint-graft       sha256:4b2e1c8930f2 injected 5/5 (imports, state, cause, poke, peek)
#   guard-graft      sha256:c310a56e47bd injected 5/5 (imports, state, cause, poke, peek)
#   forge-graft      sha256:f72193ac2018 injected 3/3 (imports, cause, poke)
#   markers in source: 9 (imports, state, cause, poke-prelude, poke, poke-postlude, peek, domain-effect, effect-union)
#   markers populated: 5 (imports, state, cause, poke, peek)
#   effect-union codegen: inserted (5 variants: settle-effect, mint-effect, guard-effect, forge-effect, domain-effect)
```

Preview-by-default exists because manifest `body` fields paste verbatim into kernel source. Seeing the composed diff — and the sha256 of each manifest that produced it — before anything hits disk is the supply-chain guardrail against a compromised `hoon/lib/`. See the trust model in the manifest schema docs.

Selective composition:

```bash
graft-inject --grafts settle-graft,mint-graft --apply hoon/app/app.hoon  # explicit subset
graft-inject --exclude forge-graft --apply hoon/app/app.hoon             # skip forge
```

The tool is idempotent — re-running reports every already-wired marker as `skipped`. If you get `warning — markers not found: ...`, your marker placement or two-space law is off.

`forge-graft` reports 3/3 because it ships no state and no peek (forge is stateless; one-shot prove, nothing to query). The injection-report denominator is per-graft — each primitive reports against the blocks *it* declares, not a fixed 5.

### Removing a graft

graft-inject is symmetric. Drop a graft from `--grafts` (or `--exclude` it) on a re-run with `--apply` and every banner-pair-bounded block that graft owned is auto-pruned:

```bash
graft-inject --grafts settle-graft,registry-graft,log-graft --apply hoon/app/app.hoon
#   ...
#   rbac-graft       no-manifest    pruned 5/5 (imports, state, cause, poke, peek) (orphan blocks from previous injection)
```

The codegen `effect` union shrinks in the same pass — variant collection only reads from the active graft set, so the dropped graft's effect type leaves the union and the orphan arms (which referenced it) leave the file. hoonc compiles clean.

The lib files (`hoon/lib/<name>-graft.hoon`, `hoon/lib/<name>-graft.toml`) stay where they are — graft-inject only edits `app.hoon`. Delete them manually if you want them gone for good. Re-adding the graft to `--grafts` later round-trips byte-identically: the inject pass restores the banner pairs at the same priority-sorted position they originally held.

#### `hoon/common/` transitive-import note

When you slim the sandbox before a non-forge compile (e.g. `rm hoon/lib/forge-graft.*` and `rm -rf hoon/dat hoon/jams`), strip the corresponding `hoon/common/` files too — `nock-prover.hoon`, `nock-verifier.hoon`, `pow.hoon`, `tx-engine{,-0,-1}.hoon`, and the `v0-v1` / `v2` / `stark` subtrees transitively `/#` into `hoon/dat/`. hoonc's eager-parse pass over the entire `hoon/common/` tree pulls them in regardless of whether your kernel reaches them, and the unsatisfied `/dat/` references show up as the misleading "no panic!" silent-fail (RM2 seed-A.md DOC-GAP-1 RECUR — the runner spent ~10 minutes diagnosing an apparent kernel bug that was actually a stale `out.jam` from the previous compile).

Pair the slim with `graft-inject lint hoon/app/app.hoon` — the [Pre-apply linting](#pre-apply-linting) pass's `transitive-imports` family walks `/+`, `/=`, `/-`, `/#` and reports each missing target, so the next "the recipe needs another rm" maintenance round shows up before hoonc runs rather than after the silent-fail.

### Step 4 — Rust side

Add dependencies to `Cargo.toml`. vesl-core is a workspace rooted at the `vesl-core` repo; point path-deps at the relevant members:

```toml
vesl-core    = { path = "../path/to/vesl-core/crates/vesl-core" }
nock-noun-rs = { path = "../path/to/vesl-core/crates/nock-noun-rs" }
```

Alternatively, use git-deps against `zkvesl/vesl-core` at a rev — the crate manifests stay self-contained (no `{ workspace = true }`) precisely so downstream consumers can pull them this way.

### Step 5 — Recompile

```bash
hoonc --new hoon/app/app.hoon hoon/
```

The composed kernel is yours. Each primitive's `?-` arm, peek handler, and state field are in place — call them from Rust with the corresponding `build_*_poke` helpers (below).

When your domain arm coordinates **multiple** grafts in one body (counter + kv + log is the canonical "audited write"), pull in the `domain-patterns` library to skip the per-graft `=/ cause` / `=/ [efx state]` / `state(<graft> …)` boilerplate:

```hoon
/+  *domain-patterns
::  ... in your domain arm:
=^  efx-c  state  (apply-counter [%counter-increment key] state)
=^  efx-aw  state  (audit-write state [%kv-set key value] %set (jam value))
[(weld efx-c efx-aw) state]
```

Full surface and convention details in `guides/writing-hoon.md` §"Multi-graft coordination". The library is a manual `/+` (no graft manifest), matching `vesl-merkle` and `vesl-gates`.

## Path 3: Docker container

For developers who don't want to build nockchain and hoonc from source.

```bash
docker pull ghcr.io/zkvesl/vesl-dev:latest
docker run -it -v $(pwd):/workspace ghcr.io/zkvesl/vesl-dev:latest
```

The container includes:

- Rust nightly with all nockchain crate dependencies
- `hoonc` pre-built and in PATH
- `graft-inject` pre-built and in PATH
- `$NOCK_HOME` pre-configured
- Vesl SDK crates available at `/opt/vesl-core/crates/`
- The four graft manifests pre-installed in `/opt/vesl-core/hoon/lib/`

Inside the container, follow Path 1 or Path 2. Dependency paths point to `/opt/vesl-core/` instead of relative paths.

::: warning
The Docker image is not yet published. This section describes the planned container setup. Until then, build nockchain, hoonc, and `graft-inject` from source per the [Installation](/getting-started/installation) guide.
:::

---

## The Rust SDK

### Mint — build Merkle trees

```rust
use vesl_core::Mint;

let mut mint = Mint::new();
let leaves: Vec<&[u8]> = data.iter().map(|d| d.as_bytes()).collect();
let root = mint.commit(&leaves);
let proof = mint.proof(0).unwrap();
```

### Guard — verify proofs locally

```rust
use vesl_core::Guard;

let mut guard = Guard::new();
guard.register_root(root).unwrap();
let valid = guard.check(data.as_bytes(), &proof, &root);
```

Mint and Guard are pure math — no kernel, no async. They're separate from the Hoon-side `mint-graft` and `guard-graft` libraries (which keep *on-kernel* state); both Rust-side and kernel-side share the same tip5 math via `vesl-merkle.hoon`.

### Root encoding — `tip5_to_atom_le_bytes`

The tip5 hash is `[u64; 5]` — five Goldilocks field elements. To pass a root to the Hoon kernel, it must be encoded as the same atom `digest-to-atom:tip5` produces. This is a base-p polynomial, **not** flat byte concatenation.

```rust
use vesl_core::tip5_to_atom_le_bytes;
use nock_noun_rs::make_atom_in;

let root_bytes = tip5_to_atom_le_bytes(&root);
let root_atom = make_atom_in(&mut slab, &root_bytes);
```

::: danger
Do **not** use `root.iter().flat_map(|v| v.to_le_bytes()).collect()`. It produces a different atom than the Hoon side expects; verification will silently fail.
:::

### Poke builders

`vesl-core` exports ready-to-poke builders for every graft's cause tags. Each returns a `NounSlab` you hand directly to `app.poke(SystemWire.to_wire(), slab)`.

**settle-graft (the full lifecycle):**

```rust
use vesl_core::{
    build_settle_register_poke,
    build_settle_verify_poke,
    build_settle_note_poke,
};

// Register a root under hull=1.
app.poke(systemwire, build_settle_register_poke(1, &root)).await?;

// Soft verify — no state transition.
app.poke(systemwire, build_settle_verify_poke(
    /*note_id=*/ 101,
    /*hull=*/    1,
    &root,
    payload_bytes,
)).await?;

// Full lifecycle — note_id goes into the settled set.
app.poke(systemwire, build_settle_note_poke(101, 1, &root, payload_bytes)).await?;
```

**mint-graft (hull-keyed commitment trellis):**

```rust
use vesl_core::build_mint_commit_poke;

// Append-only commit. Re-committing hull 1 emits %mint-error.
app.poke(systemwire, build_mint_commit_poke(1, &root)).await?;
```

**guard-graft (register + soft leaf check):**

```rust
use vesl_core::{build_guard_register_poke, build_guard_check_poke};

app.poke(systemwire, build_guard_register_poke(1, &root)).await?;

// %guard-checked ok=%.y if hash-leaf(data) == registered root under hull 1,
// %guard-checked ok=%.n if it doesn't, %guard-error if hull 1 isn't registered.
app.poke(systemwire, build_guard_check_poke(1, leaf_data)).await?;
```

**forge-graft (STARK-prove a commitment):**

```rust
use vesl_core::build_forge_prove_poke;

// Produces %forge-proved (proof=@) or %forge-error (msg=@t).
// Cost: 5–40 s per proof depending on data size.
app.poke(systemwire, build_forge_prove_poke(1, 101, data)).await?;
```

Legacy `build_vesl_register_poke` / `build_vesl_settle_poke` / `build_vesl_verify_poke` stay around as `#[deprecated]` aliases for one release cycle. The underlying cause tags renamed too: `%vesl-register` → `%settle-register`, `%vesl-settle` → `%settle-note`, `%vesl-verify` → `%settle-verify`.

### State grafts — app-state primitives without writing Hoon

The five family-3 grafts ship pre-written app-state primitives in the 50–99 priority band. Each is independent: drop in only the ones your app needs. Capacity is uniformly capped at 10M entries per map / list / set (mirror of the commitment-graft caps); RBAC adds an inner 1k cap on perms-per-pubkey.

**kv-graft — loose key-value store (priority 50):**

```rust
use vesl_core::{build_kv_set_poke, build_kv_delete_poke};

app.poke(systemwire, build_kv_set_poke("greeting", b"hello")).await?;
// → %kv-stored

app.poke(systemwire, build_kv_set_poke("greeting", b"goodbye")).await?;
// Overwrite is allowed (loose semantics). → %kv-stored

app.poke(systemwire, build_kv_delete_poke("greeting")).await?;
// → %kv-deleted (idempotent — missing keys also emit %kv-deleted, never %kv-error)
```

Peek path is `[%kv-value key=@t]`. Pick `kv-graft` for the loose store; pick `registry-graft` (below) when callers need strict semantics or structured records.

**counter-graft — named counters (priority 60):**

```rust
use vesl_core::{
    build_counter_increment_poke, build_counter_reset_poke, build_counter_set_poke,
};

// First increment of an unset name initializes to 1.
app.poke(systemwire, build_counter_increment_poke("requests")).await?;
// → %counter-incremented value=1

app.poke(systemwire, build_counter_set_poke("requests", 1000)).await?;
// → %counter-set

app.poke(systemwire, build_counter_reset_poke("requests")).await?;
// → %counter-reset (idempotent — also initializes unset names to 0)
```

Peek path is `[%counter-value name=@t]`. Increments past `u64::MAX` emit `%counter-error 'saturated'` and leave the counter unchanged so `u64` callers never encounter values they can't decode.

**queue-graft — FIFO job queue (priority 70):**

```rust
use vesl_core::{
    build_queue_clear_poke, build_queue_pop_poke, build_queue_push_poke,
};

let body_jammed: Vec<u8> = /* jam your domain payload here */;
app.poke(systemwire, build_queue_push_poke(&body_jammed)).await?;
// → %queue-pushed id=1 (monotonic; preserved across clears)

app.poke(systemwire, build_queue_pop_poke()).await?;
// → %queue-popped (job=~ on empty queue, [~ [id body]] otherwise)
//   Polling consumers check the unit; %queue-error is reserved for real errors.

app.poke(systemwire, build_queue_clear_poke()).await?;
// → %queue-cleared
```

Peek path is `[%queue-len ~]` (total pending). `%queue-push` is the first state-graft cause that cue's caller-supplied bytes inside its body, so the kernel wraps the decode in `mule` per Safety Contract C1: malformed jam surfaces as `%queue-error` rather than crashing the kernel.

**rbac-graft — pubkey-keyed permissions (priority 80):**

```rust
use vesl_core::{build_rbac_grant_poke, build_rbac_revoke_poke};

app.poke(systemwire, build_rbac_grant_poke(1, &["read", "write"])).await?;
// → %rbac-granted added=("read" "write")

app.poke(systemwire, build_rbac_grant_poke(1, &["audit"])).await?;
// Union with held → final perms = {read, write, audit}.
// Effect surfaces only the diff: %rbac-granted added=("audit").

app.poke(systemwire, build_rbac_revoke_poke(1, &["write", "ghost"])).await?;
// "ghost" wasn't held — intersect-then-noop. Effect:
// %rbac-revoked removed=("write"). Held perms = {read, audit}.
```

Two-level capacity (`roles-cap = 10M`, `perms-per-role-cap = 1k`) prevents global fan-out and per-pubkey perm-set blow-up. Revoking the last permission auto-clears the pubkey from the `roles` map, keeping `~(wyt by roles)` an honest count of users with any perms. Peek paths: `[%rbac-perm-count pubkey=@]` (returns count) and `[%rbac-has-perm pubkey=@ perm=@t]` (returns loobean).

Causes carry perms as `(list @t)` rather than `(set @t)` so Rust callers hand a flat slice; the graft `silt`s into the internal set on the way in.

**registry-graft — strict structured registry (priority 90):**

```rust
use vesl_core::{
    build_registry_del_poke, build_registry_put_poke, build_registry_update_poke,
};

let manifest_jammed = jam_to_bytes(&mut stack, my_manifest_noun);
app.poke(systemwire, build_registry_put_poke(key_id, &manifest_jammed)).await?;
// → %registry-stored. Re-put on existing key → %registry-error.

app.poke(systemwire, build_registry_update_poke(key_id, &new_manifest_jammed)).await?;
// → %registry-updated old=… new=… (audit-friendly diff).
// Update on missing key → %registry-error.

app.poke(systemwire, build_registry_del_poke(key_id)).await?;
// → %registry-deleted. Del on missing key → %registry-error.
```

Peek path is `[%registry-entry key=@]`. Registry has the heaviest C1 surface in Phase 02 — both put and update cue caller-supplied bytes inside their poke arms under a `mule` guard. Records are typed `*` (any noun); pre-jam them on the Rust side and let the graft round-trip the cue. Schema validation belongs in a Phase 03 `validate-graft` (planned), not here.

The kv-vs-registry split lands on a single axis: loose typed store vs. strict structured store. Pick by stance — there is no `%kv-update` and no lenient registry variant.

---

## Runtime inspection

Once a kernel is compiled, you don't always want to write a Rust driver to ask "what's the current value of state X?" — `vesl-test` ships a CLI bin that boots an `out.jam` and runs a peek for you.

```bash
# keyless: [%log-len ~]
vesl-test inspect peek out.jam --path-tag log-len

# hull-keyed: [%settle-registered hull=1 ~]
vesl-test inspect peek out.jam --path-tag settle-registered --hull 1

# cord-keyed: [%kv-value @t %greeting ~]
vesl-test inspect peek out.jam --path-tag kv-value --key greeting

# stable JSON for downstream tooling
vesl-test inspect peek out.jam --path-tag log-len --json
```

Output reports one of three states per peek:
- **unrecognized** — the kernel's `++peek` arm returned bare `~`. Either the path is malformed or the graft owning that tag isn't composed.
- **present-but-empty** — `[~ ~]`. Path is recognized; no value at that key.
- **present** — `[~ [~ value]]`. Atoms render as both decimal-with-dots and (when LE bytes form printable UTF-8) ASCII; cells render recursively.

Hoon-literal path parsing (`[%kv-value @t %my-key]` directly) is out of scope for the v1 cut. The `--path-tag` + `--hull`/`--key` form covers every peek shape the v0.1 grafts use; richer paths land when a real consumer needs them.

The vesl-nockup README's "Inspecting a kernel from the outside" subsection (under §"Testing with `vesl-test`") covers the same surface — keep both anchors aligned when the bin's CLI grows.

---

## State checkpoints

Operators upgrading a kernel without losing state — adding a graft, fixing a transition bug, retuning a verification gate — capture the current kernel state via `vesl-checkpoint`, recompile, and rehydrate. The crate (synced from vesl-core into `vesl-nockup/crates/vesl-checkpoint/`) wraps the underlying `nockapp` export/import path with a typed snapshot bundle.

```rust
use vesl_checkpoint::{snapshot, resume};

// 1. Boot + register a hull.
let mut harness = GraftTestHarness::boot("out.jam").await?;
harness.register(1, &root).await?;

// 2. Snapshot before re-composing the kernel.
let snap_dir = std::path::Path::new("snapshots/before-mint-graft");
let snap = snapshot(harness.app(), snap_dir, "hoon/app/app.hoon").await?;
drop(harness);

// 3. Re-run graft-inject + hoonc (add a graft / fix a bug / retune
//    a gate), then resume. snap.state_jam() points at the bundled
//    state.jam; resume() threads it through cli.state_jam.
let resumed = resume("out.jam", &snap, "after-mint-graft").await?;

// 4. Peek the new kernel — pre-snapshot state survives.
let peek_path = vesl_core::build_hull_peek_path("settle-root", 1);
let result = resumed.peek(peek_path).await?;
let stored_root = vesl_core::unwrap_triple_unit_atom(&result);
```

Bundle layout written to disk:

```
snapshots/before-mint-graft/
├── state.jam   bincode-encoded ExportedState (same format
│               that nockapp's Cli::state_jam accepts on import)
└── meta.toml   [snapshot] source_sha256, timestamp,
                vesl_checkpoint_version
```

Schema migration is **out of scope** for v0.1. **Same-composition resume** (the new kernel has the same set of grafts as the snapshot) roundtrips cleanly — both pre- and post-resume pokes emit effects. **Schema-extension resume** (the new kernel adds grafts that weren't in the snapshot) is currently a silent-failure case: the marker template's `++load` arm is identity, so new graft state fields end up at undefined nockvm axes; subsequent pokes against those grafts panic inside the wrapper's mule guard and return `Ok(vec![])` instead of a clear error. The fix — graft-inject codegen for a `nockup:load-defaults` marker populated with each graft's `++new-state` default — is deferred to v0.2 (RM4 §1). Until then, treat resume as same-composition only and re-run the full poke sequence after any composition change rather than relying on snapshot+resume.

Cross-link: pair this with [Runtime inspection](#runtime-inspection) (peek the resumed kernel from the CLI) and [Compile-time drift detection](#compile-time-drift-detection) (catch driver/kernel rename mismatches before resume gets called) — together they cover the operator's full upgrade-without-downtime path.

The vesl-nockup README's §"State checkpoints" subsection mirrors this content; keep both anchors aligned when the API grows.

---

## Diagnostics

### Invalid cause

**Symptom**: `app.poke(...).await` resolves `Ok(vec![])`, stderr shows
`slog: invalid cause [<noun>]`.

The driver emitted a cause-tag the kernel's `+$ cause` union doesn't accept, so `(soft cause)` returned `~` and the wrapper short-circuited before any arm ran. The diagnostic prints at the default tracing level (priority 1, mapped to WARN) — no `RUST_LOG=trace` needed. The noun shown after `invalid cause` is the rejected cause cell; decoding the head atom (little-endian ASCII) yields the offending tag.

Common causes:
- Typo in the driver-side bytestring.
- Kernel rename without a corresponding driver update.
- New graft installed but the kernel hasn't been re-composed via `graft-inject inject --apply`.

For harness consumers, `vesl_test::PokeReport` exposes the slogged cause structurally — `report.slog_warnings` collects every `target: "slogger"` event during a poke, and `SlogWarning::InvalidCause { noun }` round-trips through `vesl_test::decode_cause_tag(&noun)` to recover the head tag string. See `tools/graft-inject/tests/poke_report.rs` in vesl-nockup for the reference assertion pattern.

To catch this at compile time, see [Compile-time drift detection](#compile-time-drift-detection) below — the codegen path turns runtime invalid-cause silences into `cargo build` errors at the macro invocation site.

### Compile-time drift detection

Each shipped scaffold's `build.rs` runs `graft-inject codegen kernel-cause-tags` after `hoonc` and writes `kernel_cause_tags.rs` into `OUT_DIR`. The path is exposed as the `KERNEL_CAUSE_TAGS_PATH` env var (mirroring `COMPILED_HOON_PATH`). Pull it into your driver:

```rust
include!(env!("KERNEL_CAUSE_TAGS_PATH"));

fn build_settle_register_poke(hull: u64, root: &Tip5Hash) -> NounSlab {
    assert_kernel_cause_tag!("settle-register");
    // ... construct the noun ...
}
```

`assert_kernel_cause_tag!` runs a const-time membership check against `KERNEL_CAUSE_TAGS`. A kernel rename (e.g. `%settle-register` → `%settle-write`) without re-running the codegen now fails `cargo build` at the macro invocation, surfacing the drift as a compile error rather than a silent `Ok(vec![])` from `app.poke(...)` at runtime.

`KERNEL_CAUSE_TAGS` is derived from the literal `+$ cause` definition in `app.hoon`, not from the union of every `--lib-dir` manifest. Two consequences:

- **Domain causes are covered.** `[%submit-artifact ...]`, `[%emit-license ...]`, etc. — the inline variants you added directly to your domain — show up in `KERNEL_CAUSE_TAGS`. `assert_kernel_cause_tag!("submit-artifact")` compiles. Kernel rename → driver compile error, same way as the graft-side renames.
- **Inactive grafts contribute nothing.** A graft sitting under `hoon/lib/` but never referenced from `+$ cause $%(...)` (or `+$ cause <type-alias>`) doesn't pollute the slice with its tags. `assert_kernel_cause_tag!("kv-set")` only compiles when `kv-graft`'s `kv-cause` actually appears in your kernel's union.

If `graft-inject` isn't installed in the build environment, the codegen step emits a `cargo:warning` and leaves `KERNEL_CAUSE_TAGS_PATH` unset — drivers that gate the include on `cfg(env_var = "KERNEL_CAUSE_TAGS_PATH")` continue to build. Drift detection is opt-in per driver.

```bash
graft-inject codegen kernel-cause-tags hoon/app/app.hoon --out src/kernel_cause_tags.rs   # ad-hoc
graft-inject codegen kernel-cause-tags hoon/app/app.hoon --json                           # JSON for non-Rust consumers
```

Cross-link: lint catches manifest collisions before apply ([Pre-apply linting](#pre-apply-linting)); codegen catches driver/kernel renames after apply.

---

## Pre-apply linting

`graft-inject lint <app.hoon>` runs read-only structural validations before any potential `--apply`. Four lint families ship today:

- **`bare-tilde-ambiguity`** — flags domain `?-` switch arms whose body ends with a `~`-only line. The peek-chain rebuilder's `find_last_bare_tilde` scan would otherwise mistake that `~` for the chain terminator and corrupt the file. Refactor to `` `(list effect)`~ `` or `^- (list effect) ~` on a single line.
- **`collision-check`** — flags duplicate cause-tag names and state-field names across grafts and between grafts and the domain. Cross-references manifest declarations against the domain `nockup:cause` / `nockup:state` regions. Surfaces composition collisions at scaffold time rather than at hoonc nest-fail time.
- **`transitive-imports`** — walks every `.hoon` reachable from `<app.hoon>` via `/+`, `/=`, `/-`, `/#` imports AND eagerly scans every `.hoon` under `hoon/common/`. Reports each unsatisfied edge with the source file, the import token, the expected target path, and the BFS chain. hoonc eager-parses `hoon/common/` regardless of import-graph reachability — unsatisfied edges there leave hoonc exit 0 with no `out.jam` (the "no panic!" silent-fail).
- **`internal-dupes`** — flags literal duplicate variant heads in the composed `+$ cause $%(...)` union and literal duplicate field names in `+$ versioned-state $:(...)`. Differs from `collision-check` by scanning the already-composed source unions including graft-injected banner content, so post-injection duplicates that the manifest-side pass misses (e.g. two grafts contributing the same `[%<tag> ...]` head despite distinct manifest names) get caught here.

Exit code is `1` on any finding so CI can gate `--apply` on the lint passing. Pass `--json` for a stable machine-readable schema:

```json
{
  "bare_tilde_ambiguity": [{"line": 354, "arm": "ping"}],
  "collision": [{"kind": "cause_tag", "name": "enqueue-job",
                 "owners": ["queue-graft", "pipeline-graft"]}],
  "transitive_imports": [{"source": "hoon/common/nock-prover.hoon",
                          "rune": "/#", "name": "softed-constraints",
                          "target": "hoon/dat/softed-constraints.hoon",
                          "reachable_from": ["hoon/common/nock-prover.hoon"]}],
  "internal_dupes": [{"kind": "cause_tag", "name": "enqueue-job",
                      "lines": [167, 213]}]
}
```

Pair with [Compile-time drift detection](#compile-time-drift-detection) for the symmetric pre-apply / post-apply coverage: lint is the structural guard before injection lands; codegen is the rename-detection guard after the kernel rebuilds.

The vesl-nockup README's §"Pre-apply linting" subsection (under Step 3) mirrors this content; keep both anchors aligned when lint families grow.

---

## Custom domain pokes

The `build_*_poke` helpers cover the vesl primitives. For your own cause tags (e.g., `%submit-artifact`, `%revoke-artifact`), construct the `NounSlab` directly. The pattern is: one atom per cause field, then assemble with `T(&mut slab, &[tag, arg1, arg2, …])`.

Three rules inherited from the graft builders:

- **Long tags** (> 8 bytes) can't go through `D(tas!(b"…"))` — it panics at compile time. Use `Atom::from_bytes(slab, &Bytes::copy_from_slice(b"…"))` for anything from `settle-register` upward.
- **`AtomExt::from_bytes` takes `&bytes::Bytes`**, not `&[u8]`, via the `nockapp::Bytes` re-export.
- **Wide `u64` values** (hashes, IDs where the top bit may be set) panic under `D(value)` with `Number is greater than DIRECT_MAX` — route them through `nock_noun_rs::atom_from_u64(slab, value)`.

Worked example — a 3-arg `[%submit-artifact name=@t hash=@ submitter=@ux]`:

```rust
use nockapp::{AtomExt, Bytes, noun::slab::NounSlab};
use nockvm::noun::{Atom, T};
use nock_noun_rs::atom_from_u64;

fn submit_artifact(name: &[u8], hash: u64, submitter: u64) -> NounSlab {
    let mut slab = NounSlab::new();
    let tag  = Atom::from_bytes(&mut slab, &Bytes::copy_from_slice(b"submit-artifact")).as_noun();
    let nm   = Atom::from_bytes(&mut slab, &Bytes::copy_from_slice(name)).as_noun();
    let h    = atom_from_u64(&mut slab, hash);
    let s    = atom_from_u64(&mut slab, submitter);
    let noun = T(&mut slab, &[tag, nm, h, s]);
    slab.set_root(noun);
    slab
}
```

Rule of thumb: byte-strings and short tas-atoms go through `Atom::from_bytes`; integers wider than `DIRECT_MAX` (hashes, hull-ids, submitter IDs with the top bit set) go through `atom_from_u64`; atoms ≤ `DIRECT_MAX` can stay on `D(v)`. Order arguments in `T(&[...])` to match the cause tuple layout in your `app.hoon`.

### Composing two graft arms in one domain cause

When a single domain cause delegates to two grafts and concatenates their effect lists with `weld`, you'll hit a Hoon nest-fail unless the two `(list ...)` types match. With Phase 03f Lever 1's typed effect union (`+$ effect $%(<each graft's effect> domain-effect ==)`), the cleanest pattern is to widen each binding to `(list effect)` so `weld` operates over a monomorphic list:

```hoon
%set
=/  [efx-c=(list effect) new-counter=counter-state]
  (counter-poke counter.state [%counter-increment name.u.act])
=/  [efx-k=(list effect) new-kv=kv-state]
  (kv-poke kv.state [%kv-set name.u.act value.u.act])
:_  state(counter new-counter, kv new-kv)
^-  (list effect)
(weld efx-c efx-k)
```

The widening happens at the `=/` binding (Hoon's pattern-cast absorbs each graft's `(list <graft>-effect)` into the typed union's `(list effect)`). The bare `(weld efx-c efx-k)` then has same-type lists on both sides — no `(list effect)` casts needed at the weld itself.

If you bind narrowly (`(list counter-effect) ... (list kv-effect)`), the bare weld will nest-fail. The R4-era escape hatch was to cast each list at the weld site:

```hoon
(weld `(list effect)`efx-c `(list effect)`efx-k)
```

That still works post-Lever 1, but the wide-binding form above is the cleaner default.

`graft-inject` flags narrow bindings at compose time via the [`weld-friction` lint](/reference/cli#weld-friction-lint) — a one-time advisory note pointing at this section. The lint is the friendly surface for the friction; this section is the fix.

## Verification gates

The default gate `graft-inject` installs for `settle-graft` compares `hash-leaf(data)` to the expected root. That works for single-leaf commitments and nothing else. For signatures, structured documents, set membership, or anything else, you have two options: select a pre-written gate from the catalog (recommended), or write your own.

The gate type is `$-([note-id=@ data=* expected-root=@] ?)`. `note-id` is bound into the gate so domain gates can enforce `note-id == deterministic-fn(data)` — closes the pre-commit race (AUDIT 2026-04-17 H-03). Gates that don't care can ignore the argument.

### Catalog gates (recommended)

`vesl-gates.hoon` ships pre-written gate arms covering the common verification patterns. Select one by name in your `settle-graft.toml` manifest — `graft-inject` rewrites the poke body to call the named gate and adds `/+  *vesl-gates` to the imports block. You don't touch the Hoon.

**Tier 1a — currently shipping:**

| Name | Payload shape | Use case |
|---|---|---|
| `sig-verify-ed25519` | `[data=@ sig=@ pubkey=@]` | Signed attestations, notarization. Binds `expected-root = hash-leaf(pubkey)` so the hull's commitment IS the public key. |
| `sig-verify-schnorr` | `[data=@ sig=@ pubkey=@]` (cheetah) | Nockchain-native (cheetah-curve) signed attestations, intent signing. Same `expected-root = hash-leaf(pubkey)` binding as ed25519. `pubkey` is the `ser-a-pt:cheetah` serialization (the wallet-export shape); `sig` is `(chal << 256) \| s`. |
| `manifest-verify` | `[fields=(list [name=@t value=@]) proofs=(list (list [hash=@ side=?]))]` | Structured-document commitment (KYC bundle, RAG manifest, multi-field attestation). AND-folds a Merkle proof per field. |
| `set-membership-verify` | `[elem=@ proof=(list [hash=@ side=?])]` | Allowlists, blocklists, voter registries. `verify-chunk(hash-leaf(elem), proof, expected-root)`. |
| `bounded-value-verify` | `[value=@ bounds=[lo=@ hi=@] proof=(list [hash=@ side=?])]` | Numeric range attestation — age gates, balance ranges, score brackets. Binds `expected-root` to `hash-leaf(jam([value bounds]))` so bounds and value are committed together; a caller cannot substitute their own range. **Not zero-knowledge** — `value` is plaintext in the payload; the gate is named `bounded-value-verify` rather than `range-proof-verify` precisely because the latter implies ZK semantics this gate doesn't provide. `lo > hi` returns `%.n` without special-casing. |

**Schnorr payload encoding.** Cheetah `sign:affine:schnorr:cheetah` returns `[chal=@ s=@]` and `(ch-scal:affine:curve:cheetah sk a-gen:curve:cheetah)` returns an `a-pt:curve` (a structured affine point) — neither matches the flat-atom shape the gate expects. Concatenate the sig halves with `(cat 8 s chal)` (s low, chal high; the gate splits with `(rsh 8 sig)` / `(end 8 sig)`) and serialize the pubkey with `ser-a-pt:cheetah` before pasting them into the payload tuple. Because cheetah's `g-order` is 255-bit, both `chal` and `s` fit in 32 bytes, and the packed sig fits in 64 bytes. Working fixture in `vesl-core/protocol/tests/test-vesl-gates.hoon` under the `sig-verify-schnorr` block.

**Single gate selection:**

```toml
# settle-graft.toml
[graft.gates]
gate = "sig-verify-ed25519"
```

After `graft-inject --apply`, every `=/  hash-gate=verify-gate ...` block in the emitted poke body becomes:

```hoon
=/  hash-gate=verify-gate  sig-verify-ed25519:vesl-gates
```

**AND-composition** — pass multiple gates and all of them must accept:

```toml
[graft.gates]
gate-chain = ["sig-verify-ed25519", "manifest-verify"]
```

Emits a tall `?&` fold: the gate accepts iff every named gate accepts the same `(note-id, data, expected-root)` triple. `gate` and `gate-chain` are mutually exclusive — set one or neither. v1 is AND-only; OR/conditional composition is a separate decision.

Each gate wraps its `;;` payload cast in `mule` (per OVERVIEW C1), so a malformed `data=*` returns `%.n` instead of crashing the kernel. The outer mule in `settle-graft.hoon` converts any residual crash into `%settle-error`. You don't have to think about this — it's a contract gate authors guarantee.

**Manifest validation.** Names that aren't kebab-case (`^[a-z][a-z0-9-]*$`) or aren't in the catalog allowlist hard-error at `graft-inject` discovery with the offending file path and field path. Adding `[graft.gates]` to a manifest whose poke body has been hand-edited to drop the default hash-gate also errors — gate selection only applies to manifests using the stock 4-line `=/  hash-gate=verify-gate ...` shape, so a manifest with a custom gate doesn't silently ignore the catalog choice.

The `[graft.gates]` schema and validation rules are documented in full in `vesl/docs/graft-manifest.md`.

**Tier 1b — pending demand:** `threshold-sig-verify`, `merkle-kv-verify`, `timelock-verify`, `commit-reveal-verify`. Each ships when a concrete app drives the spec. (Real ZK range proofs — prove `value ∈ [lo, hi]` without revealing `value` — remain out of scope until a prover-level primitive lands; `bounded-value-verify` ships the non-ZK shape today.)

### Custom gates

For a use case the catalog doesn't cover, write a gate inline. Drop the `[graft.gates]` table from your manifest and edit the `=/  hash-gate=verify-gate ...` block in the poke body directly:

```hoon
::  Domain manifest verification
|=  [note-id=@ data=* expected-root=@]
=/  mani  ;;(manifest data)
(verify-manifest mani expected-root)

::  Custom signature scheme
|=  [note-id=@ data=* expected-root=@]
=/  sig  ;;(signed-payload data)
(verify-signature sig expected-root)

::  Always-true (testing only — never ship this)
|=  [note-id=@ data=* expected-root=@]
%.y
```

Custom gates carry the same C1 contract as catalog gates: wrap your `;;` cast in `mule` and return `%.n` on cast failure. The settle-graft layer mule-wraps the gate call, but a gate that crashes for some inputs is still a kernel DoS surface — fix it at the gate. Reference pattern: read any of the three Tier 1a arms in `vesl-gates.hoon`.

If your custom gate looks reusable across apps, propose it for the catalog instead of forking it into every project that needs it.

## The primitives — which to pick

| Need | Use | Kernel? |
|------|-----|---------|
| Hash data, get a Merkle root | Rust `Mint` | No |
| Verify a proof against a local trust root | Rust `Mint` + `Guard` | No |
| Commit a root on-kernel, keyed by hull | `mint-graft` | Yes |
| Register a root + answer leaf queries | `mint-graft` + `guard-graft` | Yes |
| Full register → verify → settle with replay | `settle-graft` | Yes |
| STARK-prove the commitment | `forge-graft` (paired with settle) | Yes (+ 16MB) |

`settle-graft` subsumes the mint+guard shape but adds gate + replay + epoch rotation. If you don't need those three things, the lighter mint/guard combination is usually the right call.

## Reference templates

| Template | What it demonstrates |
|----------|---------------------|
| `graft-scaffold` | Full settle-graft lifecycle with bundled deps. Start here. |
| `graft-hash-gate` | Custom hash gate, no RAG types. Minimal. (Formerly `graft-intent` — the name moved to mark the family-5 placeholder slot.) |
| `graft-mint` | Settle-graft + domain pokes (note store). |
| `graft-settle` | Settle-graft + replay protection (report submission). |
| `graft-intent` | Family-5 placeholder — wires the crashing `intent-graft` into an app so you can confirm the reservation is real. Not for production. |

Forge and guard don't have dedicated templates yet — add them to any of the above by dropping their manifests into `hoon/lib/` and re-running `graft-inject`.
