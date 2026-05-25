---
title: Inject
description: How nockup graft discovers manifests, composes per-marker blocks, and writes the result into your app.hoon. Preview-by-default; lint families that gate apply.
outline: deep
---

# Inject

**After reading:** you'll know what `nockup graft inject` does to your `app.hoon`, why `--apply` is opt-in, and how to narrow the graft set without editing `hoon/lib/`.

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

`nockup graft inject --apply` runs five structural lints against the composed kernel and refuses the write on any error-tier finding. The lints catch silent-fail surfaces composing would otherwise turn into corrupt output: `bare-tilde-ambiguity`, `collision`, `transitive-imports`, `internal-dupes`, `unresolved-cause-reference`, plus the advisory `weld-friction`. Each one names a specific failure mode in the composer or hoonc; the [Inject Lints](/build/grafts/inject/lints) page has the per-lint shape, sample output, and fix.

Severity is configurable per-project via the [`[lint]` table in `nockapp.toml`](/reference/nockapp-toml#lint-table); `--lint-override NAME=SEVERITY` is the one-shot CLI form. `nockup graft doctor` runs the lint pass under the resolved policy.

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

## Manifest SHA vs Library Edits

The per-graft sha256 in the inject banner — and the one `/status` surfaces in `manifest_shas` — is computed from `<name>-graft.toml`, **not** the sibling `<name>-graft.hoon` library file. Two consequences:

- **Editing the manifest** (block bodies, `[graft.gates]`, types) bumps the sha, and the next `inject --apply` re-emits every block carrying that graft's banner. The new digest appears in the banner and in `/status`.
- **Editing only the library** (a helper arm body, a comment, a typo in `<name>-graft.hoon`) does **not** change the manifest sha. `inject --apply` reports `injected 0/N; skipped …` against that graft — because the contribution is unchanged from the inject side's perspective. But `./compile.sh` reads the whole `hoon/lib/` tree, so hoonc picks the edit up and bakes it into `out.jam`. The change is live; the inject banner is correct that nothing about composition changed.

For local patches against a graft library, edit the `.hoon` file, re-run `./compile.sh`, and trust the recompile. To catch the gap (an edited library against an `out.jam` built before the edit), `vesl-test verify-jam` fingerprints both the manifest TOMLs and the library Hoon — so a stale jam against either surface trips it. See [Testing → CLI → verify-jam](/build/testing/cli#verify-jam-—-build-staleness-check).

::: info Stuck?

Something broken? The breakage is probably already in [Common Pitfalls](/troubleshooting/common-pitfalls).

:::

::: info See Also

- [vesl-nockup README — Step 3](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#step-3--wire-the-kernel) — the canonical wire-the-kernel walkthrough.
- [`tools/graft-inject/src/`](https://github.com/zkvesl/vesl-nockup/tree/main/tools/graft-inject/src) — composer source: manifest loader, marker matcher, lint passes.
- [`templates/app.hoon`](https://github.com/zkvesl/vesl-nockup/blob/main/templates/app.hoon) — the marker template the composer wires against.

:::
