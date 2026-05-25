---
layout: home
hero:
  image:
    src: /vesl_horizontal_alpha.svg
    alt: vesl — Verifiable Execution and Settlement Layer
  text: Primitives and tooling for verifiable apps.
  tagline: 14 cryptographic and state primitives, a typed Rust SDK, a real-kernel test harness, an HTTP server. One `nockup graft inject` command composes them into a deterministic kernel.
  actions:
    - theme: brand
      text: I'm a Rust dev — let me build
      link: /setup/quickstart
    - theme: alt
      text: I'm evaluating — show me the case
      link: /pitch
    - theme: alt
      text: I'm an AI agent — give me the index
      link: /llms.txt
features:
  - title: 14 primitives, one composition command
    details: Merkle commitments, STARK proofs, RBAC, audit log, settlement queue, key-value store, and more. `nockup graft inject` wires any subset into your kernel.
  - title: Typed Rust SDK at every seam
    details: One `build_*_poke` per cause, a `PokeOutcome` enum, compile-time drift detection. You write Rust, not noun construction.
  - title: Real-kernel test harness
    details: "`vesl-test` boots your compiled kernel and runs tests against it. What you test is what your users get."
  - title: HTTP server, ready to ship
    details: API-key auth, body-limit, rate-limit, `/status` introspection. Boot a production endpoint with two flags.
  - title: Loud failures, every time
    details: "`compile.sh` verifies its artifact. Lints refuse to compose corrupted Hoon. `verify-jam` detects stale kernels."
  - title: Live updates preserve state
    details: Edit your kernel, recompile, restart — accumulated state survives via PMA. A new feature is a sub-minute deploy.
---
