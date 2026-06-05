/*
 * Computer Modeling of Factors Affecting Species Extinction -- engine
 *
 * A faithful JavaScript port of the RealBASIC habitat-fragmentation simulator
 * Andrew Cantino wrote for a 2000 science fair. It models a
 * population of a hypothetical animal on a 2-D grid of habitat cells, with
 * life-history factors (birth rate, life span, dispersal rate), habitat
 * fragmentation (walls that block dispersal and hurt their neighbours), and
 * random short-term mortality events. The question: which factors push a
 * species toward extinction?
 *
 * Each cell ("Plot") holds two life stages:
 *   p1 -- stage 1, the dispersers (juveniles); only p1 migrates,
 *   p2 -- stage 2, the resident adults that reproduce.
 * and two local quality modifiers d1, d2 in [0,1] that adjacent walls erode.
 *
 * Walls come in two kinds (wall_mode): 1 = "passable but hurting" (animals can
 * pass through but it drains them), 2 = "solid" (impassable). Both reduce the
 * d1/d2 of their orthogonal neighbours.
 *
 * The port preserves the original equations and update order exactly. It runs
 * both as a browser global (window.Frag) and a Node module, so the model can
 * be exercised headlessly.
 *
 * Grid arrays are 1-based to mirror the RealBASIC source (loops run
 * `for a = 1 to size`); index 0 is unused.
 */
(function (root) {
  "use strict";

  // --- Default settings (recovered; see original/recovered-constants.txt) --
  var DEFAULTS = {
    mp: 0.01,          // dispersal / migration fraction of p1 per year
    br: 2,             // birth rate (offspring per adult per year)
    d1: 0.123,         // default local modifier 1 (used by "force death rate")
    d2: 0.85,          // default local modifier 2
    wall_d1: 0.02,     // d1 penalty applied to each neighbour of a wall
    wall_d2: 0.05,     // d2 penalty applied to each neighbour of a wall
    srate: 0.5,        // survival rate of p1 in a passable-hurting cell
    life1: 24,         // life-span numerator
    life2: 25,         // life-span denominator
    prob: 1000,        // random-event rarity (event when round(rnd*prob)==1)
    lessthan: 1200,    // auto-save/stop population threshold
    autostoptime: 150, // years before auto-stop
    frag: 0,           // habitat fragmentation percentage (slider1)
    make_mode: 2,      // wall type added by fragmentation (2 = solid)

    // run toggles (mirror the Settings checkboxes)
    fluc: false,       // "Capacity Movement": capacity drifts each year
    rhalf: false       // "Random Events": random local extinctions
  };

  var CELL = { Capacity: 300, p2: 200, d1: 0.123, d2: 0.85 };

  function round(x) { return Math.round(x); }

  // ------------------------------------------------------------------- Plot
  function Plot() {
    this.Capacity = 0;
    this.p1 = 0; this.p2 = 0; this.total = 0;
    this.d1 = 0; this.d2 = 0;
    this.in1_last = 0; this.out1_last = 0;
    this.wall_mode = 0;
  }

  // Plot.tick -- one year of local population dynamics (verbatim).
  Plot.prototype.tick = function (s) {
    var n1, n2;
    if (this.wall_mode === 0) {
      n2 = (1 / 6) * this.p1 + (s.life1 / s.life2) * this.p2 * this.d2;
      if (this.Capacity > this.total) {
        n1 = (5 / 6) * this.p1 + (s.br * this.p2) * this.d1;
      } else {
        n1 = (5 / 6) * this.p1;
      }
      this.p1 = n1; this.p2 = n2; this.total = this.p1 + this.p2;
    } else if (this.wall_mode === 1) {
      n1 = this.p1 * s.srate;
      this.p1 = n1; this.total = this.p1;
    }
    // wall_mode === 2: solid wall, stays empty
  };

  // ------------------------------------------------------------------ World
  function World() { this.p = [[]]; this.size = 0; }

  World.prototype.init = function (s) {
    this.size = s;
    this.p = [];
    for (var a = 0; a <= s; a++) this.p[a] = [];
    for (a = 1; a <= s; a++) {
      for (var b = 1; b <= s; b++) {
        var pl = new Plot();
        pl.Capacity = CELL.Capacity;
        pl.p2 = CELL.p2;
        pl.d1 = CELL.d1;
        pl.d2 = CELL.d2;
        pl.wall_mode = 0;
        this.p[a][b] = pl;
      }
    }
  };

  World.prototype.tick = function (s) {
    for (var a = 1; a <= this.size; a++)
      for (var b = 1; b <= this.size; b++) this.p[a][b].tick(s);
  };

  World.prototype.get_total = function () {
    var c = 0;
    for (var a = 1; a <= this.size; a++)
      for (var b = 1; b <= this.size; b++) c += this.p[a][b].total;
    return c;
  };

  World.prototype.get_total_capacity = function () {
    var c = 0;
    for (var a = 1; a <= this.size; a++)
      for (var b = 1; b <= this.size; b++) c += this.p[a][b].Capacity;
    return c;
  };

  // -------------------------------------------------------------------- Sim
  function Sim(opts) {
    opts = opts || {};
    this.rng = opts.rng || Math.random;
    this.s = {};
    for (var k in DEFAULTS) this.s[k] = DEFAULTS[k];
    if (opts.settings) for (var j in opts.settings) this.s[j] = opts.settings[j];
    this.w = new World();
    this.w.init(opts.size || 10);
    this.year = 0;
    this.history = [];   // [{x: year, y: total}]
  }

  Sim.prototype.rnd = function () { return this.rng(); };

  // The four orthogonal neighbours of (x,y), as the source spells them out.
  function neighbours(x, y) {
    return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
  }

  Sim.prototype.inGrid = function (x, y) {
    return x >= 1 && x <= this.w.size && y >= 1 && y <= this.w.size;
  };

  // num_near: count orthogonal neighbours that are in-bounds and not solid.
  Sim.prototype.num_near = function (x, y) {
    var n = 0, nb = neighbours(x, y);
    for (var d = 0; d < nb.length; d++) {
      var px = nb[d][0], py = nb[d][1];
      if (this.inGrid(px, py) && this.w.p[px][py].wall_mode < 2) n++;
    }
    return n;
  };

  // add_wall -- turn a cell into a wall and (if newly so) hurt its neighbours.
  Sim.prototype.add_wall = function (x, y, mode) {
    var p = this.w.p[x][y];
    var h = (p.wall_mode > 0) ? 1 : 0;
    p.wall_mode = (mode === 2) ? 2 : 1;
    p.p1 = 0; p.p2 = 0; p.total = 0;
    if (h === 0) {
      var nb = neighbours(x, y);
      for (var d = 0; d < nb.length; d++) {
        var px = nb[d][0], py = nb[d][1];
        if (this.inGrid(px, py)) {
          this.w.p[px][py].d1 -= this.s.wall_d1;
          this.w.p[px][py].d2 -= this.s.wall_d2;
        }
      }
    }
  };

  // rem_wall -- restore a wall cell to habitat and undo the neighbour penalty.
  Sim.prototype.rem_wall = function (x, y) {
    var p = this.w.p[x][y];
    if (p.wall_mode > 0) {
      p.wall_mode = 0; p.p1 = 0; p.p2 = 0; p.total = 0;
      var nb = neighbours(x, y);
      for (var d = 0; d < nb.length; d++) {
        var px = nb[d][0], py = nb[d][1];
        if (this.inGrid(px, py)) {
          this.w.p[px][py].d1 += this.s.wall_d1;
          this.w.p[px][py].d2 += this.s.wall_d2;
        }
      }
    }
  };

  // do_frag -- clear all walls, then wall off `frag`% of cells at random.
  Sim.prototype.do_frag = function () {
    var size = this.w.size, a, b;
    var list = [];
    for (a = 1; a <= size; a++)
      for (b = 1; b <= size; b++) { this.rem_wall(a, b); list.push([a, b]); }
    var count = (size * size) * (this.s.frag / 100);
    for (var c = 1; c <= count; c++) {
      if (list.length === 0) break;
      var e = round(this.rnd() * (list.length - 1));
      while (e < 0) e = round(this.rnd() * (list.length - 1));
      var cell = list[e];
      list.splice(e, 1);
      this.add_wall(cell[0], cell[1], this.s.make_mode);
    }
  };

  // do_tick -- advance the simulation one year (faithful order of operations).
  Sim.prototype.do_tick = function () {
    var w = this.w, s = this.s, size = w.size, a, b, d;
    this.year = this.year + 1;

    // 1. random short-term mortality events
    if (s.rhalf) {
      for (a = 1; a <= size; a++) for (b = 1; b <= size; b++) {
        if (round(this.rnd() * s.prob) === 1) { w.p[a][b].p1 = 0; w.p[a][b].p2 = 0; }
      }
    }

    // 2. capacity fluctuation (and clamp the d modifiers)
    if (s.fluc) {
      for (a = 1; a <= size; a++) for (b = 1; b <= size; b++) {
        var pl = w.p[a][b];
        pl.Capacity = pl.Capacity + ((this.rnd() * 5) - 2);
        if (pl.d2 > 1) pl.d2 = 1; if (pl.d1 > 1) pl.d1 = 1;
        if (pl.d2 < 0) pl.d2 = 0; if (pl.d1 < 0) pl.d1 = 0;
        pl.in1_last = 0;
      }
    }

    // 3. local population dynamics
    w.tick(s);

    // 4. migration of stage-1 dispersers into neighbouring cells
    var holderP1 = [], holderIn = [];
    for (a = 0; a <= size; a++) { holderP1[a] = []; holderIn[a] = []; }
    for (a = 1; a <= size; a++) for (b = 1; b <= size; b++) { holderP1[a][b] = 0; holderIn[a][b] = 0; }

    for (a = 1; a <= size; a++) {
      for (b = 1; b <= size; b++) {
        var cell = w.p[a][b];
        var near = this.num_near(a, b);
        if (near > 0) {
          var c;
          if (cell.wall_mode === 1) { c = cell.p1; cell.p1 = 0; }
          else { c = cell.p1 * s.mp; cell.p1 = cell.p1 * (1 - s.mp); }
          cell.out1_last = c;
          c = c / near;
          var nb = neighbours(a, b);
          for (d = 0; d < nb.length; d++) {
            var px = nb[d][0], py = nb[d][1];
            if (this.inGrid(px, py) && w.p[px][py].wall_mode < 2) {
              holderIn[px][py] += c;
              holderP1[px][py] += c;
            }
          }
        } else {
          cell.out1_last = 0;
        }
      }
    }
    for (a = 1; a <= size; a++) for (b = 1; b <= size; b++) {
      w.p[a][b].in1_last = holderIn[a][b];
      w.p[a][b].p1 = w.p[a][b].p1 + holderP1[a][b];
    }

    // 5. record total for the graph
    var t = w.get_total();
    this.history.push({ x: this.year, y: t });
    return { year: this.year, total: t };
  };

  Sim.prototype.get_total = function () { return this.w.get_total(); };

  // Reset the world (Functions->Reset) keeping the current size + settings.
  Sim.prototype.reset = function () {
    this.w.init(this.w.size);
    this.year = 0;
    this.history = [];
  };

  // --- Save / load -------------------------------------------------------
  // Same field layout the original used per cell ("Cap:d1:d2:p1:p2:wall:total")
  // wrapped in a small JSON envelope so the web app can round-trip a run.
  Sim.prototype.save = function () {
    var size = this.w.size, cells = [];
    for (var a = 1; a <= size; a++) for (var b = 1; b <= size; b++) {
      var p = this.w.p[a][b];
      cells.push([p.Capacity, p.d1, p.d2, p.p1, p.p2, p.wall_mode, p.total].join(":"));
    }
    return JSON.stringify({ size: size, years: this.year, settings: this.s, cells: cells });
  };

  Sim.prototype.load = function (obj) {
    if (typeof obj === "string") obj = JSON.parse(obj);
    if (obj.settings) for (var k in obj.settings) this.s[k] = obj.settings[k];
    this.w.init(obj.size);
    this.year = obj.years || 0;
    this.history = [];
    var i = 0;
    for (var a = 1; a <= obj.size; a++) for (var b = 1; b <= obj.size; b++) {
      var f = String(obj.cells[i++]).split(":");
      var p = this.w.p[a][b];
      p.Capacity = parseFloat(f[0]);
      p.d1 = parseFloat(f[1]); p.d2 = parseFloat(f[2]);
      p.p1 = parseFloat(f[3]); p.p2 = parseFloat(f[4]);
      p.wall_mode = parseInt(f[5], 10); p.total = parseFloat(f[6]);
    }
    return this;
  };

  var Frag = {
    DEFAULTS: DEFAULTS,
    CELL: CELL,
    Plot: Plot,
    World: World,
    Sim: Sim
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Frag;
  else root.Frag = Frag;
})(typeof window !== "undefined" ? window : this);
