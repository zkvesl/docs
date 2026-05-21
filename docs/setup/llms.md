---
title: Docs for AI Agents
description: "How this documentation is published for AI agents: the llms.txt index, per-page markdown, and llms-full.txt."
outline: deep
---

# Docs for AI Agents

This documentation is published in three machine-readable forms, so an AI agent can consume the guide directly.

## llms.txt

[`/llms.txt`](/llms.txt) is the index: every page, grouped by section, with its one-line description and a link to the page as standalone markdown. An agent fetches this once to learn what the docs cover, then follows only the links a task needs.

## Per-page markdown

Every page is mirrored at its route with a `.md` extension. [`/setup/quickstart`](/setup/quickstart) is also served at [`/setup/quickstart.md`](/setup/quickstart.md). The markdown is the page source — prose, code blocks, and D2 diagram source — with the site chrome stripped. Fetching one page costs one page of context.

## llms-full.txt

[`/llms-full.txt`](/llms-full.txt) is every page concatenated into one file, in sidebar order. Use it for bulk ingestion when an agent needs the whole guide at once; prefer per-page fetches when it does not.

## Provenance

`llms.txt` and `llms-full.txt` open with a line naming the `zkvesl-docs` commit and the vesl-nockup and vesl-core revisions the pages were written against. When an agent's checkout is newer than that revision, the source repository is authoritative; treat a mismatch as a prompt to read the code.

All three artifacts regenerate on every build, so they track the published pages exactly.
