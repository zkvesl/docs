---
title: Common Pitfalls
description: Recognizable failure modes — what the symptom looks like, what's actually happening, and the fix.
outline: deep
---

# Common Pitfalls

Each entry leads with the symptom you'd see (or fail to see) at the terminal, then the cause, then the fix.

## `hoonc` Exits 0 but `out.jam` Is Missing

`hoonc` eager-parses every `.hoon` under `hoon/common/`, touching files there regardless of import-graph reachability. A type error in any of those files (including a library no marker imports directly) can leave hoonc with no panic message, exit 0, and no `out.jam` written. Without a check you walk into the next step against a stale kernel from the previous compile. The scaffold's `compile.sh` runs `hoonc` and then verifies the `out.jam` artifact, so it catches this:

```bash
./compile.sh
```

`nockup graft lint`'s [`transitive-imports`](/build/grafts/inject#transitive-imports) catches the unsatisfied-import subset of this class before hoonc runs. Wire it into CI ahead of compile to fail fast with a named target rather than a silent-fail.

For a structured alternative that also catches the "stale jam against edited sources" case, use `vesl-test verify-jam`. See [Build / Build & Run — verify-jam structured alternative](/build/build-run/#verify-jam-structured-alternative).

## `hoonc` Fails with `mint-lost` / `-lost %<tag>` on a Multi-Graft Compose

The composed `?-` over `-.u.act` isn't exhaustive — usually because one of the graft manifests is stale. Re-install vesl-graft (or re-run `sync.sh` in a dev checkout) to pick up the latest arm set. If the missing tag was renamed in a recent vesl release, re-syncing the manifest is the fix.

## `nockup graft inject` or `update` Errors with `manifest schema too new`

The graft library in `hoon/lib/` declares a `schema_version` newer than your installed `nockup-graft` understands. The composer refuses rather than mis-compose a schema it cannot model — see [CLI — `doctor`](/reference/cli#doctor) for the schema-version handshake.

Update the binary and re-run:

```bash
cargo install --git https://github.com/zkvesl/vesl-nockup --bin nockup-graft --force
```

## `hoonc` Fails with `missing dependency /jams/constraints-0-1.jam`

`forge-graft` pulls in the STARK prover tree, which depends on pre-jammed constraint tables. Copy `hoon/dat/` and `hoon/jams/` from your `vesl-nockup` checkout into your project to satisfy the dependency.

## `cargo build` Fails on `ibig` with "expected `UBig`, found `ibig::ubig::UBig`"

vesl-core's transitive `vesl-signing` dep declares `ibig = "0.3"` from crates.io while vesl-core's signing module uses the nockchain-vendored `ibig`. Same upstream code, but Cargo treats the two as distinct crates and signing.rs fails to type-check.

If you scaffolded from the `vesl` template (see [Get started](/setup/quickstart)), vesl-graft's `[[patches]]` already added the necessary `[patch.crates-io]` block to your `Cargo.toml` — this error means you ejected the patches (`nockup patches eject zkvesl/vesl-graft`), declined the y/N prompt during `nockup project init`, or are adding vesl to an existing nockup project that doesn't pull vesl-graft. In any of those cases, add the patch manually using the same nockchain rev your other deps resolve to (visible in `nockapp.lock` or `Cargo.lock`):

```toml
[patch.crates-io]
ibig = { git = "https://github.com/nockchain/nockchain.git", rev = "<NOCK_PIN>" }
```

A path form (`path = "../../nockchain/crates/nockvm/rust/ibig"`) works equivalently if you have a sibling `nockchain/` checkout. Whichever shape you pick, the source must match what the rest of your nockchain crates resolve to — Cargo will not unify two different sources.

## `cargo test` Fails with `unresolved import \`vesl_test\``

The `vesl` template wires `vesl-test` into `[dev-dependencies]` during `nockup project init`. If you're adding tests to a project that didn't go through that path, or you removed the entry, add it back manually:

```toml
[dev-dependencies]
vesl-test = { git = "https://github.com/zkvesl/vesl-nockup" }
```

See [Build / Testing — Rust Harness](/build/testing/harness) for what the harness exposes once the import resolves.

## `Number is greater than DIRECT_MAX` Panic

A `u64` you're feeding into `D()` has its top bit set. Use `nock_noun_rs::atom_from_u64(slab, value)` instead of `D(value)` for hashed IDs, hull IDs, and any wide integer. All vesl-core poke builders already route hull-ids through `atom_from_u64` internally; this only bites when you're hand-rolling causes. See [Build / Hull — hand-rolled causes](/build/hull#hand-rolled-causes).

## `%settle-note` Returns No Effects, stderr Shows `DETERMINISTIC error mote=Exit`

The verify gate returned `%.n`. The `?>` in `lib/settle-graft.hoon`'s `%settle-note` arm crashes on gate failure by design — a rejected payload must remain an unprovable STARK state rather than an emitted error. From the Rust side, `app.poke(...).await` resolves `Ok(effects)` with `effects.len() == 0`; treat that as a gate rejection and inspect stderr for the `mule`-trace.

The most common cause is committing multiple leaves with the default single-leaf hash gate. Switch to `manifest-verify` via `[graft.gates]` if your payload has multiple leaves, or replace the gate body. See [Build / Kernel — replacing a verification gate](/build/kernel/gates).

## `%settle-note` Clean-Denies After a `[graft.gates]` Swap

A root registered under one verification gate cannot be re-verified under another. After [swapping a gate](/build/catalog-gates/swapping), treat the new gate as a fresh hull — register a new root that matches the new gate's binding (`hash-leaf(pubkey)` for the signature gates, a multi-leaf Merkle root for `manifest-verify`, and so on). Old roots stay readable via `/status` and the kernel state, but any `%settle-note` against them under the new gate clean-denies through the same surface as the previous entry.

Register fresh roots after the swap; do not replay old notes against pre-swap roots.

## Poke Resolves `Ok(vec![])` and stderr Shows `slog: invalid cause [%<tag> ...]`

The hull emitted a cause-tag the kernel's `+$ cause` union doesn't accept, so `(soft cause)` returned `~` and the wrapper short-circuited before any arm ran. The bracketed `[%<tag> ...]` is the cord-decoded head of the rejected cause; the trailing `(full: <noun>)` is the complete cell. If the head shows `%unknown`, the cause was either an atom or a cell whose head is itself a cell — both are malformed shapes for `[%tag args...]` causes.

Common causes:

- Typo in the hull-side bytestring.
- Kernel rename without a corresponding hull update.
- New graft installed but the kernel hasn't been re-composed with `nockup graft inject --apply`.

To catch this at compile time, use `assert_kernel_cause_tag!` — see [Build / Hull — drift detection](/build/hull#hull-kernel-drift-detection).

## `%non-empty` validate-graft Rule Passes a Multi-Field Cause Through

The only validate-graft rule shape shipped in v0.1, `%non-empty`, checks whether the cause body `+.u.act` is exactly `~` (sig). It does not descend into multi-field cause bodies. A cause like `%registry-put key=@ payload=@` has `+.u.act = [key payload]`, a cell — `=(~ body)` is false, the rule passes, and the prelude lets the poke through to the `?-` switch even when you expected `%validate-rejected`.

For field-level validation against `key` or `payload`, you need a v0.2 rule shape (`length` / `in-set` / `range` / `unique-in` — reserved in the type union but not yet shipped). See [Library Catalog → Known Limits (v0.1)](/reference/library#known-limits-v0-1).

## validate-graft Rule Installed on an Unknown Cause-Tag Never Fires

The validate-graft prelude only runs after the kernel's soft-cast (`;;`) accepts the poke into the composed `+$ cause` union. A rule installed against a cause-tag *outside* that union — a typo, a graft that was removed but whose rules are still in state, a cause-tag from an un-injected graft — silently never fires. The soft-cast fails first, the kernel logs `invalid cause` and emits zero effects, and the prelude block doesn't get a chance to run.

From the hull side this is indistinguishable from a clean gate-deny: empty effects, no `%validate-rejected`, just `Ok(vec![])`. Confirm the cause-tag is in the composed `+$ cause` union before chasing the rule logic.

## Peek Returns `~` on What Looks Like a Valid Path

`settle-graft`'s peek paths are **namespaced**: `[%settle-registered hull ~]`, `[%settle-noted note-id ~]`, `[%settle-root hull ~]`, `[%settle-epoch ~]`, `[%settle-count ~]`. Older unprefixed forms (`%registered`, `%settled`, etc.) are retired. Rust callers going through `vesl-core::build_*_peek_path` are unaffected; the helpers construct the namespaced shape.

If your manual peek path uses an old form, update it to the `%settle-*` prefix — or use the helper.

## Peek Decoder Reads the Wrong Axis After `peek_handle`

`peek_loobean`, `peek_atom_u64`, and `peek_unit_list` decode the raw `(unit (unit *))` envelope that `app.peek(path)` returns. `app.peek_handle(path)` pre-unwraps the outer unit, so its result needs a different decoder (or a manual head/tail descent). The test-harness equivalents follow the same split: `harness.peek_slab` returns the raw envelope; `harness.peek_handle` returns the pre-unwrapped form.

Passing a `peek_handle` result into `peek_loobean` silently mis-types — no compile-time check, and the loobean read lands on the wrong axis. The [Peek Catalog](/reference/peek-catalog) marks each path's return shape; pick the decoder by matching the catalog row to the call site.

## `out.jam` Changed but `nockup graft` Reported Nothing

A comment-only or whitespace edit in a transitively-parsed `.hoon` library (anything under `hoon/lib/`, including helpers like `domain-patterns.hoon` that no marker imports directly) can shift `out.jam` even when `nockup graft inject`'s per-graft summary reports `injected 0/N; skipped` across the board. The cause is hoonc-side, not the composer; something position-sensitive in the source bleeds into the jammed output. `nockup graft inject` is **manifest-keyed**: it re-injects only when a `<graft>.toml` digest changes, so library `.hoon` edits slip past it.

If you need byte-stable `out.jam`, treat any `.hoon` edit as material — bump the corresponding `.toml`'s body to force a re-inject pass, even if you intended only a comment.

## `nockup graft inject` Warns `markers not found` but the Marker Comments Look Right

The composer enforces a two-space law: every anchor must be `::` + two spaces + `nockup:<name>`. A one-space variant is a plain Hoon comment to the matcher and is silently skipped; the per-graft summary then reports `warning — markers not found: <list>` because nothing matched.

```hoon
::nockup:imports    :: zero spaces, not matched
:: nockup:imports   :: one space, not matched
::  nockup:imports  :: two spaces, matched
```

Fix: insert the missing space. The rule is enforced by `MARKER_PREFIX` and the matcher in [`tools/graft-inject/src/marker.rs`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/tools/graft-inject/src/marker.rs#L142-L156).

## Distinguishing Denial Paths

A write that doesn't land surfaces as a typed [`vesl_core::PokeOutcome`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-core/src/poke.rs) — match on the variant to identify the denial path without scraping stderr:

| Denial path | Where it fires | `PokeOutcome` variant | Effect list | Recovery |
|---|---|---|---|---|
| Gate clean-deny | Verify-gate returns `%.n` (e.g. `set-membership-verify` rejects, `sig-verify-schnorr` finds an invalid signature). settle-graft catches the `%.n` and emits a typed `%settle-denied` effect. | `Rejected { reason: GateDenied { reason, raw_effects } }` | `[%settle-denied reason=@t]` | Cause was rejected by policy; user must re-submit with valid input. The `reason` cord identifies which gate denied. |
| Gate crash | Gate panicked inside `mule`; settle-graft wraps the crash. | `Rejected { reason: KernelError { cord, raw_effects } }` (cord = `'settle-graft: verify gate crashed'`) | `[%settle-error msg='settle-graft: verify gate crashed']` | Gate has a bug; investigate the gate body or the data shape. |
| Pre-gate failure | Replay (note-id reused), root mismatch, unregistered hull, malformed payload, capacity. | `Rejected { reason: KernelError { cord, raw_effects } }` | `[%settle-error msg='<reason>']` | Pre-gate guard rejected the poke; check note-id uniqueness, registered-root match, or payload shape per the cord. |
| Rbac denial | Hull-side: `[%rbac-has-perm pubkey perm ~]` peek returned `%.n`; the poke is never sent to the kernel. Enabled when `[rbac] enabled = true` is set in the hull's TOML config. | `Rejected { reason: RbacDenied { pubkey, perm } }` | (none — never reaches the kernel) | Acting pubkey lacks the required perm; grant first or reject the request. HTTP 403 from `/commit` and `/settle`. |
| Validate-prelude rejection | `poke-prelude` rule returned a `(unit @t)` failure for the cause before the arm ran. | `Accepted { effects }` with head `%validate-rejected` (the prelude emits a typed effect rather than a denial) | `[%validate-rejected cause-tag=@ta reason=@t]` | Cause failed an installed domain rule; inspect `reason` and either resubmit a different cause or update the rule via `%validate-init`. |

**Multi-graft caveat.** In kernels with ≥10 active grafts, a Hoon `?>` crash (e.g. from a custom graft that still uses the pre-typed-denial pattern) emits a `mule`-trace large enough to terminate the hull process. The typed `%settle-denied` path does not crash and is safe to continue against; treat any remaining `?>`-based deny as terminal for the kernel session and restart.

### Composing Three Denials: Stacked Admission

Three of the rows above can stack in one request path. A "stacked admission" graft composition layers them so the cheapest check fails first:

1. **Rbac peek** at the hull (peek-then-poke) — `Rejected::RbacDenied` if the caller lacks the perm; the poke is never sent. See [Hull → Peek-Then-Poke Gating](/build/hull#peek-then-poke-gating) for the orchestrator-side shape.
2. **Validate prelude** — emits `%validate-rejected cause-tag reason` (an `Accepted` outcome with that head tag) if installed rules reject `+.u.act`. Runs for every poke including graft-injected ones; see [Grafts → Inject → Cause Dispatch Semantics](/build/grafts/inject#cause-dispatch-semantics).
3. **Verification gate** — `Rejected::GateDenied { reason }` on a clean-deny (`%settle-denied`), `Rejected::KernelError { cord }` on a gate crash (`%settle-error`).

A request that fails at layer 1 yields `Rejected::RbacDenied` from the hull — the kernel is never poked. A request that passes layer 1 but fails layer 2 yields `Accepted { effects: [%validate-rejected …] }`. A request that passes both but fails the gate yields the gate's typed `Rejected` variant per the table above.

The order matters for two reasons: (a) cheaper checks first avoids paying for the expensive gate evaluation when the caller wasn't authorized anyway; (b) each layer emits a distinct `PokeOutcome` variant so a test harness or operator can route on the typed match without scraping logs.

For tests that want to narrow further than the top-level `PokeOutcome` — e.g. assert specifically that settle's gate-deny carries the expected reason cord, or that counter-graft saturated rather than hit some other error — the harness ships per-graft extension traits (`SettleOutcomeExt::as_settle_outcome`, `CounterOutcomeExt::as_counter_outcome`, ...) that route by the `<graft>-graft:` cord prefix and decode into a typed `<Graft>Outcome` enum. See [Harness → Typed Per-Graft Methods](/build/testing/harness#typed-per-graft-methods).

## Kernel-Died — The Spawned Task Panicked or Returned an Error

`vesl-test watch` prints a `kernel-died: <reason>` row when the spawned `app.run()` task fails, instead of crashing itself. Reach for `watch` over `inspect peek` any time you can't tell from a bare poke return whether the kernel saw what you sent. The cause goes on the wire and the effect-list is structured. See [Build / Testing — watch](/build/testing/cli#watch-live-trace-repl).

## Snapshot Recovery — Schema Mismatch on Resume

`vesl-checkpoint::resume()` works for **same-composition** (the new kernel has the same graft set as the snapshot) and for **schema-extension** (the new kernel adds grafts the snapshot didn't have, handled by the codegen at the `nockup:load-defaults` marker). It does **not** work for graft removal or state-field reshape — the schema-migration helper is intentionally out of scope.

If you remove a graft or change a state field's shape, re-poke after resume to set up the desired state, or migrate state through a domain peek/poke round-trip before the recompile. See [Build / State & Snapshots — Manual Migration](/build/state-snapshots#manual-migration).

## Custom Route Skips Auth / Rate-Limit After `Router::merge`

`Router::merge(vesl_hull::router(state), my_routes)` looks symmetric but silently drops the middleware stack on the merged-in routes: axum's flat merge attaches your routes outside the layer set already applied to the hull's router. The custom route answers without API-key auth, without the body-size limit, and outside the rate-limit budget — none of which surfaces as an error.

Use `vesl_hull::serve_with_extra_routes` or `vesl_hull::router_with_extra` instead, so the auth, body-limit, and rate-limit layers wrap the final Router. See [Build & Run / Serve — Composing Custom Routes](/build/build-run/serve#composing-custom-routes).

## High-Throughput Latency on queue-graft / batch-graft

Both grafts back their pending list with Hoon's standard list `snoc`, which is O(n) per append. A queue or batch holding `k` pending items pays `O(k)` for the `k+1`-th push.

The symptom: linear-then-quadratic latency growth on bulk pushes. A test that pushes 100 jobs runs fine; 1k jobs starts to crawl; 10k jobs hits a multi-second cliff per push. The hard cap (`pending-cap = 10_000_000` on both grafts) bounds the worst case but doesn't help a workload that hits the cliff well before it.

The mitigation in v0.1 is operational: drain the queue (or flush the batch) regularly so `k` stays small. For batch, set `threshold` to the largest bundle size you can settle in one go — flushing fires automatically on the threshold-th add. For queue, pop in lock-step with push.

A switch to an O(1)-append structure (gap-buffer, deque-of-chunks, or a list-with-tail-pointer) is v0.2 work.

::: info See Also

- [vesl-nockup README — Troubleshooting](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#troubleshooting) — upstream troubleshooting table.
- [vesl-nockup README — Operator triage table](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/README.md#L875-L884) — the canonical 4-row denial-path table.
- [`test/vesl-test/src/lib.rs`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/test/vesl-test/src/lib.rs) — `inspect peek` and `watch` source.

:::
