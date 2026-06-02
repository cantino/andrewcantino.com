# The Cursed Puzzle — web port by Claude, 2026

A faithful browser port of **The Cursed Puzzle**, a text adventure written by
Andrew Cantino in **1996, at age 11**, in *Microsoft QuickBASIC for Macintosh*.

The game was recovered in two stages from backups of the author's old
`Quick-Basic` folder:

1. the **tokenized QuickBASIC binary** (data fork) — string literals were
   readable, which is how the world text and room data first came out; and
2. later, the **full ASCII-saved BASIC source**
   (`original/The_Cursed_Puzzle.source.bas.txt`) plus the game's **resource
   fork** with all **64 hand-drawn pictures**.

Because we now have the complete source, `game.js` is a **direct line-by-line
translation** of the original BASIC — not a reconstruction. Routine numbers
from the BASIC (e.g. `310` movement, `800` combat, `552` spells) are noted in
the code comments.

## Play it

Open `index.html` in any modern browser. No build step, no dependencies.

The original is menu-driven, so the **menu bar** (File / Game / Use-Find /
Move / Options / Help / Store) is the faithful interface, complete with the
`⌘` shortcuts and the little "X what?" dialogs. A command line is also
provided as a convenience; it maps to the same routines:

```
north south east west up down   jump  swim  down tree   enter portal/hole
look   get <x>  drop <x>  use <x>  light <x>  cast <spell>  kill <thing>
inventory  spells  map  help  scores  wimpy  save  open  z (scan)
store  buy <x>  sell <x>  prices
```

Choose **File ▸ New Game** (or type `new`) to start.

## How it plays (all exactly as in the original)

- You start on the old street by the jail (room 1) with **Hit 70/70**,
  **Spell 30/40**, level 1.
- **Hit** and **Spell** points slowly regenerate over time (+3 / +5 every
  ~20s); every so often you also "grow a little" and gain max hit points.
- **Goal:** collect all **6 puzzle pieces**, then a magic message tells you to
  *find the door to your land* — the door is at the **town wall (room 11)**;
  reach it to win.
- The six pieces: rooms **31, 35, 43, 49, 54**, and one by **swimming at the
  pond (room 27)**.
- Items live in fixed spots: **sword @ pond (27)**, **rock @ cave (14)**,
  **ten coins @ alley (7)**, **dry stick @ forest (13)**, **rusty key @ jail
  (3)**, **powder @ river bank (23)**. You can carry at most 3 of the heavy
  items at once.
- A real route: get the **stick** and `light stick` to enter the pitch-black
  caves; get the **key**, `use key` at the *KEEP OUT* door (room 47) to reach
  the secret rooms; get the **powder** and `light powder` at the pile of big
  rocks (52) to blast a hole through to the cave paintings (54).
- Combat (the **Kill** window) plays out round-by-round just like the original
  — the sword improves your odds, `wimpy` makes you flee when badly hurt, and
  monsters have the original hit points (ghoul 20, skeleton 25, ghost 10,
  zorg 15, wight 7, troll 40, wolf 15, worg 20, rat 5, ork 10).

### Faithful quirks preserved

These are real behaviours of the 1996 code, kept on purpose:

- "make portal" and "wind" deduct their spell-point cost **twice** (so they
  really cost 50 / 30, not the 25 / 15 the spell book lists).
- "heal me" needs **40** spell points even though the book says 25.
- Leveling needs a lot of experience (level 2 at >1500 ex, +1000 per level);
  the spell book reveals more spells as you level up.

### Shareware / registration

The original was shareware: the **Jump, Swim, Save and Open** menu items are
greyed out, leveling is capped at level 1, and the map is hidden until you
register — and because two puzzle pieces sit behind the waterfall jump and the
pond swim, an unregistered copy can't actually win. (Note the jump/swim *code*
isn't gated at all — routines 1950/1980 have no registration check; it's purely
the menu items that are disabled.)

At the start of each game a **mode modal** lets you choose:

- **Registered** — the full game, exactly as the author's registered copy
  (this simulates entering the unlock code hardcoded in the source,
  **`magic can zap!`**).
- **Unregistered** — the original shareware build, with the gates above.

You can also type `register` in-game to bring up the original registration
dialog and enter `magic can zap!` yourself.

The author's home mailing address and e-mail are **redacted** in the intro and
registration screens, matching the emulator screenshots that were provided as
the fidelity reference.

## Files

| file | what |
|------|------|
| `index.html` | the classic-Mac window layout (picture, text column, status bar) & menu bar |
| `style.css`  | black & white System-era styling |
| `rooms.js`   | the 54 rooms (descriptions + `n,e,s,w,u,d` + flee room), verbatim from the source DATA |
| `game.js`    | the engine — a direct translation of the BASIC routines |
| `img/`       | the 64 original PICT drawings, decoded to PNG |
| `original/`  | recovered artifacts: tokenized binary, full ASCII source, raw PICTs, room JSON |
