---
title: Install grafts
description: Install the vesl graft package, copy the marker template, and orient on the 5-family graft taxonomy.
outline: deep
---

# Install grafts

A graft is a Hoon library plus a TOML manifest that `graft-inject` splices into your kernel. This page covers installing the published graft catalog, copying the marker template, and mapping the 5-family taxonomy. Wiring a graft into `app.hoon` lives on [Wire with graft-inject](/build/wire).

## Install the package

```bash
nockup package add zkvesl/vesl-graft -v latest
```

`-v latest` is required; nockup refuses a bare `add` without a version spec.

`nockup package add` records the dep in `nockapp.toml` and installs on the next `nockup project init` / `nockup package install`. Run install from the **parent** of the project dir, not from inside it (`nockup package install` walks `./<package-name>/` and errors `Project directory '<package-name>' not found` if you run it from within the project).

## What lands on disk

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

`forge-graft` additionally pulls in the STARK prover tree (`hoon/common/v0-v1/`, `v2/`, `stark/`, plus `hoon/dat/softed-constraints.hoon` and the pre-jammed constraint tables under `hoon/jams/`). Skip `forge-graft` if you don't need STARK proofs and the prover tree won't land.

## Verify the install

`nockup package install` silently skips dependencies it can't resolve, so a clean `✓ No dependencies to install` does not mean vesl landed. Check the expected files are on disk:

```bash
ls hoon/lib/settle-graft.hoon hoon/lib/settle-graft.toml hoon/lib/vesl-merkle.hoon
```

If any of those three paths are missing, the registry didn't resolve `zkvesl/vesl-graft` — see *Fallback* below.

## Copy the marker template

```bash
cp <vesl-nockup>/templates/app.hoon hoon/app/app.hoon
```

The nockup `basic` template's `app.hoon` does not contain the nine `::  nockup:*` markers `graft-inject` wires against. The marker template is the same minimal kernel with the markers pre-placed at the right structural points. Do not edit `app.hoon` back to the basic shape afterwards — keep the markers.

## The 5-family graft taxonomy

| # | Family | Priority band | Members | Role |
|---|---|---|---|---|
| 1 | Commitment | 10–40 | `settle`, `mint`, `guard`, `forge` | Hull-keyed Merkle roots, payload verification, replay-protected settlement, STARK proofs. |
| 2 | Verification gates | library (selectable) | `vesl-gates.hoon` | Named gate arms consumed by commitment grafts via `[graft.gates]`. Ships ed25519, Schnorr, manifest, set-membership, bounded-value. |
| 3 | State | 50–99 | `kv`, `counter`, `queue`, `rbac`, `registry` | Domain-keyed app-state primitives. |
| 4 | Behavior | 100–149 | `validate`, `log`, `clock`, `batch` | Runtime wrappers and observers (pre-flight rules, audit trail, deterministic clock, settlement-flush buffer). |
| 5 | Intent | 200–299 | `intent-graft` (placeholder) | Reserved for multi-party coordination; crashes on invocation until upstream lands. |

Commitment grafts share a unified `hull=@` key — `mint`, `guard`, and `settle` can address the same logical cell across primitives. State grafts are **domain-keyed**, so they layer alongside commitments without namespace collision. Behavior grafts wrap or observe poke flow via the `poke-prelude` and `poke-postlude` markers; `validate-graft`'s prelude short-circuits before the cause switch runs.

The full schema (manifest fields, per-marker block keys, gate selection, the priority lattice in detail) lives in [`vesl-nockup/docs/graft-manifest.md`](https://github.com/zkvesl/vesl-nockup/blob/main/docs/graft-manifest.md), mirrored on [Reference / Graft manifest schema](/reference/graft-manifest).

## Fallback: the registry hasn't resolved `zkvesl/vesl-graft` yet

Until the package lands in nockup's resolver, mirror what `package add` would have done by copying directly from your local `vesl-nockup` checkout. The README documents the exact `cp` lines for the mandatory libs, each commitment graft, and the forge prover tree: [vesl-nockup README — registry fallback](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#if-the-registry-hasnt-resolved-zkveslvesl-graft-yet).

## See also

- [vesl-nockup README — Step 2](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#step-2--install-the-vesl-graft-packages)
- [Reference / Graft manifest schema](/reference/graft-manifest) — manifest TOML fields and the priority lattice in detail.
