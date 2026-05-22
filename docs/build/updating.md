---
title: Updating a Project
description: How a vesl-nockup release reaches a built project, the order to apply an update safely, and why re-injection overwrites rather than merges.
outline: deep
---

# Updating a Project

A built project is a frozen snapshot. vesl-nockup reaches it through several independent channels, and none of them auto-propagate — an update is pulled, not pushed. `Cargo.lock` freezes the Rust graph, the template files are your copies, and `app.hoon` is yours. A vesl-nockup release changes nothing in a built project until you reinstall the `nockup-graft` binary, run `nockup package install`, or run `cargo update`.

## What an update reaches

| Channel | Carries | Reaches the project via |
|---|---|---|
| `nockup-graft` binary | the graft composer | re-running `cargo install --git … --bin nockup-graft` |
| `zkvesl/vesl-graft` package | the Hoon graft library under `hoon/lib/` | `nockup package install` |
| `vesl` template | scaffold files (`Cargo.toml`, `build.rs`, `main.rs`, `app.hoon`) | only `nockup project init` — never an existing project |
| Bundled crates (`vesl-core`, `vesl-hull`, `vesl-test`) | the Rust SDK | git-deps in `Cargo.toml`, frozen by `Cargo.lock` until `cargo update` |
| Pins (`NOCK_PIN`, `VESL_CORE_PIN`, `VESL_WALLET_PIN`) | the nockchain and vesl-core revs baked into a scaffold | template `Cargo.toml` revs, set once at scaffold time |

The `vesl` template channel never re-touches a project once it is scaffolded. The `nockup-graft` binary and the `vesl-graft` package update on separate schedules and are not version-locked — update both in the same pass so the composer and the manifests it reads stay in step.

## The update sequence

Run from the project root, in order.

1. **Commit or stash all work.** `nockup graft update` rewrites `app.hoon`; an isolated diff is reviewable, a mixed one is not.
2. **Snapshot live state.** For a running deployment, `vesl-checkpoint::snapshot` the kernel before recompiling. See [State & Snapshots](/build/state-snapshots).
3. **Update the composer:**
   ```bash
   cargo install --git https://github.com/zkvesl/vesl-nockup --bin nockup-graft --force
   ```
   Do this first — `nockup graft update` cannot replace its own running binary, and stops with this instruction if the refreshed library needs a newer one.
4. **Run the update:**
   ```bash
   nockup graft update hoon/app/app.hoon
   ```
   One verb for the recomposition: it runs `nockup package install`, previews the recomposition with the `nockup graft doctor` health report, prompts for confirmation, then writes via `inject --apply`. Read the preview before pressing `y` — a `hand-edited-block` finding means a customization inside a banner pair is about to be overwritten. `--yes` skips the prompt for CI.
5. **Reconcile `Cargo.toml`.** A pin bump changes the nockchain and vesl-core revs the project should resolve to. The `nockup package install` that step 4 runs re-applies vesl-graft's `[[patches]]`; confirm the `[patch]` block agrees, then `cargo update -p vesl-core` rather than a blanket `cargo update`.
6. **Recompile:**
   ```bash
   ./compile.sh
   ```
   `compile.sh` wraps `hoonc` and fails loud if hoonc [exits 0 with no jam written](/troubleshooting/common-pitfalls).
7. **Rebuild:** `cargo +nightly build`. The scaffold's `build.rs` re-runs `nockup graft doctor`, so a residual finding shows up in the build output.
8. **Resume.** After a snapshot, `vesl-checkpoint::resume` from the new `out.jam`, then re-poke to restore state — resume reinitializes graft state to per-graft defaults.
9. **Re-run the lifecycle suite** with `vesl-test` to confirm the kernel still behaves.

`nockup graft update` absorbs the old install/preview/apply trio. Driving `nockup graft inject --apply` by hand still works when you want composition without the orchestrator.

## Re-injection is not a merge

`nockup graft inject` owns the region between each `::  graft-inject:<graft>:<marker>:begin` and `:end` banner pair. Every `--apply` — and every `nockup graft update` — strips that region and re-emits it from the manifest. It does not merge.

::: warning Edits inside a banner pair are discarded
Domain code added at the `::  nockup:*` markers but outside any banner pair — causes, peeks, `?-` arms — survives a re-inject untouched. Code typed *between* a graft's `begin` and `end` banners does not: the next re-injection overwrites it, whether or not the manifest changed.

The common trap is replacing a verification gate by editing the gate body inside a `%settle-*` arm. That arm lives inside the `settle-graft:poke` block, so the next re-injection reverts it to the default hash gate. Change the gate through `[graft.gates]` in the manifest instead — see [Swapping a Gate](/build/catalog-gates/swapping).
:::

`nockup graft doctor` flags a hand-edited block before it is lost — it runs on every `cargo build` (the scaffold's `build.rs` invokes it) and in `nockup graft update`'s preview.

## When an update breaks the build

Update-time failures are catalogued in [Common Pitfalls](/troubleshooting/common-pitfalls). The ones an update specifically provokes:

| Symptom | Cause |
|---|---|
| `hoonc` exits 0, no `out.jam` | a newer graft library pulled a Hoon import the project's frozen `hoon/common`, `hoon/dat`, or `hoon/jams` subset doesn't satisfy — refresh those trees from a vesl-nockup checkout |
| `hoonc` fails `mint-lost` / `-lost %<tag>` | the composer and the manifests are out of step — re-run steps 3 and 4 together |
| `cargo build` fails on `ibig` / `UBig` | a pin moved; the `[patch]` block no longer matches the nockchain rev `vesl-core` resolves to — realign it (step 7) |
| poke returns `Ok(vec![])`, stderr `slog: invalid cause` | the kernel re-composed with a renamed cause-tag the hull still calls by its old name — update the hull, and guard future renames with `assert_kernel_cause_tag!` |
| post-resume pokes emit nothing | the snapshot predates a graft-composition change — see [Manual Migration](/build/state-snapshots#manual-migration) |
| `nockup graft inject` / `update` errors `manifest schema too new` | the graft library declares a newer manifest schema than the installed `nockup-graft` — update the binary (step 3) and re-run |

::: info See Also

- [vesl-nockup README — Updating an existing project](https://github.com/zkvesl/vesl-nockup/blob/main/README.md#updating-an-existing-project) — the procedure's source of truth.
- [State & Snapshots](/build/state-snapshots) — snapshot and resume across a composition change.
- [Inject](/build/grafts/inject) — marker semantics and the per-graft sha256 banner.
- [Common Pitfalls](/troubleshooting/common-pitfalls) — symptom-led catalogue of build and runtime failures.

:::
