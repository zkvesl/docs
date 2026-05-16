---
title: Slog Diagnostics
description: poke_slab_report and PokeReport — capturing slog warnings to tell a gate-deny from a cause-shape rejection.
outline: deep
---

# Slog Diagnostics

When the effect list alone can't distinguish gate-deny from cause-shape-reject, swap [`poke_slab`](/build/testing/domain-pokes#driving-causes) for `poke_slab_report`. It runs the same poke but also captures every slog emitted at `target: "slogger"` during the call into a `PokeReport`:

```rust
// Example: asserting on slog diagnostics in your test
use vesl_test::{decode_cause_tag, SlogWarning};

let report = harness.poke_slab_report(slab).await?;

// Bare "did the kernel reject the cause shape?" check.
assert!(report.rejected_cause(), "kernel should have rejected the cause");

// Or assert on which tag the kernel saw before rejecting.
for warning in &report.slog_warnings {
    if let SlogWarning::InvalidCause { noun } = warning {
        assert_eq!(
            decode_cause_tag(noun).as_deref(),
            Some("my-typo"),
            "rejected cause tag should match the hull-side typo",
        );
    }
}
```

`PokeReport` fields:

- **`effect_tags: Vec<String>`** — same as `poke_slab`'s return.
- **`slog_warnings: Vec<SlogWarning>`** — slogs captured during the poke. Each is one of:
  - **`InvalidCause { noun }`** — kernel's `(soft cause)` rejected the cause shape.
  - **`Other(String)`** — any other slog emitted at `target: "slogger"`.

Helper: **`decode_cause_tag(noun) -> Option<String>`** parses the leading tag from Hoon's printed-noun format. It handles both the cord-decoded `[%foo ...]` shape and the dotted-decimal fallback.

See [Troubleshooting — distinguishing denial paths](/troubleshooting/common-pitfalls#distinguishing-denial-paths) for which slog shape maps to which failure mode.
