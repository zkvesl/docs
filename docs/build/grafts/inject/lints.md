---
title: Inject Lints
description: Five pre-apply lint families that gate nockup graft inject --apply. Each one names a silent-fail surface in the composer or hoonc and refuses the write before it lands.
outline: deep
---

# Inject Lints

`nockup graft lint <app.hoon>` runs read-only structural validations. Exit code is `1` on any error-tier finding so CI can gate `--apply` on the lint passing. Pass `--json` for a stable machine-readable schema. Five lint families run via the `lint` subcommand. `nockup graft inject --apply` runs all five structural lints — `bare-tilde-ambiguity`, `collision`, `transitive-imports`, `internal-dupes`, and `unresolved-cause-reference` — and refuses the write on any error-tier finding, because composing the file is what turns each silent-fail surface into corrupt output. A sixth lint, `weld-friction`, runs only at compose time and defaults to `warn` (advisory). See [CLI — Lints](/reference/cli#lints).

Every finding goes through one printer, so each line begins with `  {severity}: {kind}: ` (severity is `error`, `warning`, or `note`; kind matches the JSON key — `weld-friction`, `bare-tilde-ambiguity`, `collision`, `transitive-imports`, `internal-dupes`, or `unresolved-cause-reference`). Findings of the same kind print consecutively, then the per-lint remediation hint emits once for the group. The unified shape lets `grep '<kind>:'` count findings without scraping the body and `grep '^  error:'` route only the gating findings.

Severity is configurable per-project via the [`[lint]` table in `nockapp.toml`](/reference/nockapp-toml#lint-table) — e.g. `[lint] weld-friction = "error"` promotes the advisory weld lint to a gate; `[lint] transitive-imports = "warn"` demotes it below the `--apply` gate. The `--lint-override NAME=SEVERITY` CLI flag is a one-shot override at the same precedence (CLI wins over config, config wins over default). `nockup graft doctor` runs the lint pass under the resolved policy and lists the effective severity per lint, so the same command surfaces both the active policy and the findings it produces without requiring a compose.

Lint output references Hoon constructs in the composed kernel. Vocab the sections below use:

- `?-` — exhaustive-match rune (Hoon's `match`).
- `~` — null, also the empty-list literal.
- `+$ cause $%(...)` — tagged-union declaration (like a Rust `enum`).
- `+$ versioned-state $:(...)` — record declaration (like a Rust `struct`).
- `/+` `/=` `/-` `/#` — import runes.

## `bare-tilde-ambiguity`

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

## `collision-check`

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

## `transitive-imports`

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

## `internal-dupes`

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

## `unresolved-cause-reference`

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

::: info See Also

- [Inject](/build/grafts/inject) — the composer itself; this page is its lint surface.
- [CLI — Lints](/reference/cli#lints) — printer shape, JSON schema, the `--lint-override` flag.
- [nockapp.toml — `[lint]` table](/reference/nockapp-toml#lint-table) — per-project severity overrides.

:::
