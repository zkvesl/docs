---
title: vesl.toml
description: Config file fields for a vesl-based hull — settlement mode, chain endpoint, key derivation.
outline: deep
---

# `vesl.toml`

Config file for any vesl-based hull. All fields are optional; environment variables and CLI flags override config file values. Precedence: CLI flag > env var > `vesl.toml` > defaults.

## Worked example

```toml
# Path to the nockchain monorepo (required for `make setup`)
# Default matches the standard sibling layout: ~/projects/nockchain/{vesl-core,nockchain}
nock_home = "../nockchain"

# Hull HTTP API port (default: 3000)
# api_port = 3000

# Settlement mode: "local" (default), "fakenet", or "dumbnet"
# settlement_mode = "local"

# Chain settings (fakenet/dumbnet only)
# chain_endpoint = "http://localhost:9090"
# tx_fee = 256                # network minimum is 256 nicks
# coinbase_timelock_min = 1
# accept_timeout_secs = 300   # fakenet default; dumbnet default is 900
```

## Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `nock_home` | string | — | Path to the nockchain monorepo. Required for `make setup`. |
| `api_port` | integer | `3000` | HTTP API port for `--serve` mode. |
| `settlement_mode` | string | `"local"` | One of `local`, `fakenet`, `dumbnet`. |
| `chain_endpoint` | string | `"http://localhost:9090"` | Nockchain gRPC endpoint. Only used in fakenet/dumbnet. |
| `tx_fee` | integer | `256` | Transaction fee in nicks. |
| `coinbase_timelock_min` | integer | `1` | Minimum confirmations before a coinbase UTXO is spendable. |
| `accept_timeout_secs` | integer | `300` / `900` | Seconds to wait for tx acceptance. Fakenet: 300, dumbnet: 900. |

## Key derivation

For `dumbnet` mode the hull needs a signing key. Resolution order, highest priority first:

1. `--seed-phrase-file <path>` — reads one line from a file (recommended; keeps the value out of `ps` output).
2. `--seed-phrase <phrase>` — passed on the CLI (visible in process table).
3. `VESL_SEED_PHRASE` environment variable.

Domain hulls may add their own fields. The TOML role-toggle pattern (the same code reads different sections of one TOML for different roles) is exercised in [`crates/vesl-core/tests/wallet_toml_e2e.rs`](https://github.com/zkvesl/vesl-core/blob/11d110d/crates/vesl-core/tests/wallet_toml_e2e.rs).

## See also

- [`vesl-core/vesl.toml.example`](https://github.com/zkvesl/vesl-core/blob/main/vesl.toml.example) — copy-and-edit starting point.
- [Build / Build & Run — settlement modes](/build/build-run#settlement-modes) — how the settlement modes are exercised at run time.
