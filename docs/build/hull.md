---
title: Hull
description: How a hull builds a poke, sends it to the kernel, and parses the effect list. Plus drift detection and the four nock-noun-rs footguns.
outline: deep
---

# Hull

The hull is the Rust side of your nockapp — the program in `src/main.rs` that boots `out.jam` as a `NockApp`, sends pokes, and reads effects back. Most of the noun construction is done for you by `vesl-core`'s `build_*_poke` helpers; you write the orchestration.

::: info Before We Start

Three terms used throughout:

- **Atom** — a non-negative integer. Hoon's primitive scalar type. Auras (`@t`, `@ud`, `@tas`, …) annotate how to read an atom — UTF-8 cord, decimal number, lowercase symbol — without changing the underlying value.
- **Noun** — the universal value type in Nock and Hoon. Either an atom or a *cell* (an ordered pair of two nouns). Every value a kernel handles — state, causes, effects — is a noun.
- **NounSlab** — the Rust noun container. A hull allocates nouns into a slab, builds the poke head and arguments inside it, then submits the slab to the kernel via `app.poke(...)`. Defined at `nockapp::noun::slab::NounSlab`.

All three have full entries in [Reference / Glossary](/reference/glossary).

:::

```d2
direction: right

hull1: hull {
  A: "build_*_poke(args)\n→ NounSlab (cause)"
}

kernel: kernel hop {
  B: "app.poke(SystemWire, slab).await\n→ Vec<NounSlab> (effects)"
}

hull2: hull {
  C: "effect_head_tags(&effects)\n→ [\"settle-registered\", ...]"
}

hull1.A -> kernel.B
kernel.B -> hull2.C
```

## The Shape of a Hull

A hull boots the compiled kernel via `nockapp::kernel::boot::setup`, sends pokes with `app.poke(SystemWire, slab).await`, and reads back the effect list the kernel returns. The canonical shape is walked in [Quickstart / Exercise the Lifecycle](/setup/quickstart#_6-exercise-the-lifecycle); the rest of this page covers the patterns inside it.

## Scaffold CLI: Demo and Serve

The `vesl` template's `src/main.rs` is a clap dispatch with two arms. Both boot `out.jam` and pass the booted `NockApp` to the selected arm:

- **`cargo run`** — Demo arm (default): the canonical lifecycle from the quickstart, run once.
- **`cargo run -- serve`** — Serve arm: mounts the [`vesl-hull`](https://github.com/zkvesl/vesl-nockup/tree/main/crates/vesl-hull) HTTP API on `http://127.0.0.1:3000`.

`vesl-hull` is a vesl-nockup-native lib factored from vesl-core/hull. Mount your own routes by passing them to `vesl_hull::serve_with_extra_routes` (or `vesl_hull::router_with_extra` for the assembled `axum::Router`) — not `Router::merge`, which attaches custom routes outside the hull's auth / body-limit / rate-limit layers. See [Composing Custom Routes](/build/build-run/serve#composing-custom-routes). The Serve arm's full surface — `--port` / `--bind-addr` / `--no-auth` flags, the `HULL_API_KEY` auth model, the endpoint catalog, and custom-router composition — lives on [Build & Run / Serve Subcommand](/build/build-run/serve).

These handlers assume the kernel composes settle-graft — they build `%register`, `%settle-note`, and `%settle-verify` pokes. A kernel without settle-graft will reject those pokes; either delete the unused handlers from a fork of `crates/vesl-hull/src/api.rs`, or merge only `/health` and `/status` into a custom router.

## Poke Builders

`vesl-core` ships one `build_*_poke` helper per shipped graft cause. Each takes typed Rust primitives in and returns a ready-to-poke `NounSlab` out:

```rust
use vesl_core::{
    Mint, Tip5Hash,
    build_settle_register_poke, build_settle_note_poke, build_settle_verify_poke,
};

let mut mint = Mint::new();
let root: Tip5Hash = mint.commit(&[b"first"]);

let register = build_settle_register_poke(1, &root);
let note     = build_settle_note_poke(1, 1, &root, b"first");
let verify   = build_settle_verify_poke(1, 1, &root, b"first");
```

The three signatures don't share an argument count: `register` is `(hull, &root)`, `note` and `verify` are both `(note_id, hull, &root, data)`. The verify path takes the same 4-arg shape as `note`; extrapolating from `register`'s 2-arg form produces a `mismatched arguments` compile error.

`Tip5Hash` is `pub type Tip5Hash = [u64; 5]`: a tip5 digest of five Goldilocks field-element limbs (each `u64` below the Goldilocks prime `2^64 - 2^32 + 1`). The shape matches Hoon's `noun-digest:tip5 = [@ @ @ @ @]`. `Mint::commit` returns one; the `build_settle_*_poke` family takes one by reference; `build_mint_commit_poke(hull, root)` drives the `%mint-commit` arm with the same digest. Convert to a 40-byte little-endian slice via `vesl_core::tip5_to_atom_le_bytes` when raw bytes are needed.

The full set covers settle, mint, guard, forge, plus state and behavior grafts (`build_kv_set_poke`, `build_counter_inc_poke`, `build_log_append_poke`, etc.). The mint family is one builder (`build_mint_commit_poke`); guard is two (`build_guard_register_poke`, `build_guard_check_poke`); settle's six per-gate variants follow the `build_settle_note_<gate>_poke` pattern. The full per-graft list is in [Domain Pokes](/build/testing/domain-pokes); the module tree under [`crates/vesl-core/src/graft_pokes/`](https://github.com/zkvesl/vesl-core/tree/11d110d/crates/vesl-core/src/graft_pokes) is the source-of-truth.

For grafts that store structured data (`registry`, `log`, `queue`, `batch`), use the paired `_from_noun` helper to jam the payload internally rather than passing a raw `&[u8]`:

```rust
let mut record = NounSlab::new();
record.set_root(your_noun);
let slab = build_registry_put_poke_from_noun(key, &record);
```

The byte-taking variants (`build_registry_put_poke(key, &jammed_bytes)`) trust the caller to have already jammed the payload.

## Sending Pokes

```rust
let effects = app.poke(SystemWire.to_wire(), slab).await?;
```

`SystemWire` is the standard wire identity for system-level pokes. The poke is async; `app.poke` returns `Vec<NounSlab>` — the kernel's effect list, one effect per element.

## Parsing Effects

```rust
for tag in vesl_core::effect_head_tags(&effects) {
    println!("  effect: %{tag}");
}
```

`effect_head_tags` walks each effect noun and pulls the head atom as a string. For typed effect decoding beyond the head tag, see `vesl_core::effect_head_tag` (singular) and the per-graft `decode_*_effect` helpers in the source.

## Decoding Effect Payloads

Once you've matched on the head tag, you have to extract the rest of the effect cell. Three payload shapes recur across shipped grafts; each has a footgun.

### Loobean tails — `%guard-checked ok=?`, `%settle-verified ok=?`

These effects ship a loobean as the second cell field. Loobean polarity is inverted relative to Rust: in Hoon, `%.y` (yes) is the atom `0` and `%.n` (no) is the atom `1`. When you destructure a `%guard-checked` or `%settle-verified` effect, the `ok=` field is an atom — flip it before treating it as a Rust `bool`.

```rust
// Effect noun: [%guard-checked hull=@ ok=@]
// ok atom == 0  →  guard passed
// ok atom == 1  →  guard rejected
let passed = ok_atom == 0;
```

The inversion is footgun #4 in [The Four Noun Footguns](#the-four-noun-footguns) below. If your decoder reads the atom and treats `1` as `true`, every passing guard will look like a failure and every failing guard will look like a pass.

### Cell payloads — `%settle-noted`, `%batch-flushed`, `%registry-updated`

Most domain-success effects carry a structured payload. The shapes are enumerated per-graft in [Effect Catalog](/reference/effect-catalog). Examples:

| Effect | Payload shape |
|---|---|
| `%settle-noted` | `note=[id=@ hull=@ root=@ state=[%settled ~]]` |
| `%batch-flushed` | `bundle=(list *) count=@ud` |
| `%registry-updated` | `[key=@ old=* new=*]` |

To extract a field, descend through the noun with `head`/`tail` axis access or pattern-matched destructuring; the catalog page gives the exact shape per effect.

### Unit returns from peeks — `[~ ~]` vs `[~ [~ value]]`

`harness.peek_handle(path)` collapses the standard two-level unit shape: `Ok(None)` for `[~ ~]`, `Ok(Some(slab))` for `[~ [~ value]]`, and `Err` for bare `~` (unknown path). A subset of peeks ship as `(unit (unit *))` — `%settle-root`, `%mint-commit`, `%kv-value`, `%registry-entry`, `%counter-value`, `%log-by-seq` — to distinguish "path recognized, value absent" from "path recognized, value present". Use `harness.peek_raw(path)` for those; see [Testing → Domain Pokes → peek_raw](/build/testing/domain-pokes#peek-raw-nested-unit-paths). The [Peek Catalog](/reference/peek-catalog) marks each path's return shape.

## Peek-Then-Poke Gating

When two grafts must coordinate at the hull layer — most commonly an rbac-graft permission check before a downstream poke — the pattern is peek-then-poke:

1. Build the peek path for the gating graft (e.g. `[%rbac-has-perm pubkey perm ~]`).
2. Send the peek; receive `Some(true)`, `Some(false)`, or `None`.
3. Branch: on `Some(true)` proceed with the downstream poke; on `Some(false)` or `None` skip the poke (or surface a denial from the hull driver, if you want the caller to see one).

```rust
use vesl_core::{build_registry_put_poke, peek_loobean};
// build_rbac_has_perm_path is hand-rolled — see vesl-core / Driving rbac-graft
// for the full noun-slab construction. Multi-arg peek paths don't have a
// shipped builder today.

let perm_slab = build_rbac_has_perm_path(caller_pubkey, "registry-put");
let result = harness.peek_slab(perm_slab).await?;

match peek_loobean(&result) {
    Some(true) => {
        let tags = harness.poke_slab(build_registry_put_poke(key, &record)).await?;
        // proceed — downstream effects landed
    }
    Some(false) | None => {
        // skip: caller lacks the perm. No state change, no effect.
    }
}
```

The denial is silent from the kernel's perspective — the downstream poke never lands, so no `%registry-error` is emitted. If you want the caller to see a denial, surface one from the hull driver before returning.

`peek_loobean` (not a generic unit-unwrap) is the right decoder for an `ok=?` tail; the latter collapses atom-0 (`%.y`) onto the absent-value boundary. See [vesl-core → Driving rbac-graft](/reference/vesl-core#driving-rbac-graft) for the full hand-rolled peek-path construction and [Kernel → Domain Peeks → Multi-Arg Path](/build/kernel/peeks#multi-arg-path) for the path shape.

This pattern composes: stack two peeks before a poke, or pair it with a validate-graft rule (see [Common Pitfalls → Composing Three Denials](/troubleshooting/common-pitfalls#composing-three-denials-stacked-admission)).

## Hull/Kernel Drift Detection

Drift detection is opt-in. From a hull's `build.rs`, run `nockup graft codegen kernel-cause-tags <PATH>` after `hoonc`. The codegen writes `kernel_cause_tags.rs` to `OUT_DIR` and exposes its path as `KERNEL_CAUSE_TAGS_PATH`. Include the file in your hull and assert each cause tag at compile time:

```rust
include!(env!("KERNEL_CAUSE_TAGS_PATH"));

fn build_settle_register_poke(hull: u64, root: &Tip5Hash) -> NounSlab {
    assert_kernel_cause_tag!("settle-register");
    // ... construct the noun ...
}
```

`assert_kernel_cause_tag!` runs at compile time. A kernel rename (e.g. `%settle-register` → `%settle-write`) regenerates the slice on the next `cargo build`; the stale `"settle-register"` literal in the hull then fails the membership check and `cargo build` halts:

```text
error[E0080]: evaluation of constant value failed
  --> src/hull.rs:12:5
   |
12 |     assert_kernel_cause_tag!("settle-register");
   |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |     |
   |     the evaluated program panicked at 'cause tag `settle-register` not
   |     in KERNEL_CAUSE_TAGS — re-run `nockup graft codegen kernel-cause-tags`
   |     and check the driver's poke builder against the kernel's cause $%.'
   |
   = note: this error originates in the macro `assert_kernel_cause_tag`
```

The drift is surfaced as a compile error instead of a silent `Ok(vec![])` from `app.poke(...)` at runtime.

`KERNEL_CAUSE_TAGS` is derived by parsing the `+$ cause` arm in the composed `app.hoon`. Two consequences:

- **Domain causes are covered.** Inline variants you added directly to your domain (`%submit-artifact`, `%emit-license`, etc.) show up in `KERNEL_CAUSE_TAGS`. `assert_kernel_cause_tag!("submit-artifact")` compiles. Kernel rename → hull compile error, same way as graft-side renames.
- **Inactive grafts contribute nothing.** A graft sitting under `hoon/lib/` but never referenced from `+$ cause $%(...)` doesn't pollute the slice with its tags.

The default `vesl` template ships a no-op `build.rs`; the `graft-*` templates wire the codegen call and surface a `cargo:warning` when `nockup-graft` is missing or codegen fails. Either way, gate `include!(env!("KERNEL_CAUSE_TAGS_PATH"))` with `cfg(env_var = "KERNEL_CAUSE_TAGS_PATH")` so the hull stays buildable when the env var is unset; the guarded include is then skipped.

## Hand-Rolled Causes

When you have a domain cause without a builder yet, construct the noun manually:

```rust
use nockapp::{AtomExt, Bytes, NockApp, noun::slab::NounSlab, wire::{SystemWire, Wire}};
use nockvm::noun::{Atom, T};
use nock_noun_rs::atom_from_u64;

async fn issue_badge(app: &mut NockApp, subject: u64) -> anyhow::Result<()> {
    let mut slab = NounSlab::new();
    let tag  = Atom::from_bytes(&mut slab, &Bytes::copy_from_slice(b"issue-badge")).as_noun();
    let subj = atom_from_u64(&mut slab, subject);
    let noun = T(&mut slab, &[tag, subj]);
    slab.set_root(noun);
    let _ = app.poke(SystemWire.to_wire(), slab).await?;
    Ok(())
}
```

The pattern generalizes: one atom per cause field, then `T(&mut slab, &[tag, arg1, arg2, ...])`.

## The Four Noun Footguns

The four rules `nock-noun-rs` exists to handle. Read [`nock-noun-rs/README.md`](https://github.com/zkvesl/vesl-core/blob/main/crates/nock-noun-rs/README.md) for the full exposition; the short list:

- **Long tags** (> 8 bytes) panic at compile time under `D(tas!(b"…"))`. Use `Atom::from_bytes(slab, &Bytes::copy_from_slice(b"…"))` for anything from `settle-register` upward.
- **Wide `u64` values** (hashes, IDs where the top bit may be set) panic at runtime under `D(value)` with `Number is greater than DIRECT_MAX`. Route them through `atom_from_u64(slab, value)`.
- **`AtomExt::from_bytes` takes `&bytes::Bytes`**, not `&[u8]` — via the `nockapp::Bytes` re-export.
- **Loobeans are inverted relative to Rust booleans.** Hoon's `%.y` (yes) is atom `0`; `%.n` (no) is atom `1`. Convert at the boundary, not inline.

::: info See Also

- [Build & Run / Serve Subcommand](/build/build-run/serve) — the Serve arm's full surface (flags, auth, endpoint catalog, custom routes).
- [vesl-nockup README — Serving over HTTP](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#serving-over-http) — scaffold-level overview of the `Serve` arm.
- [`crates/vesl-hull/`](https://github.com/zkvesl/vesl-nockup/tree/main/crates/vesl-hull) — the lib backing the `Serve` arm (factored from vesl-core/hull as a vesl-nockup-native crate).
- [`tools/graft-inject/tests/mint_lifecycle.rs`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/tools/graft-inject/tests/mint_lifecycle.rs) — full lifecycle as a Rust integration test.
- [`crates/vesl-core/src/lib.rs`](https://github.com/zkvesl/vesl-core/blob/11d110d/crates/vesl-core/src/lib.rs#L1-L40) — the four primitives and the poke-builder map.

:::
