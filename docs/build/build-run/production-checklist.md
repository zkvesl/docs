---
title: Production Checklist
description: Pre-ship verification — build artifacts, kernel pinning, auth, rate limits, /status visibility, snapshot semantics, and the full verification sequence.
outline: deep
---

# Production Checklist

**After reading:** you'll have a single page to walk before shipping a vesl nockapp to a non-local environment — build-artifact integrity, auth and rate-limit calibration, operational visibility through `/status` and `/health`, and the state-survival contract under recompile.

Each item points to the canonical source page for the underlying behavior. The shape is: what to check, the command, expected output. Nothing on this page replaces the source pages; it's the pre-ship walk.

## Build Artifacts

The kernel binary (`out.jam`) is the single artifact every deploy ships. Three checks confirm it's the one you intend:

- **Stale-build detection.** Run `vesl-test verify-jam` to confirm `out.jam` matches the current Hoon source tree (manifest TOMLs + library `.hoon` files). A mismatch means the kernel was compiled before the last source edit.
  ```bash
  vesl-test verify-jam
  ```
  Expected: `verify-jam: ok — out.jam matches source tree`. A mismatch reports the diverging file. Full surface: [Testing / CLI — verify-jam](/build/testing/cli#verify-jam-—-build-staleness-check).

- **Project-health pass.** Run `nockup graft doctor` to confirm schema-version handshake, Cargo `[patch]` consistency, hand-edited injected blocks, missing `nockup:load-defaults` marker, plus the resolved lint policy. Exits nonzero on any project-health finding or lint error.
  ```bash
  nockup graft doctor hoon/app/app.hoon
  ```
  Expected: `nockup-graft doctor: ok` plus per-lint effective-severity listing. Full surface: [Reference / CLI — doctor](/reference/cli#doctor).

- **Kernel-hash pin (production deploys).** Set `VESL_KERNEL_SHA256` to the expected sha256 of `out.jam` before boot. The template's `load_kernel` refuses to boot on a mismatch. Local development can leave it unset (warning prints; boot proceeds).
  ```bash
  export VESL_KERNEL_SHA256=$(sha256sum out.jam | awk '{print $1}')
  cargo +nightly run --release -- serve
  ```
  Expected at boot: no `out.jam integrity unverified` warning. A mismatch surfaces as `out.jam sha256 mismatch: expected <pin>, got <actual> — refusing to boot`.

## Auth & Rate Limits

The Serve arm mounts `vesl-hull`'s HTTP API. Three auth/rate concerns to set before exposing it:

- **API-key auth.** Set `HULL_API_KEY` to a high-entropy secret before binding the listener. If unset, the server prints `WARNING: HULL_API_KEY not set -- API endpoints are unauthenticated` and starts anyway — fine for local dev, hostile in production.
  ```bash
  HULL_API_KEY=$(openssl rand -hex 32) cargo +nightly run --release -- serve --bind-addr 0.0.0.0
  ```
  Expected: no warning at startup. Clients must carry `Authorization: Bearer <key>`. The `/health` endpoint stays unauthenticated regardless. Full surface: [Build & Run / Serve — Auth Model](/build/build-run/serve#auth-model).

- **Rate-limit pacing.** Default is 200 req/60s + 256-deep buffer, applied per-route after auth. `/health` is exempt. The combination paces sustained load; a burst above 257 concurrent requests produces 429s. Calibrate by load-testing against `/status`.
  ```bash
  hey -n 300 -c 10 -H "Authorization: Bearer $HULL_API_KEY" http://localhost:3000/status
  ```
  Expected: zero 429s under burst sizes within the buffer; controlled 429s above it. Full surface: [Build & Run / Serve — Rate-limit behavior](/build/build-run/serve#rate-limit-behavior).

- **Body-size cap.** The 4 MiB body limit runs in two layers (upfront `Body::size_hint` precheck plus tower-http's streaming layer). Custom routes mounted via `Router::merge` bypass the auth/limit/rate layers — use `serve_with_extra_routes` instead. Full surface: [Build & Run / Serve — Composing Custom Routes](/build/build-run/serve#composing-custom-routes).

## Operational Visibility

The `/status` endpoint is the single window into what's running:

- **Build provenance.** `GET /status` surfaces `gate`, `grafts[]`, `manifest_shas{}`, `settlement_mode`, `hull_id`, `notes_settled`, `has_tree`. The `manifest_shas` are the sha256s carried in each `graft-inject:<name>:<marker>` banner — they identify the exact composed kernel in production.
  ```bash
  curl -H "Authorization: Bearer $HULL_API_KEY" http://localhost:3000/status | jq '{gate, grafts, manifest_shas}'
  ```
  Expected: per-graft sha256s matching the local `nockup graft inject --apply` output. A divergence means the deployed kernel was composed from a different manifest set. Full surface: [Build & Run / Serve — /status Response Shape](/build/build-run/serve#status-response-shape).

- **Readiness probe.** `GET /health` is unauthenticated and returns 200 once the hull finishes booting, 503 + `{"status":"booting","stage":"<stage>"}` during boot. Wire k8s `readinessProbe` (or any LB health check) to the 200.
  ```bash
  curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/health
  ```
  Expected: `200` once booted, `503` during the boot window. Full surface: [Build & Run / Serve — Endpoint Catalog](/build/build-run/serve#endpoint-catalog).

- **Hull/kernel drift triage.** Compare `/status`'s `grafts[]` and `manifest_shas{}` against what the hull's `assert_kernel_cause_tag!` macro statically asserts. A drift surfaces as either a build-time compile error (caught) or a runtime `Ok(vec![])` from an unknown cause (uncaught — opt into the codegen). Full surface: [Build & Run / Serve — Hull / kernel drift triage via /status](/build/build-run/serve#hull-kernel-drift-triage-via-status).

## State Management

The state survives recompile-and-restart via PMA. Three caveats determine what survives:

- **Same-composition resume.** A recompile that leaves the graft set unchanged resumes state cleanly. Pre-restart `/status` should match post-restart `/status` byte-for-byte across `has_tree`, `field_count`, `merkle_root`, `notes_settled`, `hull_id`, `manifest_shas`. Boot time drops to ~1s (vs. ~15s cold). Full surface: [State & Snapshots — Same Composition](/build/state-snapshots#same-composition).

- **Schema extension via `nockup:load-defaults`.** Adding a graft inserts new state axes. The `nockup:load-defaults` codegen emits a defaults overlay so resumed snapshots with a smaller noun shape get type defaults for the new axes instead of crashing in `mule`. Full surface: [State & Snapshots — Schema Extension](/build/state-snapshots#schema-extension).

- **Manual migration is out of scope.** Removing a graft or changing a state field's shape needs an explicit re-poke after resume — the defaults overlay doesn't unwind. Plan a migration cause if a shape change is unavoidable. Full surface: [State & Snapshots — Manual Migration](/build/state-snapshots#manual-migration).

## Verification Sequence

The pre-ship walk, in order:

```bash
# 1. Build the kernel from a clean tree.
./compile.sh

# 2. Run lints + project-health.
nockup graft doctor hoon/app/app.hoon

# 3. Confirm the artifact matches the source tree.
vesl-test verify-jam

# 4. Capture the kernel sha for pinning.
sha256sum out.jam

# 5. Boot with the pin + an API key set.
HULL_API_KEY=$(openssl rand -hex 32) \
VESL_KERNEL_SHA256=$(sha256sum out.jam | awk '{print $1}') \
cargo +nightly run --release -- serve --bind-addr 0.0.0.0

# 6. Confirm readiness + provenance.
curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/health
curl -H "Authorization: Bearer $HULL_API_KEY" http://localhost:3000/status \
  | jq '{gate, grafts, manifest_shas}'
```

Each step has a one-line failure mode. Steps 1-3 fail at build time; step 4 captures the production pin; step 5 fails at boot if the pin or auth setup is wrong; step 6 surfaces what the deployed kernel reports.

::: info Stuck?

Something broken? The breakage is probably already in [Common Pitfalls](/troubleshooting/common-pitfalls).

:::

::: info See Also

- [Testing / CLI](/build/testing/cli) — `verify-jam`, `inspect peek`, `watch`.
- [Build & Run / Serve Subcommand](/build/build-run/serve) — flags, auth, endpoint catalog, rate-limit calibration, custom routes.
- [State & Snapshots](/build/state-snapshots) — PMA-resume, schema extension, manual migration.
- [Reference / CLI — doctor](/reference/cli#doctor) — project-health pass.

:::
