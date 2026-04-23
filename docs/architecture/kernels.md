# Hoon Kernels

vesl's logic lives in Hoon kernels. These get compiled to Nock (via `hoonc`) and loaded by a Hull at runtime. Each kernel ships pre-compiled as a `.jam` file — you don't need to touch Hoon to consume a graft (an alien language by any reasonable definition).

## The commitment kernels

vesl ships four commitment kernels in [zkvesl/vesl](https://github.com/zkvesl/vesl) `protocol/lib/`:

- **mint-kernel.hoon** — commits data to a Merkle root per `hull=@`
- **guard-kernel.hoon** — verifies inclusion proofs against a registered root
- **settle-kernel.hoon** — on-chain settlement with replay protection
- **forge-kernel.hoon** — STARK-proves arbitrary Nock computation

Each compiles to `mint.jam`, `guard.jam`, `settle.jam`, `forge.jam` under `assets/`. The corresponding Rust wrapper crates (`kernels/{mint,guard,settle}/`) embed the JAM bytes and hash-verify them at load time.

Supporting libraries:

- **vesl-merkle.hoon** — tip5 Merkle primitives (hash, tree, proof)
- **vesl-prover.hoon** — STARK proof generation (bypasses puzzle-nock, proves arbitrary `[subject formula]` pairs)
- **vesl-verifier.hoon** — two-level STARK verification: structural re-execution (Level 1) and full FRI + constraint math (Level 2)
- **vesl-stark-verifier.hoon** — minimal fork of the nockchain verifier that accepts `[s f]` directly

## Compilation

If you're working on a kernel:

```bash
hoonc --new protocol/lib/<kernel>.hoon hoon/
```

The `--new` flag forces a fresh compile (hoonc caches aggressively). The compiled kernel is output as a `.jam` file.

## STARK proving

```
  input
  *[[note-id hull-id merkle-root] [0 1]]
                  │
                  ▼
┌─────────────────────────────────────┐
│  nock execution        fink:fock    │
│  trace each reduction step          │
│  top-level loop: interpreted nock   │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  constraint tables                  │
│  encode trace → algebraic           │
│  constraints over finite field      │
└─────────────────┬───────────────────┘
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
┌───────────────┐ ┌──────────────────┐
│ zkvm-jetpack  │ │ STARK prover     │
│ 85 jets       ├─┤                  │
│               │ │ FRI commitment   │
│ field arith   │ │ constraint poly  │
│ NTT           │ │ DEEP codeword    │
│ tip5 hash     │ │ verification     │
└───────────────┘ └────────┬─────────┘
                           │
                           ▼
             ┌──────────────────────┐
             │ STARK proof          │
             │ binds:               │
             │  note-id             │
             │  hull-id             │
             │  merkle-root         │
             └──────────────────────┘
```

`forge-graft` generates a STARK proof over an arbitrary `[subject formula]` pair. The proof binds the computation to a cryptographic attestation — an auditor can verify the proof without the original inputs.

The prover traces Nock execution via `fink:fock`, builds constraint tables, and generates a STARK proof with FRI commitment, constraint polynomial evaluation, and DEEP codeword verification. Math sub-operations (field arithmetic, NTT, tip5 hashing) are jet-accelerated via `zkvm-jetpack` (85 jets). The top-level proof loop runs in interpreted Nock.

STARK proving requires `--stack-size huge` (64 GB virtual NockStack) and a machine with 64+ GB physical RAM. On Linux, enable `vm.overcommit_memory=1`.

## Graft catalog families

The commitment primitives above (mint / guard / settle / forge) are family 1 of vesl's 5-family graft catalog. The other four families:

- **Family 2 (verification gates)** — library arms consumed by commitment grafts. A gate is a parameter, not a stage.
- **Family 3 (state)** — planned app-state primitives (kv, counter, queue, rbac, registry).
- **Family 4 (behavior)** — planned runtime wrappers (validate, fsm, log, clock).
- **Family 5 (intent)** — placeholder (`intent-graft.hoon`) whose arms crash on invocation. Reserved for multi-party coordination once Nockchain upstream publishes a canonical shape.

The authoritative lattice and manifest schema live in `vesl/docs/graft-manifest.md`; the [Grafting Guide](/guides/grafting) mirrors it with composition examples.
