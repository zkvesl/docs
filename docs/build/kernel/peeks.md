---
title: Adding a Domain Peek
description: How a domain peek arm works against your state. The (unit (unit *)) return convention and the peek chain.
outline: deep
---

# Adding a Domain Peek

**After reading:** you'll add a read-only peek path that walks state and returns `(unit (unit *))` cleanly — value-present, value-absent, and path-unknown all distinguished.

A peek is the kernel's read-only entrypoint: the hull asks "what's at this path?" and the kernel walks state to answer, without mutating anything. `nockup graft inject` wires graft peek arms into a chain inside `++peek`; your domain arm sits at the tail.

## Anatomy

A peek arm has three structural concerns:

```
peek arm in ++peek's chain
├── path-guard   ?.  ?=([%my-tag ...] path)      match the path shape, ~ on miss
├── reads        ~(get by m.state), i.t.path     map gets, dotted-axis (no writes)
└── returns      [~ ~]  or  ``value              miss vs hit (see Conventions)
```

Every peek arm follows this skeleton. The path-guard runs first; if the path doesn't match, the arm returns `~` and the next arm in the chain tries. If it matches, the body reads state and returns one of two value shapes.

## Worked Example

A `[%artifact-by-name @t ~]` lookup against an `artifacts=(map @t artifact-meta)` state field:

```hoon
::  inside ++peek, below the vesl peek chain:
?.  ?=([%artifact-by-name @t ~] path)
  ~
=/  got  (~(get by artifacts.state) i.t.path)
?~  got  [~ ~]
``u.got
```

Walking the arm top-to-bottom:

- `?.  ?=([%artifact-by-name @t ~] path)  ~` — if `path` doesn't pattern-match `[%artifact-by-name @t ~]`, return `~` to defer to the next arm. `?=` is type-pattern match; `?.` is if-not.
- `=/  got  (~(get by artifacts.state) i.t.path)` — typed let-binding. `~(get by m)` is the map's get, returning `(unit value)`. `i.t.path` is dotted-axis access: `t.path` is the tail of `path`, `i.t.path` is the head of that tail (i.e., the `@t` name from the path).
- `?~  got  [~ ~]` — if `got` is null (key not in map), return `[~ ~]` ("path recognized, no value").
- `` ``u.got `` — value case. `u.got` unwraps the unit; the double-backtick wraps it as `[~ ~ value]`.

## More Examples

Three more peek shapes beyond the single-key lookup above.

### Bare Path

The simplest peek: a one-element path returning a scalar. Common for counters and toggle flags.

```hoon
::  inside ++peek, below the vesl peek chain:
?.  ?=([%entries ~] path)
  ~
``entries.state
```

The path matches `[%entries ~]` (one tag, then null-terminator). The double-backtick wraps `entries.state` into the `[~ ~ value]` success shape.

### List All Keys

Returns the entire key-set of a map-valued state field as a list. Useful for enumeration queries.

```hoon
::  inside ++peek:
?.  ?=([%names ~] path)
  ~
``~(tap in ~(key by artifacts.state))
```

`~(key by m)` returns the map's keys as a `set`; `~(tap in s)` flattens a set into a list. If `artifacts` is `(map @t _)`, the result is `(list @t)`.

### Multi-Arg Path

A path with two named segments, useful for state keyed by compound tuples (for example, `balances=(map [@ @tas] @ud)`).

```hoon
::  inside ++peek:
?.  ?=([%balance @ @tas ~] path)
  ~
=/  owner=@     i.t.path
=/  asset=@tas  i.t.t.path
=/  got  (~(get by balances.state) [owner asset])
?~  got  [~ ~]
``u.got
```

`i.t.path` reaches the first arg (head of tail); `i.t.t.path` reaches the second arg (head of tail-of-tail). The tuple `[owner asset]` is the compound key passed to `~(get by ...)`.

On the Rust side, multi-arg peeks don't have a shipped `build_*` helper today. You hand-roll the noun list yourself; see [vesl-core → Driving rbac-graft](/reference/vesl-core#driving-rbac-graft) for the canonical example (`[%rbac-has-perm pubkey perm ~]` constructed by hand). The three builders enumerated below in **Calling From Rust** cover the single-arg cases.

## Conventions & Composing

### The `(unit (unit *))` return shape

`++peek` returns `(unit (unit *))`: a unit wrapping a unit wrapping any noun. The double-wrap exists because two questions need separate answers:

- **Outer unit.** "Did any arm in the chain recognize this path?" `~` means no; `[~ <inner>]` means yes.
- **Inner unit.** "Did the recognizing arm find a value?" `~` (the head of `[~ ~]`) means no; `[~ <value>]` means yes.

That gives three concrete shapes:

- **`~`** — "this path is not for me, let the next arm try." Use on any path your arm doesn't recognize.
- **`[~ ~]`** — "I recognize this path, but there is no value at it." The standard map-lookup miss.
- **`` ``x ``** — shorthand for `[~ ~ x]`, "I recognize this path and the value is `x`." `x` must be a noun.

### Dispatch order

`nockup graft inject` chains every graft's peek arm via `~` fallthrough. Each `?.  ?=(...) ~` guard is one arm; if it returns `~`, control falls through to the next. Your domain arm sits at the tail, after every graft arm has had a chance to claim the path.

### Calling From Rust

vesl-core ships three peek-path builders for the Rust hull:

- `build_hull_peek_path(tag, hull)` — for hull-keyed peeks like `[%settle-registered hull ~]`.
- `build_keyed_peek_path(tag, key)` — for cord-keyed peeks against state grafts like `[%kv-value "greeting" ~]`.
- `build_keyless_peek_path(tag)` — for zero-arg peeks like `[%log-len ~]`.

Plus three decoders for the return cell:

- `peek_loobean(result)` — decodes a boolean response.
- `peek_atom_u64(result)` — decodes a numeric atom.
- `peek_unit_list<T>(result, decoder)` — decodes a unit-wrapped list.

The [Hull](/build/hull) page walks the full caller shape; builders and decoders live in `vesl-core/src/peek.rs`.

::: info Stuck?

Something broken? The breakage is probably already in [Common Pitfalls](/troubleshooting/common-pitfalls).

:::
