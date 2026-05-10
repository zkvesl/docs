---
title: Common pitfalls
description: Recognizable failure modes — what the symptom looks like, what's actually happening, and the fix.
outline: deep
---

# Common pitfalls

Each entry leads with the symptom you'd see (or fail to see) at the terminal, then the cause, then the fix.

## `hoonc` exits 0 but `out.jam` is missing

A type error during eager-parse can leave hoonc with no panic message, exit 0, and no `out.jam` written. Without a guard you walk into the next step against a stale kernel from the previous compile. Always pair the hoonc invocation with `[ -s out.jam ]`:

```bash
hoonc hoon/app/app.hoon hoon/ && [ -s out.jam ] || \
  (echo "hoonc: silent-failed — exit 0 but no out.jam" >&2; exit 1)
```

For a structured alternative that also catches the "stale jam against edited sources" case, use `vesl-test verify-jam`. See [Build / Build & Run — verify-jam structured alternative](/build/build-run#verify-jam-structured-alternative).

## `hoonc` fails with `mint-lost` / `-lost %<tag>` on a multi-graft compose

The composed `?-` over `-.u.act` isn't exhaustive — usually because one of the graft manifests is stale. Re-install the vesl graft package (or re-run `sync.sh` in a dev checkout) to pick up the latest arm set. If the missing tag was renamed in a recent vesl release, re-syncing the manifest is the fix.

## `hoonc` fails with `missing dependency /jams/constraints-0-1.jam`

`forge-graft` pulls in the STARK prover tree, which depends on pre-jammed constraint tables. Copy `hoon/dat/` and `hoon/jams/` from your `vesl-nockup` checkout into your project to satisfy the dependency.

## `cargo build` fails on `ibig` with "expected `UBig`, found `ibig::ubig::UBig`"

vesl-core's transitive `vesl-signing` dep declares `ibig = "0.3"` from crates.io while vesl-core's signing module uses the nockchain-vendored `ibig`. Same upstream code, but Cargo treats the two as distinct crates and signing.rs fails to type-check.

If you scaffolded from the `vesl` template (see [Get started](/setup/quickstart)), vesl-graft's `[[patches]]` already added the necessary `[patch.crates-io]` block to your `Cargo.toml` — this error means you ejected the patches (`nockup patches eject zkvesl/vesl-graft`), declined the y/N prompt during `nockup project init`, or are adding vesl to an existing nockup project that doesn't pull vesl-graft. In any of those cases, add the patch manually using the same nockchain rev your other deps resolve to (visible in `nockapp.lock` or `Cargo.lock`):

```toml
[patch.crates-io]
ibig = { git = "https://github.com/nockchain/nockchain.git", rev = "<NOCK_PIN>" }
```

A path form (`path = "../../nockchain/crates/nockvm/rust/ibig"`) works equivalently if you have a sibling `nockchain/` checkout. Whichever shape you pick, the source must match what the rest of your nockchain crates resolve to — Cargo will not unify two different sources.

## `Number is greater than DIRECT_MAX` panic

A `u64` you're feeding into `D()` has its top bit set. Use `nock_noun_rs::atom_from_u64(slab, value)` instead of `D(value)` for hashed IDs, hull IDs, and any wide integer. All vesl-core poke builders already route hull-ids through `atom_from_u64` internally; this only bites when you're hand-rolling causes. See [Build / Hull — hand-rolled causes](/build/hull#hand-rolled-causes).

## `%settle-note` returns no effects, stderr shows `DETERMINISTIC error mote=Exit`

The verify gate returned `%.n`. The `?>` in `lib/settle-graft.hoon`'s `%settle-note` arm crashes on gate failure by design — a rejected payload must remain an unprovable STARK state rather than an emitted error. From the Rust side, `app.poke(...).await` resolves `Ok(effects)` with `effects.len() == 0`; treat that as a gate rejection and inspect stderr for the `mule`-trace.

The most common cause is committing multiple leaves with the default single-leaf hash gate. Switch to `manifest-verify` via `[graft.gates]` if your payload has multiple leaves, or replace the gate body. See [Build / Kernel — replacing a verification gate](/build/kernel#replacing-a-verification-gate).

## Poke resolves `Ok(vec![])` and stderr shows `slog: invalid cause [%<tag> ...]`

The hull emitted a cause-tag the kernel's `+$ cause` union doesn't accept, so `(soft cause)` returned `~` and the wrapper short-circuited before any arm ran. The bracketed `[%<tag> ...]` is the cord-decoded head of the rejected cause; the trailing `(full: <noun>)` is the complete cell. If the head shows `%unknown`, the cause was either an atom or a cell whose head is itself a cell — both are malformed shapes for `[%tag args...]` causes.

Common causes:

- Typo in the hull-side bytestring.
- Kernel rename without a corresponding hull update.
- New graft installed but the kernel hasn't been re-composed with `graft-inject inject --apply`.

To catch this at compile time, use `assert_kernel_cause_tag!` — see [Build / Hull — drift detection](/build/hull#hull-kernel-drift-detection).

## Peek returns `~` on what looks like a valid path

`settle-graft`'s peek paths are **namespaced**: `[%settle-registered hull ~]`, `[%settle-noted note-id ~]`, `[%settle-root hull ~]`, `[%settle-epoch ~]`, `[%settle-count ~]`. Older unprefixed forms (`%registered`, `%settled`, etc.) are retired. Rust callers going through `vesl-core::build_*_peek_path` are unaffected; the helpers construct the namespaced shape.

If your manual peek path uses an old form, update it to the `%settle-*` prefix — or use the helper.

## `out.jam` changed but graft-inject reported nothing

A comment-only or whitespace edit in a transitively-parsed `.hoon` library (anything under `hoon/lib/`, including helpers like `domain-patterns.hoon` that no marker imports directly) can shift `out.jam` even when graft-inject's per-graft summary reports `injected 0/N; skipped` across the board. The cause is hoonc-side, not graft-inject — something position-sensitive in the source bleeds into the jammed output. graft-inject is **manifest-keyed**: it re-injects only when a `<graft>.toml` digest changes, so library `.hoon` edits slip past it.

If you need byte-stable `out.jam`, treat any `.hoon` edit as material — bump the corresponding `.toml`'s body to force a re-inject pass, even if you intended only a comment.

## Distinguishing denial paths

A write that doesn't land emits `Ok(vec![])` from `app.poke().await?` — and that surface is shared across four denial paths. Picking the right remediation requires reading more than the effect list:

| Denial path | Where it fires | Effect list | Stderr | Recovery |
|---|---|---|---|---|
| Gate clean-deny | Hoon `?>` deterministic Exit (e.g. `set-membership-verify` returns `%.n`, `sig-verify-schnorr` finds an invalid signature) | `vec![]` | `mule`-trace dump (~30 lines) starting at `<gate-graft>.hoon::[…]` | Cause was rejected by policy; user must re-submit with valid input. |
| Gate crash | Gate panicked inside `mule`; settle-graft wraps the crash | `[%settle-error msg='settle-graft: verify gate crashed']` | (no extra) | Gate has a bug; investigate the gate body or the data shape. |
| Pre-gate failure | Replay (note-id reused) or root mismatch | `[%settle-error msg='<reason>']` | (silent) | Poke was rejected before reaching the gate; check note-id uniqueness or registered-root match. |
| Rbac denial | Orchestrator-side: `[%rbac-has-perm pubkey perm ~]` peek returned `false`; the poke was never sent | `vec![]` (hull-side) | (silent) | Acting pubkey lacks the required perm; grant first or reject the request. |

**Hull-side discipline**: log every rbac decision before the poke split so post-hoc audit shows which layer denied. Stderr alone distinguishes gate-deny from rbac-deny; only the hull knows whether the poke was sent at all.

**Multi-graft caveat.** In kernels with ≥10 active grafts, the `mule`-trace dump on gate clean-deny can be large enough to terminate the hull process after the poke returns. Treat gate clean-deny as terminal for the kernel session in multi-graft deployments — restart the kernel rather than continuing.

## Kernel-died — the spawned task panicked or returned an error

`vesl-test watch` prints a `kernel-died: <reason>` row when the spawned `app.run()` task fails, instead of crashing itself. Reach for `watch` over `inspect peek` any time you can't tell from a bare poke return whether the kernel saw what you sent. The cause goes on the wire and the effect-list is structured. See [Build / Testing — watch](/build/testing#watch-live-trace-repl).

## Snapshot recovery — schema mismatch on resume

`vesl-checkpoint::resume()` works for **same-composition** (the new kernel has the same graft set as the snapshot) and for **schema-extension** (the new kernel adds grafts the snapshot didn't have, handled by the codegen at the `nockup:load-defaults` marker). It does **not** work for graft removal or state-field reshape — the schema-migration helper is intentionally out of scope.

If you remove a graft or change a state field's shape, re-poke after resume to set up the desired state, or migrate state through a domain peek/poke round-trip before the recompile. See [Build / State & Snapshots — recomposition that requires manual migration](/build/state-snapshots#recomposition-that-requires-manual-migration).

## See also

- [vesl-nockup README — Troubleshooting](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#troubleshooting)
- [vesl-nockup README — Operator triage table](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/README.md#L875-L884) — the canonical 4-row denial-path table.
- [`test/vesl-test/src/lib.rs`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/test/vesl-test/src/lib.rs) — `inspect peek` and `watch` source.
