/*
 * Computational Evolution of Mobility -- physics engine
 *
 * A faithful JavaScript port of the RealBASIC physics engine written for the
 * 2001 international science fair.  The original was a spring/joint/muscle
 * simulator inspired by Sodaplay's Sodaconstructor, paired with an
 * evolutionary algorithm that mutates "creatures" and selects the ones that
 * travel furthest.
 *
 * The port preserves the original algorithms (see "source text" in the
 * archive).  Two things to know about the original RealBASIC code:
 *
 *   1. Arrays are 1-based: `redim a(0)` makes a one-element array whose only
 *      slot, index 0, is unused, and every loop runs `for i = 1 to ubound(a)`.
 *      We mirror that here by parking a `null` at index 0 and indexing from 1,
 *      because joints reference each other by their 1-based index.
 *
 *   2. The world uses a y-up coordinate system with the floor at y = 0.  The
 *      display flips it (screenY = height - y).
 *
 * This file works both as a browser global (window.Mobility) and as a Node
 * module (module.exports), so the physics can be unit-tested headlessly.
 */
(function (root) {
  "use strict";

  var PI = 3.1415792; // [sic] the original used this slightly-imprecise value

  // --- Constants (recovered from the RealBASIC project file) -------------
  // These are the EXACT values the original stored as project constants,
  // extracted from the "Mobility Simulator (revised)" RB project binary.
  var CONST = {
    PI: PI,
    constK: 10,            // default spring stiffness (Hooke's law)
    absorbtion: 0.8,       // scales spring force into an applied vector
    airFriction: 0.98,     // velocity retained each tick (air drag)
    floorFrict: 0.5,       // ground friction coefficient
    floorAbsorbtion: 0.8,  // fraction of speed kept after a floor bounce
    waveScale: 1.8,        // muscle contraction amount per unit waveform
    floorY: 1,             // world-y of the floor
    minPeriod: 40,         // smallest legal waveform period
    tickAmt: 0.1,          // physics timestep `s`
    waveformSpeed: 0.5,    // waveform phase advance per tick
    numberOfCycles: 2000,  // physics ticks used to score a creature
    spawnNumber: 15        // mutated offspring generated per generation
  };

  function deg(a) { return a * (PI / 180); }

  // ubound(arr) in RealBASIC is the last valid index == length-1.
  function ub(arr) { return arr.length - 1; }

  // ---------------------------------------------------------------- Vector
  function Vector() {
    this.angle = 0; // degrees
    this.mag = 0;
  }
  Vector.prototype.getSlope = function () { return Math.tan(deg(this.angle)); };
  // Recover an angle in [0,360) from y/x components (atan2, the careful way the
  // original spelled it out quadrant by quadrant).
  Vector.prototype.trueSetSlope = function (y, x) {
    var angle = Math.atan2(y, x) * (180 / PI);
    if (angle < 0) angle = 360 + angle;
    this.angle = angle;
  };
  Vector.prototype.mirror = function (v) { this.angle = v.angle; this.mag = v.mag; };

  // ----------------------------------------------------------------- Joint
  function Joint() {
    this.vectors = [null];
    this.mass = 1;
    this.velocity = new Vector();
    this.myColor = "#000000";
    this.locked = false;
    this.x = 0;
    this.y = 0;
    this.id = 0;
    this.addGravity();
  }
  Joint.prototype.init = function () {
    this.mass = 1;
    this.velocity = new Vector();
    this.myColor = "#000000";
    this.locked = false;
    this.x = 0;
    this.y = 0;
    this.id = 0;
  };
  Joint.prototype.addGravity = function () {
    var v = new Vector();
    v.angle = 270;
    if (this.mass === 0) this.mass = 1;
    v.mag = 9.8 * this.mass;
    this.vectors.push(v);
  };
  Joint.prototype.addVector = function (v) {
    var n = new Vector();
    n.angle = v.angle;
    n.mag = v.mag;
    this.vectors.push(n);
  };
  // Reset accumulated force vectors at the end of a tick (RealBASIC's joint()).
  Joint.prototype.resetForces = function () {
    this.vectors = [null];
    this.addGravity();
  };
  // Move the joint along its velocity for timestep s, then resolve the floor.
  Joint.prototype.shift = function (s) {
    var angle = this.velocity.angle;
    this.x += this.velocity.mag * Math.cos(deg(angle)) * s;
    this.y += this.velocity.mag * Math.sin(deg(angle)) * s;

    if (this.y <= CONST.floorY) {
      // Reflect a downward velocity to upward (bounce).
      if (angle > 180 && angle <= 270) {
        this.velocity.angle = 90 + (90 - (angle - 180));
      } else if (angle > 270 && angle < 360) {
        this.velocity.angle = 90 - ((angle - 180) - 90);
      }
      // Anti-jiggle: ease back toward the floor instead of snapping to it.
      this.y += Math.abs(CONST.floorY - this.y) * 0.5;
      this.velocity.mag = this.velocity.mag * CONST.floorAbsorbtion;
    }
  };
  Joint.prototype.mirror = function (j) {
    this.init();
    this.vectors = [null];
    for (var a = 1; a <= ub(j.vectors); a++) this.addVector(j.vectors[a]);
    this.id = j.id;
    this.locked = j.locked;
    this.mass = j.mass;
    this.myColor = j.myColor;
    this.velocity.mirror(j.velocity);
    this.x = j.x;
    this.y = j.y;
  };

  // ---------------------------------------------------------------- Spring
  function Spring() {
    this.Jt1Code = 0;
    this.Jt2Code = 0;
    this.k = CONST.constK;
    this.restLength = 0;
    this.originalRestLength = 0;
    this.wavePosition = -1; // -1 == not a muscle
  }
  Spring.prototype.mirror = function (s) {
    this.Jt1Code = s.Jt1Code;
    this.Jt2Code = s.Jt2Code;
    this.k = s.k;
    this.originalRestLength = s.originalRestLength;
    this.restLength = s.restLength;
    this.wavePosition = s.wavePosition;
  };

  // -------------------------------------------------------------- Waveform
  function Waveform() {
    this.average = 0;
    this.amplitude = 0;
    this.period = 1;
    this.phase = 0;
  }
  // A + B*cos( (2*PI/T) * (x - phase) )
  Waveform.prototype.at = function (x) {
    return this.average + this.amplitude * Math.cos(((2 * PI) / this.period) * (x - this.phase));
  };
  Waveform.prototype.mirror = function (w) {
    this.amplitude = w.amplitude;
    this.average = w.average;
    this.period = w.period;
    this.phase = w.phase;
  };

  // ------------------------------------------------------------- Framework
  function Framework() {
    this.joints = [null];
    this.springs = [null];
    this.waveforms = [null];
    this.waveformSpeed = CONST.waveformSpeed;
    this.time = 0;
    this.waveLCM = 0;
    this.jokingMode = true;
    this.startingCenterX = 0;
    this.startingCenterY = 0;
  }

  Framework.prototype.addJoint = function (xi, yi) {
    var j = new Joint();
    j.init();
    j.x = xi;
    j.y = yi;
    this.joints.push(j);
    j.id = ub(this.joints);
    j.mass = 1;
    j.myColor = "#000000";
  };

  Framework.prototype.addSpring = function (p1, p2) {
    var s = new Spring();
    s.k = CONST.constK;
    s.Jt1Code = p1;
    s.Jt2Code = p2;
    this.springs.push(s);
    s.restLength = this.dist(p1, p2);
    s.originalRestLength = s.restLength;
  };

  Framework.prototype.dist = function (p1, p2) {
    var dy = this.joints[p2].y - this.joints[p1].y;
    var dx = this.joints[p2].x - this.joints[p1].x;
    return Math.sqrt(dy * dy + dx * dx);
  };

  Framework.prototype.addWaveform = function (avg, amp, prd, phas) {
    var w = new Waveform();
    w.average = avg;
    w.amplitude = amp;
    w.period = prd;
    w.phase = phas;
    this.waveforms.push(w);
  };

  // Advance every waveform's phase, then refresh muscle rest lengths.
  Framework.prototype.tickWaveforms = function (amt) {
    for (var a = 1; a <= ub(this.waveforms); a++) {
      this.waveforms[a].phase += amt;
    }
    this.updateSpringLengths();
  };

  // Muscles sample the summed waveform at their fixed wavePosition.
  Framework.prototype.updateSpringLengths = function () {
    for (var a = 1; a <= ub(this.springs); a++) {
      var sp = this.springs[a];
      if (sp.wavePosition > -1) {
        var c = 0;
        for (var b = 1; b <= ub(this.waveforms); b++) {
          c -= this.waveforms[b].at(sp.wavePosition) * CONST.waveScale;
        }
        sp.restLength = sp.originalRestLength + c;
      }
    }
  };

  // Apply Hooke's law for each spring, pushing both endpoint joints.
  Framework.prototype.addSpringVectors = function () {
    for (var a = 1; a <= ub(this.springs); a++) {
      var sp = this.springs[a];
      var j1 = this.joints[sp.Jt1Code];
      var j2 = this.joints[sp.Jt2Code];
      var v = new Vector();

      var slope = (j2.y - j1.y) / (j2.x - j1.x);
      var newRestLength = sp.restLength;
      // Hooke's law: F = -k * displacement
      var force = -1 * sp.k * (this.dist(sp.Jt1Code, sp.Jt2Code) - newRestLength);

      // Choose the push direction from the geometry (top/bottom joint) and the
      // sign of the force, expressed via the line's slope.
      if (j1.y >= j2.y) { // Jt1 is the top joint
        if (force < 0) {
          v.angle = slope > 0 ? 180 + Math.atan(slope) * (180 / PI)
                              : 360 + Math.atan(slope) * (180 / PI);
        } else {
          v.angle = slope > 0 ? Math.atan(slope) * (180 / PI)
                              : 180 + Math.atan(slope) * (180 / PI);
        }
      } else { // Jt1 is the bottom joint
        if (force > 0) {
          v.angle = slope > 0 ? 180 + Math.atan(slope) * (180 / PI)
                              : 360 + Math.atan(slope) * (180 / PI);
        } else {
          v.angle = slope > 0 ? Math.atan(slope) * (180 / PI)
                              : 180 + Math.atan(slope) * (180 / PI);
        }
      }

      v.mag = Math.abs(force) * CONST.absorbtion;
      j1.addVector(v);

      // The opposite joint gets the same magnitude in the reversed direction.
      v.mag = Math.abs(force) * CONST.absorbtion;
      if (v.angle >= 0 && v.angle <= 180) v.angle += 180; else v.angle -= 180;
      if (v.angle < 0) v.angle += 360; else if (v.angle > 360) v.angle -= 360;
      j2.addVector(v);
    }
  };

  // One full physics step.
  Framework.prototype.tick = function (s) {
    this.tickWaveforms(this.waveformSpeed);
    this.addSpringVectors();

    for (var a = 1; a <= ub(this.joints); a++) {
      var j = this.joints[a];
      if (j.locked) continue;

      var xsum = 0, ysum = 0;
      for (var b = 1; b <= ub(j.vectors); b++) {
        xsum += j.vectors[b].mag * Math.cos(deg(j.vectors[b].angle));
        ysum += j.vectors[b].mag * Math.sin(deg(j.vectors[b].angle));
      }

      // Floor friction (an approximation that ignores prior momentum).
      if (j.y <= CONST.floorY + 2) {
        if (Math.abs(CONST.floorFrict * ysum) > Math.abs(xsum)) {
          xsum = 0.00000001;
        } else {
          xsum += (xsum > 0 ? -1 : 1) * Math.abs(CONST.floorFrict * ysum);
        }
      }

      // F = m*a  =>  dv = (F/m)*s, blended with damped previous velocity.
      var finalvolx = (j.velocity.mag * Math.cos(deg(j.velocity.angle))) * CONST.airFriction + (xsum / j.mass) * s;
      var finalvoly = (j.velocity.mag * Math.sin(deg(j.velocity.angle))) * CONST.airFriction + (ysum / j.mass) * s;

      j.velocity.trueSetSlope(finalvoly, finalvolx);
      j.velocity.mag = Math.sqrt(finalvoly * finalvoly + finalvolx * finalvolx);

      if (j.velocity.angle < 0) j.velocity.angle += 360;
      while (j.velocity.angle > 360) j.velocity.angle -= 360;

      j.shift(s);
    }

    this.time += s;
    for (var c = 1; c <= ub(this.joints); c++) this.joints[c].resetForces();
  };

  Framework.prototype.centerOfGravityX = function () {
    var n = 0, d = 0;
    for (var a = 1; a <= ub(this.joints); a++) { n += this.joints[a].mass * this.joints[a].x; d += this.joints[a].mass; }
    return d === 0 ? 0 : n / d;
  };
  Framework.prototype.centerOfGravityY = function () {
    var n = 0, d = 0;
    for (var a = 1; a <= ub(this.joints); a++) { n += this.joints[a].mass * this.joints[a].y; d += this.joints[a].mass; }
    return d === 0 ? 0 : n / d;
  };

  Framework.prototype.doStart = function () {
    this.startingCenterX = this.centerOfGravityX();
    this.startingCenterY = this.centerOfGravityY();
  };

  Framework.prototype.distMoved = function () {
    var dx = this.centerOfGravityX() - this.startingCenterX;
    var dy = this.centerOfGravityY() - this.startingCenterY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  Framework.prototype.updateAllSpringLengths = function () {
    for (var a = 1; a <= ub(this.springs); a++) {
      this.springs[a].restLength = this.dist(this.springs[a].Jt1Code, this.springs[a].Jt2Code);
      this.springs[a].originalRestLength = this.springs[a].restLength;
    }
  };

  // Number of evolvable "genes": joints + muscles + (springs * waveforms * 2).
  Framework.prototype.complexity = function () {
    var c = ub(this.joints);
    for (var a = 1; a <= ub(this.springs); a++) if (this.springs[a].wavePosition > -1) c += 1;
    for (var b = 1; b <= ub(this.springs); b++) c += ub(this.waveforms) * 2;
    return c;
  };

  // Deep-copy another framework into this one (RealBASIC's mirror()).
  Framework.prototype.mirror = function (f) {
    this.joints = [null];
    this.springs = [null];
    this.waveforms = [null];
    this.waveformSpeed = CONST.waveformSpeed;
    this.time = 0;
    this.waveLCM = 0;
    this.jokingMode = f.jokingMode;

    var a;
    for (a = 1; a <= ub(f.joints); a++) { var j = new Joint(); j.mirror(f.joints[a]); this.joints.push(j); }
    for (a = 1; a <= ub(f.springs); a++) { var sp = new Spring(); sp.mirror(f.springs[a]); this.springs.push(sp); }
    for (a = 1; a <= ub(f.waveforms); a++) { var w = new Waveform(); w.mirror(f.waveforms[a]); this.waveforms.push(w); }

    this.startingCenterX = f.startingCenterX;
    this.startingCenterY = f.startingCenterY;
    this.time = f.time;
    this.waveformSpeed = f.waveformSpeed;
    this.waveLCM = f.waveLCM;
  };

  // ----------------------------------------------------- file format (text)
  // Lines look like:
  //   JT x y mass locked angle mag
  //   SP jt1 jt2 wavePosition
  //   WF average amplitude period phase
  function loadFramework(text) {
    var fw = new Framework();
    var lines = text.split(/\r\n|\r|\n/);
    for (var i = 0; i < lines.length; i++) {
      var ipt = lines[i].trim();
      if (ipt === "") continue;
      var f = ipt.split(/\s+/);
      switch (f[0]) {
        case "JT":
          fw.addJoint(parseFloat(f[1]), parseFloat(f[2]));
          var jt = fw.joints[ub(fw.joints)];
          jt.mass = parseFloat(f[3]); if (!jt.mass) jt.mass = 1;
          jt.locked = (f[4] === "true");
          if (f[5] !== undefined) jt.velocity.angle = parseFloat(f[5]);
          if (f[6] !== undefined) jt.velocity.mag = parseFloat(f[6]);
          break;
        case "SP":
          fw.addSpring(parseInt(f[1], 10), parseInt(f[2], 10));
          fw.springs[ub(fw.springs)].wavePosition = parseFloat(f[3]);
          break;
        case "WF":
          fw.addWaveform(parseFloat(f[1]), parseFloat(f[2]), parseFloat(f[3]), parseFloat(f[4]));
          break;
        default:
          // ignore unknown lines
          break;
      }
    }
    fw.doStart();
    return fw;
  }

  function saveFramework(f) {
    var out = [];
    var a;
    for (a = 1; a <= ub(f.joints); a++) {
      out.push("JT " + f.joints[a].x + " " + f.joints[a].y + " " + f.joints[a].mass + " " + (f.joints[a].locked ? "true" : "false"));
    }
    for (a = 1; a <= ub(f.springs); a++) {
      out.push("SP " + f.springs[a].Jt1Code + " " + f.springs[a].Jt2Code + " " + f.springs[a].wavePosition);
    }
    for (a = 1; a <= ub(f.waveforms); a++) {
      out.push("WF " + f.waveforms[a].average + " " + f.waveforms[a].amplitude + " " + f.waveforms[a].period + " " + f.waveforms[a].phase);
    }
    return out.join("\n");
  }

  // The default four-joint box from MainWindow.Open.
  function defaultCreature() {
    var fw = new Framework();
    fw.addJoint(100, 2);
    fw.addJoint(100, 102);
    fw.addJoint(200, 102);
    fw.addJoint(200, 2);
    fw.addSpring(1, 2);
    fw.addSpring(2, 3);
    fw.addSpring(3, 4);
    fw.addSpring(4, 1);
    fw.addSpring(1, 3);
    fw.addWaveform(0, 9, 180, 1);
    fw.doStart();
    return fw;
  }

  var Mobility = {
    CONST: CONST,
    ub: ub,
    Vector: Vector,
    Joint: Joint,
    Spring: Spring,
    Waveform: Waveform,
    Framework: Framework,
    loadFramework: loadFramework,
    saveFramework: saveFramework,
    defaultCreature: defaultCreature
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Mobility;
  } else {
    root.Mobility = Mobility;
  }
})(typeof window !== "undefined" ? window : this);
