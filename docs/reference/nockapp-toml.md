---
title: nockapp.toml
description: Project manifest for `nockup project init` — package metadata, template source, and dependency declarations.
outline: deep
---

# `nockapp.toml`

The project manifest `nockup` reads to scaffold or rebuild a project. Lives at the root of a nockapp directory. Consumed by `nockup project init` (initial scaffold) and re-read by `nockup package install` (dependency resolution). All `[package]` fields except `name` are optional.

## Worked Example

```toml
[package]
name = "my-app"
version = "0.1.0"
description = "grafted NockApp"
authors = ["Alice <alice@example.com>"]
license = "MIT OR Apache-2.0"
template = "vesl"
template_git = "https://github.com/zkvesl/vesl-nockup"
template_path = "templates"
template_commit = "6e2127c"   # optional pin

[dependencies]
"zkvesl/vesl-graft" = "latest"
"someorg/somedep" = { git = "https://github.com/someorg/somedep", commit = "abc123" }
```

## `[package]` Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | string | — | Project name. Required. Used as the project directory name on `nockup project init`. |
| `version` | string | — | Semver version of the project itself. Optional metadata. |
| `description` | string | — | One-line description. Optional metadata. |
| `authors` | list of strings | — | Author list. Optional metadata. |
| `license` | string | — | SPDX license identifier or expression. Optional metadata. |
| `template` | string | `"basic"` | Template directory name. Resolves to `<template_git>/<template_path>/<template>/` when `template_git` is set; otherwise to `~/.nockup/templates/<template>/`. |
| `template_git` | string | — | Git URL of a repo containing template directories. Accepts `https://`, `git@`, and `file://` (the last is useful for local testing). When unset, nockup uses its channel-managed template cache. |
| `template_path` | string | — | Subdirectory inside `template_git` that holds the templates root. Defaults to the repo root when omitted. Leading and trailing slashes are stripped during resolution. |
| `template_commit` | string | — | Pinned git commit (full or short SHA) for `template_git`. Without a pin, nockup pulls the default branch's tip on first init and caches it. |

## `[dependencies]` Schema

Each entry maps a package name to one of three forms:

```toml
# Form 1: simple version string (most common)
"zkvesl/vesl-graft" = "latest"

# Form 2: explicit version field
"zkvesl/vesl-graft" = { version = "0.1.0" }

# Form 3: full spec with git, commit, tag, branch, path, files, or kelvin
"zkvesl/vesl-graft" = { git = "https://github.com/zkvesl/vesl-nockup", commit = "6e2127c" }
"my-local-graft"    = { path = "../local-graft" }
"strict-pin"        = { git = "https://...", tag = "v1.0" }
```

The full-spec fields:

| Field | Description |
|---|---|
| `version` | Semver constraint or a channel literal like `"latest"`. |
| `git` | Git URL (HTTPS, SSH, or `file://`). |
| `commit` | Pinned commit SHA. |
| `tag` | Git tag. Resolved at install to a commit and written to `nockapp.lock`. |
| `branch` | Git branch. Resolved at install to a commit and written to `nockapp.lock`. |
| `path` | Filesystem path. For local development; not portable. |
| `files` | List of file patterns to symlink. When unset, the entire package is symlinked. |
| `kelvin` | Kelvin version constraint (Urbit dependency convention). |

`nockup project init` resolves every entry, fetches the source, symlinks it into the new project, applies any declarative `[[patches]]` declared in the package's own manifest, and writes the resolved commit hashes to `nockapp.lock` next to `nockapp.toml`.

## `[lint]` Table

Optional table that overrides per-lint severity for `nockup graft inject --apply` and `nockup graft lint`. Each key is a lint kind label, each value is a severity (`"error"`, `"warn"`, or `"note"`):

```toml
[lint]
weld-friction = "error"        # promote the advisory weld lint to a gate
transitive-imports = "warn"    # demote — keep the warning but allow the write
```

Valid keys: `weld-friction`, `bare-tilde-ambiguity`, `collision`, `transitive-imports`, `internal-dupes`, `unresolved-cause-reference`.

Resolution order: `--lint-override NAME=SEVERITY` on the CLI wins over the `[lint]` table, which wins over the per-lint default. An unknown lint name in `[lint]` (e.g. a typo like `transitive-importss`) hard-errors at config load so the override doesn't silently no-op. `nockup graft doctor` runs the lint pass under the resolved policy and lists the effective severity per lint, so the same command surfaces both the active policy and the findings it produces without requiring a compose.

See [Inject — Pre-Apply Linting](/build/grafts/inject#pre-apply-linting) for the per-lint surfaces and [CLI — Lints](/reference/cli#lints) for the printer shape.

## What `nockup project init` Does

1. **Read** `nockapp.toml` in the current directory.
2. **Resolve the template** — fetch `template_git` (pinned to `template_commit` if set) into `~/.nockup/templates/`, or fall back to the channel cache when `template_git` is unset.
3. **Copy and render** — copy `<template>/` into `./<package.name>/`, rendering Handlebars placeholders against the manifest fields.
4. **Save the canonical manifest** — write `nockapp.toml` into the new project directory.
5. **Install dependencies** — invoke `package install` against the new project. Each `[dependencies]` entry is resolved and symlinked; declarative `[[patches]]` from each package's own manifest are applied with a y/N consent prompt (skip the prompt with `--accept-patches` for CI).
6. **Write the lockfile** — `nockapp.lock` records `[[package]]` entries with resolved commit hashes and applied-patch hashes; later runs of `nockup package install` re-confirm against these.

::: info See Also

- [Setup / Your first nockapp](/setup/quickstart) — the workflow this schema sits inside.
- [`crates/nockup/src/manifest.rs`](https://github.com/nockchain/nockchain/blob/main/crates/nockup/src/manifest.rs) — source-of-truth schema definition.
- [Reference / vesl.toml](/reference/vesl-toml) — runtime config for vesl-based hulls (sibling file, different purpose).

:::
