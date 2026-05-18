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

## Endpoint Catalog

`vesl_hull::router(state)` returns an `axum::Router` mounting six endpoints. The handlers assume the kernel composes settle-graft — a kernel without it will reject the kernel-side pokes those handlers issue.

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/commit` | Commit key-value fields to a Merkle tree and register the root with the kernel. | `HULL_API_KEY` |
| `POST` | `/settle` | Settle a note against the current registered root. | `HULL_API_KEY` |
| `POST` | `/verify` | Verify a field's Merkle proof against the registered root. | `HULL_API_KEY` |
| `GET`  | `/tx/{tx_id}` | Fetch a chain-attested receipt (requires fakenet/dumbnet settlement). | `HULL_API_KEY` |
| `GET`  | `/status` | Current state snapshot (fields, tree, hull-id, note counter, settlement mode). | `HULL_API_KEY` |
| `GET`  | `/health` | Liveness probe. Always unauthenticated. | — |

Each endpoint's request/response shape and error mapping is in `crates/vesl-hull/src/api.rs`. The 409 / 4xx mappings for kernel rejections are documented in [Effect Catalog → settle-graft](/reference/effect-catalog#settle-graft).

## Composing Custom Routes

`vesl_hull::router(state)` returns a stock `axum::Router`. Merge it with your own routes via [`Router::merge`](https://docs.rs/axum/latest/axum/struct.Router.html#method.merge):

```rust
use axum::{routing::post, Router};
use vesl_hull::{router as hull_router, SharedState};

async fn issue_badge(/* ... */) -> impl axum::response::IntoResponse {
    // your domain handler
}

pub fn build_router(state: SharedState) -> Router {
    let stock = hull_router(state.clone());
    let domain = Router::new()
        .route("/issue-badge", post(issue_badge))
        .with_state(state);
    stock.merge(domain)
}
```

This is the seam for adding endpoints that drive your domain causes. The mounted Tower middleware stack — `tower_http::limit::RequestBodyLimitLayer`, the API-key auth layer, etc. — applies to both the stock and your routes. The `/health` exemption is wired explicitly inside `vesl_hull::router`; custom routes inherit the auth layer by default.

To replace stock endpoints entirely (e.g. a domain-specific `/commit` shape), fork `crates/vesl-hull/src/api.rs` rather than merging — `Router::merge` can't override existing route definitions, only add to them.

::: info See Also

- [Hull / Scaffold CLI: Demo and Serve](/build/hull#scaffold-cli-demo-and-serve) — entry-level overview of the Demo + Serve dispatch.
- [Build & Run](/build/build-run/) — kernel compile and Demo-arm run flow.
- [Settlement Modes](/build/build-run/#settlement-modes) — selecting `local` / `fakenet` / `dumbnet` for the booted hull.
- [Effect Catalog → settle-graft](/reference/effect-catalog#settle-graft) — kernel rejection shapes the `/commit` and `/settle` handlers map to 4xx.
- [vesl-nockup README — Serving over HTTP](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#serving-over-http) — scaffold-level overview.
- [`crates/vesl-hull/`](https://github.com/zkvesl/vesl-nockup/tree/main/crates/vesl-hull) — the lib backing the Serve arm.

:::
