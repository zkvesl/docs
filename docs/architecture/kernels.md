# Hoon Kernels

vesl's logic lives in Hoon kernels. These get compiled to Nock (via `hoonc`) and loaded by the Hull at runtime. For most developers, the kernels ship pre-compiled — you don't need to touch Hoon.

## Kernels

vesl ships four kernels — each a progressively lighter slice of the protocol:

| Kernel | File | What it does |
|--------|------|-------------|
| **vesl** | `vesl-kernel.hoon` | Full: settlement, STARK proving, and tx-engine |
| **beak** | `beak-kernel.hoon` | Settlement + verification, no STARK proving |
| **grip** | `grip-kernel.hoon` | Commitment + verification, no settlement |
| **ink** | `ink-kernel.hoon` | Commitment only — just hashing and root registration |

Supporting libraries:

- **vesl-logic.hoon** — pure verification gates (Merkle, manifest, settlement)
- **vesl-prover.hoon** — STARK proof generation
- **vesl-verifier.hoon** — STARK verification

## Compilation

If you're working on the kernels themselves:

```bash
hoonc --new protocol/lib/vesl-kernel.hoon hoon/
```

The `--new` flag forces a fresh compile (hoonc caches aggressively). Compiled kernels are output as `.jam` files in `assets/`.

~
