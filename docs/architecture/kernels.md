# Hoon Kernels

vesl's logic lives in Hoon kernels. These get compiled to Nock (via `hoonc`) and loaded by the Hull at runtime. The kernel ships pre-compiled as `assets/vesl.jam` — you don't need to touch Hoon.

## The Kernel

The Hull boots `vesl-kernel.hoon` (compiled to `vesl.jam`, ~18 MB). It handles:

- Root registration (Merkle commitment)
- Manifest verification (proof checking + prompt integrity)
- Settlement (note state transitions)
- STARK proof generation (via the embedded prover)
- Transaction ID and signature hash computation

Supporting libraries:

- **vesl-logic.hoon** — pure verification gates (Merkle, manifest, settlement)
- **vesl-prover.hoon** — STARK proof generation
- **vesl-verifier.hoon** — STARK verification

## Compilation

If you're working on the kernel itself:

```bash
hoonc --new protocol/lib/vesl-kernel.hoon hoon/
```

The `--new` flag forces a fresh compile (hoonc caches aggressively). The compiled kernel is output as a `.jam` file in `assets/`.

~
