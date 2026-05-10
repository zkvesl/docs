# vesl-nockup README — residual banned-word locations

Round 1 of the docs revision deferred a coordinated scrub of
`vesl-nockup/README.md`. The README still contains banned words
(`Phase X`, `RM<N>`, `dogfood`) at the line ranges below. Round 1
docs link to the README via section anchors at branch ref only —
no new SHA-pinned links into these spans.

The round that does scrub the README should remove or reword each
hit and bump the docs SHA pins to the post-scrub commit.

## Hits identified during round 1 (vesl-nockup HEAD `6e2127c`)

- `README.md:42` — `Phase 6.5b` (in the Cargo.toml fixup paragraph). Replace with the spatial fact: "The vesl-core / nock-noun-rs crates live in the vesl-core repo, not vesl-nockup."
- `README.md:147` — `Phase 03f typed effect-union pass`. Drop the phase identifier; describe the feature plainly.
- `README.md:174-176` — Lint-family hits (`RM1 HARD-BUG-2`, `RM1 META-COLLISION-1/2/3`, `RM2 seed-A.md`). Replace with bug-class descriptions ("the bare-tilde corruption case", "duplicate cause-tag and state-field cases", "the silent-fail import case").
- `README.md:213` — `RM2 seed-A.md DOC-GAP-1 RECUR`. Drop the round/section reference.
- `README.md:220` — `RM1 DOC-GAP-1 / RM2 F→G postscript`. Replace with "hoonc's exit-0-with-no-out.jam silent-fail case".
- `README.md:319` / `:321` — `RM1 HARD-BUG-3` / `RM2 §2.2`. Describe the bug class ("a kernel rename that compiles silently and surfaces as `Ok(vec![])`").
- `README.md:485` — `Phase 02`. Drop the identifier.
- `README.md:550` — `Phase 03c` / `RM4 §1`. Describe the mechanism (snapshot resume defaults overlay) without the round/phase identifier.
- `README.md:559` — `RM4 §1 v0.2`. Drop the round identifier.
- `README.md:993` / `:995` — `RM4 round.md HARD-BUG-1`. Replace with "the kernel-died case".
- `README.md:1009` — `C-01 remediation`. Drop the remediation identifier.
- `README.md:1027` — `Phase 12A`. Drop the phase identifier.

## Where to update once the README is scrubbed

The docs pages that hoist or anchor against these spans:

- `docs/setup/install.md` — anchors against `#prerequisites` (line 5; clean).
- `docs/setup/quickstart.md` — anchors against `#step-1`–`#step-6` section headers (mostly clean; line 42 falls inside Step 1 narrative).
- `docs/build/initialize.md` — hoists the Cargo.toml fixup; in-page prose already scrubs line 42.
- `docs/build/install-grafts.md` — anchors `#step-2--install-the-vesl-graft-packages` (clean).
- `docs/build/inject.md` — anchors `#step-3--wire-the-kernel`; the lint-families subsection at lines 174–176 is dirty. In-page prose describes the lint cases by name; do not deep-link to the lint subsection until scrub.
- `docs/build/hull.md` — anchors `#step-6` and the canonical 30-line driver block; lines 319/321 (drift detection) are dirty. In-page prose scrubs.
- `docs/build/testing.md` — anchors `#testing-with-vesl-test`; lines 993/995 are dirty. In-page prose scrubs.
- `docs/build/state-snapshots.md` — anchors `#state-checkpoints`; line 550 is dirty. In-page prose scrubs.
- `docs/build/build-run.md` — anchors `#step-4` / `#step-5`; line 220 (Step 4 narrative) is dirty. In-page prose scrubs.
- `docs/troubleshooting/common-pitfalls.md` — anchors `#troubleshooting`; lines 1009/1027 are dirty. In-page prose scrubs.

When the README PR lands:

1. Bump the `vesl-nockup` SHA pin in every page that uses one (currently `6e2127c`).
2. Promote any branch-ref anchor that previously avoided a dirty span to a SHA-pinned line range now that the span is clean.
3. Delete this file.
