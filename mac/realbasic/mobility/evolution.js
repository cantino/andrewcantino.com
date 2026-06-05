/*
 * Computational Evolution of Mobility -- evolutionary algorithm
 *
 * A faithful port of the MainWindow evolution logic.  The strategy is a simple
 * (1 + N) hill-climber: score every creature in `frames` by how far its centre
 * of mass travels over `numberOfCycles` physics ticks, keep the single best,
 * then spawn `spawnNumber` mutated copies of it for the next generation.
 *
 * The original RealBASIC had a few genuine bugs in the mutation operators (for
 * example "change period" actually assigns from `phase`, and moveJoint writes
 * the new y into x twice).  Those quirks are part of how these creatures
 * actually evolved in 2001, so they are preserved here and flagged with
 * "[sic]" comments rather than silently fixed.
 */
(function (root) {
  "use strict";

  var M = (typeof require !== "undefined") ? require("./engine.js") : root.Mobility;
  var CONST = M.CONST;
  var ub = M.ub;

  function rnd() { return Math.random(); }
  function round(x) { return Math.round(x); }
  // Approximate RealBASIC str(): trim trailing zeros so 199.0 -> "199".
  function rbStr(x) { return String(Math.round(x * 1000) / 1000); }

  function EvolutionRun(seed) {
    this.frames = [null];
    this.storage = [null];
    this.cycles = 0;
    this.minPeriod = CONST.minPeriod;
    this.spawnNumber = CONST.spawnNumber;
    this.numberOfCycles = CONST.numberOfCycles;

    var start = new M.Framework();
    start.mirror(seed || M.defaultCreature());
    start.doStart();
    this.frames.push(start);

    // Optional hooks set by the UI.
    this.onLog = null;       // (string) detailed log
    this.onStat = null;      // (cycle, bestIndex, moved, complexity)
    this.onWatch = null;     // (framework, testingIndex) live render
    this.storeSteps = false; // keep best of each generation in storage
  }

  EvolutionRun.prototype.log = function (s) { if (this.onLog) this.onLog(s); };

  // Run all candidates through the physics model and keep the best mover.
  EvolutionRun.prototype.pickBestCreature = function () {
    var bestSoFar = 0;
    var bestCreatureSoFar = 1;
    var holder = new M.Framework();

    for (var a = 1; a <= ub(this.frames); a++) {
      holder.mirror(this.frames[a]);
      holder.doStart();
      for (var b = 1; b <= this.numberOfCycles; b++) {
        holder.tick(CONST.tickAmt);
        if (this.onWatch) this.onWatch(holder, a);
        var moved = holder.distMoved();
        if (moved > bestSoFar) { bestSoFar = moved; bestCreatureSoFar = a; }
      }
    }

    var complexity = this.frames[bestCreatureSoFar].complexity();
    // The per-cycle "Best creature" result goes to the cycle list (onStat); the
    // verbose mutation narration goes to the detail log (onLog) -- matching the
    // original's two separate text areas.
    if (this.onStat) this.onStat(this.cycles, bestCreatureSoFar, bestSoFar, complexity);

    holder.mirror(this.frames[bestCreatureSoFar]);

    if (this.storeSteps) {
      var keep = new M.Framework();
      keep.mirror(holder);
      this.storage.push(keep);
    }

    this.frames = [null];
    var survivor = new M.Framework();
    survivor.mirror(holder);
    survivor.doStart();
    this.frames.push(survivor);

    return { index: bestCreatureSoFar, moved: bestSoFar, complexity: complexity };
  };

  // Produce a generation of mutated offspring from the lone survivor.
  // The verbose narration mirrors MainWindow.spawnCreatures' addlog() calls.
  EvolutionRun.prototype.spawnCreatures = function () {
    this.log("Creating offspring" + "\n");
    for (var a = 1; a <= this.spawnNumber; a++) {
      var child = new M.Framework();
      child.mirror(this.frames[1]);
      this.frames.push(child);

      var choice = round(rnd() * 5) + 1; // 1..6
      if (choice === 1) {
        this.log("Mutating waveform" + "\n");
        this.mutateWaveform();
      } else if (choice === 2) {
        this.log("Mutating waveform positions" + "\n");
        this.mutateWaveformPositions();
      } else if (choice === 3) {
        var b = round(rnd() * 4) + 1;
        if (b < 4) { this.log("Adding a random joint between" + "\n"); this.addRandomJointBetween(); }
        else { this.log("Adding a random joint" + "\n"); this.addRandomJoint(); }
      } else if (choice === 4) {
        this.log("Adding a random spring" + "\n");
        this.addRandomSpring();
      } else if (choice === 5) {
        this.log("Removing random spring" + "\n");
        this.removeRandomSpring();
      } else {
        this.log("Moving a joint" + "\n");
        this.moveJoint();
      }

      this.frames[ub(this.frames)].doStart();
    }
  };

  EvolutionRun.prototype.step = function () {
    var result = this.pickBestCreature();
    this.spawnCreatures();
    this.cycles += 1;
    return result;
  };

  // ----- the current (last) framework being mutated --------------------
  EvolutionRun.prototype.cur = function () { return this.frames[ub(this.frames)]; };

  // ----- mutation operators (ported, quirks preserved) -----------------
  EvolutionRun.prototype.mutateWaveform = function () {
    var f = this.cur();
    var a = round(rnd() * 10) + 1; // 1..11
    var c, d;
    if (a < 10) {
      var b = round(rnd() * 2) + 1; // 1..3
      if (b === 1) {
        this.log("Changing a waveform's phase" + "\n");
        c = round(rnd() * (ub(f.waveforms) - 1)) + 1;
        if (f.waveforms[c]) { d = round(rnd() * 19) - 10; f.waveforms[c].phase += d; }
      } else if (b === 2) {
        this.log("Changing a waveform's period" + "\n");
        c = round(rnd() * (ub(f.waveforms) - 1)) + 1;
        d = round(rnd() * 19) - 10;
        if (f.waveforms[c]) {
          f.waveforms[c].period = f.waveforms[c].phase + d; // [sic] reads phase
          if (f.waveforms[c].period < this.minPeriod) f.waveforms[c].period = this.minPeriod;
        }
      } else {
        this.log("Changing a waveform's amplitude" + "\n");
        c = round(rnd() * (ub(f.waveforms) - 1)) + 1;
        d = round(rnd() * 3) - 2;
        if (f.waveforms[c]) f.waveforms[c].amplitude = f.waveforms[c].phase + d; // [sic] reads phase
      }
    } else if (a === 10) {
      this.log("Added a waveform" + "\n");
      f.addWaveform(0, round(rnd() * 14) + 1, round(rnd() * 359 + this.minPeriod) + 1 - this.minPeriod, round(rnd() * 99) + 1);
      var last = f.waveforms[ub(f.waveforms)];
      if (last.period < this.minPeriod) last.period = this.minPeriod;
    } else {
      if (ub(f.waveforms) > 1) {
        c = round(rnd() * (ub(f.waveforms) - 1)) + 1;
        if (f.waveforms[c]) { this.log("Removed a waveform" + "\n"); f.waveforms.splice(c, 1); }
      }
    }
  };

  EvolutionRun.prototype.mutateWaveformPositions = function () {
    var f = this.cur();
    var a = round(rnd() * 4) + 1; // 1..5
    var b, c, e = 0;
    var r = [null];

    for (b = 1; b <= ub(f.springs); b++) if (f.springs[b].wavePosition > -1) e++;
    if (e === 0) a = 5;

    if (a < 4) {
      // Move an existing muscle's sample position.
      this.log("Moving a waveform position" + "\n");
      for (b = 1; b <= ub(f.springs); b++) if (f.springs[b].wavePosition > -1) r.push(b);
      if (ub(r) > 0) {
        b = round(rnd() * (ub(r) - 1)) + 1;
        c = round(rnd() * 9) - 5;
        if (b !== 0) {
          f.springs[r[b]].wavePosition += c;
          if (f.springs[r[b]].wavePosition < 1) f.springs[r[b]].wavePosition = -1;
        }
      }
    } else {
      // Turn a plain spring into a muscle.
      for (b = 1; b <= ub(f.springs); b++) if (f.springs[b].wavePosition === -1) r.push(b);
      if (ub(r) > 0) {
        b = round(rnd() * (ub(r) - 1)) + 1;
        c = round(rnd() * 199) + 1;
        if (b > 0 && f.springs[r[b]]) f.springs[r[b]].wavePosition = c;
      }
    }
  };

  // Shared helper: a random offset (distance, angle) using the original's
  // "-1x + 100" probability curve that favours short hops.
  function randomOffset() {
    var x = round(rnd() * 99) + 1;
    var y = round(rnd() * 99) + 1;
    var abort = 0;
    while (y > -1 * x + 100 && abort < 100) { abort++; x = round(rnd() * 99) + 1; y = round(rnd() * 99) + 1; }
    var rangle = round(rnd() * 359) + 1;
    var slope = Math.tan(rangle * (CONST.PI / 180));
    var distperslope = Math.sqrt(slope * slope + 1);
    var newamount = x / distperslope;
    return { rangle: rangle, slope: slope, newamount: newamount };
  }

  function offsetPoint(px, py, o) {
    var nx = px, ny = py;
    if (o.slope > 0) {
      if (o.rangle < 180) { nx += o.newamount; ny += o.newamount * o.slope; }
      else { nx -= o.newamount; ny -= o.newamount * o.slope; }
    } else {
      if (o.rangle < 180) { nx -= o.newamount; ny -= o.newamount * o.slope; }
      else { nx += o.newamount; ny += o.newamount * o.slope; }
    }
    return { x: nx, y: ny };
  }

  EvolutionRun.prototype.addRandomJoint = function () {
    var f = this.cur();
    var o = randomOffset();
    var ref = round(rnd() * (ub(f.joints) - 1)) + 1;
    if (ref > 0) {
      var p = offsetPoint(f.joints[ref].x, f.joints[ref].y, o);
      f.addJoint(p.x, p.y);
      f.addSpring(ref, ub(f.joints));
    }
  };

  EvolutionRun.prototype.moveJoint = function () {
    var f = this.cur();
    var o = randomOffset();
    var ref = round(rnd() * (ub(f.joints) - 1)) + 1;
    if (ref > 0) {
      var p = offsetPoint(f.joints[ref].x, f.joints[ref].y, o);
      f.joints[ref].x = p.x;
      f.joints[ref].x = p.y; // [sic] original assigns y into x twice
      f.updateAllSpringLengths();
      this.log("Moved joint " + ref + " to " + rbStr(p.x) + "," + rbStr(p.y) + "\n");
    }
  };

  EvolutionRun.prototype.addRandomJointBetween = function () {
    var f = this.cur();
    var ref = round(rnd() * (ub(f.springs) - 1)) + 1;
    if (ref > 0) {
      var pt1 = f.springs[ref].Jt1Code;
      var pt3 = f.springs[ref].Jt2Code;
      var ypos = (f.joints[pt3].y + f.joints[pt1].y) / 2;
      var xpos = (f.joints[pt3].x + f.joints[pt1].x) / 2;
      f.addJoint(xpos, ypos);
      var pt2 = ub(f.joints);
      f.springs.splice(ref, 1);
      f.addSpring(pt1, pt2);
      f.addSpring(pt2, pt3);
    }
  };

  EvolutionRun.prototype.removeRandomSpring = function () {
    var f = this.cur();
    var pt1Unlinked = true, pt2Unlinked = true;
    var ref = round(rnd() * (ub(f.springs) - 1)) + 1;
    if (ref > 0) {
      var pt1 = f.springs[ref].Jt1Code;
      var pt2 = f.springs[ref].Jt2Code;
      f.springs.splice(ref, 1);

      var a;
      for (a = 1; a <= ub(f.springs); a++) {
        if (f.springs[a].Jt1Code === pt1 || f.springs[a].Jt2Code === pt1) pt1Unlinked = false;
        if (f.springs[a].Jt1Code === pt2 || f.springs[a].Jt2Code === pt2) pt2Unlinked = false;
      }

      if (pt1Unlinked) {
        f.joints.splice(pt1, 1);
        for (a = 1; a <= ub(f.springs); a++) {
          if (f.springs[a].Jt1Code > pt1) f.springs[a].Jt1Code--;
          if (f.springs[a].Jt2Code > pt1) f.springs[a].Jt2Code--;
        }
      }
      if (pt2Unlinked) {
        // After removing pt1 the higher indices shifted; mirror the original
        // which recomputed against the (now shorter) joints array.
        if (pt1Unlinked && pt2 > pt1) pt2--;
        f.joints.splice(pt2, 1);
        for (a = 1; a <= ub(f.springs); a++) {
          if (f.springs[a].Jt1Code > pt2) f.springs[a].Jt1Code--;
          if (f.springs[a].Jt2Code > pt2) f.springs[a].Jt2Code--;
        }
      }
    }
  };

  EvolutionRun.prototype.addRandomSpring = function () {
    var f = this.cur();
    var cycle = 0, bestJt = 0;
    while (cycle < 10 && bestJt === 0) {
      cycle++;
      var bestDist = 0; bestJt = 0;
      var x = round(rnd() * 124) + 1;
      var y = round(rnd() * 124) + 1;
      var abort = 0;
      while (y > -4 * x + 500 && abort < 100) { abort++; x = round(rnd() * 124) + 1; y = round(rnd() * 124) + 1; }

      var ref = round(rnd() * (ub(f.joints) - 1)) + 1;
      if (ref > 0) {
        for (var a = 1; a <= ub(f.joints); a++) {
          var d = Math.sqrt(Math.pow(f.joints[ref].y - f.joints[a].y, 2) + Math.pow(f.joints[ref].x - f.joints[a].x, 2));
          if (d > bestDist && d < x) { bestDist = d; bestJt = a; }
        }
        if (bestJt > 0) {
          var exists = false;
          for (var b = 1; b <= ub(f.springs); b++) {
            if ((f.springs[b].Jt1Code === bestJt || f.springs[b].Jt2Code === bestJt) &&
                (f.springs[b].Jt1Code === ref || f.springs[b].Jt2Code === ref)) { exists = true; break; }
          }
          if (!exists && bestJt !== ref) f.addSpring(ref, bestJt);
        }
      }
    }
  };

  var API = { EvolutionRun: EvolutionRun };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.MobilityEvolution = API;
})(typeof window !== "undefined" ? window : this);
