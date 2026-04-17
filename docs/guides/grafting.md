# Grafting Vesl onto Your NockApp

The Graft pattern attaches vesl's verification infrastructure to any NockApp as a composable Hoon library. The developer writes domain logic; vesl handles Merkle commitment, root registration, verification, and settlement with replay protection.

Three ways to start, depending on where you are.

## Path 1: Fresh project from the scaffold template

Copy `templates/graft-scaffold/` from the vesl repo. Everything is pre-wired.

```bash
cp -r /path/to/vesl/templates/graft-scaffold my-project
cd my-project
```

Compile the kernel (all Hoon deps are bundled — no `$NOCK_HOME` needed):

```bash
hoonc --new hoon/app/app.hoon hoon/
```

Build and run:

```bash
cargo +nightly build
cargo +nightly run
```

The scaffold includes:
- `hoon/app/app.hoon` — grafted kernel with `CUSTOMIZE` markers
- `hoon/lib/vesl-graft.hoon` — state + poke dispatcher
- `hoon/lib/vesl-merkle.hoon` — tip5 Merkle primitives
- `hoon/common/` — tip5 hash tables (zeke.hoon + ztd/)
- `src/main.rs` — full lifecycle: domain poke, Mint, Guard, register, verify, settle
- `Cargo.toml` — local path dependencies (adjust paths to your clones)

To customize: rename `%my-action` in `app.hoon`, add state fields after `vesl=vesl-state`, fill in domain poke logic. The three `%vesl-*` delegations and the verification gate are already written.

## Path 2: Add vesl to an existing NockApp

For a project that already has a working Hoon kernel and Rust driver.

### Hoon side

**1. Copy the libraries** into your `hoon/` directory:

```
hoon/
  lib/vesl-graft.hoon       # from vesl/protocol/lib/
  lib/vesl-merkle.hoon       # from vesl/protocol/lib/
  common/zeke.hoon            # from vesl/proof-log/hoon/common/
  common/ztd/                 # all 8 files from vesl/proof-log/hoon/common/ztd/
```

`vesl-merkle.hoon` imports `zeke.hoon` for tip5 hash primitives. Without `zeke.hoon` and `ztd/`, `hoonc` silently produces no output.

**2. Import** at the top of your kernel:

```hoon
/+  *vesl-graft
/+  *vesl-merkle
```

**3. Add `vesl-state`** to your `versioned-state`:

```hoon
+$  versioned-state
  $:  %v1
      vesl=vesl-state          ::  [registered=(map @ @) settled=(set @)]
      ::  ...your existing fields...
  ==
```

**4. Add `vesl-cause`** to your cause union:

```hoon
+$  cause
  $%  [%your-poke ...]        ::  existing domain pokes
      vesl-cause               ::  brings %vesl-register, %vesl-verify, %vesl-settle
  ==
```

**5. Delegate pokes** in your `++poke` arm. Define a verification gate and pass it to `vesl-poke`:

```hoon
    %vesl-register
  =/  lc=vesl-cause  [%vesl-register hull.u.act root.u.act]
  =/  hash-gate=verify-gate
    |=  [data=* expected-root=@]
    ^-  ?
    =((hash-leaf ;;(@ data)) expected-root)
  =/  [efx=(list vesl-effect) new-vesl=vesl-state]
    (vesl-poke vesl.state lc hash-gate)
  :_  state(vesl new-vesl)
  ^-  (list effect)
  efx
```

Same pattern for `%vesl-verify` and `%vesl-settle` — copy the block, change the cause tag.

**6. Add peek fallthrough** so vesl queries pass through:

```hoon
++  peek
  |=  =path
  ^-  (unit (unit *))
  ?+  path  (vesl-peek vesl.state path)
    [%your-path ...]  ...your peeks...
  ==
```

### Rust side

**7. Add dependencies** to `Cargo.toml`:

```toml
vesl-core = { path = "../path/to/vesl/crates/vesl-core" }
nock-noun-rs = { path = "../path/to/vesl/crates/nock-noun-rs" }
nockchain-tip5-rs = { path = "../path/to/vesl/crates/nockchain-tip5-rs" }
```

**8. Recompile** your kernel:

```bash
hoonc --new hoon/app/app.hoon hoon/
```

### That's it

Your existing domain pokes keep working. The three `%vesl-*` pokes are handled by the graft library. Peek paths `/registered/<hull>`, `/settled/<note-id>`, and `/root/<hull>` are available for free.

## Path 3: Docker container

For developers who don't want to build nockchain and hoonc from source.

```bash
docker pull ghcr.io/zkvesl/vesl-dev:latest
docker run -it -v $(pwd):/workspace ghcr.io/zkvesl/vesl-dev:latest
```

The container includes:
- Rust nightly with all nockchain crate dependencies
- `hoonc` pre-built and in PATH
- `$NOCK_HOME` pre-configured
- vesl SDK crates available at `/opt/vesl/crates/`

Inside the container, follow Path 1 or Path 2 above. The only difference is that dependency paths in `Cargo.toml` point to `/opt/vesl/crates/` instead of relative paths.

::: warning
The Docker image is not yet published. This section describes the planned container setup. Until then, build nockchain and hoonc from source per the [Installation](/getting-started/installation) guide.
:::

---

## The Rust SDK: Mint, Guard, and root encoding

### Mint — build Merkle trees

```rust
use vesl_core::Mint;

let mut mint = Mint::new();
let leaves: Vec<&[u8]> = data.iter().map(|d| d.as_bytes()).collect();
let root = mint.commit(&leaves);

// Get inclusion proof for any leaf
let proof = mint.proof(0).unwrap();
```

### Guard — verify proofs locally

```rust
use vesl_core::Guard;

let mut guard = Guard::new();
guard.register_root(root).unwrap();

let valid = guard.check(data.as_bytes(), &proof, &root);
```

Mint and Guard are pure math. No kernel, no async, no network.

### Root encoding: tip5_to_atom_le_bytes

The tip5 hash is `[u64; 5]` — five Goldilocks field elements. To pass a root to the Hoon kernel, it must be encoded as the same atom that Hoon's `digest-to-atom` produces. This is a base-p polynomial, **not** flat byte concatenation.

```rust
use vesl_core::tip5_to_atom_le_bytes;
use nock_noun_rs::make_atom_in;

let root_bytes = tip5_to_atom_le_bytes(&root);
let root_atom = make_atom_in(&mut slab, &root_bytes);
```

::: danger
Do **not** use `root.iter().flat_map(|v| v.to_le_bytes()).collect()` — this produces a different atom than the Hoon side expects. The kernel will silently register a wrong root and verification will always fail.
:::

### Register a root with the kernel

```rust
use nock_noun_rs::{make_atom_in, make_tag_in};
use nockvm::noun::{D, T};

let mut slab = NounSlab::new();
let tag = make_tag_in(&mut slab, "vesl-register");
let root_bytes = tip5_to_atom_le_bytes(&root);
let root_atom = make_atom_in(&mut slab, &root_bytes);
let poke = T(&mut slab, &[tag, D(hull_id), root_atom]);
slab.set_root(poke);

app.poke(SystemWire.to_wire(), slab).await?;
```

### Build a settlement payload

To settle a note, build a `graft-payload` noun, jam it, and poke `%vesl-settle`:

```rust
use nock_noun_rs::{jam_to_bytes, make_atom_in, make_tag_in, new_stack};
use nockvm::noun::{D, T};

let mut slab = NounSlab::new();
let rb = tip5_to_atom_le_bytes(&root);

// graft-payload: [note=[id hull root [%pending ~]] data expected-root]
let note_root = make_atom_in(&mut slab, &rb);
let pending_tag = make_tag_in(&mut slab, "pending");
let state = T(&mut slab, &[pending_tag, D(0)]);
let note = T(&mut slab, &[D(note_id), D(hull_id), note_root, state]);

let data = make_atom_in(&mut slab, leaf_bytes);
let exp_root = make_atom_in(&mut slab, &rb);
let payload_noun = T(&mut slab, &[note, data, exp_root]);

// Jam and send
let payload_bytes = {
    let mut stack = new_stack();
    jam_to_bytes(&mut stack, payload_noun)
};
let jammed = make_atom_in(&mut slab, &payload_bytes);
let tag = make_tag_in(&mut slab, "vesl-settle");
let poke = T(&mut slab, &[tag, jammed]);
slab.set_root(poke);

app.poke(SystemWire.to_wire(), slab).await?;
```

The same pattern works for `%vesl-verify` (soft verification, returns `[%vesl-verified ok=?]` without crashing on failure).

---

## Custom verification gates

The default hash gate compares `hash-leaf(data)` to the expected root. This works for single-leaf trees. For multi-leaf trees or domain-specific verification, write a custom gate.

The gate type is `$-([data=* expected-root=@] ?)` — takes opaque data and a root, returns a loobean.

```hoon
::  RAG manifest verification
|=  [data=* expected-root=@]
=/  mani  ;;(manifest data)
(verify-manifest mani expected-root)

::  Simple hash comparison (single-leaf trees)
|=  [data=* expected-root=@]
=((hash-leaf ;;(@ data)) expected-root)

::  Always-true (testing)
|=  [data=* expected-root=@]
%.y
```

Define the gate inline in each `%vesl-*` poke delegation. The gate sees `data` as opaque `*` — cast it to your domain type with `;;(your-type data)`.

## The primitives

Pick the weight class that matches your needs.

| Need | Use | Kernel? |
|------|-----|---------|
| Hash data, get roots | Mint | No |
| Verify proofs | Mint + Guard | No |
| Register roots in kernel | Mint + Graft | Yes |
| Verify in kernel | Graft (`%vesl-verify`) | Yes |
| Settle notes | Graft (`%vesl-settle`) | Yes |
| STARK proofs | Full vesl-kernel + prover | Yes (18 MB) |

## Reference templates

| Template | What it demonstrates |
|----------|---------------------|
| `graft-scaffold` | Full lifecycle with bundled deps. Start here. |
| `graft-intent` | Custom hash gate, no RAG types. Minimal. |
| `graft-mint` | Mint + Guard with domain pokes. |
| `graft-settle` | Settlement with replay protection. |

~
