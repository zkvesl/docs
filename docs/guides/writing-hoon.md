# Writing Hoon for Vesl

Graft users don't need to be Hoon experts. The scaffold template handles the hard parts. This page covers the minimum needed to customize a grafted kernel.

## Imports

Hoon import order matters. Libraries (`/+`) must come after structure files (`/-`), and both must come before subject imports (`/=`):

```hoon
/-  *vesl              :: structure file (only for RAG gates)
/+  *vesl-graft        :: library
/+  *vesl-merkle       :: library
/=  *  /common/wrapper  :: subject (state versioning)
```

Mixing order causes cryptic syntax errors in `hoonc`.

## Types

### Defining state

State is a labeled tuple using `$:`:

```hoon
+$  versioned-state
  $:  %v1                              :: version tag
      vesl=vesl-state                  :: grafted state
      items=(map @ @t)                 :: your fields
      count=@ud
  ==
```

`@` is an unsigned integer. `@t` is a text cord. `@ud` is an unsigned decimal. `(map @ @t)` is a map from integers to text.

### Tagged unions

Causes (poke types) are tagged unions using `$%`:

```hoon
+$  cause
  $%  [%my-action data=@t]     :: your domain poke
      vesl-cause                :: brings %vesl-register, %vesl-verify, %vesl-settle
  ==
```

Each variant starts with a tag atom (`%my-action`). The kernel dispatches on `-.cause` (the head — the tag).

## Poke dispatch

The `++poke` arm uses `?-` to match on the cause tag:

```hoon
++  poke
  |=  =ovum:moat
  ^-  [(list effect) _state]
  =/  act  ((soft cause) cause.input.ovum)
  ?~  act  [~ state]                    :: unknown cause, ignore
  ?-  -.u.act                           :: switch on tag
    ::
      %my-action
    ::  ... handle domain poke ...
    ::
      %vesl-register
    ::  ... delegate to graft ...
  ==
```

`(soft cause)` tries to parse the raw noun as your `cause` type. Returns `~` (null) if it doesn't match. `?~` checks for null.

## Loobeans

Hoon booleans are inverted from most languages:

| Hoon | Meaning | Nock value |
|------|---------|-----------|
| `%.y` | yes / true | `0` |
| `%.n` | no / false | `1` |

`?:` is if-then-else: `?:(test if-yes if-no)`.

`?>` asserts true (crashes if false — produces an unprovable STARK).

`?.` is inverted if: `?.(test if-no if-yes)`. Used for guard clauses:

```hoon
?.  (some-check)
  :: this runs if check is FALSE
  :_  state
  ~[[%error 'check failed']]
:: this runs if check is TRUE (fall through)
```

## State updates

`:_` is "put the second thing first" — it builds `[effects new-state]` with the state expression on the right:

```hoon
:_  state(items new-items, count +(count.state))
^-  (list effect)
~[[%my-actioned id data]]
```

`state(items new-items)` creates a copy of `state` with the `items` field replaced. Multiple fields can be updated: `state(items new-items, count new-count)`.

## Slog (debug logging)

Print a message to the console:

```hoon
~>  %slog.[0 'my debug message']
```

Priority levels: `0` = info, `1` = warning, `2` = debug, `3` = error.

Use `(cat 3 'prefix ' (scot %ud value))` to format numbers into log messages:

```hoon
~>  %slog.[0 (cat 3 'count: ' (scot %ud count.state))]
```

## Map and set operations

```hoon
::  map operations
(~(put by my-map) key value)       :: insert/update
(~(get by my-map) key)             :: lookup (returns unit)
(~(got by my-map) key)             :: lookup (crashes if missing)
(~(has by my-map) key)             :: membership check

::  set operations
(~(put in my-set) value)           :: insert
(~(has in my-set) value)           :: membership check
~(wyt in my-set)                   :: count elements
```

## Compilation

```bash
hoonc --new hoon/app/app.hoon hoon/
```

`--new` forces a fresh compile (no cache). The second argument is the library search path. All imports (`/+`, `/-`, `/=`) resolve relative to this path.

If `hoonc` says "no panic!" but produces no `out.jam`, a dependency is missing from the search path. Check that `zeke.hoon` and `ztd/` are present in `hoon/common/`.

~
