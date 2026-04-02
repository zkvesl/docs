# Hull (Rust Harness)

The Hull is vesl's Rust harness. It loads a compiled Hoon kernel (JAM file), manages state, and exposes an HTTP API for chunk operations.

Think of it as the engine block — the Hoon kernel is the logic, the Hull is what makes it run.

## Responsibilities

- Load and execute the Hoon kernel
- Manage the chunk store
- Expose REST API endpoints
- Handle signing and identity
- Settlement mode routing (local, fakenet, dumbnet)

<!-- TODO: expand with API surface and config details -->

~
