---
title: Fakenet Walkthrough
description: Wire the hull to a local nockchain fakenet — hub, miner, signing key, and the vesl.toml fields that drive end-to-end settlement.
outline: deep
---

# Fakenet Walkthrough

Fakenet is a local nockchain testnet — sandboxed, but the full settlement pipeline runs end-to-end (sign, build tx, submit, wait for acceptance). Reach for fakenet once kernel logic is stable in [`local` mode](/build/build-run/#settlement-modes) and you need to drive real transactions.

**Prerequisites.** Install the `nockchain` and `nockchain-wallet` binaries from your nockchain monorepo checkout:

```bash
cd $NOCK_HOME && make install-nockchain && make install-nockchain-wallet
```

**1. Set the mining pkh.** The fakenet miner mines coinbase UTXOs to the pkh in `.env`. Your hull must control the corresponding signing key, or it can't spend those UTXOs. For vesl-core's `hull/` template, the demo signing key's pkh is the canonical choice:

```bash
cd $NOCK_HOME
cp .env_example .env
# Replace MINING_PKH with the demo signing key's pkh
# (defined in vesl-core/hull/src/signing.rs::DEMO_KEY_PKH_BASE58)
sed -i 's/^MINING_PKH=.*/MINING_PKH=5pJiNWqnouxku6SvGU6XZhu98nHH5VFMaNJ4r1vtHxPJ5sHurHBfYnk/' .env
```

For a custom hull, mine to whatever pkh your hull's fakenet signing key controls.

**2. Boot the hub + miner.** Run each in its own working directory so checkpoint state stays isolated:

```bash
mkdir fakenet-hub fakenet-miner
cp .env fakenet-hub/ && cp .env fakenet-miner/

# Shell 1: hub (binds gRPC to 127.0.0.1:5555)
cd fakenet-hub && sh ../scripts/run_nockchain_node_fakenet.sh

# Shell 2: miner (mines to MINING_PKH from .env)
cd fakenet-miner && sh ../scripts/run_nockchain_miner_fakenet.sh
```

**3. Configure your hull.** In your project's `vesl.toml`:

```toml
nock_home = "../nockchain"
settlement_mode = "fakenet"
chain_endpoint = "http://127.0.0.1:5555"
tx_fee = 256                # network minimum, in nicks
coinbase_timelock_min = 1   # spendable after 1 confirmation
accept_timeout_secs = 300   # fakenet default
```

`chain_endpoint` must match the port the hub binds (`5555` per the upstream script). vesl-core's compiled-in default of `http://localhost:9090` is from a different layout — set the field explicitly to avoid silent mismatch.

**4. Run the hull:**

```bash
cargo +nightly run -- --settlement-mode fakenet
```

Each settled note produces `%settle-noted` followed by a `tx_id` in the effect list, and stderr shows the tx submission and acceptance. Expect a few seconds of pipeline latency per settle as the tx works through mempool and into a mined block.

::: info See Also

- [Build & Run](/build/build-run/) — kernel compile and settlement-mode selection.
- [Serve Subcommand](/build/build-run/serve) — running the same hull as an HTTP server against a fakenet endpoint.
- [Dumbnet Walkthrough](/build/build-run/dumbnet) — the live-network counterpart.
- [nockchain README — Run a testnet](https://github.com/nockchain/nockchain/blob/main/README.md#how-do-i-run-a-testnet) — upstream fakenet hub + miner setup.
- [`vesl-core/hull/src/signing.rs`](https://github.com/zkvesl/vesl-core/blob/11d110d/hull/src/signing.rs) — `demo_signing_key()` and `DEMO_KEY_PKH_BASE58`.
- [Reference / vesl.toml](/reference/vesl-toml) — full field list including the `[wallet]` schema.

:::
