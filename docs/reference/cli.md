# CLI Reference

This page covers `graft-inject` — the kernel-composition tool used when building grafted NockApps. Most SDK users only need this.

For the reference LLM Hull, see [hull-llm CLI reference](https://github.com/zkvesl/hull-llm/blob/main/docs/cli-reference.md).

## graft-inject

`graft-inject` discovers `<name>-graft.toml` manifests under a library directory and composes their blocks into a host `app.hoon`. One call writes imports, state fields, cause branches, poke arms, and peek chains for every graft it picks up.

### Usage

```
graft-inject [OPTIONS] [PATH]
```

`PATH` is the target `app.hoon`. Omit to print `--list` output.

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--grafts <CSV>` | (auto-discover all) | Comma-separated graft names to compose, in the order listed. Overrides auto-discovery. Unknown names hard-error. |
| `--exclude <CSV>` | (none) | Graft names to skip. Subtracts from either the auto-discovered set or `--grafts`. |
| `--lib-dir <DIR>` | `./hoon/lib/` | Where to look for `*-graft.toml` manifests. |
| `--list` | — | Print the discovered grafts and their blocks; exit without writing. |
| `--json` | — | Pairs with `--list`. Machine-readable JSON output. |
| `--apply` | — | Write the composed output to `PATH`. Without this flag, `graft-inject` is preview-only (see below). |
| `--dry-run` | — | Deprecated alias of the preview-only default. Prints a deprecation note; otherwise does nothing beyond the default. |

### Preview-by-default

A bare invocation with `PATH` set prints the composed kernel to stdout and a per-manifest sha256 summary to stderr. Nothing is written to disk until `--apply` is passed. This is the trust boundary: manifest `body` fields paste verbatim into the composed kernel, so seeing the diff — and the sha256 of each manifest that contributed to it — before the write lands is the only way to catch a compromised `hoon/lib/` directory (pulled via `sync.sh`, a stray `cp`, a tampered dependency) before hostile Hoon becomes kernel source.

CI pipelines and scripted deployments should pass `--apply` explicitly.

### Injection report

Invocation with `--apply` against a four-graft kernel:

```
graft-inject: hoon/app/app.hoon
  settle-graft     sha256:a9c72bbe7dc1 injected 5/5 (imports, state, cause, poke, peek)
  mint-graft       sha256:4b2e1c8930f2 injected 5/5 (imports, state, cause, poke, peek)
  guard-graft      sha256:c310a56e47bd injected 5/5 (imports, state, cause, poke, peek)
  forge-graft      sha256:f72193ac2018 injected 3/3 (imports, cause, poke)
  markers in source: 7 (imports, state, cause, poke-prelude, poke, poke-postlude, peek)
  markers populated: 5 (imports, state, cause, poke, peek)
```

The denominator is per-graft: each primitive declares which blocks it ships in its manifest. Forge is stateless and reports 3/3 (no state, no peek). A second run reports every line as `skipped: …` — `graft-inject` is idempotent; re-running against an already-wired kernel is a no-op. Without `--apply` the same report prints to stderr, followed by `(preview only — pass --apply to write <PATH>)`.

### Priority lattice

Grafts are injected in priority order (lower = earlier). Manifests can declare `after = ["<graft>"]` for soft ordering hints that resolve priority ties when both grafts are present. If the named graft isn't in the active cp set, the hint is silently ignored (a one-line note prints on stderr); priority-based ordering applies.

Hard ordering requirements aren't expressible — we deliberately keep all dependencies soft so subsetting works. If a graft structurally requires another graft's state shape, surface that through documentation, not a manifest field.

| Range | Class | Examples |
|---|---|---|
| 10–40 | Commitment | settle, mint, guard, forge |
| 50–99 | State | kv, counter, queue, rbac, registry |
| 100–149 | Behavior | validate, log, clock, batch |
| 150–199 | (reserved for user/domain grafts) | — |
| 200–299 | Intent | intent-graft (placeholder) |

### JSON schema (`--list --json`)

```json
[
  {
    "name": "settle-graft",
    "version": "0.1.0",
    "priority": 10,
    "blocks": ["imports", "state", "cause", "poke", "peek"],
    "applicable": 5,
    "deferred": false,
    "sha256": "a9c72bbe…"
  }
]
```

`sha256` is the hex sha256 of the manifest's raw TOML bytes — exposed so supply-chain reviewers can pin expected digests. Stable across the PARAMETIZATION plan's lifespan. Version bumps append fields, never reshape. Tier 2 crates can hard-fail at boot if a required graft is missing or its digest drifts.

### Common errors

- `warning — markers not found: ...` — your `app.hoon` is missing one of the seven `::  nockup:<name>` markers, or the two-space law is violated. See `vesl-nockup/templates/app.hoon` for canonical placement.
- `unknown graft: <name>` — `--grafts` named a manifest not in `--lib-dir`. Run `graft-inject --list` to see what's installed.
- Subsequent `hoonc` failure with `mint-lost` / `-lost %<tag>` on a composed `?-` — stale manifest. Re-install the graft package (or re-run `sync.sh` in a dev checkout) to pick up the current cause-union shape.

## vesl-core Makefile targets

For the agnostic Hull template in [zkvesl/vesl-core](https://github.com/zkvesl/vesl-core). vesl-core is a Cargo workspace — `make build` compiles `crates/*`, `hull/`, and `kernels/*` together into a single `target/`.

| Target | Description |
|--------|-------------|
| `make setup` | Create `hoon/` symlinks to the nockchain monorepo |
| `make build` | Compile the workspace (`cargo build --workspace --release`) |
| `make test` | Run all workspace tests |
| `make test-unit` | Run unit tests only (workspace libraries) |
| `make clean` | Remove build artifacts |
