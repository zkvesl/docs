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

### Gate-selected settle-graft pokes

When the manifest selects a Tier 1a catalog gate via `[graft.gates]` (`sig-verify-schnorr`, `sig-verify-ed25519`, `manifest-verify`, `set-membership-verify`, `bounded-value-verify`), the gate's `data` field is no longer a flat byte slice — it's a structured cell that the gate casts via `;;`. `vesl-core` ships per-gate poke builders that thread the right shape; pick the one matching your gate, or use the generic closure-driven variant for gates not yet covered.

| Builder | Gate (`[graft.gates]`) | Hoon `data` payload |
|---|---|---|
| `build_settle_note_poke_with_data(note_id, hull, &root, build_data)` | any | (closure builds the noun) |
| `build_settle_verify_poke_with_data(note_id, hull, &root, build_data)` | any | (closure builds the noun) |
| `build_settle_note_schnorr_poke(note_id, hull, &root, data, &sig, &pubkey)` | `sig-verify-schnorr` | `[data=@ sig=@ pubkey=@]` |
| `build_settle_note_ed25519_poke(note_id, hull, &root, data, sig, pubkey)` | `sig-verify-ed25519` | `[data=@ sig=@ pubkey=@]` |
| `build_settle_note_membership_poke(note_id, hull, &root, elem, &proof)` | `set-membership-verify` | `[elem=@ proof=(list [hash=@ side=?])]` |
| `build_settle_note_bounded_poke(note_id, hull, &root, value, (lo, hi), &proof)` | `bounded-value-verify` | `[value=@ bounds=[lo=@ hi=@] proof=(list [hash=@ side=?])]` |
| `build_settle_note_manifest_poke(note_id, hull, &root, fields, proofs)` | `manifest-verify` | `[fields=(list [name=@t value=@]) proofs=(list (list [hash=@ side=?]))]` |

Each per-gate builder is a one-liner over `build_settle_note_poke_with_data`. Use the generic closure form when adding a new gate or a domain-specific (non-catalog) payload.

#### Schnorr serialization helpers

`sig-verify-schnorr` enforces wire shapes the Hoon side derives via `ser-a-pt:cheetah` (pubkey) and `(chal << 256) | s` (signature). Three helpers in `vesl_core` produce those exact bytes:

| Helper | Returns | What it does |
|---|---|---|
| `pubkey_canonical_bytes(&SchnorrPubkey)` | `Vec<u8>` (97 bytes) | Affine-point encoding (`ser-a-pt:cheetah`) — the form the gate's `de-a-pt` round-trips. |
| `pack_schnorr_signature(&SchnorrSignature)` | `Vec<u8>` | Packs `(chal << 256) \| s` as canonical LE atom bytes. The gate splits via `(rsh 8 sig)` / `(end 8 sig)`. |
| `schnorr_message_digest_for_data(data: &[u8])` | `[Belt; 5]` | Mirrors the gate's `(hash-leaf-digest data)` reduction (chunked tip5 over arbitrary `&[u8]`). Pass to `vesl_core::sign(&sk, &digest)` to produce a signature the gate verifies. |

#### Worked example — Schnorr happy path

```rust
use vesl_core::{
    Mint, build_settle_register_poke, build_settle_note_schnorr_poke,
    derive_pubkey, sign,
    pubkey_canonical_bytes, schnorr_message_digest_for_data,
};
use nockchain_math::belt::Belt;

let mut sk = [Belt(0); 8];
sk[0] = Belt(0xabad_f00d);
let pubkey = derive_pubkey(&sk);

// Hull commits to the canonical pubkey encoding.
let pk_bytes  = pubkey_canonical_bytes(&pubkey);
let leaf_root = Mint::new().commit(&[&pk_bytes]);
poke(&mut app, build_settle_register_poke(1, &leaf_root)).await?;

// Sign + settle a 32-byte attestation under the registered hull.
let message: &[u8] = b"attest: 32-byte hash fingerprint";
let digest = schnorr_message_digest_for_data(message);
let sig    = sign(&sk, &digest)?;
let slab   = build_settle_note_schnorr_poke(101, 1, &leaf_root, message, &sig, &pubkey);
poke(&mut app, slab).await?;        // -> %settle-noted
```

#### Worked example — set-membership

```rust
use vesl_core::{Mint, build_settle_register_poke, build_settle_note_membership_poke};

let leaves: [&[u8]; 4] = [b"alice", b"bob", b"carol", b"dave"];
let mut mint = Mint::new();
let root  = mint.commit(&leaves);
let proof = mint.proof(0).expect("alice at index 0");

poke(&mut app, build_settle_register_poke(1, &root)).await?;
let slab = build_settle_note_membership_poke(7, 1, &root, b"alice", &proof);
poke(&mut app, slab).await?;        // -> %settle-noted
```

#### Other gates — payload notes

`bounded-value-verify`: the registered leaf must be `hash-leaf(jam([value bounds]))`; `proof` rebinds that leaf to root. `build_settle_note_bounded_poke` encodes the `[value bounds proof]` cell for you.

`manifest-verify`: AND-folds `verify-chunk(value, proof, root)` over each `(field, proof)` pair. `build_settle_note_manifest_poke` takes parallel `fields: &[(name, value)]` and `proofs: &[Vec<ProofNode>]` slices — length mismatch yields `%.n` gate-side.

`sig-verify-ed25519`: `vesl-core` has no ed25519 signing primitive; the builder takes raw `&[u8]` for sig and pubkey and threads them into the same `[data sig pubkey]` cell. Bring your own ed25519 stack (e.g., `ed25519-dalek`) on the Rust side. The hull's commitment must equal `hash-leaf(pubkey)` regardless of curve.

#### Generic escape hatch

When adding a new gate (or a domain-specific one not in the catalog):

```rust
use vesl_core::build_settle_note_poke_with_data;
use nock_noun_rs::make_atom_in;
use nockvm::noun::T;

let slab = build_settle_note_poke_with_data(note_id, hull, &root, |slab| {
    let a = make_atom_in(slab, b"...");
    let b = make_atom_in(slab, b"...");
    T(slab, &[a, b])
});
```

The closure runs against the in-progress slab and returns the data noun. The SDK handles graft-payload assembly + `%settle-note` cause wrapping.

A runnable end-to-end Schnorr happy-path example lives in vesl-nockup's [`README.md`](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#drive-a-catalog-gate-from-rust) under *Customizing → Drive a catalog gate from Rust*.

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

### kv-graft

Loose key-value store. `@t` keys, opaque atom values. Capacity capped at 10M entries; overwrite of an existing key bypasses the cap.

| Builder | Cause tag | Effect |
|---|---|---|
| `build_kv_set_poke(key, value)` | `%kv-set` | `%kv-stored` / `%kv-error` (capacity only) |
| `build_kv_delete_poke(key)` | `%kv-delete` | `%kv-deleted` (idempotent — missing keys also emit `%kv-deleted`) |

### counter-graft

Named `@ud` counters; init-on-touch, saturate at `2^64-1`. Capacity capped at 10M counters.

| Builder | Cause tag | Effect |
|---|---|---|
| `build_counter_increment_poke(name)` | `%counter-increment` | `%counter-incremented value=@ud` / `%counter-error 'saturated'` past `u64::MAX` |
| `build_counter_reset_poke(name)` | `%counter-reset` | `%counter-reset` (idempotent — initializes unset names to 0) |
| `build_counter_set_poke(name, value)` | `%counter-set` | `%counter-set value=@ud` |

### queue-graft

FIFO job queue with monotonic IDs. First state-graft cause that cue's caller-supplied bytes (`%queue-push payload=@`) — wraps the cue in `mule` per Safety Contract C1. Capacity capped at 10M pending jobs.

| Builder | Cause tag | Effect |
|---|---|---|
| `build_queue_push_poke(body_jammed)` | `%queue-push` | `%queue-pushed id=@ud` / `%queue-error 'malformed payload'` (cue failure) / `%queue-error 'capacity'` |
| `build_queue_pop_poke()` | `%queue-pop` | `%queue-popped job=(unit [id=@ud body=*])` (`~` on empty, `[~ [id body]]` otherwise — never errors) |
| `build_queue_clear_poke()` | `%queue-clear` | `%queue-cleared` (next-id preserved) |

`build_queue_push_poke` takes `&[u8]` of the caller-jammed body; pre-jam your domain noun on the Rust side and let the graft round-trip the cue. When the body originates as an in-process noun, `build_queue_push_poke_from_noun(slab)` jams internally and skips the manual jam dance. For forwarding bytes pulled from a cue-emitting source (e.g., `%queue-popped` body), pair the byte-taking builder with `vesl_core::rejam_atom` — see "Cross-graft pipelines" below.

### rbac-graft

Pubkey-keyed permission table. Two-level cap: `roles-cap = 10M` outer, `perms-per-role-cap = 1k` inner. Causes carry `(list @t)` rather than `(set @t)` so callers hand flat slices.

| Builder | Cause tag | Effect |
|---|---|---|
| `build_rbac_grant_poke(pubkey, perms)` | `%rbac-grant` | `%rbac-granted added=(list @t)` (set diff only) / `%rbac-error 'capacity'` |
| `build_rbac_revoke_poke(pubkey, perms)` | `%rbac-revoke` | `%rbac-revoked removed=(list @t)` (intersect-then-noop on unheld; auto-clears the pubkey when held set drops to empty) |

### registry-graft

Strict structured registry. Heaviest C1 surface — both put and update cue caller-supplied record bytes inside their poke arms under a `mule` guard. Capacity capped at 10M entries.

| Builder | Cause tag | Effect |
|---|---|---|
| `build_registry_put_poke(key, record_jammed)` | `%registry-put` | `%registry-stored` / `%registry-error 'key already present'` (strict create) / `%registry-error 'malformed payload'` |
| `build_registry_update_poke(key, record_jammed)` | `%registry-update` | `%registry-updated old=* new=*` / `%registry-error 'key not present; use put'` / `%registry-error 'malformed payload'` |
| `build_registry_del_poke(key)` | `%registry-del` | `%registry-deleted` / `%registry-error 'key not present'` (strict delete) |

`build_registry_*_poke` take `&[u8]` of the caller-jammed record; records are typed `*` (any noun) on the Hoon side. Schema validation belongs in `validate-graft` (Phase 03c, v0.1 — see below), not the registry itself.

> **Pre-jam payloads in custom domain arms.** If you delegate to `%registry-put` from your own kernel arm, jam the payload first (`(jam payload)` in Hoon, or pre-jam on the Rust side via `vesl_core::jam_to_bytes`). Registry's `mule (cue payload)` reads the bytes as jam — passing a raw atom may emit `%registry-stored` with garbage state OR `%registry-error 'cue failure'`, depending on what bits the atom happens to contain. The "Cross-graft pipelines" section below explains the same constraint at the queue-pop → batch-add seam.

### validate-graft

Pre-flight rule check on poke causes. Rules install per cause-tag at runtime; the prelude block short-circuits with `%validate-rejected` before the kernel's `?-` switch runs. **First consumer of the `[graft.blocks.poke-prelude]` marker landed in Phase 03b.**

v0.1 ships ONE rule shape — `ValidateRule::NonEmpty` — applied to the cause-cell body (`+.u.act`). Other rule shapes from the spec (`length` / `in-set` / `range` / `unique-in`) are reserved in the Hoon-side union for v0.2; they require graft-inject codegen (deferred) for field-level keying.

| Builder | Cause tag | Effect |
|---|---|---|
| `build_validate_init_poke(cause_tag, &[ValidateRule])` | `%validate-init` | `%validate-rules-installed cause-tag count=@ud` / `%validate-error 'too many rules per cause'` (cap 64) / `%validate-error 'rules map at capacity'` (cap 10k) |
| `build_validate_clear_poke(cause_tag)` | `%validate-clear` | `%validate-rules-cleared cause-tag` (idempotent on missing key) |

**`ValidateRule` variants (re-exported as `vesl_core::ValidateRule`)**

| Variant | Hoon rule tag | Shape | Behavior |
|---|---|---|---|
| `ValidateRule::NonEmpty` | `%non-empty` | rule body is `~` | Rule fails if `+.u.act` is atom 0 (empty body). |

v0.2 reserves `%length`, `%in-set`, `%range`, `%unique-in`. They will land with field-level keying via graft-inject codegen.

Prelude effect on a wrapped cause: `%validate-rejected cause-tag reason=@t` returned from the gate before the switch fires. State is untouched on the reject path.

### log-graft

Append-only audit trail with monotonic seq + caller-supplied `tag=@ta`. Newest-first; oldest evicted past the retention cap (100k entries — hardcoded for v0.1, manifest-config promotion deferred). C1 mule-wraps the cued payload.

| Builder | Cause tag | Effect |
|---|---|---|
| `build_log_append_poke(tag, data_jammed)` | `%log-append` | `%log-appended seq=@ud` / `%log-error 'malformed payload'` |

`build_log_append_poke` takes the entry's tag (a short identifier — typically a graft / cause name) plus `&[u8]` of the caller-jammed data. The kernel re-cues the data inside `mule` so malformed input surfaces as `%log-error` rather than a panic. `build_log_append_poke_from_noun(tag, slab)` is the in-process counterpart; pair the byte-taking form with `vesl_core::rejam_atom` when feeding bytes from a cue-emitting source — see "Cross-graft pipelines" below.

### clock-graft

Deterministic event-counter clock. `%clock-tick` advances a monotonic counter; `[%clock-now ~]` returns the current `@da` (event-count cast as opaque kernel-time units). v0.1 ships the `event-count` source only — `boot-offset` and `block-time` deferred (the former is non-deterministic environmental input; the latter waits on chain-bridge plumbing).

| Builder | Cause tag | Effect |
|---|---|---|
| `build_clock_tick_poke()` | `%clock-tick` | `%clock-ticked now=@da` |

No C1 mule-wrap site (the cause carries no payload to cue).

### batch-graft

Settlement-flush buffer. Accumulates caller-supplied intents and emits one `%batch-flushed bundle=...` when the count threshold trips, amortizing on-chain settlement cost. v0.1 ships the `count` trigger only — `pages` and `time` triggers deferred. C1 mule-wraps the cued intent payload.

| Builder | Cause tag | Effect |
|---|---|---|
| `build_batch_init_poke(threshold)` | `%batch-init` | `%batch-initialized threshold=@ud` (`threshold = 0` disables auto-flush; manual `%batch-flush` only) |
| `build_batch_add_poke(intent_jammed)` | `%batch-add` | `%batch-added id=@ud` / `%batch-error 'malformed intent payload'` / on auto-flush: also `%batch-flushed bundle count` |
| `build_batch_flush_poke()` | `%batch-flush` | `%batch-flushed bundle count` (always emits, even on empty pending — boundary signal for downstream listeners) |

`build_batch_add_poke` takes `&[u8]` of the caller-jammed intent. Threshold semantics: `count = 1` flushes on every add (functionally no-batch); `count = N` flushes once `(lent pending) >= N`. Capacity-capped at `pending-cap = 10M` intents. `build_batch_add_poke_from_noun(slab)` is the in-process counterpart; pair the byte-taking form with `vesl_core::rejam_atom` when forwarding bytes from a cue-emitting source — see "Cross-graft pipelines" below.

The downstream orchestrator (Rust side) listens for `%batch-flushed` and routes each intent in the bundle to settle-graft on its own time — batch-graft itself does not call into settle-graft.

### Cross-graft pipelines

State grafts that store opaque caller-supplied payloads (queue / log / batch / registry) split into two kinds at the Rust↔kernel seam:

- **Cue-consuming**: `%queue-push`, `%batch-add`, `%log-append`, `%registry-put` / `-update` — the kernel `(cue body)`s the caller's bytes inside `mule`. Inputs MUST be valid jam.
- **Cue-emitting**: `%queue-popped` returns the body as the noun the kernel decoded on push. Walking that noun's bytes via `as_ne_bytes()` returns the *atom* representation, not a fresh jam encoding.

Forwarding bytes from a cue-emitting source straight into a cue-consuming sink fails three ways: a `%queue-error` / `%batch-error` / `%log-error` (best case), silent garbage interpretation that corrupts downstream state, or a kernel hang inside `cue` on pathological back-refs. The seam needs a re-jam.

`vesl_core::rejam_atom(&[u8]) -> Vec<u8>` is the canonical cross-graft helper: it cues the input bytes and re-jams the resulting noun so the next graft's `cue` succeeds. `vesl_core::decode_queue_popped(effects: &[NounSlab]) -> Option<(u64, Vec<u8>)>` pulls the `(id, body_bytes)` out of a `%queue-popped` effect — paired with `rejam_atom`, the queue → batch seam becomes:

```rust
use vesl_core::{decode_queue_popped, rejam_atom, build_batch_add_poke, build_queue_pop_poke};

let popped = poke(&mut app, build_queue_pop_poke()).await?;
let Some((_id, body_bytes)) = decode_queue_popped(&popped) else {
    // queue was empty (or the pop emitted no %queue-popped) — nothing to forward
    return Ok(());
};
let canonical = rejam_atom(&body_bytes);
poke(&mut app, build_batch_add_poke(&canonical)).await?;
```

The effect-decoder skips non-matching effects in the slice, returns `None` on empty queue (Hoon `[%queue-popped ~]`), and propagates body bytes verbatim — `as_ne_bytes()` representation, padding included — for `rejam_atom` to canonicalize.

Known graft pairs that need `rejam_atom` at the seam:

- `queue → batch` (queue's body is cued; batch cues its input)
- `queue → log`
- `queue → registry`
- Any custom domain that forwards opaque bytes between cue-emitting and cue-consuming grafts.

**Picking the builder shape — `_from_noun` vs. byte-taking:**

- `build_*_poke_from_noun(slab)` — body originates in-process. The wrapper jams internally; the call site never handles raw bytes.
- `build_*_poke(jammed_body: &[u8])` — body came from a cue-emitting source. Pair with `rejam_atom` at cross-graft seams; pass directly when the bytes are already in canonical jam form.

The signature itself signals the contract: the byte-taking builders name their parameter `body_jammed` / `intent_jammed` / `data_jammed` to underline that raw user payloads will fail.

### Peek path conventions

**Commitment grafts (hull-keyed `@` peek):** settle / mint / guard expose `[%<graft>-root hull=@ ~]` / `[%<graft>-commit hull=@ ~]` / `[%<graft>-registered hull=@ ~]`. The returned shape is `[~ [~ (unit @)]]`:

- present hull → `[~ [~ [~ root]]]`
- missing hull → `[~ [~ ~]]`

`vesl_core::unwrap_triple_unit_atom` strips the three layers; pair with `vesl_core::build_hull_peek_path("<graft>-root", hull)` (or `-commit` / `-registered`) to construct the slab.

**State grafts** key on whatever shape fits the domain — most diverge from the hull pattern:

| Graft | Peek path | Returns |
|---|---|---|
| `kv-graft`       | `[%kv-value key=@t ~]`           | `(unit @)` — same triple-unit shape; `peek_keyed_value` decodes |
| `counter-graft`  | `[%counter-value name=@t ~]`     | `(unit @ud)` — same triple-unit shape |
| `queue-graft`    | `[%queue-len ~]`                 | atom (always present; uses `peek_keyless_atom` to bypass the atom-zero-is-None quirk) |
| `rbac-graft`     | `[%rbac-perm-count pubkey=@ ~]`  | atom — count of held perms; `0` when pubkey not present (auto-clear invariant) |
| `rbac-graft`     | `[%rbac-has-perm pubkey=@ perm=@t ~]` | loobean — `%.y` (atom 0) when held, `%.n` (atom 1) otherwise |
| `registry-graft` | `[%registry-entry key=@ ~]`      | `(unit *)` — opaque record (callers cast against their schema) |
| `validate-graft` | `[%validate-rules cause-tag=@ta ~]` | `(unit (list rule))` — installed rules for the cause-tag (debug aid) |
| `log-graft`      | `[%log-by-seq seq=@ud ~]` / `[%log-tail count=@ud ~]` / `[%log-len ~]` | by-seq returns `(unit log-entry)`; tail returns `(list log-entry)` (newest first); len returns atom |
| `clock-graft`    | `[%clock-now ~]`                 | atom (always present; current `@da` from event-count) |
| `batch-graft`    | `[%batch-pending-len ~]` / `[%batch-threshold ~]` | atoms (always present) |

Empty bytes after trimming correspond to atom 0 — for the loobean has-perm peek that's `%.y` (true). The shared decoders are exported from `vesl_core::peek`: `unwrap_triple_unit_atom` for atom payloads, `peek_loobean` for `(unit ?)`, `peek_unit_list` for `(unit (list T))`, plus `build_hull_peek_path` / `build_keyed_peek_path` / `build_keyless_peek_path` builders. See "Peek calls from Rust" below for worked examples.

### Peek calls from Rust

Peeks are read-only kernel queries. The `NockApp` method:

```rust
pub async fn peek(&mut self, path: NounSlab) -> Result<NounSlab>;
```

`vesl_core::peek` ships path-builders for the three shapes v0.1 grafts use, plus pure decoders for the triple-unit return wrapper. Callers `use vesl_core::{...}` and stop hand-rolling the `app.peek` plumbing.

#### Builders

```rust
use vesl_core::{build_hull_peek_path, build_keyed_peek_path, build_keyless_peek_path};

let p_hull    = build_hull_peek_path("settle-registered", hull_id);   // [%settle-registered hull=@ ~]
let p_keyed   = build_keyed_peek_path("kv-value", "greeting");        // [%kv-value key=@t ~]
let p_keyless = build_keyless_peek_path("log-len");                   // [%log-len ~]
```

For shapes the v0.1 helpers don't cover (e.g. multi-arg `[%rbac-has-perm pubkey=@ perm=@t ~]` or `u64`-keyed `[%registry-entry key=@ ~]`), build the slab directly:

```rust
use nock_noun_rs::{atom_from_u64, make_tag_in, NounSlab};
use nockvm::noun::{D, T};

let mut slab = NounSlab::new();
let tag  = make_tag_in(&mut slab, "rbac-has-perm");
let pk   = atom_from_u64(&mut slab, pubkey);
let perm = make_tag_in(&mut slab, "audit");
let path = T(&mut slab, &[tag, pk, perm, D(0)]);
slab.set_root(path);
```

The decoders in the next section work on either form — they care about the result wrap, not how the path was built.

#### Decoders

Every v0.1 graft wraps its peek body in `` `` `` `` so the result shape is `[~ [~ (unit @)]]`. Strip the three layers with:

```rust
use vesl_core::{unwrap_triple_unit_atom, peek_loobean};

let result = app.peek(build_keyless_peek_path("log-len")).await?;
let len_bytes = unwrap_triple_unit_atom(&result);  // Option<Vec<u8>>
```

`unwrap_triple_unit_atom` returns `None` for an absent value (graft replied `[~ [~ ~]]`) and `Some(bytes)` for a present atom. Trailing zeros are trimmed so cord round-trips compare cleanly.

For loobean peeks (`%rbac-has-perm`, anything returning `(unit ?)`), use `peek_loobean` instead — atom 0 is `%.y` (true), atom 1 is `%.n` (false), and `unwrap_triple_unit_atom` collapses atom-0 onto the same `None` boundary as "absent value." That's wrong for booleans:

```rust
let has = peek_loobean(&app.peek(rbac_path).await?).unwrap_or(false);
```

For `(unit (list T))` peeks (`[%validate-rules cause-tag ~]`, `[%log-tail count ~]`), use `peek_unit_list` — `unwrap_triple_unit_atom` returns `None` here even when items are present, because the inner value is a cell, not an atom. The decoder takes a per-element closure:

```rust
use nock_noun_rs::{atom_from_u64, make_tag_in, NounSlab};
use nockvm::noun::{D, T};
use vesl_core::peek_unit_list;

// Build [%validate-rules <cause-tag> ~] by hand — no shared builder for
// cause-tag-keyed peeks yet.
let mut path = NounSlab::new();
let tag       = make_tag_in(&mut path, "validate-rules");
let cause_tag = make_tag_in(&mut path, "queue-push");
let p = T(&mut path, &[tag, cause_tag, D(0)]);
path.set_root(p);

let result = app.peek(path).await?;
let rules = peek_unit_list(&result, |n| {
    // Each rule noun: [tag=@t body=*]. Pull the tag cord out.
    let cell = n.as_cell().ok()?;
    let bytes = cell.head().as_atom().ok()?.as_ne_bytes().to_vec();
    Some(bytes)
})
.unwrap_or_default(); // outer wrapper malformed → empty
assert!(!rules.is_empty(), "validate-rules should not be empty");
```

Return-shape contract: `None` on a malformed wrapper, `Some(vec![])` when the path bound but no value is stored (Hoon inner `~`), `Some(items)` otherwise. Failures from the closure abort the walk and propagate `None`.

#### Worked example

Round-trip a settle commitment — register a hull, peek it back, parity-check against the source root:

```rust
use vesl_core::{
    build_hull_peek_path, build_settle_register_poke, tip5_to_atom_le_bytes,
    unwrap_triple_unit_atom,
};

// 1. Register a root.
poke(&mut app, build_settle_register_poke(hull_id, &root)).await?;

// 2. Peek it back.
let result = app.peek(build_hull_peek_path("settle-registered", hull_id)).await?;
let stored = unwrap_triple_unit_atom(&result)
    .ok_or_else(|| anyhow!("expected hull {hull_id} to be registered"))?;
assert_eq!(stored, tip5_to_atom_le_bytes(&root));
```

The same pattern works for any commitment graft — swap `settle-registered` for `mint-commit` or `guard-root` and use the matching poke builder.

#### Strict decoding

`unwrap_triple_unit_atom` and `peek_loobean` collapse structural mismatches onto `None`. That's the right shape for tests and most drivers — if the kernel returned a sane reply, decode succeeds; otherwise treat it as absent. If you need to surface "graft returned a malformed peek result" as a typed error, walk the noun yourself with `noun.as_cell()? / .tail() / .as_atom()?` and propagate the underlying nockvm errors.

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
