---
title: Build a Real App
description: Compose five grafts into a license registry — rbac + registry + log + settle + batch — running on the same kernel that ships out of the vesl template.
outline: deep
head:
  - - meta
    - name: keywords
      content: vesl tutorial, license registry, multi-graft compose, rbac registry log settle batch, real-world example, end-to-end nockapp
---

# Build a Real App

The [quickstart](/setup/quickstart) gets you three commands from an empty directory to `%settle-noted`. This page goes further: composing five grafts into a working license registry, end to end, in one running kernel. The graft set, the cause arms, the Rust hull, the HTTP surface, and the test harness all sit in the same project the quickstart scaffolds.

## The Problem

A license registry is a small but realistic verifiable app. The service needs to:

- Issue licenses, gated on admin signing keys.
- Suspend, revoke, and renew them.
- Record every state change in an audit trail.
- Commit each license to a Merkle root so the registry's history can be proven against a single hash.
- Flush settlements in batches so a burst of issuance doesn't fragment the chain commitment.

Five concerns, five grafts.

## Grafts Chosen

| Graft | Family | Priority | Role |
|---|---|---|---|
| `rbac-graft` | state | 80 | Track admin pubkeys and the permissions granted to each. |
| `registry-graft` | state | 90 | Strict per-license rows: put, update, delete. |
| `log-graft` | behavior | 130 | Append-only audit trail keyed by event tag. |
| `settle-graft` | commitment | 10 | Merkle-rooted attestation of issued licenses. |
| `batch-graft` | behavior | 145 | Buffer settle causes and flush them in batches. |

Inject composes manifests in priority order; the resulting `?-` switch dispatches cause-tag by cause-tag. The lower priority runs earlier, so settle-graft's poke arms (priority 10) splice in first, then state grafts, then behavior grafts.

```d2
direction: down

markers: {
  direction: right
  cause:  "::  nockup:cause"
  state:  "::  nockup:state"
  poke:   "::  nockup:poke"
  peek:   "::  nockup:peek"
}

settle:   "settle-graft\ncommitment · prio 10"
rbac:     "rbac-graft\nstate · prio 80"
registry: "registry-graft\nstate · prio 90"
log:      "log-graft\nbehavior · prio 130"
batch:    "batch-graft\nbehavior · prio 145"

settle -> markers.cause: { style.stroke: "#c084fc"; style.stroke-width: 2 }
settle -> markers.state: { style.stroke: "#c084fc"; style.stroke-width: 2 }
settle -> markers.poke:  { style.stroke: "#c084fc"; style.stroke-width: 2 }
settle -> markers.peek:  { style.stroke: "#c084fc"; style.stroke-width: 2 }

rbac -> markers.cause: { style.stroke: "#60a5fa"; style.stroke-width: 2 }
rbac -> markers.state: { style.stroke: "#60a5fa"; style.stroke-width: 2 }
rbac -> markers.poke:  { style.stroke: "#60a5fa"; style.stroke-width: 2 }
rbac -> markers.peek:  { style.stroke: "#60a5fa"; style.stroke-width: 2 }

registry -> markers.cause: { style.stroke: "#60a5fa"; style.stroke-width: 2 }
registry -> markers.state: { style.stroke: "#60a5fa"; style.stroke-width: 2 }
registry -> markers.poke:  { style.stroke: "#60a5fa"; style.stroke-width: 2 }
registry -> markers.peek:  { style.stroke: "#60a5fa"; style.stroke-width: 2 }

log -> markers.cause: { style.stroke: "#fb923c"; style.stroke-width: 2 }
log -> markers.state: { style.stroke: "#fb923c"; style.stroke-width: 2 }
log -> markers.poke:  { style.stroke: "#fb923c"; style.stroke-width: 2 }
log -> markers.peek:  { style.stroke: "#fb923c"; style.stroke-width: 2 }

batch -> markers.cause: { style.stroke: "#fb923c"; style.stroke-width: 2 }
batch -> markers.state: { style.stroke: "#fb923c"; style.stroke-width: 2 }
batch -> markers.poke:  { style.stroke: "#fb923c"; style.stroke-width: 2 }
```

Each graft contributes to four of the ten markers (cause, state, poke, peek); batch-graft skips peek. Edge color marks family — purple for commitment (settle), blue for state (rbac, registry), orange for behavior (log, batch). The cause-tag union grows by the sum of contributions; the `?-` switch grows the same way; the state record gets one field per graft. [Why splicing, not import](/build/grafts/#why-splicing-not-import) covers the mechanic.

## Manifest

The project's `nockapp.toml` declares the dep — same shape as the quickstart:

```toml
# Example: nockapp.toml — top-level project manifest
[package]
name         = "license-registry"
version      = "0.1.0"
description  = "verifiable license registry"
template     = "vesl"
template_git = "https://github.com/zkvesl/vesl-nockup"
template_path = "templates"

[dependencies]
"zkvesl/vesl-graft" = "latest"
```

`nockup project init` pulls the full graft library into `hoon/lib/`. Graft selection happens at inject time, not in the manifest.

## Kernel Composition

The vesl template ships `hoon/app/app.hoon` with the ten marker comments at their structural positions. The `--grafts` flag narrows the composer to the five names the registry uses:

```bash
# Example: filter inject to the five grafts the registry needs
nockup graft inject --grafts rbac,registry,log,settle,batch hoon/app/app.hoon            # preview
nockup graft inject --grafts rbac,registry,log,settle,batch --apply hoon/app/app.hoon    # write
```

Without `--grafts`, every manifest under `hoon/lib/` composes (the 14-graft kernel the quickstart uses). With it, only the five names land. The splice is leaner, the kernel boots faster, and `/status` reports exactly those five.

The first lines of the assembled `app.hoon` after `--apply`:

```hoon
:: Example: hoon/app/app.hoon (composed, abridged) — first ~20 lines after inject
::  Composed by nockup graft inject — do not hand-edit between banners.
::
/+  lib
::  graft-inject:imports:settle-graft:begin:f1b2c8e4
/+  *settle-graft
/+  *vesl-merkle
::  graft-inject:imports:settle-graft:end
::  graft-inject:imports:rbac-graft:begin:8d3a7c2e
/+  *rbac-graft
::  graft-inject:imports:rbac-graft:end
::  ... (registry, log, batch imports follow)
::
=>
|%
+$  versioned-state
  $:  %v1
  ::  graft-inject:state:settle-graft:begin:f1b2c8e4
      settle=settle-state
  ::  graft-inject:state:settle-graft:end
  ::  graft-inject:state:rbac-graft:begin:8d3a7c2e
      rbac=rbac-state
  ::  ... (registry, log, batch state fields follow)
  ==
```

Banner pairs (`begin:<sha>` / `end`) wrap every contribution; the sha is the manifest sha256 reported on `/status`. A `git diff` shows exactly which graft added which lines. See [Inject](/build/grafts/inject) for the marker model and lint families.

## Hoon Cause Arms

The registry's five domain causes go into the `::  nockup:cause` marker. The poke switch arms go into `::  nockup:poke`. Each arm threads through one or more grafts in the order their priorities imply.

```hoon
:: Example: hoon/app/app.hoon — domain cause variants (above the ::  nockup:cause marker)
[%license-issue admin=@ key=@uw expires=@da]
[%license-revoke admin=@ key=@uw reason=@t]
[%license-suspend admin=@ key=@uw until=@da]
[%license-renew admin=@ key=@uw new-expires=@da]
[%license-flush admin=@]
```

The `%license-issue` arm runs the rbac check, the registry put, a log append, and a batch-buffered settle in one cause:

```hoon
:: Example: hoon/app/app.hoon — %license-issue arm (in the ?- switch, above ::  nockup:poke)
%license-issue
?>  (~(has by perms.rbac.state) admin.u.act)
=/  payload  (jam [key=key.u.act expires=expires.u.act status=%active])
=^  reg-efx  registry.state
  (registry-poke registry.state [%registry-put key.u.act payload])
=^  log-efx  log.state
  (log-poke log.state [%log-append %license-issued payload])
=^  batch-efx  batch.state
  (batch-poke batch.state [%batch-add (jam [hull=1 root=*@ data=payload])])
:_  state
:(welp reg-efx log-efx batch-efx)
```

Five lines of orchestration on top of four graft calls. The full set of arms (issue, revoke, suspend, renew, flush) fits in roughly 25 lines of Hoon. [Multi-Graft Coordination](/build/kernel/multi-graft) covers the `=^` threading pattern and effect aggregation.

## Rust Hull

Each domain cause gets a typed `build_<verb>_poke` from the codegen the manifest declares. The hull binds them to HTTP routes via `serve_with_extra_routes`:

```rust
// Example: src/main.rs — Serve arm with custom routes
use axum::{routing::{post, get}, Router, Json, extract::{State, Path}};
use vesl_core::{PokeOutcome, SystemWire};
use license_registry::pokes::{
    build_license_issue_poke, build_license_revoke_poke,
    build_license_suspend_poke, build_license_renew_poke,
    build_license_flush_poke,
};

#[derive(serde::Deserialize)]
struct IssueRequest { admin: String, key: u64, expires_days: u32 }

#[derive(serde::Serialize)]
struct IssueResponse { license_id: u64, settled: bool }

async fn handle_issue(
    State(state): State<SharedState>,
    Json(req): Json<IssueRequest>,
) -> Result<Json<IssueResponse>, ApiError> {
    let poke = build_license_issue_poke(
        &req.admin,
        req.key,
        days_to_da(req.expires_days),
    );
    let outcome = state.app.lock().await
        .poke(SystemWire.to_wire(), poke).await?;
    match outcome {
        PokeOutcome::Accepted { effects } => {
            let settled = effects.iter().any(|e| e.head_tag() == "settle-noted");
            Ok(Json(IssueResponse { license_id: req.key, settled }))
        }
        PokeOutcome::Rejected { reason } => Err(ApiError::rejected(reason)),
        PokeOutcome::Crashed { error }   => Err(ApiError::crashed(error)),
    }
}

pub async fn run(state: SharedState, port: u16, bind: &str) -> anyhow::Result<()> {
    let extra: Router<SharedState> = Router::new()
        .route("/license/issue",   post(handle_issue))
        .route("/license/revoke",  post(handle_revoke))
        .route("/license/suspend", post(handle_suspend))
        .route("/license/renew",   post(handle_renew))
        .route("/license/flush",   post(handle_flush))
        .route("/license/:id",     get(handle_query));
    vesl_hull::serve_with_extra_routes(state, port, bind, extra).await?;
    Ok(())
}
```

`build_license_issue_poke` is generated by per-graft codegen; its signature comes from the `[graft.types].cause` declaration in `domain-graft.toml`. The other five handlers follow the same shape. [Composing Custom Routes](/build/build-run/serve#composing-custom-routes) covers the auth, body-limit, and rate-limit layers that wrap every route uniformly.

## Tests

The harness boots the same `out.jam` your hull does. Per-graft methods (`harness.rbac_grant`, `harness.license_issue`) come from the codegen that walks each manifest's cause types:

```rust
// Example: tests/license_registry.rs — happy-path issue + query
use vesl_test::Harness;

#[tokio::test]
async fn issue_then_query_returns_active_license() {
    let mut h = Harness::boot("out.jam").await;
    let admin = "admin-pubkey-1";

    h.rbac_grant(admin, vec!["license-admin"]).await.expect("grant");

    let outcome = h.license_issue(admin, 100, days(365)).await;
    assert!(matches!(outcome, PokeOutcome::Accepted { .. }));

    let row = h.peek_license(100).await.expect("license found");
    assert_eq!(row.status, LicenseStatus::Active);
}
```

Twelve assertions cover the surface:

- **Happy path (5):** issue, query, revoke, suspend, renew each succeed against an admin-granted key.
- **Rejection (5):** non-admin issuer (rbac denies), double-revoke (registry update on revoked row), query-missing (peek returns `~`), expired renew (new-expires earlier than current), flush with empty buffer.
- **Cross-graft (2):** `%license-issue` triggers `%log-appended`; the Nth `%license-issue` after the batch threshold triggers `%settle-noted`.

[Rust Harness](/build/testing/harness) covers the binding model. [Domain Pokes](/build/testing/domain-pokes) walks the typed builder a domain cause gets generated.

## HTTP Routes

Issue a license over HTTP:

```bash
# Example: issue one license against a running hull
curl -X POST -H "Authorization: Bearer $HULL_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"admin":"admin-pubkey-1","key":100,"expires_days":365}' \
     http://localhost:3000/license/issue
```

```json
{
  "license_id": 100,
  "settled": false
}
```

`settled: false` means the issue landed in the batch buffer without flushing. Once enough issues bring the buffer to its threshold (or `POST /license/flush` is called), the batch drains and settle-graft commits a Merkle root over the batched payloads. `GET /license/100` returns the row regardless of whether the underlying batch has flushed yet.

## /status Verification

A `GET /status` after one issue + one revoke + one flush:

```json
{
  "has_tree": true,
  "field_count": 1,
  "merkle_root": "3p7q1r4u8v2w6x0y5z9a3b7c1d4e8f2g…",
  "notes_settled": 1,
  "hull_id": 1,
  "settlement_mode": "in-process",
  "gate": "default-hash",
  "grafts": [
    "batch-graft", "log-graft", "rbac-graft",
    "registry-graft", "settle-graft"
  ],
  "manifest_shas": {
    "batch-graft":    "8f3e2a1c…",
    "log-graft":      "3b7f4e8c…",
    "rbac-graft":     "8d3a7c2e…",
    "registry-graft": "f7b2e4a9…",
    "settle-graft":   "f1b2c8e4…"
  }
}
```

Five grafts in the `grafts` array (sorted), five matching `manifest_shas` entries, one note settled, one field in the Merkle tree. The same payload doubles as a runtime sanity check during deployment — a mismatched sha against the on-disk manifest means the running hull is out of date.

## What You Got

- **5 verifiable primitives composed** via `nockup graft inject --grafts ...`.
- **~25 lines of Hoon** for the five domain cause arms.
- **~80 lines of Rust** for the six HTTP handlers.
- **6 custom HTTP routes** wired via `serve_with_extra_routes`, inheriting auth + body-limit + rate-limit from `vesl-hull`.
- **12 harness assertions** running against the real compiled kernel.
- **One `/status` payload** that proves what's running.

The same recipe scales: swap rbac-graft for a stricter gate, replace registry-graft with kv-graft for looser storage, drop log-graft if you don't need an audit trail. Each graft is a substitution; the domain cause arms stay shaped the same way.

For the underlying mechanic, see [NockApp Anatomy](/build/anatomy). For the per-graft surface, [Grafts](/build/grafts/). For deeper coordination patterns, [Multi-Graft Coordination](/build/kernel/multi-graft).
