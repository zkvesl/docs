# Hoon Kernels

vesl's logic lives in Hoon kernels. These get compiled to Nock (via `hoonc`) and loaded by the Hull at runtime. For most developers, the kernels ship pre-compiled — you don't need to touch Hoon.

## Key kernels

- **rag.hoon** — core execution and verification logic
- **manifest.hoon** — commitment and proof generation

## Compilation

If you're working on the kernels themselves:

```bash
hoonc kernels/rag.hoon hoon/ --new
```

The `--new` flag forces a fresh compile (hoonc caches aggressively).

<!-- TODO: document kernel structure and the two-space law -->

~
