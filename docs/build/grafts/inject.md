---
title: Inject
description: How nockup graft discovers manifests, composes per-marker blocks, and writes the result into your app.hoon. Preview-by-default; lint families that gate apply.
outline: deep
---

# Inject

`nockup graft` is the CLI that splices Hoon graft libraries into your kernel at the marker comments. It reads `<name>-graft.toml` manifests under `hoon/lib/`, composes the per-marker blocks, and writes the result back into `hoon/app/app.hoon`.

```d2
direction: right

manifests: "hoon/lib/*-graft.toml"
appin: "hoon/app/app.hoon\n(with markers)"
composer: "nockup graft inject"
stdout: "preview to stdout\n+ sha256 banner to stderr"
apply: "--apply"
appout: "hoon/app/app.hoon\n(composed)"

manifests -> composer
appin -> composer
composer -> stdout
stdout -> apply: {style.stroke-dash: 3}
apply -> appout
```

## The Composer Model

Every graft manifest declares blocks of Hoon code keyed to a marker name (`imports`, `state`, `cause`, `poke`, `peek`, etc.). The marker template in `templates/app.hoon` carries ten anchor comments at the right structural points:

```
templates/app.hoon  (89 lines; 10 anchor comments)
::  nockup:imports          ← graft /+ and /= imports
::  nockup:state            ← per-graft state fragments inside +$ versioned-state
::  nockup:domain-effect    ← your app's effect variants (you write these)
::  nockup:effect-union     ← codegen: the typed effect-union pass writes here
::  nockup:cause            ← graft cause-tag variants
::  nockup:load-defaults    ← codegen: state-shape migration overlay (resume)
::  nockup:peek             ← graft peek arms
::  nockup:poke-prelude     ← pre-flight checks (e.g. validate-graft)
::  nockup:poke             ← graft ?- arms
::  nockup:poke-postlude    ← post-flight observers (e.g. log-graft, batch-graft)
```

`nockup graft inject` walks `hoon/lib/`, reads every `<name>-graft.toml`, and splices each block at its declared marker. The composer is idempotent — re-running after `--apply` skips anything already wired.

See [NockApp Anatomy — Anchor Markers](/build/anatomy#anchor-markers) for the full per-marker purpose definitions (content markers vs. codegen anchors).

The matching manifest on disk:

```toml
# hoon/lib/settle-graft.toml (with an opt-in [graft.gates] override added)
[graft]
name     = "settle-graft"
version  = "0.1.0"
priority = 10
after    = []

[graft.types]
effect = "settle-effect"
cause  = "settle-cause"

# [graft.gates] is optional. settle-graft's poke body declares the canonical
# 4-line hash-gate splice point in each %settle-* arm; this section rewrites
# every occurrence to call a named gate from vesl-gates.hoon.
[graft.gates]
gate = "sig-verify-schnorr"

[graft.blocks.imports]
sentinel = "*settle-graft"
body     = """
/+  *settle-graft
/+  *vesl-merkle"""

[graft.blocks.state]
sentinel = "settle=settle-state"
body     = "settle=settle-state"

[graft.blocks.cause]
sentinel = "settle-cause"
body     = "settle-cause"

[graft.blocks.peek]
sentinel = "settle-peek"
body     = "(settle-peek settle.state path)"

# [graft.blocks.poke] holds the %settle-register / %settle-verify /
# %settle-note arm bodies — multi-line Hoon wrapped in TOML """ ... """
# strings.
```

The fields:

- **`[graft]`** — top-level metadata the composer reads but doesn't paste.
  - `name`: canonical identifier. Matches `--grafts <CSV>` on the CLI.
  - `version`: semver, bumped when blocks change incompatibly.
  - `priority`: injection order. The numeric band picks the family: 10–40 commitment, 50–99 state, 100–149 behavior, 200–299 intent.
  - `after`: soft ordering hints. Entries naming an absent graft are silently ignored.
- **`[graft.types]`** — opts the graft into the typed effect-union codegen. The composer synthesizes `+$ effect $%(...)` at the `nockup:effect-union` marker from every opted-in graft's `effect` declaration.
- **`[graft.gates]`** — picks a named verification gate from `vesl-gates.hoon` (`sig-verify-ed25519`, `sig-verify-schnorr`, `manifest-verify`, `set-membership-verify`, `bounded-value-verify`). Only grafts whose poke body carries the canonical 4-line hash-gate splice point accept the block; `settle-graft` is the one shipped manifest with that shape. Omitting the section keeps whatever gate the poke body already declares (the default single-leaf hash gate, for `settle-graft`).
- **`[graft.blocks.<marker>]`** — one sub-table per marker the graft contributes to. Each contains a `sentinel` (documentation-only label naming the marker target) and a `body` (the Hoon pasted at the matching `nockup:<marker>` anchor). Multi-line bodies use TOML's `""" ... """` block-string syntax. In the example, `imports` lands on the `/+` line, `state` becomes a `versioned-state` fragment, and `poke` (elided here) becomes the `?-` arms.

::: info Full schema reference

[**Manifest Schema**](/build/grafts/manifest-schema) — every field, gate-chains, stability levels, the priority lattice, and the supply-chain trust model.

:::

The shipping `settle-graft.toml` omits `[graft.gates]` (each `%settle-*` arm carries the default hash gate inline); the unabridged file is at [`hoon/lib/settle-graft.toml`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/hoon/lib/settle-graft.toml). `mint-graft`, `guard-graft`, and `forge-graft` ship without the splice point and reject `[graft.gates]` at composition.

Each graft's splice-point status follows from what it semantically does. Only settle-graft has a verify-payload-against-registered-root lifecycle that a `verify-gate` parameterizes. Its `(settle-poke state cause veri)` signature takes the gate as a third argument, and every arm binds the gate before calling it. `%mint-commit` one-shot binds `[hull, root]` with no payload to check. `%guard-check` runs a hard-coded `hash-leaf` comparison. `%forge-prove` generates STARK proofs, not loobean predicates. The splice point is the composer's pattern-match anchor; its presence reflects whether the graft has a swappable gate slot at all.

## Cause Dispatch Semantics

When a graft's manifest declares a `[graft.blocks.poke-prelude]` block, the composed kernel runs that block **before** the kernel's `?-` switch dispatches on the cause-tag. The prelude runs for every poke — domain-written causes and graft-injected causes alike — and can short-circuit by returning `[(list effect) state]` directly, ending the gate before the switch sees the cause.

The canonical prelude is `validate-graft`'s rule check:

```hoon
=/  v-failure=(unit @t)
  (check-rules -.u.act +.u.act validate.state)
?:  ?=(^ v-failure)
  :_  state
  ^-  (list effect)
  ~[[%validate-rejected -.u.act u.v-failure]]
```

`u.act` is the noun the kernel received as the poke cause. The prelude inspects `-.u.act` (the cause-tag head) and `+.u.act` (the body after the tag) without caring which graft owns the cause. So:

- Domain causes (e.g. a hand-written `%my-app-do-thing`) hit the prelude.
- Graft-injected causes (`%queue-push`, `%batch-add`, `%settle-note`, `%rbac-grant`, etc.) **all** hit the prelude.
- The prelude only acts on causes for which rules have been installed via `%validate-init`. For causes with no installed rules, the prelude is a no-op and falls through to the `?-` switch.

### Block sentinels

Each manifest block specifies the source-line sentinel `inject` searches for in the composed kernel. The `poke-prelude` marker lives in `templates/app.hoon` (`::  nockup:poke-prelude` at the right structural point). Adding a prelude block to a new graft's manifest means injecting source between that sentinel and the kernel's `?-` switch.

## Preview by Default

```bash
nockup graft inject hoon/app/app.hoon            # preview
nockup graft inject --apply hoon/app/app.hoon    # write
```

A bare invocation prints the composed kernel to stdout and a per-manifest sha256 summary to stderr. Nothing is written until you pass `--apply`. This keeps a compromised `hoon/lib/` — pulled by sync, a bad `cp`, or a dependency bump — from silently composing hostile Hoon into your kernel source. The supply-chain trust model lives in [Manifest Schema](/build/grafts/manifest-schema).

## Removing Grafts

Every manifest under `hoon/lib/` composes by default. The vesl-graft package installs all of them; most apps need only a subset. Three ways to narrow the set, in increasing permanence:

```bash
nockup graft list                                                              # see what's available
nockup graft inject --grafts settle-graft,counter-graft --apply hoon/app/app.hoon  # one-shot allow-list
nockup graft inject --exclude intent-graft,forge-graft --apply hoon/app/app.hoon   # one-shot deny-list
```

A bare `nockup graft list` against the full `vesl-graft` install prints one row per discovered graft in priority order:

```
  settle-graft     0.1.0    priority=10  (imports, state, cause, poke, peek)
  mint-graft       0.1.0    priority=20  (imports, state, cause, poke, peek)
  guard-graft      0.1.0    priority=30  (imports, state, cause, poke, peek)
  forge-graft      0.1.0    priority=40  (imports, cause, poke)
  kv-graft         0.1.0    priority=50  (imports, state, cause, poke, peek)
  counter-graft    0.1.0    priority=60  (imports, state, cause, poke, peek)
  queue-graft      0.1.0    priority=70  (imports, state, cause, poke, peek)
  rbac-graft       0.1.0    priority=80  (imports, state, cause, poke, peek)
  registry-graft   0.1.0    priority=90  (imports, state, cause, poke, peek)
  validate-graft   0.1.0    priority=100 (imports, state, cause, poke-prelude, poke, peek)
  log-graft        0.1.0    priority=130 (imports, state, cause, poke, peek)
  clock-graft      0.1.0    priority=140 (imports, state, cause, poke, peek)
  batch-graft      0.1.0    priority=145 (imports, state, cause, poke, peek)
  intent-graft     0.1.0    priority=200 (imports, state, cause, poke, peek)
```

The `(blocks)` column names every marker the graft populates. `forge-graft` is stateless and omits `state` and `peek`. `validate-graft` lands a pre-flight check in `poke-prelude` in addition to a regular `poke` arm. Pass `--exclude <CSV>` to drop entries from the listing without touching `hoon/lib/`.

To remove a graft permanently, delete `<name>-graft.toml` from `hoon/lib/` (and the matching `.hoon` if no other graft imports it). The composer reads what's on disk; what's missing isn't discovered.

Markers in `app.hoon` are anchor points shared across the graft set. Multiple grafts can contribute to the same marker, and their bodies stack at that slot: every graft's `imports` body at `nockup:imports`, every graft's `poke` arms at `nockup:poke`, and so on. Each contribution is wrapped in a `graft-inject:<name>:<marker>:begin / :end` banner pair carrying the manifest's sha256, which is what `--apply` re-runs match against to skip already-wired blocks.

Inclusion is controlled by what `hoon/lib/` contains and by the CLI flags above. Deleting a marker removes the slot for every graft (one fewer place for any graft to land); deleting a manifest removes one graft from every slot it would have filled. A graft whose block targets an absent marker is a hard error — `nockup graft inject` stops with a nonzero exit rather than drop the block silently. Add the marker, or narrow the graft set so nothing targets it.

## Pre-Apply Linting

`nockup graft lint <app.hoon>` runs read-only structural validations. Exit code is `1` on any error-tier finding so CI can gate `--apply` on the lint passing. Pass `--json` for a stable machine-readable schema. Five lint families run via the `lint` subcommand. `nockup graft inject --apply` runs all five structural lints — `bare-tilde-ambiguity`, `collision`, `transitive-imports`, `internal-dupes`, and `unresolved-cause-reference` — and refuses the write on any error-tier finding, because composing the file is what turns each silent-fail surface into corrupt output. A sixth lint, `weld-friction`, runs only at compose time and defaults to `warn` (advisory). See [CLI — Lints](/reference/cli#lints).

Every finding goes through one printer, so each line begins with `  {severity}: {kind}: ` (severity is `error`, `warning`, or `note`; kind matches the JSON key — `weld-friction`, `bare-tilde-ambiguity`, `collision`, `transitive-imports`, `internal-dupes`, or `unresolved-cause-reference`). Findings of the same kind print consecutively, then the per-lint remediation hint emits once for the group. The unified shape lets `grep '<kind>:'` count findings without scraping the body and `grep '^  error:'` route only the gating findings.

Severity is configurable per-project via the [`[lint]` table in `nockapp.toml`](/reference/nockapp-toml#lint-table) — e.g. `[lint] weld-friction = "error"` promotes the advisory weld lint to a gate; `[lint] transitive-imports = "warn"` demotes it below the `--apply` gate. The `--lint-override NAME=SEVERITY` CLI flag is a one-shot override at the same precedence (CLI wins over config, config wins over default). `nockup graft doctor` lists the effective per-lint severity so the resolved policy is inspectable without running a compose.

Lint output references Hoon constructs in the composed kernel. Vocab the sections below use:

- `?-` — exhaustive-match rune (Hoon's `match`).
- `~` — null, also the empty-list literal.
- `+$ cause $%(...)` — tagged-union declaration (like a Rust `enum`).
- `+$ versioned-state $:(...)` — record declaration (like a Rust `struct`).
- `/+` `/=` `/-` `/#` — import runes.

### `bare-tilde-ambiguity`

**What you see:** an arm in your `++poke` switch flagged because its body ends with a bare `~` on its own line. Sample:

```
graft-inject lint: 1 error(s)
  error: bare-tilde-ambiguity: hoon/app/app.hoon:147 — domain arm `%settle-register` body ends with bare `~` line
    graft-inject's chain-rebuilder may mistake this for the peek-chain
    terminator. Refactor to one of:
      `(list effect)`~
      ^- (list effect) ~
```

**Why it matters:** the composer's peek-chain rebuilder treats a lone `~` line as a chain terminator, which would corrupt `app.hoon`. `nockup graft inject --apply` runs this check and refuses to write on a finding; `nockup graft lint` reports it without composing.

**Fix:** type-annotate the empty list on a single line. Use `` `(list effect)`~ `` (cast shorthand) or `^- (list effect) ~` (cast rune).

### `collision-check`

**What you see:** lint output naming a cause-tag or state-field that two or more grafts (or a graft and your domain) both declare. Sample:

```
graft-inject lint: 2 error(s)
  error: collision: cause-tag `settle-register` declared by: settle-graft, (domain)
  error: collision: state-field `epoch` declared by: settle-graft, my-domain-graft
    duplicate names compose into one cause $% / state record.
    Disambiguate via manifest rename, profile-letter suffix, or
    domain shadowing.
```

**Why it matters:** duplicates compose into one `+$ cause $%(...)` union or one `+$ versioned-state` record. hoonc would later fail with a `nest-fail`. The lint catches this at scaffold time and attributes the conflict to specific manifests.

**Fix:** rename the offender in its manifest, suffix one with a profile letter, or shadow it in your domain.

**Coverage:** cause-tags and state-fields. Graft peek arms chain, so peek-path-head overlap is benign and falls outside the lint. `[graft.types].effect` duplicates are caught at composer discovery instead (see [CLI / Common Errors](/reference/cli#common-errors)).

### `transitive-imports`

**What you see:** lint output listing each unsatisfied `/+`, `/=`, `/-`, or `/#` import: source file, import token, expected target, and the BFS chain that reached it. Sample:

```
graft-inject lint: 1 error(s)
  error: transitive-imports: hoon/common/nock-prover.hoon: /# softed-constraints → hoon/dat/softed-constraints.hoon (NOT FOUND)
      reachable from: hoon/common/nock-prover.hoon
    hoonc eager-parses hoon/common/ regardless of import-graph
    reachability; unsatisfied edges leave hoonc exit 0 with no
    out.jam (the "no panic!" silent-fail). Either add the missing
    target file or strip the offending file from hoon/common/.
```

**Why it matters:** `hoonc` eager-parses every `.hoon` under `hoon/common/` regardless of import-graph reachability. An unsatisfied edge there causes hoonc to exit 0 with no `out.jam` written. This is the silent-fail case described in [Build & Run](/build/build-run/).

**Fix:** add the missing `.hoon` to `hoon/lib/` or `hoon/common/`, or remove the unsatisfied import.

### `internal-dupes`

**What you see:** lint output naming a duplicate variant head inside the composed `+$ cause $%(...)` or a duplicate field name inside `+$ versioned-state $:(...)`. Sample:

```
graft-inject lint: 1 error(s)
  error: internal-dupes: duplicate cause-tag `kv-set` at lines 178, 213
    literal duplicates in the composed +$ cause $%(...) or
    +$ versioned-state $:(...) — hoonc accepts whichever wins
    lexically (mint-lost) or fires nest-fail on duplicate fields.
    Rename, merge into a tagged sum, or distinguish by argument shape.
```

**Why it matters:** these duplicates only surface after composition. Two grafts with different manifest names can still contribute the same variant head or field, which `collision-check` (manifest-side) doesn't catch. hoonc would fail later with a `nest-fail`.

**Fix:** edit one of the contributing grafts' bodies in its manifest to rename the offending head or field. If one of the grafts is shipped by vesl, shadow or rename it in your local fork of the manifest.

### `unresolved-cause-reference`

**What you see:** lint output naming a sub-cause-type cited by the kernel's `+$ cause $%(...)` union that no manifest in the active set declares via `[graft.types].cause`. Sample:

```
graft-inject lint: 1 error(s)
  error: unresolved-cause-reference: hoon/app/app.hoon:54 — `+$ cause` references `settle-cause`, but no graft's [graft.types].cause declares that type
    the cause-tag codegen drops the contribution silently and
    hoonc later surfaces it as `find . <name>-cause`. Either
    add the missing manifest to --lib-dir (and ensure its
    [graft.types].cause matches the referenced name), or remove
    the reference from the kernel's `+$ cause` union.
```

**Why it matters:** the cause-tag codegen pass cross-references each `[graft.types].cause` declaration against the union's references, then emits a Rust slice driving the hull-side `assert_kernel_cause_tag!` macro. An orphan reference silently drops the contribution from the slice, and the composed kernel reaches hoonc with an undefined type name — surfacing as the unfriendly `find . <name>-cause` error with no path back to the kernel source line.

**Fix:** either add the missing manifest to `hoon/lib/` and ensure its `[graft.types].cause` matches the referenced name, or remove the reference from the kernel's `+$ cause` union.

## What Got Composed

After `--apply`, the per-manifest sha256 summary on stderr looks like:

```
graft-inject: hoon/app/app.hoon
  settle-graft     sha256:a9c72bbe7dc1 injected 5/5 (imports, state, cause, poke, peek)
  mint-graft       sha256:4b2e...       injected 5/5 (imports, state, cause, poke, peek)
  guard-graft      sha256:c310...       injected 5/5 (imports, state, cause, poke, peek)
  forge-graft      sha256:f721...       injected 3/3 (imports, cause, poke)
  markers in source: 10
  markers populated: 5 (imports, state, cause, poke, peek)
```

`forge-graft` ships three blocks (no state, no peek — forge is stateless). The denominator is per-graft: each graft reports against the blocks *it* declares, not a fixed total.

By default, the four commitment grafts use a hash-comparison verification gate: the kernel tip5-hashes the raw payload and checks it against the registered root. That's enough for single-leaf commitments. For Merkle manifests, signatures, or STARK gates, see [Kernel — Verification Gates](/build/kernel/gates) and [Manifest Schema](/build/grafts/manifest-schema).

::: info See Also

- [vesl-nockup README — Step 3](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#step-3--wire-the-kernel) — the canonical wire-the-kernel walkthrough.
- [`tools/graft-inject/src/`](https://github.com/zkvesl/vesl-nockup/tree/main/tools/graft-inject/src) — composer source: manifest loader, marker matcher, lint passes.
- [`templates/app.hoon`](https://github.com/zkvesl/vesl-nockup/blob/main/templates/app.hoon) — the marker template the composer wires against.

:::
