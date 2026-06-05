/*
 * app.js -- UI wiring for the Sympatric Speciation Simulator.
 *
 * Recreates the original RealBASIC windows (Main, Graphic Output, Options,
 * Speciation Check) on top of the ported engine (engine.js / window.SSS).
 * The original ran its main loop on a thread; here we drive Sim.mainloop()
 * from a timer and redraw the scatter plots, mirroring Window.updategraphs.
 */
(function () {
  "use strict";

  var SSS = window.SSS;
  var sim = new SSS.Sim();
  sim.startup();

  var timer = null;       // setInterval handle while "running"
  var running = false;

  // ---- element helpers --------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function open(id) { window.MacWindows.open(id); }

  // ---- options <-> prefs ------------------------------------------------
  var NUM_PREFS = [
    "fruit_support", "insect_support", "seed_small_support", "seed_medium_support",
    "seed_large_support", "nector_straight_support", "nector_curved_support",
    "max_birds", "max_age", "mut_max", "rec_food", "max_baby", "min_baby", "maxdist"
  ];

  function prefsToForm() {
    NUM_PREFS.forEach(function (k) {
      var el = $("opt_" + k);
      if (el) el.value = sim.prefs[k];
    });
    var mm = document.querySelector('input[name="matemode"][value="' + sim.prefs.matemode + '"]');
    if (mm) mm.checked = true;
    $("opt_detect").checked = !!sim._detect;
    $("opt_stop").checked = !!sim._stopOnSpeci;
    $("opt_save_new").checked = !!sim._saveNew;
    $("opt_save_continue").checked = !!sim._saveContinue;
    $("opt_gen_stop").checked = !!sim._genStop;
    $("opt_num_gen_stop").value = sim._numGenStop || 0;
  }

  function formToPrefs() {
    NUM_PREFS.forEach(function (k) {
      var el = $("opt_" + k);
      if (el && el.value !== "") sim.prefs[k] = parseFloat(el.value);
    });
    var mm = document.querySelector('input[name="matemode"]:checked');
    if (mm) sim.prefs.matemode = parseInt(mm.value, 10);
    sim._detect = $("opt_detect").checked;
    sim._stopOnSpeci = $("opt_stop").checked;
    sim._saveNew = $("opt_save_new").checked;
    sim._saveContinue = $("opt_save_continue").checked;
    sim._genStop = $("opt_gen_stop").checked;
    sim._numGenStop = parseInt($("opt_num_gen_stop").value, 10) || 0;
  }

  // ---- status / food read-outs (Window.dispfood + stat fields) ----------
  function updateStats() {
    $("totbirds").textContent = sim.total();
    $("years").textContent = sim.year;
    $("insectbox").textContent = sim.insect;
    $("fruitbox").textContent = sim.fruit;
    $("sseedbox").textContent = sim.seed_small;
    $("mseedbox").textContent = sim.seed_medium;
    $("lseedbox").textContent = sim.seed_large;
    $("snectorbox").textContent = sim.nector_straight;
    $("cnectorbox").textContent = sim.nector_curved;
  }
  function setStatus(s) { $("status").textContent = s; }

  // ---- scatter graphs (Window.updategraphs + graphcanvas.drawpt) --------
  var GRID = SSS.GRAPH.scale; // 20

  function drawAxes(ctx, w, h) {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#000000"; ctx.lineWidth = 1;
    // bounding box (graphcanvas.outline)
    ctx.strokeRect(0.5, 0.5, w - 5, h - 5);
    // tick marks every 20px for the 5 beak units (graphcanvas.mark)
    ctx.fillStyle = "#000000";
    for (var a = 1; a <= 5; a++) {
      ctx.fillRect(a * GRID + 4, h - 9, 3, 3);   // x axis ticks
      ctx.fillRect(0, h - a * GRID - 10, 3, 3);   // y axis ticks
    }
  }

  function dot(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 1, 1.5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // active highlight predicates from the checkboxes
  function highlightPredicates() {
    var preds = [];
    document.querySelectorAll(".hl:checked").forEach(function (cb) {
      if (cb.dataset.fn) {
        var fn = cb.dataset.fn;
        preds.push(function (i) { return sim[fn](i); });
      } else if (cb.dataset.sex) {
        var sx = parseInt(cb.dataset.sex, 10);
        preds.push(function (i) { return sim.birds[i].sex === sx; });
      }
    });
    return preds;
  }

  function colorFor(i, preds) {
    for (var p = 0; p < preds.length; p++) if (preds[p](i)) return "#0000ff";
    return "#ff0000";
  }

  function drawGraphs() {
    var c1 = $("g1"), c2 = $("g2"), c3 = $("g3");
    if (!c1) return;
    var x1 = c1.getContext("2d"), x2 = c2.getContext("2d"), x3 = c3.getContext("2d");
    var h = c1.height;
    drawAxes(x1, c1.width, h); drawAxes(x2, c2.width, h); drawAxes(x3, c3.width, h);
    var preds = highlightPredicates();
    for (var a = 0; a <= sim.birds.length - 1; a++) {
      var b = sim.birds[a];
      var col = colorFor(a, preds);
      dot(x1, SSS.transX(b.width), SSS.transY(b.length, h), col);  // width vs length
      dot(x2, SSS.transX(b.width), SSS.transY(b.curve, h), col);   // width vs curve
      dot(x3, SSS.transX(b.curve), SSS.transY(b.length, h), col);  // curve vs length
    }
  }

  // ---- speciation detector view -----------------------------------------
  function drawSpeci(detected) {
    var c = $("speciCanvas"); if (!c) return;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height);
    // re-create the additive blob field for display (keyed on width, length)
    var w = c.width, h = c.height;
    var img = ctx.createImageData(w, h);
    var field = new Float64Array(w * h);
    function inb(x, y) { return x >= 0 && x < w && y >= 0 && y < h; }
    for (var a = 0; a <= sim.birds.length - 1; a++) {
      var px = SSS.transX(sim.birds[a].width), py = SSS.transY(sim.birds[a].length, h);
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
        var amt = 5 - Math.round(Math.sqrt(dx * dx + dy * dy));
        var xx = px + dx, yy = py + dy;
        if (inb(xx, yy)) field[yy * w + xx] += amt * 10;
      }
    }
    for (var i = 0; i < field.length; i++) {
      var v = field[i] < 135 ? 0 : Math.min(255, field[i]);
      img.data[i * 4] = v; img.data[i * 4 + 1] = v ? 200 : 0;
      img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    $("speciStatus").textContent = detected ? "Speciation!" : "No speciation";
    $("speciStatus").style.color = detected ? "#cc0000" : "#000";
  }

  // ---- save the bird array (RB Window.savearray -> a download) -----------
  function saveBirds() {
    try {
      var blob = new Blob([sim.save()], { type: "text/plain" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "birds-year-" + sim.year + ".txt";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { /* file save unsupported -- ignore */ }
  }

  // Perform the user-selected "when speciation is detected" action.
  function doSpeciationAction(reason) {
    setStatus(reason + " at year " + sim.year + "!");
    drawSpeci(true);
    if (sim._saveNew) {
      saveBirds();
      reset(null, "Saved; started a new run after " + reason.toLowerCase() + ".");
      return; // reset() already redrew
    } else if (sim._saveContinue) {
      saveBirds();
      setStatus("Saved; continuing the run after " + reason.toLowerCase() + ".");
    } else if (sim._stopOnSpeci) {
      stop();
    }
    redraw();
  }

  // ---- the simulation step ----------------------------------------------
  function step() {
    sim.mainloop();
    if (sim._detect) {
      var fired = sim.tickSpeciationDetector(function () {
        return sim.speci_check(120, 120);
      });
      if (fired) { doSpeciationAction("Speciation detected"); return; }
    }
    if (sim._genStop && sim._numGenStop > 0 && sim.year >= sim._numGenStop) {
      doSpeciationAction("Generation limit reached");
      return;
    }
    redraw();
  }

  var rafPending = false;
  function redraw() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      updateStats();
      drawGraphs();
    });
  }

  function go() {
    if (running) return;
    if (sim.total() === 0) { setStatus("All birds died -- reset to continue."); return; }
    running = true;
    setStatus("Running...");
    var interval = 1000 / parseInt($("speedSlider").value, 10);
    timer = setInterval(function () {
      step();
      if (sim.total() === 0) { stop(); setStatus("Extinction at year " + sim.year + "."); }
    }, interval);
  }

  function stop() {
    running = false;
    if (timer) { clearInterval(timer); timer = null; }
    if ($("status").textContent === "Running...") setStatus("Stopped.");
  }

  function reset(text, label) {
    stop();
    sim = new SSS.Sim({ prefs: cloneNumericPrefs() });
    sim._detect = $("opt_detect").checked;
    sim._stopOnSpeci = $("opt_stop").checked;
    if (text) sim.load(text); else sim.startup();
    setStatus(label || "Ready");
    redraw();
  }

  function cloneNumericPrefs() {
    var p = {};
    NUM_PREFS.forEach(function (k) {
      var el = $("opt_" + k);
      if (el && el.value !== "") p[k] = parseFloat(el.value);
    });
    var mm = document.querySelector('input[name="matemode"]:checked');
    if (mm) p.matemode = parseInt(mm.value, 10);
    return p;
  }

  // ---- run dropdown -----------------------------------------------------
  function populateRuns() {
    var sel = $("runSelect");
    var opt = document.createElement("option");
    opt.value = "__new__"; opt.textContent = "New run (2 founders)";
    sel.appendChild(opt);
    (window.SSS_RUNS || []).forEach(function (r, i) {
      var o = document.createElement("option");
      o.value = String(i); o.textContent = r.name;
      sel.appendChild(o);
    });
  }

  function loadSelected() {
    var v = $("runSelect").value;
    if (v === "__new__") { reset(null, "New founder population."); return; }
    var r = window.SSS_RUNS[parseInt(v, 10)];
    reset(r.text, "Loaded: " + r.name);
  }

  // ---- wire it all up ---------------------------------------------------
  function init() {
    populateRuns();
    prefsToForm();

    $("btnLaunch").addEventListener("click", function () {
      open("mainWin"); open("graphsWin");
      window.MacWindows.close("introWin");
      redraw();
    });
    $("openOptions").addEventListener("click", function () { open("optionsWin"); });
    $("openSpeci").addEventListener("click", function () { open("speciWin"); drawSpeci(false); });

    $("goBtn").addEventListener("click", go);
    $("stopBtn").addEventListener("click", stop);
    $("stepBtn").addEventListener("click", function () {
      if (sim.total() === 0) { setStatus("All birds died -- reset to continue."); return; }
      step();
    });
    $("loadBtn").addEventListener("click", loadSelected);
    $("runSelect").addEventListener("change", loadSelected);

    $("speedSlider").addEventListener("input", function () {
      if (running) { stop(); go(); }
    });

    document.querySelectorAll(".hl").forEach(function (cb) {
      cb.addEventListener("change", redraw);
    });

    $("optApply").addEventListener("click", function () {
      formToPrefs();
      setStatus("Options applied.");
    });
    $("optReset").addEventListener("click", function () {
      for (var k in SSS.DEFAULTS) sim.prefs[k] = SSS.DEFAULTS[k];
      sim._detect = false; sim._stopOnSpeci = false;
      sim._saveNew = false; sim._saveContinue = false;
      sim._genStop = false; sim._numGenStop = 0;
      prefsToForm();
      setStatus("Defaults restored.");
    });
    $("speciCheckBtn").addEventListener("click", function () {
      drawSpeci(sim.speci_check(120, 120));
    });

    updateStats();
    drawGraphs();
    drawSpeci(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
