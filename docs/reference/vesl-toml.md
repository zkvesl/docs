# vesl.toml Reference

All fields are optional. Environment variables and CLI flags override config file values.

```toml
# Path to the nockchain monorepo (required for `make setup` and `make kernel`)
# Default matches the standard sibling layout: ~/projects/nockchain/{vesl,nockchain}
nock_home = "../../nockchain"

# Ollama endpoint (optional — demo uses stub provider if unset)
# ollama_url = "http://localhost:11434"

# Hull HTTP API port (default: 3000)
# api_port = 3000

# Settlement mode: "local" (default), "fakenet", or "dumbnet"
# settlement_mode = "local"

# Chain settings (fakenet/dumbnet only)
# chain_endpoint = "http://localhost:9090"
# tx_fee = 256              # network minimum is 256 nicks
# coinbase_timelock_min = 1
# accept_timeout_secs = 300   # fakenet default; dumbnet default is 900
```

## Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `nock_home` | string | — | Path to the nockchain monorepo. Required for `make setup` and `make kernel`. |
| `ollama_url` | string | (none) | Ollama API base URL. If unset, the hull uses a deterministic stub provider. |
| `api_port` | integer | `3000` | HTTP API port for `--serve` mode. |
| `settlement_mode` | string | `"local"` | One of `local`, `fakenet`, `dumbnet`. |
| `chain_endpoint` | string | `"http://localhost:9090"` | Nockchain gRPC endpoint. Only used in fakenet/dumbnet. |
| `tx_fee` | integer | `256` | Transaction fee in nicks. |
| `coinbase_timelock_min` | integer | `1` | Minimum confirmations before a coinbase UTXO is spendable. |
| `accept_timeout_secs` | integer | `300` / `900` | Seconds to wait for tx acceptance. Fakenet: 300, dumbnet: 900. |

~
