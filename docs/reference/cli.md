---
title: CLI (nockup graft)
description: nockup graft subcommand surface, preview-by-default semantics, the priority lattice, and the typed effect-union codegen.
outline: deep
---

# CLI (`nockup graft`)

`nockup graft` is the kernel-composition tool. It discovers `<name>-graft.toml` manifests under a library directory and composes their blocks into a host `app.hoon`. One call writes imports, state fields, cause branches, poke arms, and peek chains for every graft it picks up.

The user-facing invocation is `nockup graft <subcommand>` — `nockup`'s plugin discovery dispatches to the `nockup-graft` sidecar on PATH. Sample output and on-disk banner comments still identify the tool as `graft-inject`.

## Subcommands

| Subcommand | Purpose |
|---|---|
| `inject <PATH>` | Compose grafts into the target `app.hoon`. Documented in detail below — the primary command. |
| `list` | List discovered grafts, their priority, and the blocks each ships. |
| `lint <PATH>` | Pre-apply structural validation (four lint families). See [Inject — Pre-Apply Linting](/build/grafts/inject#pre-apply-linting). |
| `doctor <PATH>` | Project-health check: schema-version handshake, Cargo `[patch]` consistency, hand-edited injected blocks, missing `nockup:load-defaults` marker. Exits nonzero on findings. See [`doctor`](#doctor) below. |
| `update <PATH>` | Refresh the graft library and recompose: `nockup package install` → preview → confirm → `inject --apply`. Preview-by-default; `--yes` skips the prompt. See [`update`](#update) below. |
| `codegen kernel-cause-tags <PATH>` | Emit a Rust slice of the kernel's cause-tag set. Wire from your own `build.rs` to opt into compile-time hull/kernel drift assertions. See [Hull — Hull/Kernel Drift Detection](/build/hull#hull-kernel-drift-detection). |
| `rename-kernel <new-name>` | Rename `hoon/app/<from>.hoon` plus references in `nockapp.toml` and `README.md`. |

Pass `--help` to any subcommand for its current flag set.

## Usage

```
nockup graft inject [OPTIONS] [PATH]
```

`PATH` is the target `app.hoon`.

## `inject` Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--grafts <CSV>` | (auto-discover all) | Comma-separated graft names to compose, in the order listed. Overrides auto-discovery. Unknown names hard-error. |
| `--exclude <CSV>` | (none) | Graft names to skip. Subtracts from either the auto-discovered set or `--grafts`. |
| `--lib-dir <DIR>` | `./hoon/lib/` | Where to look for `*-graft.toml` manifests. |
| `--apply` | — | Write the composed output to `PATH`. Without this flag, `nockup graft inject` is preview-only (see below). |
| `--no-migrate` | — | Skip the auto-migration of legacy `+$ effect *` to the marker shape. Default behavior is to migrate transparently; this flag is the paranoid-review opt-out. |

`nockup graft list` also accepts `--lib-dir`, `--exclude`, and `--json` (machine-readable schema; see below).

## Preview-by-Default

A bare invocation with `PATH` set prints the composed kernel to stdout and a per-manifest sha256 summary to stderr. Nothing is written to disk until `--apply` is passed. This is the trust boundary: manifest `body` fields paste verbatim into the composed kernel, so seeing the diff — and the sha256 of each manifest that contributed to it — before the write lands is the only way to catch a compromised `hoon/lib/` directory (pulled via `sync.sh`, a stray `cp`, a tampered dependency) before hostile Hoon becomes kernel source.

CI pipelines and scripted deployments should pass `--apply` explicitly.

## Injection Report

Invocation with `--apply` against a four-graft kernel:

```
graft-inject: hoon/app/app.hoon
  settle-graft     sha256:a9c72bbe7dc1 injected 5/5 (imports, state, cause, poke, peek)
  mint-graft       sha256:4b2e1c8930f2 injected 5/5 (imports, state, cause, poke, peek)
  guard-graft      sha256:c310a56e47bd injected 5/5 (imports, state, cause, poke, peek)
  forge-graft      sha256:f72193ac2018 injected 3/3 (imports, cause, poke)
  markers in source: 10 (imports, state, cause, poke-prelude, poke, poke-postlude, peek, domain-effect, effect-union, load-defaults)
  markers populated: 5 (imports, state, cause, poke, peek)
  effect-union codegen: inserted (5 variants: settle-effect, mint-effect, guard-effect, forge-effect, domain-effect)
```

The denominator is per-graft: each primitive declares which blocks it ships in its manifest. Forge is stateless and reports 3/3 (no state, no peek). A second run reports every line as `skipped: …` — `nockup graft inject` is idempotent; re-running against an already-wired kernel is a no-op (the codegen line reports `unchanged`). Without `--apply` the same report prints to stderr, followed by `(preview only — pass --apply to write <PATH>)`.

The `effect-union codegen` line surfaces the typed effect-union pass. Status is one of `inserted` (first run on a kernel that already has the `nockup:effect-union` marker), `replaced` (graft set changed since the last run; the union body was rewritten), `unchanged` (idempotent re-run), or `skipped` (kernel has no `nockup:effect-union` marker — the cast/weld friction at multi-graft `weld` sites remains; see [Grafts / Manifest Schema](/build/grafts/manifest-schema)).

## `list` Output

A bare `nockup graft list` prints one row per discovered graft in priority order:

```
  settle-graft     0.1.0    priority=10  (imports, state, cause, poke, peek)
  mint-graft       0.1.0    priority=20  (imports, state, cause, poke, peek)
  guard-graft      0.1.0    priority=30  (imports, state, cause, poke, peek)
  forge-graft      0.1.0    priority=40  (imports, cause, poke)
```

The trailing `(blocks)` column names every marker the graft populates. Grafts that ship fewer blocks (forge omits `state` and `peek`) report only what they declare. An empty `--lib-dir` prints `(no grafts discovered)`. Pass `--exclude <CSV>` to drop grafts from the listing without touching `hoon/lib/` on disk.

## `doctor`

`nockup graft doctor <PATH>` runs four project-health checks against a composed kernel and its project:

| Check | Flags |
|---|---|
| schema-version handshake | a graft manifest declaring a `schema_version` newer than the installed `nockup-graft` supports |
| Cargo `[patch]` consistency | a `Cargo.toml` pinning more than one nockchain rev — the partial-update state behind the `ibig` / `UBig` build failure |
| hand-edited block | a banner-bounded graft block whose body no longer matches what its manifest renders, while the banner sha still matches the manifest — a local edit the next `inject --apply` overwrites |
| missing `nockup:load-defaults` marker | a grafted kernel without the marker, where a schema-extension resume would silently drop effects |

`doctor` exits nonzero when any check fires, so CI can gate on it. `--json` emits a stable `{ "findings": [...] }` report. `--format build-warnings` emits one `doctor: <message>` line per finding to stdout and always exits 0 — the form the `vesl` scaffold's `build.rs` consumes, forwarding each line as a `cargo:warning=` so findings surface on every `cargo build` without a separate command to run.

## `update`

`nockup graft update <PATH>` is the graft-library update orchestrator — one verb for the safe-update sequence (see [Updating a Project](/build/updating)):

1. **Schema preflight** — stop if a graft needs a newer `nockup-graft`. `update` cannot replace its own running binary; it prints the `cargo install --force` instruction instead.
2. **`nockup package install`** — refresh the graft library.
3. **Re-check** the refreshed library's schema.
4. **Preview** the recomposition alongside the `doctor` health report.
5. **Confirm** — a `y/N` prompt, unless `--yes`.
6. **`inject --apply`** — recompose the kernel.

Preview-by-default is preserved: the preview prints before the prompt, and the kernel is rewritten only after a `y` (or `--yes`). `update` does not compile — the recompile and the cause-tag codegen are the next `cargo build`'s job. The `nockup` binary resolves from `NOCKUP_BIN` when set, otherwise from `PATH`.

## Priority Lattice

Grafts are injected in priority order (lower = earlier). Manifests can declare `after = ["<graft>"]` for soft ordering hints that resolve priority ties when both grafts are present. If the named graft isn't in the active cp set, the hint is silently ignored (a one-line note prints on stderr); priority-based ordering applies.

Hard ordering requirements aren't expressible — we deliberately keep all dependencies soft so subsetting works. If a graft structurally requires another graft's state shape, surface that through documentation, not a manifest field.

| Range | Class | Examples |
|---|---|---|
| 10–40 | Commitment | settle, mint, guard, forge |
| 50–99 | State | kv, counter, queue, rbac, registry |
| 100–149 | Behavior | validate, log, clock, batch |
| 150–199 | (reserved for user/domain grafts) | — |
| 200–299 | Intent | intent-graft (placeholder) |

## JSON Schema (`nockup graft list --json`)

```json
[
  {
    "name": "settle-graft",
    "version": "0.1.0",
    "priority": 10,
    "blocks": ["imports", "state", "cause", "poke", "peek"],
    "applicable": 5,
    "deferred": false,
    "sha256": "a9c72bbe…",
    "types": { "effect": "settle-effect", "cause": "settle-cause" }
  }
]
```

`sha256` is the hex sha256 of the manifest's raw TOML bytes — exposed so supply-chain reviewers can pin expected digests. Version bumps append fields, never reshape. Downstream crates can hard-fail at boot if a required graft is missing or its digest drifts.

`types` is the manifest's `[graft.types]` table — typed effect-union codegen input. Omitted on grafts that don't declare the table. `effect` is consumed by the codegen pass; `cause` is parsed forward-compat for cause destructuring and not yet read.

## `[graft.types]` Codegen Schema

A graft that exports a tagged effect type opts in by declaring it in `[graft.types]`:

```toml
[graft.types]
effect = "settle-effect"
cause  = "settle-cause"
```

Names must be kebab-case (`^[a-z][a-z0-9-]*$`). Two grafts cannot declare the same `effect` (or `cause`) name — `nockup graft inject` hard-errors at discovery with both manifest paths, mirroring the existing duplicate-graft-name guard. Hoon's `$%` would otherwise reject the synthesized union as `not a fork` with no manifest attribution.

The codegen pass synthesizes a banner-bounded block beneath the `nockup:effect-union` marker:

```hoon
::  nockup:effect-union
::  graft-inject:effect-union:begin
+$  effect
  $%  settle-effect
      mint-effect
      guard-effect
      forge-effect
      domain-effect
  ==
::  graft-inject:effect-union:end
```

Variant order matches the composer's input order (priority-sorted by default). `domain-effect` is appended when the `nockup:domain-effect` marker is present — the developer's `+$ domain-effect $%(...)` declaration there is left untouched. An empty union falls back to `[%effect-placeholder ~]` so Hoon's `$%` stays non-empty.

REPLACE-IF-PRESENT semantics: removing a graft from `--grafts` shrinks the union; adding one grows it; same-input reruns are byte-identical (Unchanged status).

## Lints

Advisory stderr notes — they don't fail the run, but they point at footguns the codegen can't fix on its own. The lint below fires at compose time during `nockup graft inject`. Pre-apply lints from `nockup graft lint` are documented separately on [Inject — Pre-Apply Linting](/build/grafts/inject#pre-apply-linting).

### `weld-friction lint`

Scans developer code (lines outside the `graft-inject:<X>:begin / :end` banner regions) for narrow `(list <X>-effect)` bindings where `<X>-effect` is a variant in the typed effect union. Sample output:

```
weld-friction lint: 2 narrow effect bindings found in domain code
  line 106: =/  [efx-c=(list counter-effect) new-counter=counter-state]
  line 108: =/  [efx-k=(list kv-effect) new-kv=kv-state]
  cross-graft `(weld a b)` over these bindings will nest-fail. widen each
    to `(list effect)` so the typed union absorbs each graft's effect.
  see zkvesl-docs §"Composing two graft arms in one domain cause"
    (/build/kernel/multi-graft#composing-two-graft-arms-in-one-domain-cause)
```

**Why it fires:** `weld` requires monomorphic lists — `(list X)` and `(list Y)` won't unify even when both `X` and `Y` are arms of the typed `+$ effect $%(...)` union. Two patterns work: cast each list at the weld site (`` `(list effect)`efx-c ``), or widen each binding to `(list effect)` upstream so the bare `(weld efx-c efx-k)` operates on a monomorphic list. The composer's typed-union codegen makes the latter the simpler default.

**Why the composer can't auto-fix it:** the binding lives in the developer's domain arm, between markers. Rewriting it would require parsing Hoon in Rust — explicitly out of scope for `nockup graft`. The lint surfaces the friction; the developer chooses Pattern A (cast at weld) or Pattern B (widen at binding).

**When it doesn't fire:**
- The kernel has no `nockup:effect-union` marker → codegen Skipped → no typed union to widen toward → lint short-circuits.
- All bindings already use `(list effect)` (Pattern B).
- The narrow type sits inside a graft-inject banner region (graft-injected poke bodies legitimately bind narrowly; the lint ignores those).

See [Build / Kernel — coordinating multiple grafts in one arm](/build/kernel/multi-graft) and [Grafts / Manifest Schema](/build/grafts/manifest-schema) for the worked patterns.

## Common Errors

- `warning — markers not found: ...` — your `app.hoon` is missing one of the ten `::  nockup:<name>` markers, or the two-space law is violated. See `vesl-nockup/templates/app.hoon` for canonical placement.
- `unknown graft: <name>` — `--grafts` named a manifest not in `--lib-dir`. Run `nockup graft list` to see what's installed.
- `duplicate [graft.types].effect` (or `.cause`) `<name>` in `<a.toml>` and `<b.toml>` — two manifests declared the same exported type name. Pick one; rename the other.
- `orphan graft-inject:effect-union:begin/end at line N` — the codegen banner pair under `nockup:effect-union` is corrupted (one banner without its mate). Restore the pair manually or remove both and let codegen re-insert on the next run.
- Subsequent `hoonc` failure with `mint-lost` / `-lost %<tag>` on a composed `?-` — stale manifest. Re-install the graft package (or re-run `sync.sh` in a dev checkout) to pick up the current cause-union shape.
- Subsequent `hoonc` `nest-fail` at a `(weld efx-a efx-b)` site — narrow bindings (`(list <graft>-effect)`); the [`weld-friction` lint](#weld-friction-lint) above flags this at compose time. Widen each binding to `(list effect)` or cast at the weld with `` `(list effect)` ``.

::: info See Also

- [`tools/graft-inject/src/`](https://github.com/zkvesl/vesl-nockup/tree/main/tools/graft-inject/src) — composer source: manifest loader, marker matcher, lint passes.
- [Grafts / Manifest Schema](/build/grafts/manifest-schema) — TOML field definitions for what `nockup graft inject` consumes.
- [Build / Inject](/build/grafts/inject) — the workflow this CLI sits inside.

:::
