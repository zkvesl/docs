# Vesl SDK Reference

The vesl SDK is in `crates/vesl-core`. All public types and functions are re-exported from the top-level `vesl_core` crate.

```rust
use vesl_core::{Mint, Guard, Tip5Hash, tip5_to_atom_le_bytes};
```

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
| `make_tag_in(&mut slab, "tag")` | Create a cord atom. Use for tags > 8 bytes (e.g., `vesl-register`). |
| `make_atom_in(&mut slab, &bytes)` | Create an atom from raw LE bytes. |
| `make_cord_in(&mut slab, "text")` | Create a text cord atom. |
| `jam_to_bytes(&mut stack, noun)` | Serialize a noun to jam encoding. |
| `new_stack()` | Allocate a NockStack for jam/cue operations. |

For tags that fit in 8 bytes, `D(tas!(b"tag"))` is more efficient. For longer tags like `vesl-register` or `vesl-settle`, use `make_tag_in`.

## Crate dependencies

For a grafted NockApp, the minimum Cargo.toml dependencies:

```toml
# Vesl SDK
vesl-core = { path = "path/to/vesl/crates/vesl-core" }
nock-noun-rs = { path = "path/to/vesl/crates/nock-noun-rs" }
nockchain-tip5-rs = { path = "path/to/vesl/crates/nockchain-tip5-rs" }

# NockVM (from nockchain monorepo)
nockapp = { path = "path/to/nockchain/crates/nockapp", default-features = false }
nockvm = { path = "path/to/nockchain/crates/nockvm/rust/nockvm" }
nockvm_macros = { path = "path/to/nockchain/crates/nockvm/rust/nockvm_macros" }

# Runtime
tokio = { version = "1.32", features = ["rt-multi-thread", "macros"] }
anyhow = "1.0"
```

`nockchain-tip5-rs` is optional if only using `tip5_to_atom_le_bytes` — it's re-exported from `vesl-core`.

~
