---
title: Grafts
description: Install the vesl graft package and orient on the 5-family graft taxonomy.
outline: deep
---

# Grafts

A graft is a Hoon library plus a TOML manifest that `nockup graft inject` splices into your kernel. This page covers installing the published graft catalog and mapping the 5-family taxonomy. Wiring a graft into `app.hoon` lives on [Inject](/build/grafts/inject); manual fallback paths for non-canonical setup live at the bottom.

## Anatomy of a Graft

The manifest carries metadata and code blocks; the library carries the types and helper gates those blocks call into.

```
graft
├── manifest: <name>-graft.toml
│   ├── [graft]                  name · version · priority · after
│   ├── [graft.types]            cause-type · effect-type
│   └── [graft.blocks.*]         Hoon spliced at kernel markers
│       ├── imports              /+ lines pulling the library into scope
│       ├── state                one field on versioned-state
│       ├── cause                one variant on the cause $% union
│       ├── peek                 one arm chained into the peek dispatch
│       ├── poke                 ≥1 arms in the ?- switch
│       │   └── arm              one per cause-tag the graft handles
│       │       ├── tag          %settle-register
│       │       ├── reads        cause fields off u.act
│       │       ├── reads/writes its own state field
│       │       ├── gate         swappable verify-gate (optional; commitment grafts)
│       │       ├── calls        the library's <name>-poke entrypoint
│       │       └── returns      [(list effect) new-state]
│       ├── poke-prelude         pre-?- short-circuit (validate-graft only)
│       └── poke-postlude        post-?- result transform (no shipped graft yet)
└── library: <name>-graft.hoon   state shape, types, poke/peek gates
```

Across the thirteen shipped grafts, the `poke` block carries one to four arms (most have two or three; `clock-graft`, `forge-graft`, `log-graft`, and `mint-graft` each have one). The arm shape stays consistent across all of them, and [Adding a Domain Cause](/build/kernel/causes) walks the same shape for a domain cause you write yourself.

## Install the Package

If you scaffolded from the [quickstart](/setup/quickstart), vesl-graft is already installed — `nockup project init` saw it declared in your `nockapp.toml`'s `[dependencies]` block and pulled it in automatically. Skip ahead to [Verify the install](#verify-the-install).

If you're adding vesl to an **existing** nockapp project that doesn't yet declare the dep, add it now:

```bash
nockup package add zkvesl/vesl-graft -v latest
nockup package install
```

`-v latest` is required; nockup refuses a bare `add` without a version spec. Run `nockup package install` from the **parent** of the project dir, not from inside it (`nockup package install` walks `./<package-name>/` and errors `Project directory '<package-name>' not found` if you run it from within the project).

If you'd like the kernel file named something other than `app.hoon` to match your project domain:

```bash
nockup graft rename-kernel <new-name> --apply
```

Add `--apply` to do the rename — without it, you just see what would change. The command updates the kernel file, `nockapp.toml`, and the build commands in your README in one pass.

## What Lands on Disk

```
my-app/hoon/
├── lib/                          # graft libraries + manifests
│   ├── settle-graft.hoon
│   ├── settle-graft.toml
│   ├── mint-graft.hoon
│   ├── mint-graft.toml
│   ├── guard-graft.hoon
│   ├── guard-graft.toml
│   ├── forge-graft.hoon          # plus vesl-prover.hoon, vesl-lower.hoon
│   ├── forge-graft.toml
│   ├── ...                       # state + behavior grafts (kv, counter, queue, rbac, registry, validate, log, clock, batch)
│   └── vesl-merkle.hoon          # tip5 Merkle primitives
└── common/
    ├── zeke.hoon                 # tip5 hash chain
    └── ztd/                      # tip5 math tables (8 files)
```

`forge-graft` additionally pulls in the STARK prover tree (`hoon/common/v0-v1/`, `v2/`, `stark/`, plus `hoon/dat/softed-constraints.hoon` and the pre-jammed constraint tables under `hoon/jams/`).

## Verify the Install

`nockup package install` silently skips dependencies it can't resolve, so a clean `✓ No dependencies to install` does not mean vesl landed. Check the expected files are on disk:

```bash
ls hoon/lib/settle-graft.hoon hoon/lib/settle-graft.toml hoon/lib/vesl-merkle.hoon
```

If any of those three paths are missing, the registry didn't resolve `zkvesl/vesl-graft` — see [Fallback paths](#fallback-paths) below.

## If Your `app.hoon` Already Has Work in It

If you scaffolded from a non-vesl template and started writing causes, peeks, or state before reading this page, take one of these paths to add the markers without losing your work:

**Template-overlay (easier).** Copy `templates/app.hoon` over your file, then move your existing causes, peeks, and state into the marker slots. The template is 89 lines — the diff is mostly cut-and-paste, and the marker positions are already correct.

**Annotate-in-place (surgical).** Add the ten `::  nockup:*` comments at the structural points below. **Two-space law:** `::` followed by exactly two spaces, then `nockup:<name>` — no other spacing matches.

| Marker | Position |
|---|---|
| `::  nockup:imports` | Between the `/+` and `/=` import lines at the top of the file |
| `::  nockup:state` | Inside `+$ versioned-state`'s `$:` block, after the `%vN` version tag |
| `::  nockup:domain-effect` | Above your `+$ domain-effect $%(...)` declaration |
| `::  nockup:effect-union` | Above the typed `+$ effect` union (codegen rewrites the line below) |
| `::  nockup:cause` | Inside `+$ cause`'s `$%` union, after your existing variants |
| `::  nockup:load-defaults` | Inside `++ load`, on the line above the fall-through that returns `old-state` |
| `::  nockup:peek` | Inside `++ peek`, on the line above the fall-through `~` |
| `::  nockup:poke-prelude` | Immediately before the `?-` poke switch |
| `::  nockup:poke` | Inside the `?-` poke switch, on its own line above the closing `==` |
| `::  nockup:poke-postlude` | Immediately after the `?-` switch's enclosing block |

Missing markers don't fail the run. `nockup graft inject` warns (`warning — markers not found: <list>`) and silently skips any slot it can't find — so partial annotation is safe to iterate. One special case is auto-migrated: a bare `+$ effect *` in source is rewritten on the same `--apply` pass into the `nockup:domain-effect` + `nockup:effect-union` shape, so kernels that already have the bare effect don't need to add those two markers by hand.

## The 5-Family Graft Taxonomy

| # | Family | Priority band | Members | Role |
|---|---|---|---|---|
| 1 | Commitment | 10–40 | `settle`, `mint`, `guard`, `forge` | Hull-keyed Merkle roots, payload verification, replay-protected settlement, STARK proofs. |
| 2 | Verification gates | library (selectable) | `vesl-gates.hoon` | Named gate arms consumed by commitment grafts via `[graft.gates]`. Ships ed25519, Schnorr, manifest, set-membership, bounded-value. |
| 3 | State | 50–99 | `kv`, `counter`, `queue`, `rbac`, `registry` | Domain-keyed app-state primitives. |
| 4 | Behavior | 100–149 | `validate`, `log`, `clock`, `batch` | Runtime wrappers and observers (pre-flight rules, audit trail, deterministic clock, settlement-flush buffer). |
| 5 | Intent | 200–299 | `intent-graft` (placeholder) | Reserved for multi-party coordination; crashes on invocation until upstream lands. |

Commitment grafts share a unified `hull=@` key — `mint`, `guard`, and `settle` can address the same logical cell across primitives. State grafts are **domain-keyed**, so they layer alongside commitments without namespace collision. Behavior grafts wrap or observe poke flow via the `poke-prelude` and `poke-postlude` markers; `validate-graft`'s prelude short-circuits before the cause switch runs.

Splitting commitments across multiple `hull=@` keys for per-tenant, per-version, or per-period isolation is [the trellis pattern](/build/grafts/trellis-pattern).

The full schema (manifest fields, per-marker block keys, gate selection, the priority lattice in detail) lives on [Grafts / Manifest Schema](/build/grafts/manifest-schema).

## Fallback Paths

If you scaffolded from upstream nockup's `basic` template (or any other non-vesl template), your `hoon/app/app.hoon` lacks the ten `::  nockup:*` markers `nockup graft inject` wires against. `nockup project init` with `template = "vesl"` produces them automatically; this `cp` is the manual equivalent:

```bash
cp <vesl-nockup>/templates/app.hoon hoon/app/app.hoon
```

The marker template is the same minimal kernel as the basic scaffold's `app.hoon`, with the markers pre-placed at the right structural points. Do not edit `app.hoon` back to the basic shape afterwards — keep the markers.

::: info See Also

- [vesl-nockup README — Step 2](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#step-2--install-the-vesl-graft-packages) — install the vesl-graft package via nockup.
- [Reference / Library catalog](/reference/library) — per-graft one-liners and links to source for every shipped graft, support Hoon library, and Rust crate.
- [Grafts / Manifest Schema](/build/grafts/manifest-schema) — manifest TOML fields and the priority lattice in detail.

:::
