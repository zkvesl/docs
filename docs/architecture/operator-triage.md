# Operator Triage

When a Vesl-grafted write doesn't land, the driver-side surface is `Ok(vec![])` from `app.poke().await?` — and that surface is shared across four distinct denial paths. This page explains why each layer fails in its own vocabulary, why `Ok(vec![])` is the union, and what the operational implications are. The 5-row attribution matrix lives in the [SDK reference](/reference/sdk#distinguishing-denial-paths); this page is the design rationale.

## The four admission layers

A v0.1 grafted kernel can reject a write at four distinct points:

1. **Pre-gate (replay / root mismatch).** Settle's pre-gate checks fire before the gate runs. A reused note-id or a settle-call against an unregistered hull surface as `[%settle-error msg='<reason>']` — the cause never reached the gate body.
2. **Gate clean-deny (Hoon `?>`).** The gate runs, the Hoon `?>` deterministic Exit fires (`set-membership-verify` returns `%.n`, `sig-verify-schnorr` finds an invalid signature). The kernel emits zero effects (`vec![]`) and dumps a `mule`-trace breadcrumb to stderr starting at `<gate-graft>.hoon::[…]`.
3. **Gate crash.** The gate body panicked inside `mule` — the gate has a bug or the data shape doesn't match what the gate expects. Settle-graft wraps the crash as `[%settle-error msg='settle-graft: verify gate crashed']`.
4. **Rbac denial (orchestrator-side).** Before sending the poke, the Rust driver runs `[%rbac-has-perm pubkey perm ~]`; the peek returns `false`; the driver skips the poke. The kernel never sees the cause; the driver-side surface is `vec![]` because nothing ran.

These four layers fail in **four different vocabularies** — pre-gate failures stamp `%settle-error` with a structured reason, gate crashes stamp `%settle-error` with a generic message, gate clean-denies emit nothing on the kernel side but dump trace to stderr, and rbac denials are entirely Rust-side. None of the four were designed knowing about the others.

## Why effect-only attribution is impossible

Each layer's failure surface was correct in isolation:

- **Pre-gate** uses `%settle-error` because the cause was structurally rejected; surfacing the reason as a typed error is what every downstream listener expects.
- **Gate crash** uses `%settle-error` because settle-graft is the layer that knows how to wrap a `mule`-failure into a structured outcome.
- **Gate clean-deny** uses `?>` Exit because `?>` is the Hoon idiom for deterministic policy denial; it's the same primitive used inside every other `?:`-using arm of every other graft. Adding a typed effect would require every gate-body to know it's running inside a settle-graft (a layering violation).
- **Rbac denial** runs in the driver because v0.1's design choice puts rbac on the orchestrator side — that gives the driver a hook for logging, rate-limiting, and pre-emptive feedback before the kernel session is touched. The cost is that the driver-side `vec![]` surface looks identical to a kernel-side `vec![]`.

The result: gate clean-deny and rbac-deny both surface as `Ok(vec![])` from `app.poke().await?`. Only stderr disambiguates them — and only the driver knows whether the poke was sent at all.

## Why the design is sound (despite looking broken)

The natural fix — "let's add a typed `[%admission-denied layer=%gate|%rbac|...]` effect" — is a contract break for every graft and every driver. It also collapses the **attribution preservation** the current design buys: each layer fails in *its own* vocabulary, which means a future version can add a fifth admission layer without re-shaping the existing four.

The real failure is documentation, not architecture. Operators need:

1. A 5-row matrix of which surfaces map to which layer (lives in [SDK reference](/reference/sdk#distinguishing-denial-paths)).
2. Driver-side discipline: log every rbac decision before the poke split, so post-hoc audit attributes the denial to a layer.
3. A stderr capture mechanism in production deployments — gate clean-deny is the only path that writes anything visible.

## Operational implications

### Driver discipline

Log every rbac decision **before** the poke. The rule: if the driver decides not to send a poke, that decision must be visible to whatever audit log catches the kernel's own emissions. Without this, a post-hoc audit that sees `0 settle-noted` events cannot tell whether the writes were rejected (gate-deny) or never attempted (rbac-deny).

Pseudocode shape:

```rust
let allowed = is_rbac_allowed(&app, pubkey, perm).await?;
if !allowed {
    audit_log.record_rbac_denial(pubkey, perm);  // do this BEFORE returning
    return Err(DenialReason::Rbac);
}
let effects = app.poke(slab).await?;
if effects.is_empty() {
    // Gate clean-deny — capture stderr if you have it.
    audit_log.record_kernel_silent_denial(pubkey, perm);
}
```

The two `record_*` calls give post-hoc audit the attribution that the effect list alone cannot.

### Multi-graft halt (Profile J)

In kernels with **≥10 grafts**, the `mule`-trace dump on gate clean-deny can be large enough to terminate the driver process after the poke returns. R3 Profile J observed this empirically with the ten-graft Permissioned Manifest-Verified Vault.

Operational implication: in multi-graft deployments, **treat gate clean-deny as TERMINAL for the kernel session**. Restart the kernel rather than continuing — the trace overflow has nondeterministic downstream effects and there's no clean recovery path inside the same process.

This caveat is grafts-count-driven, not gate-specific. Any kernel with ≥10 active grafts can hit it; the Schnorr gate is just the path Profile J reproduced it on.

### Stderr capture

Gate clean-deny is the only denial path that writes operator-visible diagnostics. Production deployments need stderr capture — without it, a `Ok(vec![])` outcome is unrecoverable for triage purposes.

Recommended: capture stderr to a structured log alongside effect emissions, keyed by request-id. Future v0.2 work may add a `vesl_core::parse_gate_trace(stderr) -> GateDenyAttribution` helper to type the trace; v0.1 keeps this responsibility at the deployment-config layer.

## Forward-looking

When v0.2 ships field-level rules in validate-graft, the pre-gate layer gains a fifth surface (`%validate-rejected`). The matrix grows by one row; the attribution-preservation argument continues to hold. The existence of this page makes that growth additive rather than disruptive.

The longer-term answer to the `Ok(vec![])` ambiguity isn't a typed denial effect — it's an admission-layer middleware abstraction in the orchestrator that knows about all four (or five) layers and unifies them at the driver boundary, leaving the kernel's per-layer vocabulary intact. That's a v0.3 design conversation; v0.1 keeps each layer's contract pristine and pushes attribution responsibility to the driver.
