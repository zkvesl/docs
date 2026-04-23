# Grafting Vesl onto Your NockApp

Vesl attaches to a NockApp as a set of composable Hoon libraries. Your kernel keeps doing what it does — each graft you install adds a state fragment, a cause-union branch, a `?-` arm, and a peek chain entry. Writing that wiring by hand is busywork, so vesl ships `graft-inject` to do it for you.

Grafts fall into five families on a priority lattice. Families 1–4 shape what the graft *does*; family 5 is reserved for coordination. Pick any subset you need.

| # | Family | Priority band | Status | What lives there |
|---|---|---|---|---|
| 1 | Commitment | 10–40 | Shipped | `settle-graft`, `mint-graft`, `guard-graft`, `forge-graft` |
| 2 | Verification gates | n/a (library) | Scaffolded | Named gate arms consumed by commitment grafts; delivered as a library, not a priority-claimed graft |
| 3 | State | 50–99 | Planned | App-state primitives (kv, counter, queue, rbac, registry) |
| 4 | Behavior | 100–149 | Planned | Runtime wrappers that enforce or observe rules around other grafts |
| 5 | Intent | 200–299 | Placeholder | `intent-graft` — reserved for multi-party coordination (declare / match / cancel / expire); crashes on invocation until Nockchain upstream publishes the canonical shape |

Commitments do not require intents. A NockApp can produce a ZK proof and settle it without ever declaring an intent — the STARK pipeline itself is intent-free. Family 5 is optional coordination over state transitions, not a dependency of families 1–4.

Today's shipped grafts, all family 1:

| Graft | Priority | What it does |
|---|---|---|
| `settle-graft` | 10 | Register roots, verify payloads against a gate, settle notes with replay protection and epoch rotation. The heavyweight primitive. |
| `mint-graft`   | 20 | Commit a Merkle root to a `hull=@` trellis cell. Append-only, no gate. |
| `guard-graft`  | 30 | Register a root per hull, check a leaf's hash against the registered root. Soft verify (`ok=%.y/%.n`). |
| `forge-graft`  | 40 | STARK-prove a Nock computation over the committed data. Stateless. Adds ~16MB of prover constraint tables. |
| `intent-graft` | 200 | **Placeholder** — family-5 slot reservation. `stability = "placeholder"` in its manifest; every cause arm bangs with `%intent-graft-placeholder` so accidental adoption fails loud. Swapped for the real primitive when Nockchain upstream lands. |

A typical layered app mints, guards, and settles the same `hull=@`: mint records the commitment, guard answers inclusion queries, settle gates the transition to a durable "noted" state. The four commitment primitives share the unified `hull=@` key; the caller picks when to propagate.

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

For a project that already has a working Hoon kernel and Rust driver. The flow is: install the Hoon libraries, annotate `app.hoon` with the five markers, run `graft-inject`, recompile.

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
# settle-graft   0.1.0   injectable   (imports, state, cause, poke, peek)
# mint-graft     0.1.0   injectable   (imports, state, cause, poke, peek)
# guard-graft    0.1.0   injectable   (imports, state, cause, poke, peek)
# forge-graft    0.1.0   injectable   (imports, cause, poke)
```

`--list --json` emits the same information as machine-readable JSON. The schema is documented in `vesl/docs/graft-manifest.md` and stable across PARAMETIZATION's lifespan.

### Step 2 — Annotate your `app.hoon` with markers

`graft-inject` looks for five comment markers at fixed structural points:

```
::  nockup:imports   — top of the file, near your `/+` directives
::  nockup:state     — inside `versioned-state`'s `$:` block
::  nockup:cause     — inside `cause`'s `$%` union
::  nockup:poke      — inside the `?-` poke switch
::  nockup:peek      — inside the peek `?+` default arm (or just above a bare `~` fallthrough)
```

The two-space law applies: `::` followed by exactly two spaces, then `nockup:<name>`. See `vesl-nockup/templates/app.hoon` for canonical placement.

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
#   markers present: 5 (imports, state, cause, poke, peek)
```

Preview-by-default exists because manifest `body` fields paste verbatim into kernel source. Seeing the composed diff — and the sha256 of each manifest that produced it — before anything hits disk is the supply-chain guardrail against a compromised `hoon/lib/`. See the trust model in the manifest schema docs.

Selective composition:

```bash
graft-inject --grafts settle-graft,mint-graft --apply hoon/app/app.hoon  # explicit subset
graft-inject --exclude forge-graft --apply hoon/app/app.hoon             # skip forge
```

The tool is idempotent — re-running reports every already-wired marker as `skipped`. If you get `warning — markers not found: ...`, your marker placement or two-space law is off.

`forge-graft` reports 3/3 because it ships no state and no peek (forge is stateless; one-shot prove, nothing to query). The injection-report denominator is per-graft — each primitive reports against the blocks *it* declares, not a fixed 5.

### Step 4 — Rust side

Add dependencies to `Cargo.toml` (vesl-core moved upstream to the `vesl` repo in Phase 6.5b):

```toml
vesl-core    = { path = "../path/to/vesl/crates/vesl-core" }
nock-noun-rs = { path = "../path/to/vesl/crates/nock-noun-rs" }
```

### Step 5 — Recompile

```bash
hoonc --new hoon/app/app.hoon hoon/
```

The composed kernel is yours. Each primitive's `?-` arm, peek handler, and state field are in place — call them from Rust with the corresponding `build_*_poke` helpers (below).

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
- Vesl SDK crates available at `/opt/vesl/crates/`
- The four graft manifests pre-installed in `/opt/vesl/hoon/lib/`

Inside the container, follow Path 1 or Path 2. Dependency paths point to `/opt/vesl/` instead of relative paths.

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

## Custom verification gates

The default gate `graft-inject` installs for `settle-graft` compares `hash-leaf(data)` to the expected root. This works for single-leaf commitments. For multi-leaf trees, signatures, manifests, or STARK proofs, write a custom gate and splice it into the manifest's poke body (or replace the gate inline after running `graft-inject`).

The gate type is `$-([note-id=@ data=* expected-root=@] ?)`:

```hoon
::  RAG manifest verification
|=  [note-id=@ data=* expected-root=@]
=/  mani  ;;(manifest data)
(verify-manifest mani expected-root)

::  Signature check
|=  [note-id=@ data=* expected-root=@]
=/  sig  ;;(signed-payload data)
(verify-signature sig expected-root)

::  Always-true (testing)
|=  [note-id=@ data=* expected-root=@]
%.y
```

`note-id` is bound into the gate so domain gates can enforce `note-id == deterministic-fn(data)` — closes the pre-commit race (AUDIT 2026-04-17 H-03). Gates that don't care can ignore the argument.

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
