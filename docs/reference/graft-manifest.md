---
title: Graft manifest schema
description: TOML schema for graft manifests — the file format graft-inject reads to compose a graft into your kernel.
outline: deep
---

# Graft manifest schema

A graft manifest is a TOML file that describes how `graft-inject` composes a Hoon library into a host kernel's `app.hoon`. One manifest per graft, sibling to the graft's `.hoon` file under `hoon/lib/`. The full source-of-truth schema lives at [`vesl-nockup/docs/graft-manifest.md`](https://github.com/zkvesl/vesl-nockup/blob/main/docs/graft-manifest.md); this page is a navigable companion.

## Layout

```
hoon/lib/
├── settle-graft.hoon      Hoon library
├── settle-graft.toml      manifest (this schema)
├── mint-graft.hoon
├── mint-graft.toml
└── ...
```

Flat — no per-graft directory. The manifest's `name` field, not its filename, is the canonical identifier the loader uses.

## Manifest skeleton

```toml
[graft]
name      = "settle-graft"      # canonical name, matches --grafts <CSV>
version   = "0.1.0"             # semver
priority  = 10                  # injection order; band picks the family
stability = "stable"            # stable | beta | placeholder
after     = []                  # soft ordering hints

[graft.types]                   # optional — typed effect-union codegen input
effect    = "settle-effect"
cause     = "settle-cause"

[graft.gates]                   # optional — gate selection (commitment grafts)
gate      = "manifest-verify"

[graft.blocks.imports]
sentinel  = "*settle-graft"
body      = """
/+  *settle-graft
/+  *vesl-merkle"""

[graft.blocks.state]
sentinel  = "settle=settle-state"
body      = "settle=settle-state"

# ... one [graft.blocks.<marker>] per marker the graft contributes to
```

## `[graft]` — top-level metadata

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Canonical name. Must be unique across all manifests under the discovery root. |
| `version` | string | yes | Semver. Bumped when blocks change in a backwards-incompatible way. |
| `priority` | int | yes | Injection order. Lower = injected earlier. The band picks the family. |
| `stability` | string | no | One of `stable`, `beta`, `placeholder`. Defaults to `stable`. `placeholder` marks a reserved family slot whose body crashes on invocation (see `intent-graft`). |
| `after` | string list | no | Soft ordering hints. Each entry names another graft that must inject earlier. If an entry names a graft not in the discovered set, the hint is silently ignored and priority-based ordering applies. |

## `[graft.blocks.<marker>]` — injection blocks

A graft contributes one block per marker it claims. Ten markers exist — seven content markers and three codegen markers (`domain-effect`, `effect-union`, `load-defaults`). Codegen markers are anchors for graft-inject's own passes; grafts don't contribute per-graft blocks at them.

| Marker | What lands here |
|---|---|
| `imports` | `/+` and `/=` import lines |
| `state` | per-graft fragments inside `+$ versioned-state` |
| `cause` | variant additions to the cause `$%` union |
| `poke-prelude` | pre-flight hook (e.g. `validate-graft`) |
| `poke` | the `?-` arms |
| `poke-postlude` | post-flight observer (e.g. `log-graft`, `batch-graft`) |
| `peek` | peek arms (joined into a chain across grafts) |
| `domain-effect` | codegen anchor (your `+$ domain-effect $%(...)` declaration) |
| `effect-union` | codegen anchor (typed effect-union written by the composer) |
| `load-defaults` | codegen anchor (state-shape migration overlay on resume) |

Each present block is a TOML sub-table with two fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `sentinel` | string | yes | Documentation-only — names the marker the block targets. The loader's idempotence runs off `::  graft-inject:<name>:<marker>:begin` banner comments the composer emits. |
| `body` | string | yes | The Hoon to paste at the marker. Stored unindented; the loader re-applies indentation from the marker's leading whitespace. Leading and trailing newlines are trimmed. |

A content block omitted from the manifest is not injected for that marker — the marker is left untouched.

## `[graft.gates]` — gate selection

Commitment grafts (`settle-graft` is the canonical example) accept a verification gate as a parameter. The default is a hash-comparison gate the composer installs. To swap in a named gate from `vesl-gates.hoon`:

```toml
[graft.gates]
gate = "manifest-verify"
```

Or for a chain of gates evaluated in order:

```toml
[graft.gates]
gate-chain = ["sig-verify-schnorr", "manifest-verify"]
```

Five named gates ship: `sig-verify-ed25519`, `sig-verify-schnorr`, `manifest-verify`, `set-membership-verify`, `bounded-value-verify`. Selecting a different gate at any point — including mid-project — and re-running `graft-inject inject --apply` re-injects the new gate body; the composer detects manifest drift via the sha256 in each begin-banner.

A gate is a parameter, not a step in a pipeline. See [Build / Kernel — replacing a verification gate](/build/kernel#replacing-a-verification-gate) for replacing a gate with a fully custom one.

## `[graft.types]` — typed effect-union input

A graft that exports a tagged effect type opts into the typed effect-union codegen by declaring it:

```toml
[graft.types]
effect = "settle-effect"
cause  = "settle-cause"
```

Names must be kebab-case (`^[a-z][a-z0-9-]*$`). Two grafts cannot declare the same `effect` (or `cause`) name — `graft-inject` hard-errors at discovery if they collide. The composer synthesizes a `+$ effect $%(...)` union under the `nockup:effect-union` marker; variant order matches injection order. The cause field is reserved for forward-compat cause-destructuring and not yet read.

## The 5-family lattice

Grafts fall into five families. The priority number both orders injection and labels the family.

| # | Family | Priority band | Role | Examples |
|---|---|---|---|---|
| 1 | Commitment | 10–40 | STARK-bearing primitives that commit data to hull-keyed roots | `settle-graft` (10), `mint-graft` (20), `guard-graft` (30), `forge-graft` (40) |
| 2 | Verification gates | n/a (library) | Parameterized decision functions consumed by commitment grafts via `[graft.gates]` | `vesl-gates.hoon` (5 named gates ship today) |
| 3 | State | 50–99 | Domain-keyed app-state primitives | `kv` (50), `counter` (60), `queue` (70), `rbac` (80), `registry` (90) |
| 4 | Behavior | 100–149 | Runtime wrappers that enforce or observe rules around other grafts | `validate` (100), `log` (130), `clock` (140), `batch` (145) |
| 5 | Intent | 200–299 | Multi-party coordination primitives (declare / match / cancel / expire) | `intent-graft` (200, placeholder) |

Bands 150–199 and 300+ are reserved for future families or user/domain grafts. Verification gates do not claim a priority band — they're library arms imported by commitment grafts.

## Trust model

A manifest's `body` field is Hoon text pasted **verbatim** into your `app.hoon`. `graft-inject` does not sanitize, sandbox, sign-check, or verify the provenance of a manifest. Whatever Hoon a `.toml` declares becomes kernel source on the next `--apply`.

Three consequences:

- **Manifests are code.** Treat them like any other dependency: review incoming changes the way you would a PR that touches `hoon/lib/`.
- **`graft-inject` is a composition step, not a trust boundary.** Trust is managed at the distribution layer — checkout provenance, directory hygiene, what lands in `hoon/lib/`.
- **Preview by default.** `graft-inject inject` prints the composed diff and a per-manifest sha256 to stderr; nothing writes to disk until `--apply`. This keeps silent supply-chain drift impossible without explicit consent.

## Worked example: `settle-graft.toml`

```toml
[graft]
name     = "settle-graft"
version  = "0.1.0"
priority = 10
after    = []

[graft.types]
effect = "settle-effect"
cause  = "settle-cause"

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

# [graft.blocks.poke] block contains the ?- arms.
# See the file linked below for the full body.
```

The full file is at [`hoon/lib/settle-graft.toml`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/hoon/lib/settle-graft.toml).

## See also

- [`vesl-nockup/docs/graft-manifest.md`](https://github.com/zkvesl/vesl-nockup/blob/main/docs/graft-manifest.md) — canonical source-of-truth schema document.
- [Reference / CLI (graft-inject)](/reference/cli) — the consumer of this schema.
- [Build / Inject](/build/inject) — how the schema fits into the dev workflow.
