# Round-2 three-profile docs vet

Date: 2026-05-12
Method: paper-run each of three DOGFOOD profiles using **only** `~/projects/zkvesl-docs/docs/`. No READMEs, codebase internals, or memory consulted while vetting.
Profiles chosen for spread:

- **Profile A — Commitment Trio** (settle + mint + guard; family 1 only; baseline)
- **Profile E — Gate-Selected Settlement** (settle + mint with `[graft.gates]`; families 1 + 2)
- **Profile J — Permissioned Manifest-Verified Vault** (10 grafts; every shipped family)

Each finding is tagged. Severity hints which gate it would fail at: `BUILD` blocks compile; `RUN` blocks driving the kernel; `INTERPRET` blocks understanding the result; `META` is doc hygiene.

Tags:
- **DOC-GAP** — needed info isn't anywhere in zkvesl-docs.
- **DOC-DISCREPANCY** — two pages disagree, or a page contradicts a worked example.
- **DOC-STALE** — page references a removed/renamed symbol or out-of-date claim.
- **FACTUAL-CORRECTION** — claim is wrong on its own terms.

---

## Cross-cutting findings (hit every profile)

### DOC-DISCREPANCY · Marker count: "9" vs "10" in two injection-report samples · INTERPRET

`docs/build/inject.md:31` and `:150` both say **10** markers in source. `docs/reference/cli.md:61` shows a sample report with **9** markers in source, enumerating only `imports, state, cause, poke-prelude, poke, poke-postlude, peek, domain-effect, effect-union` — `load-defaults` is missing from cli.md's list. `docs/build/anatomy.md:94-114` and `docs/build/grafts.md:72-83` both define 10 markers (7 content + 3 codegen). Either the cli.md sample drifted (`load-defaults` was forgotten in the count) or the composer actually emits "9" and the other pages are wrong. The user walks away unsure how many markers their kernel should have.

### DOC-GAP · `nockup graft list` plain-text output format is never shown · INTERPRET

`docs/build/inject.md:122` and `docs/reference/cli.md` mention `nockup graft list` as the discovery command and document the `--json` schema (cli.md:84), but no doc shows what the plain-text table looks like. A developer following any profile is told to "see what's installed" without a reference for what they should see. The DOGFOOD prompt expects a table with priority + blocks columns; the docs don't tell readers what to compare against.

### DOC-GAP · No comprehensive `build_<graft>_<verb>_poke` table · BUILD

`docs/going-deeper/vesl-core.md:72` enumerates a partial list (one builder per graft in most cases): `build_kv_set_poke, build_counter_inc_poke, build_log_append_poke, build_queue_push_poke, build_rbac_grant_poke, build_registry_put_poke, build_validate_init_poke, build_clock_tick_poke, build_batch_add_poke`. `docs/build/testing.md:154` says "Each graft's full builder and effect-tag list is in its rustdoc." But:

- No rustdoc URL is anywhere in the docs.
- Most grafts have multiple verbs (e.g. counter has `increment` / `reset` / `set`; rbac has `grant` / `revoke`; queue has `push` / `pop` / `clear`; batch has `init` / `add` / `flush`; registry has `put` / `update` / `del`; kv has `set` / `delete`; validate has `init` / `clear`). Only one verb per graft appears in any doc.
- `docs/build/hull.md:55` repeats the same partial list with "etc."

Profile A needs `build_mint_commit_poke, build_guard_register_poke, build_guard_check_poke, build_settle_verify_poke` — none of which are named anywhere in zkvesl-docs. Profile J needs at minimum a dozen builders the docs don't enumerate.

The convention paragraph at `docs/build/testing.md:154` (`build_<graft>_<verb>_poke`, effect-tag is `<graft>-<verb-past-tense>`) helps for the happy path but doesn't cover failure-effect tags (`%mint-error`, `%settle-error`, `%registry-error`) or the 6 settle-note gate variants.

### DOC-GAP · `Guard` Rust API has zero usage examples · BUILD

`docs/welcome/what-is-vesl.md:55-56` and `docs/going-deeper/vesl-core.md:17-22` describe `Guard` as "verify those proofs locally, before sending anything to the kernel." Grep across `docs/**/*.md` finds **zero** examples of `Guard::new()`, `Guard::verify(...)`, or any Guard method call. `Mint` is shown a handful of times (`Mint::new()`, `mint.commit(&[b"first"])`); `Guard` is named only.

A Profile A run needs Guard to construct or check proofs against a registered root (the leaf-inclusion check before settling), and Profile E with `manifest-verify` needs Guard to produce the Merkle proof that the multi-leaf gate expects. Without an API example the developer has to read source.

### DOC-GAP · No rustdoc URL anywhere · BUILD / INTERPRET

Multiple pages punt to "the rustdoc" (`docs/build/testing.md:154`, `docs/going-deeper/vesl-core.md:12`) but no doc gives a URL, `cargo doc --open` instruction, or hosted-docs link. Readers are sent to read source at GitHub permalinks instead, which is slower than rustdoc.

### DOC-GAP · `vesl-test` CLI binary install path is not documented · RUN

`docs/build/testing.md:225-281` documents three CLI subcommands of a `vesl-test` binary (`inspect peek`, `watch`, `verify-jam`). The Rust library installs via `[dev-dependencies] vesl-test = { git = ... }` per `docs/troubleshooting/common-pitfalls.md:48-50`, but that gives you the **library**, not the CLI. The docs never show how to install the `vesl-test` binary on `$PATH` (no `cargo install --git ... --bin vesl-test`, no script). `docs/setup/quickstart.md:53` verifies `nockup-graft --version` in the toolchain check but doesn't mention `vesl-test`.

### DOC-GAP · `vesl-checkpoint` Cargo dep declaration not shown · BUILD

`docs/build/state-snapshots.md:41` starts a Rust example with `use vesl_checkpoint::{snapshot, resume};`. There's no `Cargo.toml` snippet anywhere showing how to declare the dep. `docs/going-deeper/vesl-core.md:58-59` lists `vesl-checkpoint` as a sibling crate of `vesl-core` but doesn't say whether it's re-exported through `vesl-core` or needs its own entry in `[dependencies]`.

### DOC-GAP · `nockapp.toml` schema is not in the Reference section · META

`docs/reference/vesl-toml.md` documents runtime `vesl.toml`. `nockapp.toml` (the scaffold-time manifest with `template`, `template_git`, `template_path`, `template_commit`, `[dependencies]`) is shown only via the `cat > nockapp.toml <<TOML` example in `docs/setup/quickstart.md:62-74` and a brief troubleshooting note. There is no canonical schema reference for nockapp.toml fields, validation rules, or what `nockup project init` does with each field.

### DOC-DISCREPANCY · `build.rs`: "no-op" vs "runs codegen kernel-cause-tags" · BUILD

`docs/build/anatomy.md:123` shows the project layout with `build.rs # no-op (hoonc runs in Step 4)`. `docs/build/hull.md:87` and `docs/reference/cli.md:20` both state that `build.rs` runs `nockup graft codegen kernel-cause-tags` after hoonc, emits `KERNEL_CAUSE_TAGS_PATH` to `OUT_DIR`, and is the basis for compile-time hull/kernel drift detection. A reader of anatomy.md will assume build.rs is empty; the hull.md section then references machinery anatomy.md said doesn't exist.

### DOC-GAP · Two-space marker law has no negative example · BUILD

`docs/build/grafts.md:70` states the two-space law (`::` then exactly two spaces then `nockup:<name>`). `docs/build/inject.md` references it but doesn't show what a violating comment looks like or how the composer reports it. The DOGFOOD prompt warns this is a common scaffold-time miss; the docs document the rule but not its failure mode beyond the generic "markers not found: <list>" warning at cli.md:167.

### DOC-STALE · `docs/troubleshooting/common-pitfalls.md:96-101` denial table omits `%validate-rejected` · INTERPRET

The "Distinguishing Denial Paths" table covers four paths: gate clean-deny, gate crash, pre-gate failure, rbac denial. It does **not** include validate-graft's prelude rejection (`%validate-rejected`), which is the canonical Family-4 denial. For Profile C/I/J, the developer who composes validate-graft will see a fifth denial shape the table doesn't cover. The page elsewhere (`docs/build/anatomy.md:104` and `docs/reference/graft-manifest.md:73`) names validate-graft as the prelude consumer.

### DOC-GAP · "Three admission checks stacking" pattern not documented · INTERPRET

Profile H/J combine rbac (orchestrator-side perm check) + validate (prelude in-kernel) + gate (in settle's poke body). Each check can independently deny a write. The order is fixed (rbac → validate → gate) but the docs don't walk through the layered shape: which effect/silence/stderr the hull sees in each of the eight pass/deny combinations. The `docs/troubleshooting/common-pitfalls.md` table covers paths in isolation, not the stack.

### DOC-GAP · gate-chain semantics undefined · INTERPRET

`docs/reference/graft-manifest.md:103` shows `gate-chain = ["sig-verify-schnorr", "manifest-verify"]` and labels it "a chain of gates evaluated in order." Order isn't enough. Is it AND (every gate must accept)? OR (first acceptance wins)? Short-circuit on first deny? What effect tag fires when chain-element-2 denies vs. when chain-element-1 denies? The DOGFOOD profile catalog tests single-gate selection in Profile E but a developer reading graft-manifest.md would expect chains to work and have no semantic anchor.

### DOC-GAP · Catalog-gate driving guide explicitly punted to external README · BUILD / RUN

`docs/going-deeper/vesl-core.md:78` says:

> The vesl-nockup README's "Drive a catalog gate from Rust" section walks the Schnorr signing flow end-to-end (build a payload, sign, hash via tip5, register the root, settle a note that pre-commits to the signed payload).

For a developer using only zkvesl-docs, **this is a hard stop**. The whole end-to-end gate-driving workflow lives in an external README. Profile E is unrunnable without it. Either mirror the walkthrough into a new page (e.g. `docs/build/gates.md`) or copy the relevant section into `docs/build/kernel.md`'s gate-replacement section.

### DOC-GAP · `signing.rs` API not exposed in docs · BUILD

`docs/going-deeper/vesl-core.md:87` names the file and labels it "Schnorr key derivation, Ed25519 signature helpers." No function signatures, no examples, no `use` line. A developer attempting Profile E needs to sign a payload from Rust; the docs name the crate path and stop.

### DOC-GAP · `hoon/common/` install contents not enumerated for non-forge profiles · BUILD

`docs/build/grafts.md:42-52` shows `hoon/common/` containing `zeke.hoon` and `ztd/` (8 files), and says forge "additionally pulls in" `hoon/common/v0-v1/`, `v2/`, `stark/`, `hoon/dat/`, `hoon/jams/`. But:

- The full-catalog install path described in `docs/setup/quickstart.md:75-83` does not say whether it installs forge or skips it.
- If install is wholesale (it appears to be), forge's prover tree lands on every project even when the user excludes forge from `nockup graft inject`. Is this expected? Does it bloat builds?
- Conversely, a "no forge" install path isn't described anywhere — the developer who never wants STARK proofs has no documented way to skip the 16 MB prover tree at install time.

The DOGFOOD prompt has explicit slim-cp instructions that aren't (and shouldn't be) in the docs, but the docs should at least state which path the package install takes.

### DOC-GAP · `hoonc` eager-parse semantics surface only in passing · BUILD

`docs/build/inject.md:137` describes the `transitive-imports` lint by noting "hoonc eager-parses `hoon/common/` regardless of import-graph reachability, and unsatisfied edges there leave hoonc exit 0 with no `out.jam`." That's the only place in the docs that the eager-parse semantics are stated. The "silent-fail" troubleshooting entry at `docs/troubleshooting/common-pitfalls.md:11-20` and the `[ -s out.jam ]` guard described at `docs/build/build-run.md:29-33` both reference the symptom but not the cause. For developers who hit a silent-fail on what looks like an unused library, the answer ("eager-parse touches everything under `hoon/lib/` and `hoon/common/`") should be in the build-run page, not buried in the lint description.

---

## Profile A — Commitment Trio (settle + mint + guard)

### DOC-GAP · `build_mint_commit_poke`, `build_mint_*` family · BUILD

`docs/build/kernel.md:168` cites `build_mint_commit_poke` as an example of one builder. Nothing else: no signature, no other mint cause builders, no `%mint-error` failure path. Profile A asks the developer to drive `%mint-committed` and `%mint-error` on re-commit; the docs name the success effect (via the `<verb-past-tense>` convention) but not the error effect or its builder. **Affects every commitment-family profile.**

### DOC-GAP · `build_guard_*` family entirely absent · BUILD

Grep across `docs/**/*.md` finds zero references to `build_guard_register_poke`, `build_guard_check_poke`, or any guard-related builder. Profile A needs both. The closest is `docs/welcome/what-is-vesl.md:68-69`: "`guard-graft` — publish a root and check whether items belong to it." Conceptually present, builder-name absent.

### DOC-GAP · `Tip5Hash` type origin and shape · BUILD

`docs/build/hull.md:46` shows `use vesl_core::{Mint, Tip5Hash, ...}; let root: Tip5Hash = mint.commit(&[b"first"]);`. The type is named, never described. Is it a newtype around `[u8; 32]`? Around `[u8; 20]` (Profile A might pass `&root_bytes[..]` per `docs/build/state-snapshots.md:69` — what does that slicing operation produce?). For a Profile A developer asserting on a re-fetched root from a peek, the byte width and accessor API matter.

### DOC-GAP · Single-leaf hash gate inputs not specified · BUILD

The default gate is described at `docs/build/inject.md:155-156` and `docs/build/anatomy.md:86` as "tip5-hashes the raw payload and checks equality against the registered root." But what is "the raw payload" from Rust's perspective? `&[u8]`? Is `build_settle_note_poke(note_id, hull, &root, b"payload")` the right call? Hull.md:52 shows it with that shape but doesn't tie back to the gate semantics. The Profile A `%settle-verified` step needs to commit, register, and verify with consistent bytes; the contract between the Rust caller and the kernel gate isn't spelled out.

### DOC-GAP · `%settle-verified` vs `%settle-noted` distinction · INTERPRET

Profile A's "Effects to verify" list includes both `%settle-verified` and `%settle-noted`. The docs treat these as distinct settle outputs (testing.md's standard-suite table at line 71-77 distinguishes the two: verify is "fresh note-id, hull A, root → %settle-verified"; note is "fresh note-id, hull B, root → %settle-noted"). But the conceptual distinction — what semantic difference between "verified" and "noted" — isn't anywhere in the docs. `docs/setup/quickstart.md:128-130` walks `%settle-registered` and `%settle-noted` only. A new reader sees three settle effects and no clear delta among them.

---

## Profile E — Gate-Selected Settlement

### DOC-GAP · `[graft.gates]` scope: which commitment grafts support it · BUILD

`docs/reference/graft-manifest.md:90-94` says "Commitment grafts (`settle-graft` is the canonical example) accept a verification gate as a parameter." `docs/build/inject.md:62-64` shows the `mint-graft.toml` example with `[graft.gates] gate = "sig-verify-schnorr"`. So `mint-graft` is also gate-configurable? Or is the inject.md example illustrative-only and only settle supports it in practice? Profile E says "settle-graft, mint-graft with a `[graft.gates]` block in settle-graft.toml" — does mint need its own block or does it inherit settle's?

### DOC-GAP · `build_settle_note_*_poke` per-gate signatures · BUILD

`docs/build/testing.md:94-99` lists six builders by name and gate type, but for each the only guidance is "pass its gate-specific arguments (e.g., signature and pubkey for Schnorr, Merkle proof for manifest)." No argument list, no struct shape, no example. Profile E needs to call `build_settle_note_schnorr_poke` and provide the right shape; the docs don't show what that shape is.

### DOC-GAP · How to produce a `manifest-verify`-shaped payload · BUILD / RUN

For `manifest-verify` gate, the payload must include a Merkle proof against the registered root. The Rust API to construct such a proof (via `Mint` and/or `Guard`) is undocumented. The DOGFOOD prompt mentions `Mint`/`Guard` as the Rust-side primitives for off-kernel Merkle-tree construction, but the docs only show `mint.commit(&[b"first"])` (root) — not proof generation.

### DOC-GAP · Gate selection swap workflow lacks an end-to-end example · RUN

`docs/reference/graft-manifest.md:106-107` says "Selecting a different gate at any point — including mid-project — and re-running `nockup graft inject --apply` re-injects the new gate body; the composer detects manifest drift via the sha256 in each begin-banner." This sounds clean but doesn't walk the developer through:

- The list of effects that change shape on swap (does `%settle-verified` payload differ between ed25519 and Schnorr?).
- The hull-side builder that must swap in tandem (e.g., `build_settle_note_poke` → `build_settle_note_schnorr_poke`).
- Whether existing registered roots remain valid under the new gate.

Profile E's "swap the gate mid-round" instruction needs this workflow documented.

### FACTUAL-CORRECTION · "`mint-graft.toml` omits `[graft.gates]`" attribution · META

`docs/build/inject.md:104` reads: "The shipping `mint-graft.toml` omits `[graft.gates]` (it relies on the default hash gate)." Reading this paragraph alongside `docs/build/inject.md:62-64` (which shows mint-graft.toml *with* `[graft.gates]`), the developer is told the example is hypothetical. Fine, but the page should make that hypothetical explicit at the top of the example block, not at the bottom in a sentence the reader might miss. Also: if `mint-graft` doesn't actually support `[graft.gates]` (a real question — see the scope DOC-GAP above), this paragraph is misleading rather than illustrative.

---

## Profile J — Permissioned Manifest-Verified Vault (10 grafts)

### DOC-GAP · `rbac-graft` integration walkthrough · BUILD / RUN

`docs/welcome/what-is-vesl.md:75` describes rbac as "public-key role and permission table." `docs/troubleshooting/common-pitfalls.md:97` mentions the `[%rbac-has-perm pubkey perm ~]` peek pattern. That is the **entirety** of zkvesl-docs's rbac coverage. Missing:

- Pubkey type — is it `Tip5Hash`, `[u8; 32]`, `&[u8]`? How does the hull derive it?
- Perm type — `@tas`? Free-form `&str`?
- How to grant: `build_rbac_grant_poke(pubkey, perm)` signature.
- How to revoke; what `auto-clear assertion` (DOGFOOD's term) means concretely.
- How the in-kernel rbac arm vs. the orchestrator-side peek pattern compose.

Profile B/H/J are unrunnable without this.

### DOC-GAP · `validate-graft` rule installation API · BUILD / RUN

`docs/going-deeper/vesl-core.md:72` mentions `build_validate_init_poke` and `docs/build/anatomy.md:104` and `docs/build/grafts.md:97` confirm validate runs as a prelude. **Nowhere** is the `ValidateRule` type defined, its variants (`%non-empty` and the deferred others) listed, or the call shape shown. Profile C, I, and J all need `%validate-init` to install a rule before any test fires.

### DOC-GAP · `%validate-rejected` effect and its place in the denial-paths table · INTERPRET

The "Distinguishing Denial Paths" table at `docs/troubleshooting/common-pitfalls.md:92-99` enumerates four denial paths but not the prelude rejection. For Profile J's three-stack admission check, the developer cannot disambiguate "rbac denied (no poke sent)" from "validate-prelude rejected (poke sent, %validate-rejected effect emitted)" from "gate clean-denied (poke sent, vec![] returned, mule trace on stderr)." The docs lay out three of the five but call it complete.

### DOC-GAP · 10-graft namespace audit guidance · INTERPRET

Profile J's headline test is "do effect/cause/peek/state names collide across 10 grafts in one kernel?" `docs/build/inject.md:136` mentions the `collision-check` lint catches duplicate cause-tag and state-field names. The doc does not say:

- Whether the lint catches peek-path-head collisions.
- Whether effect-tag collisions are checked (effect tags are graft-prefixed in convention, but the lint coverage isn't stated).
- What the lint output looks like in a real 10-graft composition — neither the lint output sample nor a worked 10-graft `nockup graft list` table exists.

### DOC-GAP · Mint-committing-over-other-graft-state pattern · BUILD

Profile J's `%snapshot` cause commits a Merkle root over `registry-graft`'s state (the vault map). This requires the kernel domain arm to:

1. Read the current registry state.
2. Serialize/jam each entry into a leaf.
3. Hand the leaf list to mint via `%mint-commit`.

`docs/build/kernel.md` walks adding a domain cause and "Coordinating Multiple Grafts in One Arm" (a 3-graft fanout pattern). It does not walk "domain arm reads graft state and commits a root over it." This is a non-trivial pattern that Profile J requires — cross-graft pattern that goes beyond the documented examples.

### DOC-GAP · "Snapshot temporal-staleness" semantics · INTERPRET

The DOGFOOD prompt cautions: "the mint root reflects vault state at flush-time, not query-time." For Profile J this is core to understanding what `%guard-checked` answers (against which version of the registry?). The docs make no reference to the temporal-staleness window introduced by snapshotting state via mint, nor how a Profile J operator should reason about it.

### DOC-GAP · `build_batch_init_poke`, `build_batch_flush_poke` · BUILD

Only `build_batch_add_poke` is named in `docs/going-deeper/vesl-core.md:72`. Profile J uses `%batch-init` (to set a threshold) and ultimately consumes a `%batch-flushed` effect. The init builder is absent from the docs. Same issue for `build_validate_clear_poke`, `build_queue_pop_poke`, `build_queue_clear_poke`, `build_counter_reset_poke`, `build_counter_set_poke`, `build_rbac_revoke_poke`, `build_registry_update_poke`, `build_registry_del_poke`, `build_kv_delete_poke` — all needed by some profile in the catalog, none enumerated.

### DOC-GAP · `[%rbac-has-perm pubkey perm ~]` peek path builder · BUILD

`docs/troubleshooting/common-pitfalls.md:97` names the path shape but doesn't say which builder produces it. The three peek-path builder helpers in `docs/build/testing.md:166-170` (`build_keyless_peek_path`, `build_hull_peek_path`, `build_keyed_peek_path`) don't obviously cover the two-arg shape `[%tag pubkey perm ~]`. Either there's a fourth builder (undocumented), or the developer must hand-roll a path noun (the techniques in `docs/build/hull.md:124-141` cover hand-rolled causes but not peek paths).

### DOC-GAP · Mule-trace dump location and parsing · INTERPRET

`docs/troubleshooting/common-pitfalls.md:94` describes "`mule`-trace dump (~30 lines) starting at `<gate-graft>.hoon::[…]`" for gate clean-deny. Where does this dump land — stderr of the hull, the kernel's slog channel, a separate trace file? Profile J relies on the trace to distinguish gate-deny from rbac-deny. The docs name the dump but don't tell the developer where to look for it or how to capture it programmatically.

### DOC-DISCREPANCY · `≥10 grafts terminates the driver` is in two places with different framings · META

`docs/troubleshooting/common-pitfalls.md:100-101` ("Multi-graft caveat") says ≥10 active grafts can produce a mule-trace large enough to terminate the hull. Same warning appears nowhere else, including `docs/build/anatomy.md` which is where a developer wiring 10 grafts would first arrive. For a Profile J–scale composition, the warning belongs near the composition guidance, not only in the troubleshooting page.

---

## Stage-by-stage summary across all 3 profiles

| Stage | Profile A | Profile E | Profile J |
|---|---|---|---|
| 0 — Environment | ✓ covered (quickstart Prereqs) | ✓ | ✓ |
| 1 — Scaffold (nockup project init) | ✓ covered (quickstart §1) | ✓ | ✓ |
| 2 — Install vesl-graft package | ✓ covered (quickstart §1 + grafts.md) | ✓ | ✓ but full hoon/common contents unclear |
| 3 — `nockup graft list` | partial (no output sample) | partial | partial |
| 4 — `nockup graft inject` | ✓ covered | partial ([graft.gates] scope unclear for mint) | partial (10-graft sample missing) |
| 5 — `hoonc` | ✓ covered (guard + verify-jam) | ✓ | ✓ |
| 6 — Domain Hoon | ✓ kernel.md walks the badge example | partial (signed-payload shape missing) | gap (cross-graft root-over-state pattern undocumented) |
| 7 — Build Rust driver | **gap** (`build_mint_*`, `build_guard_*` absent) | **major gap** (gate-driving guide punted to external README; signing API unshown; per-gate builder signatures missing) | **major gap** (rbac, validate, batch sub-verbs all absent) |
| 8 — Drive primitives | partial (mint/guard effect tags not in docs) | gap (gate-deny / gate-crash distinction unclear past stderr) | gap (3-stack admission denial-paths only partially covered; %validate-rejected missing from denial table) |

---

## Priorities

If round-3 docs work picks the top 5 to scrub before another vet:

1. **Catalog-gate driving guide** — fold the punted vesl-nockup-README section into `docs/build/kernel.md` (gate-replacement subsection) or a new `docs/build/gates.md`. Without this, half the gate profiles (E, H, J) are unrunnable from zkvesl-docs alone.

2. **Per-graft cause/effect/builder reference** — one canonical table (probably in `docs/reference/`) enumerating every shipped graft's cause tags, effect tags (success + error), and `build_*_poke` signatures. Either inline in the docs or a hosted-rustdoc URL. Affects every profile.

3. **rbac-graft and validate-graft integration walkthroughs** — currently both grafts are named in the family tables but have no usage page. Add at minimum a worked example per graft (grant + check, install rule + observe rejection).

4. **`Guard` Rust API examples** — at least one full lifecycle (`Guard::new()` → `verify(...)`) in `docs/build/hull.md` or `docs/going-deeper/vesl-core.md`.

5. **Reconcile the marker count** — patch `docs/reference/cli.md:61` so the injection-report sample matches the 10-marker model in inject.md / anatomy.md, or vice versa. One-line fix; affects every reader who compares the two pages.

---

## Resolutions (decided 2026-05-12)

Numbering matches the order findings appear above.

### Cross-cutting

1. **Marker count "9 vs 10":** update `cli.md:61` sample to 10 (add `load-defaults`).
2. **`nockup graft list` plain-text output:** add a sample to both `cli.md` and `inject.md`.
3. **Comprehensive `build_<graft>_<verb>_poke` table:** inline in `build/testing.md` — extend the convention paragraph at `:154` into a full table covering every shipped graft × verb, plus success/error effect tags.
4. **`Guard` Rust API lifecycle:** add to `going-deeper/vesl-core.md`.
5. **Rustdoc access:** add `cargo doc --open -p vesl-core` (and siblings) wherever docs punt to "the rustdoc."
6. **`vesl-test` CLI install path:** add `cargo install --git ... --bin vesl-test` at the top of the CLI-subcommands section in `build/testing.md`.
7. **`vesl-checkpoint` Cargo dep:** add `Cargo.toml` snippet to `build/state-snapshots.md` above the `use vesl_checkpoint::{...}` example.
8. **`nockapp.toml` schema:** new page `docs/reference/nockapp-toml.md` mirroring `reference/vesl-toml.md`'s structure.
9. **`build.rs` no-op vs codegen:** verify against the project template first, then patch the wrong side (anatomy.md or hull.md/cli.md).
10. **Two-space marker law negative example:** add to `troubleshooting/common-pitfalls.md` as a pitfall entry with violating example + composer warning text.
11. **Denial table missing `%validate-rejected`:** add a 5th row to the table in `common-pitfalls.md`.
12. **Three admission checks stacking pattern:** document on the new `build/gates.md` or in kernel.md (NOT the pitfalls table).
13. **`gate-chain` semantics (AND/short-circuit/effect tags per element):** document on the new `build/gates.md`.
14. **Catalog-gate driving guide (Priority #1):** new page `docs/build/gates.md` end-to-end Schnorr/Ed25519/manifest-verify walkthroughs; absorbs #13, #21, #25, possibly #12.
15. **`signing.rs` API:** add to `going-deeper/vesl-core.md`.
16. **`hoon/common/` install contents:** document what install actually does (full catalog including forge); no opt-out path documented.
17. **`hoonc` eager-parse semantics:** relocate cause-of-silent-fail from `inject.md`'s lint description into `common-pitfalls.md`'s silent-fail entry.

### Profile A

18. **`build_mint_*` family:** bundle into `testing.md` builder table (#3); add a mint-specific callout in `build/kernel.md` (or `build/hull.md`) where mint is first driven.
19. **`build_guard_*` family:** bundle into existing decisions — `testing.md` table (#3) + `vesl-core.md` Guard lifecycle (#4). No new work item.
20. **`Tip5Hash` type origin and shape:** define inline at `build/hull.md:46` where the type is first used.
21. **Single-leaf hash gate inputs (raw payload contract):** document on the new `build/gates.md`.
22. **`%settle-verified` vs `%settle-noted` distinction:** explain in `build/kernel.md` where settle's arms are walked.

### Profile E

23. **`[graft.gates]` scope (which commitment grafts accept it):** verify behavior against vesl-core/composer source, then patch `graft-manifest.md` + `inject.md` to match reality.
24. **`build_settle_note_*_poke` per-gate signatures:** bundle into `testing.md` table (#3) + `gates.md` walkthrough (#14).
25. **`manifest-verify` Merkle-proof payload construction:** walk on the new `build/gates.md`.
26. **Gate-swap workflow (effect-shape deltas, builder swap, root re-validation):** expand the paragraph at `graft-manifest.md:106-107` into a full workflow inline.
27. **"`mint-graft.toml` omits `[graft.gates]`" attribution:** patch after #23 verification — fix wording or remove/relabel the inject.md:62-64 example based on what the verification finds.

### Profile J

28. **`rbac-graft` integration walkthrough (Priority #3):** add to `going-deeper/vesl-core.md` (or a new subsection of it).
29. **`validate-graft` rule installation API (Priority #3):** add to `going-deeper/vesl-core.md`, paired with rbac.
30. **`%validate-rejected` denial-path coverage:** #11's table row is sufficient; no further action.
31. **10-graft namespace audit guidance (collision-check lint coverage + 10-graft sample):** extend `build/inject.md` alongside the existing lint discussion.
32. **Mint-committing-over-other-graft-state pattern:** add to `going-deeper/vesl-core.md`.
33. **Snapshot temporal-staleness window:** add to `going-deeper/vesl-core.md` (bundle with #32 cross-graft commit pattern).
34. **Missing sub-verb builders (`batch_init/flush`, `validate_clear`, `queue_pop/clear`, `counter_reset/set`, `rbac_revoke`, `registry_update/del`, `kv_delete`):** confirmed bundled into `testing.md` table (#3).
35. **`[%rbac-has-perm pubkey perm ~]` peek path builder:** document in the rbac walkthrough on `going-deeper/vesl-core.md` (#28).
36. **Mule-trace dump location and parsing:** add capture/parsing instructions to `common-pitfalls.md` gate-clean-deny entry.
37. **"≥10 grafts terminates the driver" framing:** mirror the pitfalls warning into `build/anatomy.md` (composition page) while keeping the pitfalls entry.

### Net work landing per page

**New pages**

- `docs/build/gates.md` — Priority #1; absorbs #13, #14, #21, #25, possibly #12.
- `docs/reference/nockapp-toml.md` — #8.

**Substantial additions to existing pages**

- `docs/build/testing.md` — #3 (builder table absorbing #18/#19/#24/#34) + #6 (CLI install).
- `docs/going-deeper/vesl-core.md` — #4 (Guard) + #15 (signing.rs) + #28 (rbac) + #29 (validate) + #32 (cross-graft commit) + #33 (staleness) + #35 (rbac peek path).
- `docs/troubleshooting/common-pitfalls.md` — #10 + #11 + #17 + #36; possibly #12.
- `docs/build/kernel.md` — #18 callout + #22; #12 candidate.
- `docs/build/hull.md` — #20; possibly #18 callout.
- `docs/build/inject.md` — #2 + #27 patch + #31.
- `docs/build/anatomy.md` — #9 candidate + #37 mirror.
- `docs/reference/cli.md` — #1 + #2.
- `docs/reference/graft-manifest.md` — #23 patch + #26.
- `docs/build/state-snapshots.md` — #7.
- Several pages — #5 (`cargo doc --open` callouts wherever docs punt to rustdoc).

### Verification findings (2026-05-12)

**#9 — `build.rs` role.** Verified against `~/projects/nockchain/vesl-core/templates/`.

- The `vesl` template (which `quickstart.md:16,67` directs readers to scaffold with) ships build.rs as a 3-line rerun hint: `println!("cargo:rerun-if-changed=out.jam");`. No hoonc invocation; no codegen.
- Graft-creating templates (`graft-mint`, `graft-settle`, `graft-hash-gate`, `graft-intent`, `data-registry`, `settle-report`) ship a full build.rs that runs hoonc on `hoon/app/app.hoon` and then calls `graft-inject codegen kernel-cause-tags` to emit `kernel_cause_tags.rs` to `OUT_DIR` for compile-time drift assertions.
- **Verdict:** `anatomy.md:123` (`build.rs # no-op (hoonc runs in Step 4)`) is correct for the default vesl template. `hull.md:87` and `cli.md:20` are wrong as stated — they describe behavior of graft-creating templates as if it were ambient scaffold behavior.
- **Patch shape:** rewrite the "Hull/Kernel Drift Detection" subsection (hull.md:85–87) and cli.md:20's blurb to present drift detection as an opt-in pattern (“if your `build.rs` invokes `nockup graft codegen kernel-cause-tags` after hoonc”), not an automatic feature.

**#23 — `[graft.gates]` scope.** Verified against `~/projects/nockchain/vesl-nockup/tools/graft-inject/src/gates.rs` and all 14 shipped manifests in `protocol/lib/`.

- Composer's `apply_gate_selection` (gates.rs:131–138) bails when `[graft.gates]` is declared on a manifest whose poke body lacks the canonical 4-line `=/  hash-gate=verify-gate …` splice point: *\"gate selection only applies to manifests using the stock 4-line `=/  hash-gate=verify-gate  ...` shape.\"*
- Of the 14 shipped `*-graft.toml` manifests, only `settle-graft.toml` ships with the splice point (three occurrences, one per arm: register / verify / note). NONE of the shipped manifests declare `[graft.gates]`.
- Composer test fixture (`gates.rs:163-180`) uses `settle-graft.toml` exclusively for `[graft.gates]` test cases.
- **Verdict:** `[graft.gates]` is settle-graft-only in practice. `mint-graft.toml` does not accept it — the composer would bail with the splice-point error.
- **Patch shape for #23:** tighten `inject.md:95` and `graft-manifest.md` from “commitment-graft-only” to the actual scope (“requires the canonical hash-gate splice point in the poke body; `settle-graft` is the only shipped manifest with this shape; custom grafts can adopt the pattern by including the same splice point”).
- **Patch shape for #27:** re-key the inject.md:62-64 example from `mint-graft.toml` to `settle-graft.toml`. The current example is not just illustrative — it shows a configuration the composer would reject.
