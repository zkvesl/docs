# Configuration

vesl is configured via `vesl.toml` in the project root. CLI flags override environment variables, which override the config file, which overrides defaults.

```bash
cp vesl.toml.example vesl.toml
```

## Settlement modes

| Mode | What happens | Chain required |
|------|-------------|----------------|
| `local` | Kernel verifies, no chain interaction. Default. | No |
| `fakenet` | Full pipeline — sign, build tx, submit to a local nockchain fakenet. | Yes (local) |
| `dumbnet` | Same as fakenet but uses a real seed phrase for key derivation. | Yes (live) |

Set via `--settlement-mode`, `VESL_SETTLEMENT_MODE`, or `settlement_mode` in `vesl.toml`. Passing `--chain-endpoint` or `--submit` without an explicit mode infers `fakenet`.

## Config precedence

```
CLI flag > environment variable > vesl.toml > mode defaults
```

For example, `--settlement-mode fakenet` overrides whatever is in `vesl.toml`, which in turn overrides the default of `local`.

## Key derivation

For dumbnet mode, the hull needs a signing key. Resolution order:

1. `--seed-phrase-file <path>` — reads one line from a file (recommended, keeps the value out of `ps` output)
2. `--seed-phrase <phrase>` — passed on the CLI (visible in process table)
3. `VESL_SEED_PHRASE` environment variable

## vesl.toml fields

See [vesl.toml Reference](/reference/vesl-toml) for the complete field list.

~
