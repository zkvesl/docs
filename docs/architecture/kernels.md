# Hoon Kernels

vesl's logic lives in Hoon kernels. These get compiled to Nock (via `hoonc`) and loaded by the Hull at runtime.

## Key kernels

- **rag.hoon** — core retrieval and verification logic
- **manifest.hoon** — chunk commitment and proof generation

## Compilation

```bash
hoonc kernels/rag.hoon hoon/ --new
```

The `--new` flag forces a fresh compile (hoonc caches aggressively).

<!-- TODO: document kernel structure and the two-space law -->

~
