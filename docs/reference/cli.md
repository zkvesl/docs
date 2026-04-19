# CLI Reference

Two CLIs ship with vesl: `graft-inject` (the kernel-composition tool used when building grafted NockApps) and the Hull binary (the full product's runtime). Most SDK users only need `graft-inject`.

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
  markers present: 5 (imports, state, cause, poke, peek)
```

The denominator is per-graft: each primitive declares which blocks it ships in its manifest. Forge is stateless and reports 3/3 (no state, no peek). A second run reports every line as `skipped: …` — `graft-inject` is idempotent; re-running against an already-wired kernel is a no-op. Without `--apply` the same report prints to stderr, followed by `(preview only — pass --apply to write <PATH>)`.

### Priority lattice

Grafts are injected in priority order (lower = earlier). Manifests can declare `after = ["<graft>"]` for soft ordering hints that resolve priority ties.

| Range | Class | Examples |
|---|---|---|
| 10–40 | Commitment primitives | settle=10, mint=20, guard=30, forge=40 |
| 50–99 | State-pattern grafts | (reserved — kv, counter, queue, rbac, registry) |
| 100+ | User / domain grafts | any custom graft you ship |

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

- `warning — markers not found: ...` — your `app.hoon` is missing one of the five `::  nockup:<name>` markers, or the two-space law is violated. See `vesl-nockup/templates/app.hoon` for canonical placement.
- `unknown graft: <name>` — `--grafts` named a manifest not in `--lib-dir`. Run `graft-inject --list` to see what's installed.
- Subsequent `hoonc` failure with `mint-lost` / `-lost %<tag>` on a composed `?-` — stale manifest. Re-install the graft package (or re-run `sync.sh` in a dev checkout) to pick up the current cause-union shape.

---

## Hull CLI

The rest of this page covers the Hull binary (`cargo run --bin hull`). SDK users building their own grafted NockApps don't need these flags — they're for operating the full vesl product.

## Make targets

| Target | Description |
|--------|-------------|
| `make setup` | Create `hoon/` symlinks to the nockchain monorepo |
| `make build` | Compile hull (`cargo build --release`) |
| `make build-dumbnet` | Compile hull with dumbnet wallet support |
| `make test` | Run all tests (unit + e2e) |
| `make test-unit` | Run unit tests only (99 tests) |
| `make demo-local` | Local-only demo (no chain, stub LLM unless Ollama configured) |
| `make demo-fakenet` | Full demo with fakenet (requires `nockchain` in PATH) |
| `make demo-dumbnet` | Demo against a running nockchain node (requires wallet init) |
| `make wallet-init` | Generate a new keypair for dumbnet mode |
| `make kernel` | Recompile Hoon kernel to `assets/vesl.jam` |
| `make clean` | Remove build artifacts and runtime state |
| `make status` | Show fakenet status |

## Hull CLI flags

Run the hull directly with `cd hull && cargo run -- [FLAGS]`.

### Pipeline flags

| Flag | Default | Description |
|------|---------|-------------|
| `--new` | — | Start fresh (required on first boot or after kernel recompile) |
| `--serve` | — | Start the HTTP API server instead of one-shot CLI pipeline |
| `--docs <dir>` | (built-in demo data) | Directory of `.txt` files to ingest |
| `--query <text>` | "Summarize Q3 financial position" | Query for one-shot mode |
| `--top-k <n>` | `2` | Number of top chunks to retrieve |
| `--ollama-url <url>` | (stub provider) | Ollama API endpoint for real LLM inference |
| `--model <name>` | `llama3.2` | Ollama model name |
| `--stack-size <size>` | `normal` | Nock stack size: `tiny` (2G), `small` (4G), `normal` (8G), `medium` (16G), `large` (32G), `huge` (64G). Use `huge` for STARK proving. |

### Server flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port <n>` | `3000` | HTTP API port |
| `--bind-addr <addr>` | `127.0.0.1` | Bind address. Use `0.0.0.0` to expose to the network. |

### Settlement flags

| Flag | Default | Description |
|------|---------|-------------|
| `--settlement-mode <mode>` | `local` | One of `local`, `fakenet`, `dumbnet` |
| `--chain-endpoint <url>` | — | Nockchain gRPC endpoint. Infers `fakenet` if set without explicit mode. |
| `--submit` | — | Submit settlement tx on-chain. Infers `fakenet` if set without explicit mode. |
| `--tx-fee <n>` | `3000` | Transaction fee in nicks |
| `--coinbase-timelock-min <n>` | `1` | Coinbase timelock minimum |
| `--accept-timeout <secs>` | `300` / `900` | TX acceptance timeout |
| `--seed-phrase-file <path>` | — | Path to file containing seed phrase (recommended over `--seed-phrase`) |
| `--seed-phrase <phrase>` | — | Seed phrase for dumbnet key derivation (visible in `ps`) |
| `--config <path>` | `../vesl.toml` | Path to config file |

## HTTP API

Start with `cd hull && cargo run -- --new --serve`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ingest` | POST | Documents in, Merkle tree out |
| `/query` | POST | Retrieve + infer + settle |
| `/prove` | POST | Like `/query` but adds STARK proof (needs `--stack-size huge`, 64+ GB RAM) |
| `/status` | GET | Tree state, settled notes, root |
| `/health` | GET | Liveness check |

### Example

```bash
# Ingest a document
curl -X POST http://127.0.0.1:3000/ingest \
  -H 'Content-Type: application/json' \
  -d '{"documents": ["Q3 revenue: $47M, up 12% YoY"]}'

# Query — triggers retrieve → LLM → verify → settle
curl -X POST http://127.0.0.1:3000/query \
  -H 'Content-Type: application/json' \
  -d '{"query": "Summarize Q3 financial position", "top_k": 2}'
```

~
