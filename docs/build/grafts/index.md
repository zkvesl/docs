---
title: Grafts
description: Install vesl-graft and orient on the 5-family graft taxonomy.
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

Across the fourteen shipped grafts, the `poke` block carries one to four arms (most have two or three; `clock-graft`, `forge-graft`, `log-graft`, and `mint-graft` each have one). The arm shape stays consistent across all of them, and [Adding a Domain Cause](/build/kernel/causes) walks the same shape for a domain cause you write yourself.

## Why Splicing, Not Import

A Hoon kernel is a single `app.hoon` file. Hoon has no linking step; the cause-tag union, the `?-` switch, and the state record all live in one source file, and the type system checks them as a unit. Importing a graft as a module would still leave you hand-assembling those three structures from the imported pieces.

`nockup graft inject` does the composition for you. It discovers manifests under `hoon/lib/`, gathers per-marker bodies in priority order, and assembles the new `app.hoon`. By default the command is preview-only: it prints what would change and exits without touching disk. `--apply` opts in to writing the result. The on-disk Hoon stays auditable; every contribution lives between named banner comments, so a `git diff` shows exactly what each graft added.

Preview-by-default keeps the trust boundary explicit: a compromised `hoon/lib/` would otherwise splice hostile bodies before you saw them. Inspect, then write.

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

**Template-overlay (easier).** Copy `templates/vesl/hoon/app/app.hoon` over your file, then move your existing causes, peeks, and state into the marker slots. The template is 89 lines — the diff is mostly cut-and-paste, and the marker positions are already correct.

**Annotate-in-place (surgical).** Add the ten `::  nockup:*` comments at the structural points below. A marker comment is `::` followed by one or more spaces, then `nockup:<name>`; the templates use two spaces as the canonical form.

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

A marker no active graft needs is skipped. But if an active graft contributes a block for an absent marker, `nockup graft inject` stops with a nonzero exit — the block has nowhere to land and would otherwise be silently dropped. Add the missing markers, then re-run. One special case is auto-migrated: a bare `+$ effect *` in source is rewritten on the same `--apply` pass into the `nockup:domain-effect` + `nockup:effect-union` shape, so kernels that already have the bare effect don't need to add those two markers by hand.

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

## Per-Graft Rust Snippets

One typical poke per graft, in family order. Each snippet calls the canonical `build_*_poke` builder shipped in [`vesl-core`](https://github.com/zkvesl/vesl-core/tree/11d110d/crates/vesl-core/src/graft_pokes); the `_from_noun` variants and signature alternates live alongside.

### Commitment

```rust
// crates/vesl-core/src/graft_pokes/settle.rs
use vesl_core::{Mint, build_settle_register_poke};
let mut mint = Mint::new();
let root = mint.commit(&[b"first-license"]);
let slab = build_settle_register_poke(1, &root);
```

```rust
// crates/vesl-core/src/graft_pokes/mint.rs
use vesl_core::{Mint, build_mint_commit_poke};
let mut mint = Mint::new();
let root = mint.commit(&[b"asset-1"]);
let slab = build_mint_commit_poke(1, &root);
```

```rust
// crates/vesl-core/src/graft_pokes/guard.rs
use vesl_core::{Mint, build_guard_register_poke, build_guard_check_poke};
let mut mint = Mint::new();
let root = mint.commit(&[b"member-a"]);
let register = build_guard_register_poke(1, &root);
let check    = build_guard_check_poke(1, b"member-a");
```

```rust
// crates/vesl-core/src/graft_pokes/forge.rs
use vesl_core::build_forge_prove_poke;
let slab = build_forge_prove_poke(/*hull=*/ 1, /*note_id=*/ 42, b"payload-bytes");
```

### State

```rust
// crates/vesl-core/src/graft_pokes/kv.rs
use vesl_core::{build_kv_set_poke, build_kv_delete_poke};
let set = build_kv_set_poke("user:123", b"alice@example.com");
let del = build_kv_delete_poke("user:123");
```

```rust
// crates/vesl-core/src/graft_pokes/counter.rs
use vesl_core::{build_counter_increment_poke, build_counter_set_poke};
let inc = build_counter_increment_poke("page-views");
let set = build_counter_set_poke("page-views", 0);
```

```rust
// crates/vesl-core/src/graft_pokes/queue.rs
use vesl_core::{build_queue_push_poke, build_queue_pop_poke};
let push = build_queue_push_poke(b"job-payload-jammed");
let pop  = build_queue_pop_poke();
```

```rust
// crates/vesl-core/src/graft_pokes/rbac.rs
use vesl_core::{build_rbac_grant_poke, build_rbac_revoke_poke};
let grant  = build_rbac_grant_poke(/*pubkey=*/ 0xCAFE_BABE, &["registry-put"]);
let revoke = build_rbac_revoke_poke(0xCAFE_BABE, &["registry-put"]);
```

```rust
// crates/vesl-core/src/graft_pokes/registry.rs
use vesl_core::{build_registry_put_poke, build_registry_del_poke};
let put = build_registry_put_poke(/*key=*/ 1, /*record_jammed=*/ &record);
let del = build_registry_del_poke(1);
```

### Behavior

```rust
// crates/vesl-core/src/graft_pokes/validate.rs
use vesl_core::{build_validate_init_poke, Rule};
let rules = &[Rule::NonEmpty];
let slab  = build_validate_init_poke("issue-license", rules);
```

```rust
// crates/vesl-core/src/graft_pokes/log.rs
use vesl_core::build_log_append_poke;
let slab = build_log_append_poke("audit", b"issued license to user 42");
```

```rust
// crates/vesl-core/src/graft_pokes/clock.rs
use vesl_core::build_clock_tick_poke;
let slab = build_clock_tick_poke();
```

```rust
// crates/vesl-core/src/graft_pokes/batch.rs
use vesl_core::{build_batch_init_poke, build_batch_add_poke, build_batch_flush_poke};
let init  = build_batch_init_poke(/*threshold=*/ 100);
let add   = build_batch_add_poke(b"intent-jammed");
let flush = build_batch_flush_poke();
```

### Intent

```rust
// Example: intent-graft is a placeholder — no Rust builder ships today.
// Causes routed through it crash on invocation until upstream lands.
```

## Fallback Paths

If you scaffolded from upstream nockup's `basic` template (or any other non-vesl template), your `hoon/app/app.hoon` lacks the ten `::  nockup:*` markers `nockup graft inject` wires against. `nockup project init` with `template = "vesl"` produces them automatically; this `cp` is the manual equivalent:

```bash
cp <vesl-nockup>/templates/vesl/hoon/app/app.hoon hoon/app/app.hoon
```

The marker template is the same minimal kernel as the basic scaffold's `app.hoon`, with the markers pre-placed at the right structural points. Do not edit `app.hoon` back to the basic shape afterwards — keep the markers.

::: info See Also

- [vesl-nockup README — Step 2](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#step-2--install-the-vesl-graft-packages) — install the vesl-graft package via nockup.
- [Reference / Library catalog](/reference/library) — per-graft one-liners and links to source for every shipped graft, support Hoon library, and Rust crate.
- [Grafts / Manifest Schema](/build/grafts/manifest-schema) — manifest TOML fields and the priority lattice in detail.

:::
