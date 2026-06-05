# Computer Modeling of Factors Affecting Species Extinction (2000)

A web port of Andrew Cantino's 2000 international science-fair project — a
**habitat-fragmentation / species-extinction** simulator originally written in
RealBASIC. Open [`index.html`](index.html) in any browser; it runs entirely
offline from `file://`.

## What it models

A population of a hypothetical animal lives on a `size × size` grid of habitat
cells. Each cell tracks two life stages:

- **p2** — resident **adults**, which reproduce;
- **p1** — **juveniles / dispersers**, the only stage that migrates.

and two local habitat-quality modifiers **d1**, **d2** (in `[0,1]`). Every
simulated **year** (`do_tick`), in order:

1. **Random events** (optional) — each cell has a `1/prob` chance of a local
   wipe-out (`p1 = p2 = 0`).
2. **Capacity movement** (optional) — each cell's carrying capacity drifts.
3. **Local dynamics** (`Plot.tick`) — births and survival:
   - `p2' = (1/6)·p1 + (life1/life2)·p2·d2`
   - `p1' = (5/6)·p1 + (birth·p2)·d1` while below capacity, else just `(5/6)·p1`
4. **Dispersal** — a fraction `mp` of each cell's `p1` spreads equally to its
   non-wall orthogonal neighbours.

### Habitat fragmentation

Cells can be turned into **walls**:

- **Solid** (green) — impassable; blocks dispersal entirely.
- **Passable but hurting** (blue) — dispersers can cross but are drained
  (`p1 × srate`).

Either kind also **degrades its neighbours**, subtracting `wall_d1`/`wall_d2`
from their `d1`/`d2`. The *Fragmentation* slider walls off a chosen percentage
of cells at random (`do_frag`).

### What the project found

> Reproductive rate had a greater influence on survival than starting
> population size. Life span had practically no effect. Increased dispersal
> *hurt* in a fragmented habitat but *helped* (non-linearly) under random
> mortality events; with both stressors present there was an optimal dispersal
> rate.

You can reproduce these by switching scenarios and watching the **Graph** window
(total population over time).

## The windows

- **Display Window** — the grid, shaded white (full) → black (empty); walls are
  blue/green. Go / Stop / Step / Reset, with the current year and total. Click a
  cell to inspect it.
- **World Settings** — scenario picker; mortality toggles (Capacity Movement,
  Random Events + `P`); life-history factors (Migration %, Birth rate, Life
  span); fragmentation %, wall type and per-wall penalty; display options; grid
  size / New World.
- **Graph** — population total over time, with a vertical-scale slider.
- **Cell Info** — the selected cell's stage counts, capacity, `d1`/`d2`,
  neighbour count and last-tick flows; you can force-set its `d1`/`d2`.

## Scenarios

The dropdown loads fresh runs that mirror the original experiments: intact
habitat, 30% / 60% fragmentation, random mortality events, and fragmentation +
events together. (Generated into `scenarios-data.js` from `examples/*.json`.)

## Files

```
index.html       the windows; @imports shared CSS; loads engine + data + app
style.css        @import "../shared/retro-mac.css" + app-specific rules
engine.js        ported model core (UMD: window.Frag + module.exports)
scenarios-data.js embedded scenario presets (generated)
gen_data.js      regenerates scenarios-data.js from examples/
app.js           UI wiring, grid + graph rendering, run loop
examples/        scenario preset definitions (JSON)
original/        provenance: report, flowchart, project binary, saved prefs,
                 screenshot, recovered-constants.txt
test_engine.js   Node engine checks (run: node test_engine.js)
smoke.js         Playwright smoke test (run: node smoke.js)
shots.js         screenshot capture
```

## Fidelity notes

- Grid arrays are **1-based** (index 0 unused), mirroring the RealBASIC source.
- The `Plot.tick` equations, the `do_tick` order of operations, migration, and
  the wall neighbour-penalty logic are ported verbatim. Constants were recovered
  from the project binary (`original/scifair4-project`) and cross-checked against
  the author's saved settings (`original/saved-prefs/`) and the original UI
  screenshot — not guessed.
- The app's save/load uses the same per-cell field layout the original wrote
  (`Capacity:d1:d2:p1:p2:wall:total`), wrapped in a small JSON envelope.

---

*Science fair project & model by Andrew Cantino (2000). Port of the RealBASIC
source by Claude.*
