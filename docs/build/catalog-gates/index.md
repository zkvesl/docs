---
title: Catalog Gates from Rust
description: How to drive each of the five named verification gates the vesl-gates library ships, plus the default single-leaf hash gate baked into settle-graft.
outline: deep
---

# Catalog Gates from Rust

A verification gate is a Hoon function with type signature `$-([note-id=@ data=* expected-root=@] ?)`. It returns a loobean stating whether the caller's `data` is bound to `expected-root`. Commitment grafts (settle-graft canonically) accept a gate as a parameter; the choice of gate determines what the commitment-and-verify cycle actually proves.

The default gate is a single-leaf hash comparison baked into settle-graft's poke body. Five named gates ship in [`vesl-gates.hoon`](https://github.com/zkvesl/vesl-core/blob/11d110d/protocol/lib/vesl-gates.hoon) for richer cases. This page covers driving each from Rust.

::: tip Gate selection
The gate is picked in the manifest via `[graft.gates]`. See [Grafts / Manifest Schema — Gate Selection](/build/grafts/manifest-schema#graft-gates-gate-selection) for the selection contract and the splice-point requirement.
:::

::: info Related pages
- [Gate Chains](/build/catalog-gates/gate-chains) — AND-folding multiple gates in `[graft.gates].gate-chain`.
- [Swapping a Gate](/build/catalog-gates/swapping) — manifest edit + re-inject + verification steps.
- [Custom Gates](/build/catalog-gates/custom-gates) — using a gate outside the shipped catalog.
:::

## The Default Hash Gate

With no `[graft.gates]` block, settle-graft uses a single-leaf hash gate: it treats `data` as a single atom and binds `expected-root = hash-leaf(data)`. From Rust:

```rust
// Example: default hash-gate flow
use vesl_core::{Mint, build_settle_register_poke, build_settle_note_poke};

let mut mint = Mint::new();
let payload: &[u8] = b"single-leaf payload";
let root = mint.commit(&[payload]);                // hash-leaf(payload)

let register = build_settle_register_poke(1, &root);
let note     = build_settle_note_poke(42, 1, &root, payload);
// app.poke(register) → [%settle-registered 1 root]
// app.poke(note)     → [%settle-noted note=[42 1 root [%settled ~]]]
```

The bytes registered as the root and the bytes submitted on `%settle-note` must match. Anything else makes the gate return `%.n`, the arm's `?>` crashes deterministically (preserving STARK unprovability), and the hull observes `Ok(vec![])`. The [Distinguishing Denial Paths](/troubleshooting/common-pitfalls#distinguishing-denial-paths) entry maps the surface.

## Schnorr Signing — End-to-End

`sig-verify-schnorr` binds `expected-root = hash-leaf(pubkey)` and verifies a Schnorr signature over `data` from that pubkey. The Rust driver assembles the payload, signs, registers the pubkey hash as the root, then submits a note that pre-commits to the signed bytes.

```rust
// Example: full Schnorr-signed settle cycle
use vesl_core::{build_settle_register_poke, build_settle_note_schnorr_poke};
use vesl_core::signing::{
    derive_pubkey, key_from_seed_phrase, pubkey_hash,
    schnorr_message_digest_for_data, sign,
};

// 1. Derive a Schnorr keypair.
let sk = key_from_seed_phrase("...")?;
let pk = derive_pubkey(&sk);

// 2. Register the pubkey hash as the hull's root.
let root = pubkey_hash(&pk);
let _ = app.poke(SystemWire.to_wire(), build_settle_register_poke(1, &root)).await?;

// 3. Sign the payload bytes against their tip5 digest.
let data: &[u8] = b"attested claim";
let digest = schnorr_message_digest_for_data(data);
let sig = sign(&sk, &digest)?;

// 4. Submit a %settle-note with [data sig pubkey] as the data cell.
let poke = build_settle_note_schnorr_poke(42, 1, &root, data, &sig, &pk);
let _ = app.poke(SystemWire.to_wire(), poke).await?;
// → [%settle-noted note=[42 1 root [%settled ~]]]
```

The pubkey is the trust anchor: a kernel that registered `hash-leaf(pubkey_A)` rejects any signature from pubkey_B (the gate's first AND-clause is `=((hash-leaf pubkey) expected-root)`). The signature binds the same `data` the gate `;;`-casts internally.

## ed25519

`sig-verify-ed25519` has the same shape as Schnorr but uses ed25519 signatures. vesl-core ships no ed25519 signing primitive; produce `sig` and `pubkey` with your own ed25519 stack (e.g., `ed25519-dalek`) and pass them as flat byte slices:

```rust
// Example: ed25519 settle-note (sig + pubkey from an external library)
use vesl_core::build_settle_note_ed25519_poke;

let poke = build_settle_note_ed25519_poke(
    42, 1, &root,
    data,                    // &[u8]
    sig_bytes,               // &[u8]  — 64-byte signature
    pubkey_bytes,            // &[u8]  — 32-byte pubkey
);
```

The same binding holds: `expected-root = hash-leaf(pubkey_bytes)`.

## manifest-verify — Multi-Field Merkle Proofs

`manifest-verify` AND-folds Merkle proofs over named fields. Use it when the payload is a structured document (a KYC bundle, signed JSON, a multi-field attestation) and the commitment is a Merkle root over field values.

```rust
// Example: build a manifest commitment and verify three fields
use vesl_core::{Mint, build_settle_register_poke, build_settle_note_manifest_poke};
use nockchain_tip5_rs::ProofNode;

// 1. Mint over the field values, one leaf per value.
let values: &[&[u8]] = &[b"alice@example.com", b"34", b"US"];
let mut mint = Mint::new();
let root = mint.commit(values);
let _ = app.poke(SystemWire.to_wire(), build_settle_register_poke(1, &root)).await?;

// 2. Collect a proof for each field.
let proofs: Vec<Vec<ProofNode>> = (0..values.len())
    .map(|i| mint.proof(i).unwrap())
    .collect();
let fields: Vec<(&[u8], &[u8])> = vec![
    (b"email", values[0]),
    (b"age",   values[1]),
    (b"juris", values[2]),
];

// 3. Submit a %settle-note with the (fields, proofs) cell.
let poke = build_settle_note_manifest_poke(42, 1, &root, &fields, &proofs);
let _ = app.poke(SystemWire.to_wire(), poke).await?;
```

Field names are descriptive; they aid debugging but the gate doesn't bind on them. The gate AND-folds `verify-chunk(value, proof, root)` over the (value, proof) pairs. Mismatched list lengths yield `%.n` from the gate.

## set-membership-verify

`set-membership-verify` proves an element belongs to a Merkle-committed set. Use it for allowlists, voter rolls, membership tables.

```rust
// Example: prove `alice` is in a committed roster
use vesl_core::{Mint, build_settle_register_poke, build_settle_note_membership_poke};

let roster: &[&[u8]] = &[b"alice", b"bob", b"carol"];
let mut mint = Mint::new();
let root = mint.commit(roster);
let _ = app.poke(SystemWire.to_wire(), build_settle_register_poke(1, &root)).await?;

let elem: &[u8] = b"alice";
let proof = mint.proof(0).unwrap();
let poke = build_settle_note_membership_poke(42, 1, &root, elem, &proof);
let _ = app.poke(SystemWire.to_wire(), poke).await?;
```

The payload `data` shape is `[elem=@ proof=(list [hash=@ side=?])]`.

## bounded-value-verify

`bounded-value-verify` proves a Merkle-committed numeric value falls in a committed `[lo, hi]` interval. Use it for age gates, score ranges, balance brackets.

The committed leaf is `hash-leaf(jam([value, bounds]))` — `value` and `bounds` are jammed together so an attacker cannot substitute their own range. Constructing the leaf requires the nock-noun-rs jamming helpers:

```rust
// Example: prove age=34 falls in [18, 65]
use vesl_core::{Mint, build_settle_register_poke, build_settle_note_bounded_poke};
use nock_noun_rs::{atom_from_u64, jam_to_bytes, new_stack, slab_root, NounSlab};
use nockvm::noun::T;

let value: u64 = 34;
let bounds: (u64, u64) = (18, 65);

// 1. Build the leaf bytes: jam([value bounds]).
let mut leaf_slab = NounSlab::new();
let v   = atom_from_u64(&mut leaf_slab, value);
let lo  = atom_from_u64(&mut leaf_slab, bounds.0);
let hi  = atom_from_u64(&mut leaf_slab, bounds.1);
let b   = T(&mut leaf_slab, &[lo, hi]);
let leaf = T(&mut leaf_slab, &[v, b]);
leaf_slab.set_root(leaf);
let mut stack = new_stack();
let leaf_bytes = jam_to_bytes(&mut stack, slab_root(&leaf_slab));

// 2. Mint over the leaf bytes; register the root.
let mut mint = Mint::new();
let root = mint.commit(&[&leaf_bytes[..]]);
let _ = app.poke(SystemWire.to_wire(), build_settle_register_poke(1, &root)).await?;

// 3. Submit a %settle-note with [value bounds proof].
let proof = mint.proof(0).unwrap();
let poke = build_settle_note_bounded_poke(42, 1, &root, value, bounds, &proof);
let _ = app.poke(SystemWire.to_wire(), poke).await?;
```

This is not a zero-knowledge proof. `value` is plaintext in the payload. Real ZK range proofs (Bulletproofs et al.) are out of scope for the catalog; the name `bounded-value-verify` is deliberately distinct from `range-proof-verify` for that reason.

## Hull `/settle` routing

Stock `vesl_hull::settle_handler` dispatches the `%settle-note` poke through a `SettlePayloadBuilder` trait so the JSON body shape adapts to the active gate. The hull's binary picks the impl at boot from the same gate name that `/status` reports.

| Gate | `/settle` request body | Notes |
|---|---|---|
| `default-hash` | `{}` re-mints from the first committed field, or `{"data": "<hex>"}` passes the leaf through. | The default behavior for the single-leaf hash gate. |
| `manifest-verify` | `{"fields": [{"name": "...", "value": "..."}, ...]}`. The hull re-derives proofs from the committed tree using `vesl_hull::field_to_leaf_bytes`. | Each `name`/`value` pair must match a field committed via `/commit`. |

Both shapes accept the common envelope fields `note_id` (optional, auto-increments) and `hull` (optional, defaults to the configured `hull_id`).

### Implementing a `SettlePayloadBuilder`

Each impl decodes its own JSON body and returns a `NounSlab` from one of the per-gate poke builders in `vesl_core`. `SettleContext` carries the committed tree, fields, and envelope:

```rust
use vesl_hull::{
    field_to_leaf_bytes, SettleBuilderError, SettleContext, SettlePayloadBuilder,
};

pub struct MyGatePayloadBuilder;

impl SettlePayloadBuilder for MyGatePayloadBuilder {
    fn gate_name(&self) -> &'static str { "my-gate" }

    fn build_settle_poke(
        &self,
        ctx: &SettleContext<'_>,
        body: &serde_json::Value,
    ) -> Result<nock_noun_rs::NounSlab, SettleBuilderError> {
        let hex_field = |k: &str| body.get(k).and_then(|v| v.as_str())
            .ok_or_else(|| SettleBuilderError::BadRequest(format!("missing `{k}`")))
            .and_then(|s| hex::decode(s).map_err(|e|
                SettleBuilderError::BadRequest(format!("invalid hex in `{k}`: {e}"))));
        let first = ctx.fields.first().ok_or_else(||
            SettleBuilderError::BadRequest("POST /commit first".into()))?;
        Ok(vesl_core::build_settle_note_ed25519_poke(
            ctx.note_id, ctx.hull_id, ctx.root,
            &field_to_leaf_bytes(first),
            &hex_field("sig")?,
            &hex_field("pubkey")?,
        ))
    }
}
```

Wire it into the scaffolded binary's `build_app_state`:

```rust
let settle_builder: Arc<dyn SettlePayloadBuilder> = Arc::new(MyGatePayloadBuilder);
```

Return `BadRequest` → 400, `InternalError` → 500. Kernel-side rejection still surfaces as 409 after the poke runs.

For the un-implemented catalog gates (`schnorr`, `ed25519`, `set-membership-verify`, `bounded-value-verify`), the hull warns at boot and falls back to `default-hash` — stock `/settle` will dead-deny on those, so you'll need either a `SettlePayloadBuilder` impl (above) or a custom route via [`serve_with_extra_routes`](/build/build-run/serve#composing-custom-routes). For gates not in the catalog at all, see [Custom Gates](/build/catalog-gates/custom-gates).

::: info See Also

- [Grafts / Manifest Schema — Gate Selection](/build/grafts/manifest-schema#graft-gates-gate-selection) — the manifest-side selection contract.
- [`protocol/lib/vesl-gates.hoon`](https://github.com/zkvesl/vesl-core/blob/11d110d/protocol/lib/vesl-gates.hoon) — the canonical gate catalog with per-gate binding rationale.
- [`crates/vesl-core/src/graft_pokes/settle.rs`](https://github.com/zkvesl/vesl-core/blob/11d110d/crates/vesl-core/src/graft_pokes/settle.rs) — Rust builders for each gate.
- [`crates/vesl-core/src/signing.rs`](https://github.com/zkvesl/vesl-core/blob/11d110d/crates/vesl-core/src/signing.rs) — Schnorr signing primitives.
- [Reference / vesl-core — Catalog Gates from Rust](/reference/vesl-core#catalog-gates-from-rust) — orientation pointer.

:::
