---
title: Serve Subcommand
description: The scaffolded binary's serve arm — flags, auth model, endpoint catalog, and merging custom routes into the vesl-hull HTTP API.
outline: deep
---

# Serve Subcommand

The `vesl` scaffold's `src/main.rs` is a clap dispatch with two arms — `Demo` (default) and `Serve`. The Serve arm boots `out.jam`, builds an `AppState`, and hands it to [`vesl_hull::serve`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-hull/src/api.rs), which mounts an `axum::Router` on the configured bind address.

```bash
cargo +nightly run -- serve                  # http://127.0.0.1:3000, demo signing key
cargo +nightly run -- serve --no-auth        # loopback dev: skip API-key auth
cargo +nightly run -- serve --port 8080      # custom port, still loopback
HULL_API_KEY=mysecret cargo +nightly run -- serve --bind-addr 0.0.0.0   # LAN
```

## Flags

| Flag | Default | Notes |
|---|---|---|
| `--port <PORT>` | `3000` | TCP listen port. |
| `--bind-addr <ADDR>` | `127.0.0.1` | Bind address. `--no-auth` is refused on any non-loopback bind. |
| `--no-auth` | off | Disable API-key auth. Honored only when `--bind-addr` is loopback (`127.0.0.1`, `::1`, `localhost`); otherwise the binary refuses to start. |

All other behavior — settlement mode, signing key, `vesl.toml` overrides — flows through the same surfaces the Demo arm uses. See [Settlement Modes](/build/build-run/#settlement-modes) for the mode-selection logic.

## Auth Model

The Serve arm checks two configuration surfaces at startup via `vesl_hull::check_auth_config_with_bind(no_auth, bind_addr)`:

1. **Non-loopback bind + `--no-auth`** → refuse to start. The combination would expose an unauthenticated kernel-poke surface to the LAN; the early-exit guard is unconditional.
2. **`HULL_API_KEY` env var** → if set and non-empty, every kernel-side endpoint requires `Authorization: Bearer <key>`. If unset, the server prints `WARNING: HULL_API_KEY not set -- API endpoints are unauthenticated` to stderr and starts anyway.

The `/health` endpoint is **always** unauthenticated regardless of `HULL_API_KEY` — it's the liveness probe and must answer for orchestrators that don't carry the bearer token.

```bash
# Loopback dev: skip auth entirely.
cargo +nightly run -- serve --no-auth

# LAN / shared dev: require an API key.
HULL_API_KEY=$(openssl rand -hex 32) \
  cargo +nightly run -- serve --bind-addr 0.0.0.0

# Then from another host:
curl -H "Authorization: Bearer $HULL_API_KEY" \
  http://<host>:3000/status
```

For production deployments where the seed phrase + bearer key + bind address all matter, lock down the host running the hull — the BIP-39/BIP-44 derivation gives the hull spend authority over any UTXO locked to the resulting pkh (see [Dumbnet Walkthrough](/build/build-run/dumbnet)).

## Rate-limit behavior

The hull's middleware stack paces requests rather than rejecting them on burst. The layer is `tower`'s `RateLimit` with a `tower::buffer::Buffer` in front:

- **Capacity**: 200 requests per 60 seconds, shared across every authenticated endpoint.
- **Buffer**: 256 in-flight requests. Excess in-flight requests are queued, not rejected.
- **Overflow**: requests beyond the 256 buffer slot return HTTP 429 via the `HandleErrorLayer` wrapper. Under the capacity ceiling, requests block until a slot frees instead of failing fast.

This is pacing, not strict rate-limiting. A 300-request burst against `/status` takes ~110 seconds to drain (~200 served, 100 paced); zero 429s under that load. A 257-deep concurrent burst (one request above the buffer ceiling) is what produces the 429.

Custom routes mounted through `serve_with_extra_routes` / `router_with_extra` inherit the same layer (the middleware stack wraps the merged Router — see [Composing Custom Routes](#composing-custom-routes)).

Swap to `tower_governor::GovernorLayer` if the deployment needs true burst-rejection semantics; the existing pacing layer is wired in `crates/vesl-hull/src/api.rs`.

## Endpoint Catalog

`vesl_hull::router(state)` returns an `axum::Router` mounting six endpoints. The handlers assume the kernel composes settle-graft — a kernel without it will reject the kernel-side pokes those handlers issue.

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/commit` | Commit key-value fields to a Merkle tree and register the root with the kernel. | `HULL_API_KEY` |
| `POST` | `/settle` | Settle a note against the current registered root. **Body shape varies by gate** — see [Catalog Gates / Hull settle routing](/build/catalog-gates/#hull-settle-routing). | `HULL_API_KEY` |
| `POST` | `/verify` | Verify a field's Merkle proof against the registered root. | `HULL_API_KEY` |
| `GET`  | `/tx/{tx_id}` | Fetch a chain-attested receipt (requires fakenet/dumbnet settlement). | `HULL_API_KEY` |
| `GET`  | `/status` | Current state snapshot — fields, tree, hull-id, note counter, settlement mode, **active gate**, **composed grafts**, **per-graft manifest sha256s**. | `HULL_API_KEY` |
| `GET`  | `/health` | Liveness probe. Always unauthenticated. | — |

Each endpoint's request/response shape and error mapping is in `crates/vesl-hull/src/api.rs`. The 409 / 4xx mappings for kernel rejections are documented in [Effect Catalog → settle-graft](/reference/effect-catalog#settle-graft).

### Verifying a gate swap via /status

`/status` snapshots the graft manifest dir at hull boot. After [swapping a gate](/build/catalog-gates/swapping), restart the hull and check:

```bash
curl -H "Authorization: Bearer $HULL_API_KEY" http://localhost:3000/status | jq '{gate, grafts, manifest_shas}'
```

```json
{
  "gate": "manifest-verify",
  "grafts": ["mint-graft", "settle-graft"],
  "manifest_shas": {
    "mint-graft": "9a3c…",
    "settle-graft": "f1b2…"
  }
}
```

The `gate` field is `"default-hash"` when no graft declares `[graft.gates]`; otherwise it's the selection from the highest-priority graft (in practice, settle-graft), with `gate-chain = [...]` selections rendered as `"A&B"`. The `manifest_shas` map mirrors the digest `nockup graft inject` banners on each block, so any drift between the on-disk manifest and the composed kernel surfaces here.

## Composing Custom Routes

Pass your routes to [`vesl_hull::serve_with_extra_routes`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-hull/src/api.rs) (or [`vesl_hull::router_with_extra`](https://github.com/zkvesl/vesl-nockup/blob/main/crates/vesl-hull/src/api.rs) if you only need the assembled `axum::Router`). The hull merges them with its stock endpoints **before** applying the middleware stack, so auth, body limit, and rate limit cover every route uniformly:

```rust
use axum::{routing::post, Router};
use vesl_hull::SharedState;

async fn issue_badge(/* ... */) -> impl axum::response::IntoResponse {
    // your domain handler
}

pub async fn run(state: SharedState, port: u16, bind: &str) -> anyhow::Result<()> {
    let extra: Router<SharedState> = Router::new()
        .route("/issue-badge", post(issue_badge));
    vesl_hull::serve_with_extra_routes(state, port, bind, extra).await?;
    Ok(())
}
```

This is the seam for adding endpoints that drive your domain causes. The mounted Tower middleware stack — `tower_http::limit::RequestBodyLimitLayer` (4 MiB), the API-key auth layer, and the 200 req / 60 s rate limit with a 256-deep buffer — wraps the merged Router, so your custom routes inherit auth, body limit, and rate limit automatically. The `/health` exemption is wired explicitly inside the auth middleware.

To replace stock endpoints entirely (e.g. a domain-specific `/commit` shape), fork `crates/vesl-hull/src/api.rs` rather than merging — `Router::merge` can't override existing route definitions, only add to them.

### Worker patterns and throughput

`AppState` lives behind a single `Arc<Mutex<...>>` so any custom route that holds the lock across a multi-step kernel poke serializes against every other endpoint. Sustained throughput tops out near 20 ops/s on a held-lock workload; a 250-deep concurrent burst against a worker-style `/enqueue` route takes ~12.7 seconds to drain.

If your custom route's hot path is "lock, poke kernel, write state, unlock," the mutex is the ceiling. Two shapes that lift it:

- **mpsc to a dedicated worker task**. The route sends work over an `mpsc::Sender`; a single owner task holds the kernel handle and drains the channel. The route returns immediately with a job id, and a follow-up GET surfaces completion. Trades latency for throughput.
- **Read-mostly fast path**. Routes that only need to peek (no kernel poke) can take an `RwLock` read guard via a refactored `AppState`, leaving the write path on the mutex. Tightly scoped — most hull state mutation goes through the kernel poke, which is single-threaded by construction.

## Running multiple instances

Each `serve` process boots its own copy of `out.jam` into its own kernel. None of that kernel's state is shared between processes — every instance carries an independent state tree.

The kernel's note-`settled` set is the replay guard behind `/settle`: a second settle of an already-settled `note_id` is rejected by the kernel, which the handler maps to [409](/reference/effect-catalog#settle-graft). That set lives in one kernel's state. Two instances behind a load balancer hold two independent `settled` sets — a note settled on instance A is unknown to instance B, so the same `/settle` request routed to B settles a second time and returns no 409. Registered roots from `/commit` and any per-graft counters diverge the same way.

In [`fakenet` / `dumbnet`](/build/build-run/#settlement-modes) modes the settlement transaction also lands on-chain, so the chain — not the hull — is the cross-instance record of what settled there. The kernel's in-memory `settled` guard, and the 409 a client sees, stay per-instance regardless. `local` mode has no chain backstop at all.

Until hull state is externalized to a shared store, run a single instance, or front a fleet with sticky sessions (load-balancer affinity) so each client reaches the same kernel on every request. A fleet without one of those drops cross-instance replay rejection silently.

::: info See Also

- [Hull / Scaffold CLI: Demo and Serve](/build/hull#scaffold-cli-demo-and-serve) — entry-level overview of the Demo + Serve dispatch.
- [Build & Run](/build/build-run/) — kernel compile and Demo-arm run flow.
- [Settlement Modes](/build/build-run/#settlement-modes) — selecting `local` / `fakenet` / `dumbnet` for the booted hull.
- [Effect Catalog → settle-graft](/reference/effect-catalog#settle-graft) — kernel rejection shapes the `/commit` and `/settle` handlers map to 4xx.
- [vesl-nockup README — Serving over HTTP](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#serving-over-http) — scaffold-level overview.
- [`crates/vesl-hull/`](https://github.com/zkvesl/vesl-nockup/tree/main/crates/vesl-hull) — the lib backing the Serve arm.

:::
