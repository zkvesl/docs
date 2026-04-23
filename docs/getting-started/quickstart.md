# Quick Start

For developers building a NockApp who want verifiable data commitment. Vesl ships four composable primitives — `settle-graft`, `mint-graft`, `guard-graft`, `forge-graft` — and `graft-inject` wires whichever subset you pick into your kernel.

**Prerequisites:** Nockchain monorepo built, `hoonc` in PATH, Rust nightly, plus `graft-inject` on PATH (build once: `cd vesl-nockup/tools/graft-inject && cargo build`).

## Starting fresh (nockup scaffold + graft-inject)

```bash
# scaffold
mkdir my-project && cd my-project
# write nockapp.toml, then:
nockup project init && cd my-project

# copy the graft package into hoon/lib/ (nockup registry fallback)
cp ~/projects/nockchain/vesl-nockup/hoon/lib/{settle,mint,guard}-graft.{hoon,toml} hoon/lib/
cp ~/projects/nockchain/vesl-nockup/hoon/lib/vesl-merkle.hoon  hoon/lib/
cp -r ~/projects/nockchain/vesl-nockup/hoon/common/* hoon/common/

# copy the marker template, preview-then-apply the four grafts
cp ~/projects/nockchain/vesl-nockup/templates/app.hoon hoon/app/app.hoon
graft-inject hoon/app/app.hoon            # preview — stdout shows what will land
graft-inject --apply hoon/app/app.hoon    # write; auto-discovers every *-graft.toml in hoon/lib/

# compile + run
hoonc --new hoon/app/app.hoon hoon/
cargo +nightly build && cargo +nightly run
```

## Adding to an existing project

Annotate your `app.hoon` with the five `::  nockup:*` markers (see `vesl-nockup/templates/app.hoon` for placement), drop the graft manifests into `hoon/lib/`, and run `graft-inject --apply hoon/app/app.hoon`. No hand-written delegation code. Full walkthrough in the [Grafting Guide](/guides/grafting).

## Running a Hull directly

If you want to run the agnostic Hull template (kernel boot + HTTP shell), clone [zkvesl/vesl](https://github.com/zkvesl/vesl):

```bash
git clone https://github.com/zkVesl/vesl.git
cd vesl
cp vesl.toml.example vesl.toml     # edit nock_home if your layout differs
make setup                          # create hoon symlinks
make build                          # compile hull
```

For the verified-RAG reference implementation (ingest, Ollama, settlement), see [zkvesl/hull-llm](https://github.com/zkvesl/hull-llm).

## Next steps

- [Grafting Guide](/guides/grafting) — full walkthrough for all three developer paths
- [SDK Reference](/reference/sdk) — Mint, Guard, and tip5 encoding API
- [Configuration](/guides/configuration) — settlement modes and `vesl.toml`
- [Writing Hoon](/guides/writing-hoon) — minimum Hoon needed for graft customization
