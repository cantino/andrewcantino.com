# Sympatric Speciation Simulator (1999)

A web port of Andrew Cantino's 1999 international science-fair project, *Can
sympatric speciation occur?* — a bird-evolution simulator originally written in
RealBASIC (the "SSS" app). Open [`index.html`](index.html) in any browser; it
runs entirely offline from `file://`.

## What it models

A population of birds undergoes **adaptive radiation**, loosely based on the
Hawaiian honeycreepers. Each bird has a beak described by three continuous
traits — **length**, **width** and **curve** — each clamped to `[0, 5]`. Seven
food types are available (fruit, insects, small/medium/large seeds, and nectar
from straight- and curved-corolla flowers). A bird's beak shape decides which
foods it can eat:

| Food | Rule |
| --- | --- |
| Fruit | width ≤ 3 and curve ≤ 1 |
| Insects | width ≤ 3 |
| Small seeds | curve ≤ 2 |
| Medium seeds | width ≥ 2 and curve ≤ 2 |
| Large seeds | width ≥ 3 and length ≤ 3 |
| Curved nectar | width ≤ 2 and length ≥ 4 and curve ≥ 3 |
| Straight nectar | width ≤ 2 and curve ≤ 2 and length > 2 |

Each simulated **year**: the food supply resets, every bird ages (and dies at
its life span), birds eat in random order until fed or starved, then survivors
pair off and breed. Offspring beaks average the parents' with a small chance of
mutation. The food supply, not a hard cap, limits the population.

### Mating schemes

- **Random** — pairs are picked at random. Always evolves; never speciates.
- **Assortative** — each bird mates with the closest available beak match.
  Evolves but stays one cluster.
- **Semi-random** — random pairs that are *too different* (beak difference ≥
  "max beak difference") can't mate. This is the scheme that produces
  **sympatric speciation**: the population splits into reproductively isolated
  clusters. Lower the max difference (e.g. 0.5) to speciate faster.

### Speciation detection

The original had a clever pixel-based detector (`Window.speci_check`): it splats
a small additive blob for every bird onto the Width×Length plot, finds the
brightest peak, and checks whether any other bright region lies far from it. Two
separated clusters ⇒ speciation. It must fire three samples in a row to
confirm. The port reproduces this exactly, including the thresholds (135/140)
and the 35-pixel separation. Enable it under **Options → Speciation Detection**.

## The windows

- **Main** — load a run, Go/Stop/Step, speed, live bird & food counts.
- **Graphic Output** — the three scatter plots (Width×Length, Width×Curve,
  Curve×Length). Check a food type to highlight (blue) the birds that can eat it.
- **Options** — food support values, life span, mutation rate, litter size,
  mating scheme, speciation detection. (Defaults are the originals; see
  `original/recovered-constants.txt`.)
- **Speciation Check** — the detector's internal view.

## Files

```
index.html      the windows; @imports shared CSS; loads engine + data + app
style.css       @import "../shared/retro-mac.css" + app-specific rules
engine.js       ported simulation core (UMD: window.SSS + module.exports)
birds-data.js   embedded original saved runs (generated)
gen_data.js     regenerates birds-data.js from examples/
app.js          UI wiring, scatter plots, animation loop
examples/       original saved bird arrays (CR→LF converted)
original/       provenance: report, screenshots, project binary, constants
test_engine.js  Node engine checks (run: node test_engine.js)
smoke.js        Playwright smoke test (run: node smoke.js)
shots.js        screenshot capture
```

## Save-file format

Plain text, one bird per line, preceded by the year count:

```
<year>
length:width:curve:sex:age:life
...
```

`sex` is 0 (female) or 1 (male). The embedded example runs (e.g. *Two species
(2/22/99)*) are the author's originals and show clear two-cluster speciation.

## Fidelity notes

- The engine is a faithful port; original quirks are preserved and flagged
  `[sic]` in `engine.js` — most notably the food-eating loop's fruit branch,
  which (unlike the other six food types) never sets the `holder` flag.
- The 1999 birds array is **0-based** (index 0 is a real bird), unlike the 2001
  Mobility project's 1-based arrays.
- Constants were recovered from the RealBASIC project binary
  (`original/SSS-1.0-project`) rather than guessed.

---

*Science fair project & model by Andrew Cantino (1999). Port of the RealBASIC
source by Claude.*
