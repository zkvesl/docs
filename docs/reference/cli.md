# CLI Reference

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
| `--stack-size <size>` | `normal` | Nock stack size. Use `large` for STARK proving. |

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
| `/prove` | POST | Like `/query` but adds STARK proof (needs `--stack-size large`) |
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
