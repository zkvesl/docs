---
title: Glossary
description: One-line definitions for the terms that appear across the guide. Each entry links to the page that introduces the term.
outline: deep
---

# Glossary

Terms are alphabetized. Each entry is a single declarative definition; click through for context.

## Atoms and auras

A Hoon atom is a non-negative integer. Auras (`@t`, `@ud`, `@tas`, `@da`, `@`) are tags on atoms that record how to read the integer — UTF-8 cord, decimal number, lowercase symbol, absolute date, or untyped — without changing the underlying value. See [Build / Write the kernel (Hoon)](/build/kernel-hoon).

## Cause

The input shape to a kernel `++poke` arm. A cause is a tagged tuple — `[%settle-register hull root]`, `[%my-action arg1 arg2]` — pattern-matched by the `?-` arm and dispatched to its handler. See [Build / Wire with graft-inject](/build/wire).

## Cue

The JAM deserializer — the inverse of `jam`. Reads a noun back out of a byte buffer the kernel previously wrote with `jam`. JAM and cue are nockchain primitives, not vesl ones.

## Domain

The cause tags, peek paths, and verification gates you write between the markers. Distinct from grafts, which are pre-written and composed in for you. See [Build / Write the kernel (Hoon)](/build/kernel-hoon).

## Driver

The Rust process that hosts a kernel — your `src/main.rs` boot binary. Mediates I/O (HTTP, chain client, filesystem) into pokes and peeks; sometimes called *hull*. See [Build / The Rust driver](/build/rust-driver).

## Effect

The output shape from a kernel `++poke` arm — a `(list effect)` of tagged nouns the driver receives back from `app.poke(...).await`. The driver parses heads via `vesl_core::effect_head_tags`. See [Build / The Rust driver](/build/rust-driver).

## Family

One of the five priority bands in vesl's graft taxonomy: **commitment** (10–40), **verification gates** (library, not a band), **state** (50–99), **behavior** (100–149), **intent** (200–299, placeholder). The priority number both orders graft injection and labels the family. See [Build / Install grafts](/build/install-grafts).

## Graft

A composable unit shipped as `<name>-graft.hoon` (the Hoon library) plus a sibling `<name>-graft.toml` (the manifest). `graft-inject` discovers manifests under `hoon/lib/` and splices their declared blocks into your kernel. See [Build / Install grafts](/build/install-grafts).

## graft-inject

The CLI that composes grafts into a kernel. Discovers manifests, splices per-marker blocks into `app.hoon`, runs lint families, and emits per-graft sha256 banners. Preview by default; `--apply` writes to disk. See [Reference / CLI](/reference/cli).

## Hoon

Nockchain's source language. Compiles to Nock; kernel source files are Hoon. See [Build / Write the kernel (Hoon)](/build/kernel-hoon).

## hoonc

The Hoon compiler. Reads `hoon/app/app.hoon` (plus the library tree) and produces `out.jam` — the kernel bytes the driver loads. Ships in the [nockchain](https://github.com/nockchain/nockchain) toolchain.

## Hull

In vesl: the Rust process that hosts the kernel — the Rust harness in your `src/main.rs` that boots `out.jam` as a `NockApp`, sends pokes, and reads effects. Also the `hull=@` keying scheme that commitment grafts use to address logical cells. See [Build / Shape of a nockapp](/build/shape).

## JAM

Nockchain's serialization format for nouns. `jam` produces a deterministic byte sequence from a noun; `cue` reads the bytes back into a noun. JAM is part of the nockchain runtime, not vesl.

## Kernel

The compiled `out.jam` running inside `NockApp`. Logic-only (no I/O), pure functions over nouns, deterministic. The hull does the I/O and the kernel does the math.

## Manifest

A graft's `<name>-graft.toml` file. Declares per-marker blocks of Hoon, gate selection, type names, and metadata (priority, version, stability). See [Reference / Graft manifest schema](/reference/graft-manifest).

## Marker

One of the ten `::  nockup:*` anchor comments in `templates/app.hoon`. `graft-inject` splices graft blocks at the markers; the codegen markers (`domain-effect`, `effect-union`, `load-defaults`) are anchors for the composer's own passes. See [Build / Wire with graft-inject](/build/wire).

## Mule

The Hoon crash-isolation wrapper. Catches a downstream panic and returns it as a value rather than terminating the kernel. The `wrapper.hoon` library wraps every `++poke` arm so a single bad cause doesn't take down the kernel.

## Nock

Nockchain's combinator calculus — the deterministic execution primitive that gives a computation exactly one output for any given input. Nock is part of the nockchain runtime, not vesl.

## NockApp

The harness type from nockchain that owns the boot lifecycle, event loop, and effect broadcast for a Hoon kernel. A vesl hull is a `NockApp` plus your driver code on top.

## nockchain

The upstream runtime. Provides Nock, Hoon, the `NockApp` harness, JAM, and tip5. vesl runs a Hoon kernel inside a `NockApp` and ships a graft library on top.

## nockup

Nockchain's developer CLI. `nockup project init` scaffolds a NockApp project; `nockup package add` installs grafts. vesl-nockup will eventually ship as a package within it.

## Noun

The universal value type in Nock and Hoon. Either an atom (a non-negative integer) or a cell (an ordered pair of two nouns). Everything in a kernel — state, causes, effects — is a noun.

## Peek and poke

The two arms of a kernel. **Poke** is the write side: takes a cause noun, returns `[(list effect) state]`. **Peek** is the read side: takes a path noun, returns `(unit (unit *))` — three shapes encoding "not for me", "recognized but absent", "recognized and here is the value". See [Build / Write the kernel (Hoon)](/build/kernel-hoon).

## Settle

In vesl: the canonical commitment-family graft (priority 10). Registers Merkle roots per `hull=@`, verifies payloads against a gate, settles notes with replay protection and epoch rotation. The heaviest commitment primitive; what most apps reach for first.

## Snapshot

A serialized kernel-state checkpoint. Lets a kernel resume without replaying every poke since boot. See [Build / State & snapshots](/build/state-snapshots).

## tip5

Nockchain's hash function — a custom Merkle hash optimized for STARK-friendliness. ~100 constraints per call vs. ~30k for SHA-256. Used by `vesl-merkle.hoon` and `zeke.hoon`. tip5 is part of the nockchain runtime.

## Trellis

A pattern: one kernel split across multiple `hull=@` namespaces, each with its own root and lifecycle. Gives the isolation of separate kernels without booting separate `NockApp`s. See [Build / State & snapshots](/build/state-snapshots#the-trellis-pattern).

## Verification gate

A parameterized decision function consumed by commitment grafts. Default is hash-comparison; named gates (`sig-verify-ed25519`, `sig-verify-schnorr`, `manifest-verify`, `set-membership-verify`, `bounded-value-verify`) ship in `vesl-gates.hoon` and are selected per-graft via `[graft.gates]`. A gate is a parameter, not a step in a pipeline. See [Build / Write the kernel (Hoon)](/build/kernel-hoon#replacing-a-verification-gate).

## vesl

Verifiable Execution and Settlement Layer. A Rust SDK (`vesl-core`) plus a Hoon graft library that runs inside nockchain's `NockApp`. See [Welcome / What is vesl](/welcome/what-is-vesl).

## vesl-core

vesl's Rust SDK crate: `Mint`, `Guard`, builder helpers, and poke constructors for every shipped graft. See [Going deeper / vesl-core](/going-deeper/vesl-core).

## vesl-nockup

The recommended development environment for building nockapps; the subject of this guide. Ships the templates, the `graft-inject` CLI, and the example apps.

## vesl.toml

Runtime config file — settlement modes, key derivation, chain settings. See [Reference / vesl.toml](/reference/vesl-toml).
