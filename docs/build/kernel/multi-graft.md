---
title: Coordinating Multiple Grafts in One Arm
description: Threading state through multiple grafts in one domain arm via domain-patterns' apply-<graft> wet-gates.
outline: deep
---

# Coordinating Multiple Grafts in One Arm

**After reading:** you'll use `apply-<graft>` wet-gates from `domain-patterns` to chain pokes through several grafts from one domain arm — three lines per step, not nine.

When a domain arm threads state through more than one graft (increment a counter, write to `kv`, append to the audit log), the hand-coded shape gets repetitive. `vesl-core` ships a small library, `domain-patterns`, with `apply-<graft>` wet-gates that bundle each graft's three-line poke shape into a single line:

```hoon
::  near the top of your app.hoon, alongside the other /+ lines:
/+  *domain-patterns
```

Walking the import:

- `/+` is Hoon's import rune: import a named library from `hoon/lib/`.
- The `*` prefix on the library name pulls all exposed names into the subject (`*domain-patterns` vs. selective import like `/+  domain-patterns`).
- `domain-patterns` is the library — it lives at `hoon/lib/domain-patterns.hoon`.

## Composing Two Graft Arms in One Domain Cause

This is the pattern `nockup graft inject` warns about when its `weld-friction` lint fires (see [CLI → weld-friction](/reference/cli#weld-friction)). When one domain cause needs to drive two grafts in a defined order — writing to `kv` then logging the change, or incrementing a counter then settling a note — you thread the post-state of one graft into the next via the `apply-<graft>` helpers in `domain-patterns`.

A worked arm that fans a single domain cause out to three grafts — assuming the cause variant is `[%record-event name=@t]`:

```hoon
::  inside ?-, a %record-event arm that increments a counter,
::  writes to kv, and appends to the audit log:
  %record-event
=^  efx-c  state  (apply-counter [%counter-increment 'events'] state)
=^  efx-k  state  (apply-kv [%kv-set name.u.act 1] state)
=^  efx-l  state  (apply-log [%log-append name.u.act] state)
:_  state
^-  (list effect)
(welp efx-c (welp efx-k efx-l))
```

Walking the arm:

- `%record-event` is the cause tag this arm matches.
- `=^  efx-c  state  (apply-counter ...)` is the threading rune. It evaluates the expression, binds the head of the returned cell to `efx-c` (the counter's effects list), and rebinds `state` to the tail (the post-counter state). The next line sees the updated `state`.
- Each `apply-<graft>` call takes the graft's cause noun and the current `state`, internally routes through the underlying `<graft>-poke` arm, and returns `[effects new-state]`.
- After three `=^` lines, `state` reflects all three graft updates and each `efx-*` binding holds that graft's effect list.
- `(welp efx-c (welp efx-k efx-l))` concatenates the three lists into the single `(list effect)` the arm returns. `welp` is list concatenation; the nested call performs a three-way concat.
- `:_  state` returns `[effects state]` in `NockApp`'s required `[effects new-state]` shape.
- `^-  (list effect)` ascribes the head's type.

Each `apply-<graft>` takes `[cause versioned-state]` and returns `[(list <graft>-effect) versioned-state]`, suitable for direct `=^` binding. See [`hoon/lib/domain-patterns.hoon`](https://github.com/zkvesl/vesl-nockup/blob/6e2127c/hoon/lib/domain-patterns.hoon) for the full helper list.

::: info Stuck?

Something broken? The breakage is probably already in [Common Pitfalls](/troubleshooting/common-pitfalls).

:::
