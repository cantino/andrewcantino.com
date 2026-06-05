/*
 * app.js -- UI wiring for the species-extinction / habitat-fragmentation sim.
 *
 * Recreates the original RealBASIC windows (Display, World Settings, Graph,
 * Cell Info) on top of the ported engine (engine.js / window.Frag). The grid
 * renderer mirrors GridC.draw; the run loop mirrors Window1.do_tick driven
 * from a timer (the original used a background thread).
 */
(function () {
  "use strict";

  var Frag = window.Frag;
  var sim = new Frag.Sim({ size: 10 });

  var timer = null, running = false;
  var selected = null;   // [x,y] of the inspected cell
  var hover = null;      // [x,y] under the mouse

  function $(id) { return document.getElementById(id); }
  function open(id) { window.MacWindows.open(id); }

  // ---- settings form <-> engine settings --------------------------------
  var TEXT_SETTINGS = ["mp", "br", "life1", "life2", "wall_d1", "wall_d2", "prob"];

  function settingsToForm() {
    TEXT_SETTINGS.forEach(function (k) { var el = $("opt_" + k); if (el) el.value = sim.s[k]; });
    $("opt_fluc").checked = !!sim.s.fluc;
    $("opt_rhalf").checked = !!sim.s.rhalf;
    $("opt_make_mode").value = String(sim.s.make_mode);
    $("fragSlider").value = sim.s.frag;
    $("fragShow").textContent = sim.s.frag + "%";
    $("opt_size").value = sim.w.size;
  }

  function formToSettings() {
    TEXT_SETTINGS.forEach(function (k) {
      var el = $("opt_" + k);
      if (el && el.value !== "") sim.s[k] = parseFloat(el.value);
    });
    sim.s.fluc = $("opt_fluc").checked;
    sim.s.rhalf = $("opt_rhalf").checked;
    sim.s.make_mode = parseInt($("opt_make_mode").value, 10);
    sim.s.frag = parseInt($("fragSlider").value, 10);
  }

  // ---- grid rendering (GridC.draw) --------------------------------------
  function drawGrid() {
    var canvas = $("grid"), ctx = canvas.getContext("2d");
    var num = sim.w.size, W = canvas.width, H = canvas.height;
    var a = W / num, b = H / num;
    var showText = $("opt_showw").checked;

    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

    for (var c = 1; c <= num; c++) {
      for (var d = 1; d <= num; d++) {
        var p = sim.w.p[c][d];
        var col;
        if (p.wall_mode < 1) {
          var ratio = p.Capacity > 0 ? Math.max(0, Math.min(1, p.total / p.Capacity)) : 0;
          var g = Math.round(255 * ratio);
          col = "rgb(" + g + "," + g + "," + g + ")";
        } else if (p.wall_mode === 1) {
          col = "rgb(0,0,255)";       // passable-hurting
        } else {
          col = "rgb(0,255,0)";       // solid wall
        }
        ctx.fillStyle = col;
        ctx.fillRect(a * (c - 1), b * (d - 1), a, b);
      }
    }

    // grid lines
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    for (c = 0; c <= num; c++) {
      ctx.beginPath(); ctx.moveTo(a * c, 0); ctx.lineTo(a * c, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, b * c); ctx.lineTo(W, b * c); ctx.stroke();
    }

    // optional per-cell text
    if (showText) {
      ctx.font = "8px Geneva, sans-serif";
      for (c = 1; c <= num; c++) for (d = 1; d <= num; d++) {
        var pp = sim.w.p[c][d];
        if (pp.wall_mode >= 1) continue;
        var ratio2 = pp.Capacity > 0 ? pp.total / pp.Capacity : 0;
        ctx.fillStyle = (255 * Math.max(0, Math.min(1, ratio2))) < 100 ? "#fff" : "#000";
        ctx.fillText("C" + Math.round(pp.Capacity), a * (c - 1) + 1, b * (d - 1) + 9);
        ctx.fillText("T" + Math.round(pp.total), a * (c - 1) + 1, b * (d - 1) + 17);
      }
    }

    // hover (blue) and selection (red) outlines
    function outline(cell, color) {
      if (!cell) return;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(a * (cell[0] - 1) + 1, b * (cell[1] - 1) + 1, a - 2, b - 2);
    }
    outline(hover, "#0000ff");
    outline(selected, "#ff0000");
  }

  // ---- population graph (graphwin.g) ------------------------------------
  function drawGraph() {
    var canvas = $("graph"), ctx = canvas.getContext("2d");
    var W = canvas.width, H = canvas.height;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    var pts = sim.history;
    $("graphTotal").textContent = "Total: " + Math.round(sim.get_total());
    if (pts.length < 2) return;

    var maxX = pts[pts.length - 1].x || 1;
    var scale = parseInt($("graphScale").value, 10) / 100;  // y zoom
    var cap = sim.w.get_total_capacity() || 1;
    var maxY = cap * scale;

    ctx.strokeStyle = "#cc0000"; ctx.lineWidth = 1; ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var x = (pts[i].x / maxX) * (W - 2) + 1;
      var y = H - 1 - Math.min(1, pts[i].y / maxY) * (H - 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // ---- cell info (Window1.show) -----------------------------------------
  function showInfo() {
    if (!selected) return;
    var x = selected[0], y = selected[1], p = sim.w.p[x][y];
    var lines = [
      "Cell (" + x + ", " + y + ")",
      "Total:    " + p.total.toFixed(2),
      "Capacity: " + Math.round(p.Capacity),
      "Adults (p2):    " + p.p2.toFixed(2),
      "Juveniles (p1): " + p.p1.toFixed(2),
      "d1: " + p.d1.toFixed(3) + "   d2: " + p.d2.toFixed(3),
      "Num near: " + sim.num_near(x, y),
      "Wall: " + (p.wall_mode === 0 ? "no" : p.wall_mode === 1 ? "passable" : "solid"),
      "In last tick:  " + p.in1_last.toFixed(2),
      "Out last tick: " + p.out1_last.toFixed(2)
    ];
    $("infoOut").textContent = lines.join("\n");
    $("cell_d1").value = p.d1.toFixed(3);
    $("cell_d2").value = p.d2.toFixed(3);
  }

  // ---- run loop (Window1.do_tick / run) ---------------------------------
  function step() {
    sim.do_tick();
    $("yrs").textContent = sim.year;
    $("totLabel").textContent = "Total: " + Math.round(sim.get_total());
    if ($("opt_update1").checked) drawGrid();
    if ($("opt_gr").checked) drawGraph();
    if (selected && $("opt_update2").checked) showInfo();
    updateExper();
  }

  function go() {
    if (running) return;
    running = true;
    timer = setInterval(function () {
      step();
      if (sim.get_total() <= 0) { stop(); }
    }, 60);
  }
  function stop() {
    running = false;
    if (timer) { clearInterval(timer); timer = null; }
  }

  function redrawAll() {
    $("yrs").textContent = sim.year;
    $("totLabel").textContent = "Total: " + Math.round(sim.get_total());
    drawGrid(); drawGraph(); if (selected) showInfo();
  }

  // ---- scenarios --------------------------------------------------------
  function populateScenarios() {
    var sel = $("scenarioSelect");
    (window.FRAG_SCENARIOS || []).forEach(function (sc, i) {
      var o = document.createElement("option");
      o.value = String(i); o.textContent = sc.name;
      sel.appendChild(o);
    });
  }

  function loadScenario() {
    stop();
    var sc = window.FRAG_SCENARIOS[parseInt($("scenarioSelect").value, 10)];
    sim = new Frag.Sim({ size: sc.size, settings: sc.settings });
    sim.s.frag = sc.frag || 0;
    if (sc.applyFrag && sim.s.frag > 0) sim.do_frag();
    selected = null; hover = null;
    settingsToForm();
    $("scenarioNote").textContent = sc.note || "";
    updateExper(sc);
    redrawAll();
  }

  // ---- Experiment Control read-out --------------------------------------
  var loadedScenario = null;
  function updateExper(sc) {
    if (sc) loadedScenario = sc;
    var out = $("experOut"); if (!out) return;
    if (!loadedScenario) { out.textContent = "No experiment loaded."; return; }
    out.textContent = [
      "Run: " + loadedScenario.name,
      "Grid: " + sim.w.size + " x " + sim.w.size,
      "Year: " + sim.year,
      "Total: " + Math.round(sim.get_total()),
      "Capacity: " + Math.round(sim.w.get_total_capacity())
    ].join("\n");
  }

  // ---- grid mouse handling ----------------------------------------------
  function cellAt(ev) {
    var canvas = $("grid"), r = canvas.getBoundingClientRect();
    var num = sim.w.size;
    var x = Math.floor((ev.clientX - r.left) / (canvas.width / num)) + 1;
    var y = Math.floor((ev.clientY - r.top) / (canvas.height / num)) + 1;
    if (x < 1 || x > num || y < 1 || y > num) return null;
    return [x, y];
  }

  // ---- wire up ----------------------------------------------------------
  function init() {
    populateScenarios();
    settingsToForm();

    $("btnLaunch").addEventListener("click", function () {
      open("settingsWin"); open("displayWin"); open("graphWin"); open("experWin");
      window.MacWindows.close("introWin");
      redrawAll();
    });

    $("goBtn").addEventListener("click", go);
    $("stopBtn").addEventListener("click", stop);
    $("stepBtn").addEventListener("click", function () { step(); });
    $("resetBtn").addEventListener("click", function () {
      stop(); sim.reset(); selected = null; redrawAll();
    });

    $("loadScenario").addEventListener("click", loadScenario);
    $("scenarioSelect").addEventListener("change", loadScenario);
    $("loadData").addEventListener("click", loadScenario);

    $("applySettings").addEventListener("click", function () { formToSettings(); redrawAll(); });
    $("newWorld").addEventListener("click", function () {
      stop();
      formToSettings();
      var size = parseInt($("opt_size").value, 10) || 10;
      sim = new Frag.Sim({ size: size, settings: sim.s });
      selected = null; redrawAll();
    });

    $("fragSlider").addEventListener("input", function () {
      $("fragShow").textContent = this.value + "%";
      sim.s.frag = parseInt(this.value, 10);
    });
    $("applyFrag").addEventListener("click", function () {
      formToSettings(); sim.do_frag(); redrawAll();
    });
    $("graphScale").addEventListener("input", drawGraph);
    $("opt_showw").addEventListener("change", drawGrid);

    var grid = $("grid");
    grid.addEventListener("mousemove", function (ev) {
      var c = cellAt(ev);
      if ((c && (!hover || c[0] !== hover[0] || c[1] !== hover[1])) || (!c && hover)) {
        hover = c; if (!running) drawGrid();
      }
    });
    grid.addEventListener("mouseleave", function () { hover = null; if (!running) drawGrid(); });
    grid.addEventListener("click", function (ev) {
      var c = cellAt(ev);
      if (!c) return;
      if (selected && selected[0] === c[0] && selected[1] === c[1]) selected = null;
      else selected = c;
      open("infoWin"); showInfo(); drawGrid();
    });

    $("cellApply").addEventListener("click", function () {
      if (!selected) return;
      var p = sim.w.p[selected[0]][selected[1]];
      if ($("cell_d1").value !== "") p.d1 = parseFloat($("cell_d1").value);
      if ($("cell_d2").value !== "") p.d2 = parseFloat($("cell_d2").value);
      showInfo(); drawGrid();
    });

    redrawAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
