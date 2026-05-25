---
title: Glossary
description: Two-section glossary. Building blocks for the project artifacts, files, and tools; Hoon for the language constructs you write into the kernel.
outline: deep
---

# Glossary

Two sections, each alphabetized. **Building blocks** covers the project artifacts, files, and tools you assemble — what your directory contains and which CLI runs over what. **Hoon** covers the language constructs you write into your kernel — the arms, types, and utilities that make up the kernel source. Hoon entries also appear (with worked examples) on [Build / Kernel](/build/kernel/); the duplication is intentional.

## Building Blocks

### Block

A snippet of Hoon a graft contributes at a single marker. `[graft.blocks.<marker>]` in the manifest declares the block's contents; `nockup graft inject` splices it into `app.hoon` at the matching `::  nockup:<marker>` anchor. See [Grafts / Manifest Schema](/build/grafts/manifest-schema).

### Driver

Synonym for *hull* in vesl docs — see [Hull](#hull). Note that nockchain itself uses *driver* for I/O subcomponents inside `NockApp` (`nockapp::driver::*`, `nockapp/src/drivers/{file,http,timer,...}.rs`); those run inside the hull and aren't surfaced through the SDK.

### Family

One of the priority bands in vesl's graft taxonomy. The priority number orders graft injection and labels the family. See [Build / Grafts / The 5-Family Graft Taxonomy](/build/grafts/#the-5-family-graft-taxonomy) for the bands, their priority ranges, and members.

### Graft

A composable unit shipped as `<name>-graft.hoon` (the Hoon library) plus a sibling `<name>-graft.toml` (the manifest). `nockup graft inject` discovers manifests under `hoon/lib/` and splices their declared blocks into your kernel. See [Build / Grafts](/build/grafts/).

### nockup graft

The CLI that composes grafts into a kernel. Discovers manifests, splices per-marker blocks into `app.hoon`, runs lint families, and emits per-graft sha256 banners. Preview by default; `--apply` writes to disk. The underlying binary is `nockup-graft` (sidecar to `nockup`'s plugin discovery); error output and on-disk banner comments still identify it as `graft-inject` since that's the source-of-truth name. See [Reference / CLI](/reference/cli).

### Hoon

Nockchain's source language. Compiles to Nock; kernel source files are Hoon. See [Build / Kernel](/build/kernel/).

### hoonc

The Hoon compiler. Reads `hoon/app/app.hoon` (plus the library tree) and produces `out.jam` — the kernel bytes the hull loads. Ships in the [nockchain](https://github.com/nockchain/nockchain) toolchain.

### Hull

In vesl: the Rust process that hosts the kernel — the Rust harness in your `src/main.rs` that boots `out.jam` as a `NockApp`, sends pokes, and reads effects. Also the `hull=@` keying scheme that commitment grafts use to address logical cells. See [Build / NockApp Anatomy](/build/anatomy).

### JAM

Nockchain's serialization format for nouns. `jam` produces a deterministic byte sequence from a noun; `cue` reads the bytes back into a noun. JAM is part of the nockchain runtime, not vesl.

### Kernel

The compiled `out.jam` running inside `NockApp`. Logic-only (no I/O), pure functions over nouns, deterministic. The hull does the I/O and the kernel does the math.

### Manifest

A graft's `<name>-graft.toml` file. Declares per-marker blocks of Hoon, gate selection, type names, and metadata (priority, version, stability). See [Grafts / Manifest Schema](/build/grafts/manifest-schema).

### Marker

One of the ten `::  nockup:*` anchor comments in `templates/app.hoon`. `nockup graft inject` splices graft blocks at the markers; the codegen markers (`domain-effect`, `effect-union`, `load-defaults`) are anchors for the composer's own passes. See [Build / NockApp Anatomy — Anchor Markers](/build/anatomy#anchor-markers) for the per-marker definitions.

### nockchain

The upstream runtime. Provides Nock, Hoon, the `NockApp` harness, JAM, and tip5. vesl runs a Hoon kernel inside a `NockApp` and ships a graft library on top.

### nockup

Nockchain's developer CLI. `nockup project init` scaffolds a NockApp project; `nockup package add` installs grafts. vesl-nockup will eventually ship as a package within it.

### NounSlab

The Rust noun container. The hull allocates nouns into a slab, builds a poke head and arguments inside it, and submits the slab to the kernel via `app.poke(...)`. Defined in `nockapp::noun::slab`. See [Build / Hull](/build/hull).

### Panic

A runtime crash. In the hull, a Rust `panic!` aborts the spawned `app.run()` task — `vesl-test watch` surfaces this as `kernel-died: <reason>` rather than crashing itself. In the kernel, `mule` traps panics so a single bad cause doesn't terminate the kernel; deliberate `?>` exits surface as `Ok(vec![])` from `app.poke(...)` with a `mule`-trace on stderr. See [Troubleshooting / Common Pitfalls](/troubleshooting/common-pitfalls).

### Settle

In vesl: the canonical commitment-family graft (priority 10). Registers Merkle roots per `hull=@`, verifies payloads against a gate, settles notes with replay protection and epoch rotation. The heaviest commitment primitive; what most apps reach for first.

### Snapshot

A serialized kernel-state checkpoint. Lets a kernel resume without replaying every poke since boot. See [Build / State & Snapshots](/build/state-snapshots).

### tip5

Nockchain's hash function — a custom Merkle hash optimized for STARK-friendliness. ~100 constraints per call vs. ~30k for SHA-256. Used by `vesl-merkle.hoon` and `zeke.hoon`. tip5 is part of the nockchain runtime.

### Trellis

A pattern: one kernel split across multiple `hull=@` namespaces, each with its own root and lifecycle. Gives the isolation of separate kernels without booting separate `NockApp`s. See [Build / Grafts — The Trellis Pattern](/build/grafts/trellis-pattern).

### vesl

Verifiable Execution and Settlement Layer. A Rust SDK (`vesl-core`) plus a Hoon graft library that runs inside nockchain's `NockApp`. See [vesl at a glance](/pitch).

### vesl-core

vesl's Rust SDK crate: `Mint`, `Guard`, builder helpers, and poke constructors for every shipped graft. See [Reference / vesl-core](/reference/vesl-core).

### vesl-nockup

The recommended development environment for building nockapps; the subject of this guide. Ships the templates, the `nockup graft` CLI, and the example apps.

### vesl.toml

Runtime config file — settlement modes, key derivation, chain settings. See [Reference / vesl.toml](/reference/vesl-toml).

## Hoon

### Arm

A function on a Hoon core. The kernel's two top-level arms are `++poke` (write) and `++peek` (read); each cause-tag in `nockup:poke` is an arm of the `?-` switch. See [Build / Kernel](/build/kernel/).

### Atoms and Auras

A Hoon atom is a non-negative integer. Auras (`@t`, `@ud`, `@tas`, `@da`, `@`) are tags on atoms that record how to read the integer — UTF-8 cord, decimal number, lowercase symbol, absolute date, or untyped — without changing the underlying value. See [Build / Kernel](/build/kernel/).

### Cause

The input shape to a kernel `++poke` arm. A cause is a tagged tuple — `[%settle-register hull root]`, `[%my-action arg1 arg2]` — pattern-matched by the `?-` arm and dispatched to its handler. See [Build / Inject](/build/grafts/inject).

### Cell

A noun built from two other nouns — an ordered pair `[a b]`. Cells nest right-associatively, so `[1 2 3]` is `[1 [2 3]]`. With atoms, cells compose every noun a kernel handles.

### Cue

The JAM deserializer — the inverse of `jam`. Reads a noun back out of a byte buffer the kernel previously wrote with `jam`. JAM and cue are nockchain primitives, not vesl ones.

### Domain

The cause tags, peek paths, and verification gates you write between the markers. Distinct from grafts, which are pre-written and composed in for you. See [Build / Kernel](/build/kernel/).

### Effect

The output shape from a kernel `++poke` arm — a `(list effect)` of tagged nouns the hull receives back from `app.poke(...).await`. The hull parses heads via `vesl_core::effect_head_tags`. See [Build / Hull](/build/hull).

### Gate

A Hoon function. Takes one or more sample arguments, returns a value computed from its body. Distinct from a [verification gate](#verification-gate) — that is vesl's parameterized decision function consumed by commitment grafts, not the language-level construct.

### Mule

The Hoon crash-isolation wrapper. Catches a downstream panic and returns it as a value rather than terminating the kernel. The `wrapper.hoon` library wraps every `++poke` arm so a single bad cause doesn't take down the kernel.

### Noun

The universal value type in Nock and Hoon. Either an atom (a non-negative integer) or a cell (an ordered pair of two nouns). Everything in a kernel — state, causes, effects — is a noun.

### Peek

The read arm of a kernel. Takes a path noun, returns `(unit (unit *))` — three shapes encoding "not for me", "recognized but absent", "recognized and here is the value". See [Build / Kernel](/build/kernel/).

### Poke

The write arm of a kernel. Takes a cause noun, returns `[(list effect) state]` — a list of effects for the hull to consume plus the new kernel state. See [Build / Kernel](/build/kernel/).

### Verification Gate

A parameterized decision function consumed by commitment grafts. Default is hash-comparison; named gates (`sig-verify-ed25519`, `sig-verify-schnorr`, `manifest-verify`, `set-membership-verify`, `bounded-value-verify`) ship in `vesl-gates.hoon` and are selected per-graft via `[graft.gates]`. A gate is a parameter, not a step in a pipeline. See [Build / Kernel — replacing a verification gate](/build/kernel/gates).

### Versioned-State

The kernel's state type. Declared as `+$ versioned-state` in `app.hoon` at the `nockup:state` marker: a tagged record with a head version (`%v0`, `%v1`, ...) followed by per-graft state fields and any state your domain adds. Each `++poke` arm receives it by value and returns the new version as the tail of `[effects new-state]`. Bumping the head tag triggers `++load`'s migration path on resumed snapshots — see `nockup:load-defaults` in [Build / NockApp Anatomy — Anchor Markers](/build/anatomy#anchor-markers).
