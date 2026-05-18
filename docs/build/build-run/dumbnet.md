---
title: Dumbnet Walkthrough
description: Wire the hull to a live nockchain endpoint — seed-phrase resolution, the dumbnet vesl.toml shape, and the deploy posture for a hull with spend authority.
outline: deep
---

# Dumbnet Walkthrough

Dumbnet runs the same pipeline as [fakenet](/build/build-run/fakenet) against the live network, using a real seed phrase for key derivation. Use it once your kernel is stable on fakenet — every transaction has economic stakes.

**1. Generate or reuse a key pair:**

```bash
nockchain-wallet keygen
```

Capture the seed phrase out-of-band; you'll feed it to the hull via a file flag rather than `vesl.toml`.

**2. Stash the seed phrase** in a permission-locked file:

```bash
mkdir -p ~/.config/vesl && touch ~/.config/vesl/dumbnet.seed
chmod 600 ~/.config/vesl/dumbnet.seed
$EDITOR ~/.config/vesl/dumbnet.seed
```

The file form keeps the value out of `ps` output. Resolution order is: `--seed-phrase-file <path>` > `--seed-phrase <phrase>` > `VESL_SEED_PHRASE` > `[wallet] seed_phrase = "..."` in `vesl.toml`. Avoid the last form for production — it pins live key material in a file that may end up in source control.

**3. Configure your hull:**

```toml
nock_home = "../nockchain"
settlement_mode = "dumbnet"
chain_endpoint = "https://your-nockchain-rpc.example"   # required
tx_fee = 256
coinbase_timelock_min = 1
accept_timeout_secs = 900   # dumbnet default; blocks land every ~10 min

[wallet]
account = 0
```

`chain_endpoint` is required for dumbnet — there is no compiled-in default. `accept_timeout_secs = 900` matches the live-network block cadence; a settle that triggers a tx won't return its effect until the network accepts.

**4. Run the hull**, supplying the seed phrase via the file flag:

```bash
cargo +nightly run -- \
  --settlement-mode dumbnet \
  --seed-phrase-file ~/.config/vesl/dumbnet.seed
```

For deployment, lock down both the seed file and the host running the hull — the BIP-39/BIP-44 derivation gives the hull spend authority over any UTXO locked to the resulting pkh.

::: info See Also

- [Build & Run](/build/build-run/) — kernel compile and settlement-mode selection.
- [Serve Subcommand](/build/build-run/serve) — running the dumbnet-configured hull as an HTTP server; the same seed-resolution rules apply to the Serve arm.
- [Fakenet Walkthrough](/build/build-run/fakenet) — the local-testnet counterpart; iterate there before pointing at dumbnet.
- [Reference / vesl.toml](/reference/vesl-toml) — full field list including the `[wallet]` schema.

:::
