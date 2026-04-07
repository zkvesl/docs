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
- **vesl-prover.hoon** — STARK proof generation (bypasses puzzle-nock, proves arbitrary `[subject formula]` pairs)
- **vesl-verifier.hoon** — two-level STARK verification: structural re-execution (Level 1) and full FRI + constraint math (Level 2)
- **vesl-stark-verifier.hoon** — minimal fork of the nockchain verifier that accepts `[s f]` directly

## Compilation

If you're working on the kernel itself:

```bash
hoonc --new protocol/lib/vesl-kernel.hoon hoon/
```

The `--new` flag forces a fresh compile (hoonc caches aggressively). The compiled kernel is output as a `.jam` file in `assets/`.

## STARK proving

The `/prove` endpoint generates a STARK proof of the settlement commitment `*[[note-id hull-id merkle-root] [0 1]]`. The proof binds the settlement metadata to a cryptographic attestation — an auditor can verify the proof without the original data, manifest, or LLM output.

The prover traces Nock execution via `fink:fock`, builds constraint tables, and generates a STARK proof with FRI commitment, constraint polynomial evaluation, and DEEP codeword verification. Math sub-operations (field arithmetic, NTT, tip5 hashing) are jet-accelerated via `zkvm-jetpack` (85 jets). The top-level proof loop runs in interpreted Nock.

STARK proving requires `--stack-size huge` (64 GB virtual NockStack) and a machine with 64+ GB physical RAM. On Linux, enable `vm.overcommit_memory=1`.

~
