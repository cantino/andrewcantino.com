/*
 * Sympatric Speciation Simulator (SSS) -- evolution engine
 *
 * A faithful JavaScript port of the RealBASIC bird-evolution engine Andrew
 * Cantino wrote for a 1999 science fair. The simulation models
 * adaptive radiation in a population of birds, loosely based on the Hawaiian
 * honeycreepers (genus Loxops, family Drepanididae).
 *
 * Each bird has a beak described by three continuous traits -- length, width
 * and curve -- each in the range [0, 5]. Every simulated year:
 *   1. the food supply is reset,
 *   2. every bird ages one year (and dies at its life span),
 *   3. birds eat in random order; a bird's beak shape decides which of seven
 *      food types it can eat, and birds that cannot get enough food starve,
 *   4. survivors pair off (random / assortative / semi-random mating) and
 *      breed; offspring beaks average the parents' with a chance of mutation.
 *
 * Over many years the population radiates into the available food niches, and
 * under semi-random mating it can split into reproductively-isolated clusters
 * -- sympatric speciation.
 *
 * The port preserves the original behaviour, including its quirks (flagged
 * [sic]). It runs both as a browser global (window.SSS) and a Node module
 * (module.exports), so the engine can be tuned and tested headlessly.
 */
(function (root) {
  "use strict";

  // --- Default preferences (recovered from Window.getprefs in the project
  //     binary; see original/recovered-constants.txt). ---------------------
  var DEFAULTS = {
    fruit_support: 60,
    insect_support: 60,
    nector_curved_support: 60,
    nector_straight_support: 60,
    seed_small_support: 60,
    seed_medium_support: 60,
    seed_large_support: 60,
    max_birds: 100,        // kept for fidelity; the food supply is the real cap
    max_age: 10,
    mut_max: 10,           // mutation happens when round(rnd*mut_max) == 2
    rec_food: 5,           // a bird must gather rec_food+1 food units per year
    max_baby: 5,
    min_baby: 2,
    matemode: 1,           // 1 = random, 2 = assortative, 3 = semi-random
    maxdist: 3             // max beak difference for semi-random mating
  };

  // RealBASIC's round() is round-half-up; JS Math.round matches for the
  // non-negative arguments used here.
  function round(x) { return Math.round(x); }

  // ------------------------------------------------------------------- Bird
  function Bird() {
    this.length = 0;
    this.width = 0;
    this.curve = 0;
    this.sex = 0;     // 0 = female, 1 = male
    this.age = 0;
    this.life = 0;
    this.temp = "";   // scratch field used by eat()/babys()
  }

  // -------------------------------------------------------------------- Sim
  function Sim(opts) {
    opts = opts || {};
    this.rng = opts.rng || Math.random;   // injectable for deterministic tests
    this.prefs = {};
    for (var k in DEFAULTS) this.prefs[k] = DEFAULTS[k];
    if (opts.prefs) for (var p in opts.prefs) this.prefs[p] = opts.prefs[p];

    this.birds = [];
    this.year = 0;

    // current food stocks (reset to *_support each year)
    this.fruit = 0;
    this.insect = 0;
    this.nector_curved = 0;
    this.nector_straight = 0;
    this.seed_small = 0;
    this.seed_medium = 0;
    this.seed_large = 0;

    // speciation-detector state
    this.speci_count = 0;
    this.speci_mem = 0;
    this.speci_stop = false;
    this.speciated = false;   // set true once detection fires
  }

  Sim.prototype.rnd = function () { return this.rng(); };

  // ubound(birds) in RB == last valid index (length - 1). The 1999 source
  // uses a 0-based birds array (index 0 IS used), unlike the 2001 project.
  Sim.prototype.ub = function () { return this.birds.length - 1; };

  // --- Window.dimbirds + Window.startup: two identical founder birds -------
  Sim.prototype.startup = function () {
    this.dimbirds();
    this.year = 0;
    this.birds[0].age = 0; this.birds[0].sex = 0;
    this.birds[1].age = 0; this.birds[1].sex = 1;
    this.birds[0].life = this.prefs.max_age;
    this.birds[1].life = this.prefs.max_age;
    this.foodreset();
    this.speci_count = 0; this.speci_mem = 0;
    this.speci_stop = false; this.speciated = false;
    return this;
  };

  Sim.prototype.dimbirds = function () {
    this.birds = [];
    for (var a = 0; a <= 1; a++) {
      var b = new Bird();
      b.length = 1; b.width = 1; b.curve = 0; b.age = 0;
      this.birds.push(b);
    }
  };

  // --- Module Food.foodreset ----------------------------------------------
  Sim.prototype.foodreset = function () {
    var p = this.prefs;
    this.fruit = p.fruit_support;
    this.insect = p.insect_support;
    this.seed_small = p.seed_small_support;
    this.seed_medium = p.seed_medium_support;
    this.seed_large = p.seed_large_support;
    this.nector_straight = p.nector_straight_support;
    this.nector_curved = p.nector_curved_support;
  };

  // --- Beak-shape feeding rules (Module functions, verbatim) ---------------
  Sim.prototype.caneatfruit = function (b) {
    var d = this.birds[b]; return d.width <= 3 && d.curve <= 1;
  };
  Sim.prototype.caneatinsect = function (b) {
    return this.birds[b].width <= 3;
  };
  Sim.prototype.caneatseedsmall = function (b) {
    return this.birds[b].curve <= 2;
  };
  Sim.prototype.caneatseedmedium = function (b) {
    var d = this.birds[b]; return d.width >= 2 && d.curve <= 2;
  };
  Sim.prototype.caneatseedlarge = function (b) {
    var d = this.birds[b]; return d.width >= 3 && d.length <= 3;
  };
  Sim.prototype.caneatnectorcurved = function (b) {
    var d = this.birds[b]; return d.width <= 2 && d.length >= 4 && d.curve >= 3;
  };
  Sim.prototype.caneatnectorstraight = function (b) {
    var d = this.birds[b]; return d.width <= 2 && d.curve <= 2 && d.length > 2;
  };

  // --- Window.removebird ---------------------------------------------------
  Sim.prototype.removebird = function (birdy) {
    this.birds.splice(birdy, 1);
  };

  // --- Window.age ----------------------------------------------------------
  Sim.prototype.age = function () {
    for (var b = 0; b <= this.ub(); b++) {
      if (this.birds[b].age > this.birds[b].life) {
        this.removebird(b);
        b = b - 1;
      } else {
        this.birds[b].age = this.birds[b].age + 1;
      }
    }
  };

  // --- Window.resettemps ---------------------------------------------------
  Sim.prototype.resettemps = function () {
    for (var b = 0; b <= this.ub(); b++) this.birds[b].temp = "";
  };

  // Build a random permutation of bird indices, exactly as the RB source does
  // (repeated rnd picks rejecting birds already marked "ate"), then clear temps.
  Sim.prototype._shuffleIndices = function () {
    var birdies = [];
    for (var b = 0; b <= this.ub(); b++) {
      var tmp = round(this.rnd() * this.ub());
      while (this.birds[tmp].temp === "ate") tmp = round(this.rnd() * this.ub());
      birdies[b] = tmp;
      this.birds[tmp].temp = "ate";
    }
    this.resettemps();
    return birdies;
  };

  // --- Window.eat ----------------------------------------------------------
  Sim.prototype.eat = function () {
    var birdies = this._shuffleIndices();
    var rec_food = this.prefs.rec_food;
    for (var b = 0; b <= birdies.length - 1; b++) {
      var food = 0;
      while (food < rec_food + 1) {
        // pick one of seven food types (0 maps to none -- [sic], a no-op pick)
        var tmp = round(this.rnd() * 7);
        var holder = 0;
        if (tmp === 1) {
          // [sic] the fruit branch never sets holder = 1, unlike the others
          if (this.caneatfruit(birdies[b]) && this.fruit > 0) {
            this.fruit -= 1; food += 1;
          }
        } else if (tmp === 2) {
          if (this.caneatinsect(birdies[b]) && this.insect > 0) {
            this.insect -= 1; food += 1; holder = 1;
          }
        } else if (tmp === 3) {
          if (this.caneatnectorstraight(birdies[b]) && this.nector_straight > 0) {
            this.nector_straight -= 1; food += 1; holder = 1;
          }
        } else if (tmp === 4) {
          if (this.caneatnectorcurved(birdies[b]) && this.nector_curved > 0) {
            this.nector_curved -= 1; food += 1; holder = 1;
          }
        } else if (tmp === 5) {
          if (this.caneatseedsmall(birdies[b]) && this.seed_small > 0) {
            this.seed_small -= 1; food += 1; holder = 1;
          }
        } else if (tmp === 6) {
          if (this.caneatseedmedium(birdies[b]) && this.seed_medium > 0) {
            this.seed_medium -= 1; food += 1; holder = 1;
          }
        } else if (tmp === 7) {
          if (this.caneatseedlarge(birdies[b]) && this.seed_large > 0) {
            this.seed_large -= 1; food += 1; holder = 1;
          }
        }
        if (holder === 0) {
          // Could this bird eat ANY food still available? If not, it starves.
          var blah = 0;
          if (this.caneatinsect(birdies[b]) && this.insect > 0) blah = 1;
          if (this.caneatfruit(birdies[b]) && this.fruit > 0) blah = 1;
          if (this.caneatseedsmall(birdies[b]) && this.seed_small > 0) blah = 1;
          if (this.caneatseedmedium(birdies[b]) && this.seed_medium > 0) blah = 1;
          if (this.caneatseedlarge(birdies[b]) && this.seed_large > 0) blah = 1;
          if (this.caneatnectorstraight(birdies[b]) && this.nector_straight > 0) blah = 1;
          if (this.caneatnectorcurved(birdies[b]) && this.nector_curved > 0) blah = 1;
          if (blah === 0) {
            this.birds[birdies[b]].temp = "starved";
            food = 500;
          }
        }
      }
    }
    for (var c = 0; c <= this.ub(); c++) {
      if (this.birds[c].temp === "starved") {
        this.removebird(c);
        c = c - 1;
      }
    }
  };

  // --- Window.addbird ------------------------------------------------------
  Sim.prototype.addbird = function (motherid, fatherid) {
    var p = this.prefs;
    var nb = new Bird();
    nb.age = 0;
    nb.life = p.max_age;
    nb.sex = (round(this.rnd() * 1) === 0) ? 1 : 0;

    var ml = this.birds[motherid].length,
        mw = this.birds[motherid].width,
        mc = this.birds[motherid].curve,
        fl = this.birds[fatherid].length,
        fw = this.birds[fatherid].width,
        fc = this.birds[fatherid].curve;
    var al = (ml + fl) / 2,
        aw = (mw + fw) / 2,
        ac = (mc + fc) / 2;

    // do we mutate?  (rare -- only when round(rnd*mut_max) hits 2 exactly)
    if (round(this.rnd() * p.mut_max) === 2) {
      var which = round(this.rnd() * 2);   // 0 = curve, 1 = length, 2 = width
      var amt = this.rnd() * 1;
      if (round(this.rnd()) === 1) amt = amt * -1;
      if (which === 0) ac = ac + amt;
      else if (which === 1) al = al + amt;
      else if (which === 2) aw = aw + amt;
    }

    if (aw < 0) aw = 0; if (al < 0) al = 0; if (ac < 0) ac = 0;
    if (aw > 5) aw = 5; if (al > 5) al = 5; if (ac > 5) ac = 5;

    nb.length = al; nb.width = aw; nb.curve = ac;
    this.birds.push(nb);
  };

  // pick a litter size in [min_baby, max_baby] the way the source does
  Sim.prototype._litter = function () {
    var tmp = round(this.rnd() * this.prefs.max_baby);
    while (tmp < this.prefs.min_baby) tmp = round(this.rnd() * this.prefs.max_baby);
    return tmp;
  };

  function ubA(arr) { return arr.length - 1; }
  function beakDiff(birds, i, j) {
    return Math.abs(birds[i].width - birds[j].width) +
           Math.abs(birds[i].length - birds[j].length) +
           Math.abs(birds[i].curve - birds[j].curve);
  }

  // --- Window.babys --------------------------------------------------------
  Sim.prototype.babys = function () {
    var birdies = this._shuffleIndices();
    var male = [], female = [];
    for (var b = 0; b <= birdies.length - 1; b++) {
      if (this.birds[birdies[b]].sex === 0) female.push(birdies[b]);
      else male.push(birdies[b]);
    }
    var birds = this.birds, c, tmp, d, a;

    // -- Random mating ------------------------------------------------------
    if (this.prefs.matemode === 1) {
      if (ubA(male) > ubA(female)) {
        for (b = 0; b <= ubA(female); b++) {
          tmp = this._litter();
          for (c = 1; c <= tmp; c++) this.addbird(male[b], female[b]);
        }
      } else {
        for (b = 0; b <= ubA(male); b++) {
          tmp = this._litter();
          for (c = 1; c <= tmp; c++) this.addbird(male[b], female[b]);
        }
      }
    }

    // -- Assortative mating (mate to closest beak match) --------------------
    if (this.prefs.matemode === 2) {
      if (ubA(male) > ubA(female)) {
        for (a = 0; a <= ubA(female); a++) {
          var biggest = 10000, good = -1;
          for (b = 0; b <= ubA(male); b++) {
            if (male[b] !== -1) {
              var e = beakDiff(birds, male[b], female[a]);
              if (e < biggest) { biggest = e; good = b; }
            }
          }
          if (good !== -1) {
            tmp = this._litter();
            for (c = 1; c <= tmp; c++) this.addbird(male[good], female[a]);
            male[good] = -1;
          }
        }
      } else {
        for (a = 0; a <= ubA(male); a++) {
          var biggest2 = 10000, good2 = -1;
          for (b = 0; b <= ubA(female); b++) {
            if (female[b] !== -1) {
              var e2 = beakDiff(birds, female[b], male[a]);
              if (e2 < biggest2) { biggest2 = e2; good2 = b; }
            }
          }
          if (good2 !== -1) {
            tmp = this._litter();
            for (c = 1; c <= tmp; c++) this.addbird(male[a], female[good2]);
            female[good2] = -1;
          }
        }
      }
    }

    // -- Semi-random mating (random within a max beak difference) -----------
    if (this.prefs.matemode === 3) {
      var maxdist = this.prefs.maxdist;
      if (ubA(female) > ubA(male)) {
        for (b = 0; b <= ubA(male); b++) {
          for (c = 0; c <= ubA(female); c++) {
            if (beakDiff(birds, female[c], male[b]) < maxdist) {
              tmp = this._litter();
              for (d = 1; d <= tmp; d++) this.addbird(male[b], female[c]);
              c = 20000; // break
            }
          }
        }
      } else {
        for (b = 0; b <= ubA(female); b++) {
          for (c = 0; c <= ubA(male); c++) {
            if (beakDiff(birds, male[c], female[b]) < maxdist) {
              tmp = this._litter();
              for (d = 1; d <= tmp; d++) this.addbird(male[c], female[b]);
              c = 20000; // break
            }
          }
        }
      }
    }
  };

  // --- Window.mainloop: one simulated year --------------------------------
  // Returns an object describing what happened (so the UI can react without
  // reaching into internals). speciation handling is left to the caller.
  Sim.prototype.mainloop = function () {
    this.foodreset();
    this.age();
    this.eat();
    this.babys();
    this.year = this.year + 1;
    return { year: this.year, total: this.birds.length };
  };

  Sim.prototype.total = function () { return this.birds.length; };

  // --- File format (Window.savearray / Window.loadold) --------------------
  // line 1: year ; then "length:width:curve:sex:age:life" per bird.
  Sim.prototype.save = function () {
    var lines = [String(this.year)];
    for (var a = 0; a <= this.ub(); a++) {
      var b = this.birds[a];
      lines.push([b.length, b.width, b.curve, b.sex, b.age, b.life].join(":"));
    }
    return lines.join("\n");
  };

  Sim.prototype.load = function (text) {
    var rows = String(text).replace(/\r\n?/g, "\n").split("\n");
    this.birds = [];
    this.year = parseInt(rows[0], 10) || 0;
    this.foodreset();
    for (var i = 1; i < rows.length; i++) {
      var line = rows[i];
      if (line === "" ) continue;
      var f = line.split(":");
      var b = new Bird();
      b.length = parseFloat(f[0]);
      b.width = parseFloat(f[1]);
      b.curve = parseFloat(f[2]);
      b.sex = parseInt(f[3], 10);
      b.age = parseInt(f[4], 10);
      b.life = parseInt(f[5], 10);
      this.birds.push(b);
    }
    return this;
  };

  // --- Window.graphs scatter-plot coordinate transforms -------------------
  // The original drew on small RB pictures: trans_x(n) = n*20 + 4,
  // trans_y(n) = height - n*20 - 10. Beak traits live in [0,5].
  // The original declared these `As Integer`, so RB rounded the result; we do
  // too (it also matters because speci_check indexes a pixel buffer with them).
  var GRAPH = { scale: 20, padX: 4, padY: 10 };
  function transX(n) { return round(n * GRAPH.scale + GRAPH.padX); }
  function transY(n, h) { return round(h - n * GRAPH.scale - GRAPH.padY); }

  // --- Window.speci_check: pixel-cluster speciation detector ---------------
  // Faithful port of the original's clever trick. It splats a small additive
  // blob for every bird onto an offscreen buffer keyed on (width, length),
  // finds the brightest peak, then asks whether any other still-bright pixel
  // lies more than 35px away. If so, there are >= 2 clusters -> speciation.
  //
  // `getDist` and the 5x5 blob / thresholds are reproduced exactly.
  function getdist(x, y, cx, cy) {
    return Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
  }

  // w,h are the buffer dimensions (the original canvas was ~120x120).
  Sim.prototype.speci_check = function (w, h) {
    w = w || 120; h = h || 120;
    // red channel only (the original stored intensity in .red)
    var red = new Float64Array(w * h);
    function idx(x, y) { return y * w + x; }
    function inb(x, y) { return x >= 0 && x < w && y >= 0 && y < h; }

    var a, b, c, posx, posy, curx, cury, amt;
    // 1. additively splat a 5x5 blob per bird
    for (a = 0; a <= this.ub(); a++) {
      posx = transX(this.birds[a].width);
      posy = transY(this.birds[a].length, h);
      curx = posx - 2; cury = posy - 2;
      for (b = 1; b <= 5; b++) {
        for (c = 1; c <= 5; c++) {
          amt = 5 - round(getdist(curx, cury, posx, posy));
          if (inb(curx, cury)) red[idx(curx, cury)] += amt * 10;
          curx = curx + 1;
        }
        curx = posx - 2; cury = cury + 1;
      }
    }
    // 2. threshold + find the brightest pixel
    var high_amt = 0, high_x = 0, high_y = 0;
    for (a = 0; a <= this.ub(); a++) {
      posx = transX(this.birds[a].width);
      posy = transY(this.birds[a].length, h);
      curx = posx - 2; cury = posy - 2;
      for (b = 1; b <= 5; b++) {
        for (c = 1; c <= 5; c++) {
          if (inb(curx, cury)) {
            var v = red[idx(curx, cury)];
            if (v < 135) red[idx(curx, cury)] = 0;
            else if (v > high_amt) { high_amt = v; high_x = curx; high_y = cury; }
          }
          curx = curx + 1;
        }
        curx = posx - 2; cury = cury + 1;
      }
    }
    // 3. any bright pixel far from the peak => a second cluster
    var speciation = false;
    for (a = 0; a <= this.ub(); a++) {
      posx = transX(this.birds[a].width);
      posy = transY(this.birds[a].length, h);
      curx = posx - 2; cury = posy - 2;
      for (b = 1; b <= 5; b++) {
        for (c = 1; c <= 5; c++) {
          if (inb(curx, cury) && red[idx(curx, cury)] > 140) {
            if (getdist(curx, cury, high_x, high_y) > 35) speciation = true;
          }
          curx = curx + 1;
        }
        curx = posx - 2; cury = cury + 1;
      }
    }
    return speciation;
  };

  // Mirror of the mainloop's detection bookkeeping: call once per year with
  // the result of speci_check (sampled). Returns true the moment a run is
  // confirmed speciated (3 positive samples, each 5+ years apart). The exact
  // counters match Window.mainloop.
  Sim.prototype.tickSpeciationDetector = function (checkFn) {
    if (this.speci_stop) return false;
    this.speci_count = this.speci_count + 1;
    if (this.speci_count > 5) {
      this.speci_count = 0;
      if (checkFn()) {
        this.speci_mem = this.speci_mem + 1;
        if (this.speci_mem === 3) { this.speciated = true; return true; }
      } else {
        this.speci_mem = 0;
      }
    }
    return false;
  };

  var SSS = {
    DEFAULTS: DEFAULTS,
    Bird: Bird,
    Sim: Sim,
    transX: transX,
    transY: transY,
    GRAPH: GRAPH
  };

  if (typeof module !== "undefined" && module.exports) module.exports = SSS;
  else root.SSS = SSS;
})(typeof window !== "undefined" ? window : this);
