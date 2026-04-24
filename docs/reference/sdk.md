# Vesl SDK Reference

The vesl SDK is in `vesl-core/crates/vesl-core` (workspace member). All public types and functions are re-exported from the top-level `vesl_core` crate.

```rust
use vesl_core::{Mint, Guard, Tip5Hash, tip5_to_atom_le_bytes};
```

For kernels composed via `graft-inject`, `vesl-core` also exports a `build_*_poke` helper for every graft's cause tags — see [Graft poke builders](#graft-poke-builders) below.

## Mint

Data commitment. Pure math, zero async.

### `Mint::new() -> Mint`

Create a new Mint instance.

### `mint.commit(&leaves) -> Tip5Hash`

Build a tip5 Merkle tree from byte slices. Returns the root hash. Each leaf is hashed through `hash-leaf` (7-byte belt encoding + tip5 varlen sponge).

```rust
let mut mint = Mint::new();
let leaves: Vec<&[u8]> = items.iter().map(|i| i.as_bytes()).collect();
let root: Tip5Hash = mint.commit(&leaves);
```

### `mint.root() -> Option<Tip5Hash>`

Returns the root of the last committed tree, or `None` if `commit` hasn't been called.

### `mint.proof(index) -> Result<Vec<ProofNode>, MintError>`

Returns the Merkle inclusion proof for the leaf at `index`. Errors if the index is out of range.

```rust
let proof = mint.proof(0).unwrap();
```

### `mint.leaf_count() -> usize`

Number of leaves in the committed tree.

## Guard

Proof verification against trusted roots. Pure math, no kernel.

### `Guard::new() -> Guard`

Create a new Guard instance.

### `guard.register_root(root) -> Result<(), GuardError>`

Register a root as trusted. A root must be registered before proofs can be verified against it.

### `guard.check(data, proof, root) -> bool`

Verify that `data` is bound to `root` via the Merkle `proof`. Returns `false` if the proof is invalid or the root is not registered.

```rust
let valid = guard.check(data.as_bytes(), &proof, &root);
```

### `guard.check_with_reason(data, proof, root) -> Result<(), String>`

Same as `check` but returns a specific error message on failure: `"root not registered"` or `"proof invalid against registered root"`.

## Types

### `Tip5Hash`

```rust
pub type Tip5Hash = [u64; 5];
```

Five Goldilocks field elements (`p = 2^64 - 2^32 + 1`). This is the native hash representation in memory.

### `ProofNode`

```rust
pub struct ProofNode {
    pub hash: Tip5Hash,
    pub side: bool,    // true = sibling is LEFT, false = sibling is RIGHT
}
```

### `GraftPayload`

Mirrors the Hoon `graft-payload` type:

```rust
pub struct GraftPayload {
    pub note: Note,
    pub data: Vec<u8>,
    pub expected_root: Tip5Hash,
}
```

### `Note`

```rust
pub struct Note {
    pub id: u64,
    pub hull: u64,
    pub root: Tip5Hash,
    pub state: NoteState,
}
```

### `NoteState`

```rust
pub enum NoteState {
    Pending,
    Verified(NockZkp),
    Settled,
}
```

## Hash functions

### `hash_leaf(data: &[u8]) -> Tip5Hash`

Hash raw bytes through the tip5 varlen sponge. Splits data into 7-byte belts (each < 2^56 < Goldilocks prime), prepends the count, and hashes.

### `hash_pair(left: &Tip5Hash, right: &Tip5Hash) -> Tip5Hash`

Non-commutative pair hash. `hash_pair(a, b) != hash_pair(b, a)`. Used for internal Merkle tree nodes.

### `verify_proof(data: &[u8], proof: &[ProofNode], root: &Tip5Hash) -> bool`

Verify a Merkle inclusion proof. Hashes the leaf, walks the proof path, compares to root.

## Cross-VM encoding

### `tip5_to_atom_le_bytes(hash: &Tip5Hash) -> Vec<u8>`

Encode a tip5 hash as the LE bytes of the base-p polynomial atom:

```
atom = limb[0] + limb[1]*p + limb[2]*p^2 + limb[3]*p^3 + limb[4]*p^4
```

This matches Hoon's `digest-to-atom:tip5`. Use this when passing roots or hashes to a Hoon kernel.

::: danger
Flat LE byte concatenation (`root.iter().flat_map(|v| v.to_le_bytes()).collect()`) produces a **different** atom. The base-p encoding uses Horner's method to compute the polynomial value. These diverge because `p != 2^64`.
:::

### `format_tip5(hash: &Tip5Hash) -> String`

Human-readable hex representation. Useful for logging.

## Noun building helpers

From `nock-noun-rs`:

| Function | Purpose |
|----------|---------|
| `make_tag_in(&mut slab, "tag")` | Create a cord atom. Use for tags > 8 bytes (e.g., `settle-register`). |
| `make_atom_in(&mut slab, &bytes)` | Create an atom from raw LE bytes. |
| `make_cord_in(&mut slab, "text")` | Create a text cord atom. |
| `atom_from_u64(&mut slab, value)` | Create an atom from a `u64`. Routes through a real allocation for values above `DIRECT_MAX` — use this for hash-derived hull IDs. |
| `jam_to_bytes(&mut stack, noun)` | Serialize a noun to jam encoding. |
| `new_stack()` | Allocate a NockStack for jam/cue operations. |

For tags that fit in 8 bytes, `D(tas!(b"tag"))` is more efficient. For longer tags like `settle-register` or `mint-commit`, use `make_tag_in`. For `u64` values where the top bit may be set (hash digests truncated to u64 are a common case), use `atom_from_u64` instead of `D(value)` to avoid `Number is greater than DIRECT_MAX` panics.

## Graft poke builders

Each graft primitive has matching Rust builders in `vesl_core::graft_pokes`. They're re-exported at the top level of `vesl_core` for convenience. All return a `NounSlab` you hand directly to `app.poke(SystemWire.to_wire(), slab)`.

### settle-graft

| Builder | Cause tag | Effect |
|---|---|---|
| `build_settle_register_poke(hull, &root)` | `%settle-register` | `%settle-registered` / `%settle-error` |
| `build_settle_verify_poke(note_id, hull, &root, data)` | `%settle-verify` | `%settle-verified ok=?` |
| `build_settle_note_poke(note_id, hull, &root, data)` | `%settle-note` | `%settle-noted` / `%settle-error` / `%settle-epoch-rotated` (on overflow) |

Legacy `build_vesl_register_poke` / `build_vesl_settle_poke` / `build_vesl_verify_poke` names survive as `#[deprecated]` aliases for one release cycle. `%vesl-settle` was renamed `%settle-note` to avoid the tautological `%settle-settle`.

### mint-graft

| Builder | Cause tag | Effect |
|---|---|---|
| `build_mint_commit_poke(hull, &root)` | `%mint-commit` | `%mint-committed` / `%mint-error` (re-commit rejected — append-only) |

### guard-graft

| Builder | Cause tag | Effect |
|---|---|---|
| `build_guard_register_poke(hull, &root)` | `%guard-register` | `%guard-registered` / `%guard-error` |
| `build_guard_check_poke(hull, data)` | `%guard-check` | `%guard-checked hull ok=?` (soft mismatch — loobean in the effect) / `%guard-error` on unregistered hull |

### forge-graft

| Builder | Cause tag | Effect |
|---|---|---|
| `build_forge_prove_poke(hull, note_id, data)` | `%forge-prove` | `%forge-proved proof=@` / `%forge-error msg=@t` |

Forge-prove runs 5–40 s per call depending on data size; it's the only primitive that needs `--stack-size huge` at boot for serious workloads.

### Peek path conventions

Commitment grafts (settle / mint / guard) all expose a hull-keyed peek: `[%<graft>-root hull=@ ~]` or `[%<graft>-commit hull=@ ~]` or `[%<graft>-registered hull=@ ~]`. The returned shape is `[~ [~ (unit @)]]` — a nested unit wrapping the stored value:

- present hull → `[~ [~ [~ root]]]`
- missing hull → `[~ [~ ~]]`

Strip three layers to get to the raw atom. `vesl-test`'s `GraftTestHarness::peek_raw` returns the outer slab unchanged; `GraftTestHarness::peek_handle` only peels one layer and will miss the inner unit, so use `peek_raw` for the hull-keyed peeks.

## Crate dependencies

For a grafted NockApp, the minimum Cargo.toml dependencies:

```toml
# Vesl SDK (path-dep against a sibling vesl-core checkout)
vesl-core    = { path = "path/to/vesl-core/crates/vesl-core" }
nock-noun-rs = { path = "path/to/vesl-core/crates/nock-noun-rs" }

# NockVM (from nockchain monorepo)
nockapp       = { path = "path/to/nockchain/crates/nockapp", default-features = false }
nockvm        = { path = "path/to/nockchain/crates/nockvm/rust/nockvm" }
nockvm_macros = { path = "path/to/nockchain/crates/nockvm/rust/nockvm_macros" }

# Runtime
tokio  = { version = "1.32", features = ["rt-multi-thread", "macros"] }
anyhow = "1.0"
```

Adjust the `path = "..."` entries to fit your tree — or swap them for git-deps against `zkvesl/vesl-core` and `nockchain/nockchain` at a rev you want to pin. Grafts shipped via `nockup package add zkvesl/vesl-graft` or synced from `vesl-nockup` carry git-dep versions already.

`vesl-core` re-exports `tip5_to_atom_le_bytes` and `Tip5Hash`, so `nockchain-tip5-rs` doesn't need to be a direct dependency in application code. All four primitive builders (`build_settle_*_poke`, `build_mint_commit_poke`, `build_guard_*_poke`, `build_forge_prove_poke`) come from `vesl-core` as well.
