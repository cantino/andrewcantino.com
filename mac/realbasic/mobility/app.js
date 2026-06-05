/*
 * Computational Evolution of Mobility -- UI / application layer.
 *
 * Wires the ported physics engine (Mobility) and evolutionary algorithm
 * (MobilityEvolution) to a retro Mac-styled HTML interface that recreates the
 * three windows of the original RealBASIC app: the intro, the Creature Display,
 * and the Evolving Creatures Window.
 */
(function () {
  "use strict";
  var M = window.Mobility;
  var Evo = window.MobilityEvolution;
  var C = M.CONST;

  // ----------------------------------------------------------------- utils
  function $(id) { return document.getElementById(id); }

  // Draggable windows + close boxes + zoom-to-front.
  (function windowing() {
    var z = 10;
    document.querySelectorAll(".window").forEach(function (win) {
      win.addEventListener("mousedown", function () { win.style.zIndex = ++z; });
      var bar = win.querySelector(".titlebar");
      var drag = null;
      bar.addEventListener("mousedown", function (e) {
        if (e.target.classList.contains("close")) return;
        drag = { x: e.clientX, y: e.clientY, left: parseInt(win.style.left, 10) || win.offsetLeft, top: parseInt(win.style.top, 10) || win.offsetTop };
        e.preventDefault();
      });
      document.addEventListener("mousemove", function (e) {
        if (!drag) return;
        win.style.left = (drag.left + e.clientX - drag.x) + "px";
        win.style.top = Math.max(22, drag.top + e.clientY - drag.y) + "px";
      });
      document.addEventListener("mouseup", function () { drag = null; });
    });
    document.querySelectorAll("[data-close]").forEach(function (c) {
      c.addEventListener("click", function () { $(c.getAttribute("data-close")).style.display = "none"; });
    });
  })();

  function openWindow(id) {
    var w = $(id);
    w.style.display = "";
    w.style.zIndex = 9999;
  }

  // ----------------------------------------------------------- renderer
  // Draws a Framework onto a 2D context with a simple follow-camera and a
  // scrolling ground, porting Framework.paint (springs/joints/center of mass).
  function renderCreature(ctx, W, H, fw, opts) {
    opts = opts || {};
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

    var scale = opts.scale || 1.0;
    var bottomMargin = 24;
    var groundScreenY = H - bottomMargin;
    var cogx = fw.centerOfGravityX();
    var camX = opts.follow ? cogx : (opts.camX || 0);

    function sx(wx) { return (wx - camX) * scale + W / 2; }
    function sy(wy) { return groundScreenY - (wy - C.floorY) * scale; }

    // ground + scrolling tick marks
    ctx.strokeStyle = "#9a9a9a"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, groundScreenY + 0.5); ctx.lineTo(W, groundScreenY + 0.5); ctx.stroke();
    ctx.strokeStyle = "#cccccc";
    var spacing = 40;
    var startTick = Math.floor((camX - W / 2 / scale) / spacing) * spacing;
    for (var gx = startTick; gx < camX + W / 2 / scale + spacing; gx += spacing) {
      var x = sx(gx);
      ctx.beginPath(); ctx.moveTo(x, groundScreenY); ctx.lineTo(x, groundScreenY + 6); ctx.stroke();
    }

    var ub = M.ub, a;
    ctx.font = "9px Geneva, sans-serif";
    ctx.textBaseline = "alphabetic";

    // springs
    for (a = 1; a <= ub(fw.springs); a++) {
      var sp = fw.springs[a];
      var j1 = fw.joints[sp.Jt1Code], j2 = fw.joints[sp.Jt2Code];
      if (!j1 || !j2) continue;
      var muscle = sp.wavePosition > -1;
      ctx.strokeStyle = muscle ? "#0000ff" : "#000000";
      ctx.lineWidth = muscle ? 1.4 : 1;
      ctx.beginPath(); ctx.moveTo(sx(j1.x), sy(j1.y)); ctx.lineTo(sx(j2.x), sy(j2.y)); ctx.stroke();
      if (muscle) {
        ctx.fillStyle = "#0000ff";
        ctx.fillText(String(a), (sx(j1.x) + sx(j2.x)) / 2, (sy(j1.y) + sy(j2.y)) / 2);
      }
    }

    // center of mass
    ctx.fillStyle = "#cc0000";
    ctx.beginPath(); ctx.arc(sx(cogx), sy(fw.centerOfGravityY()), 3.2, 0, 2 * Math.PI); ctx.fill();

    // joints + labels
    ctx.font = "10px Geneva, sans-serif";
    for (a = 1; a <= ub(fw.joints); a++) {
      var j = fw.joints[a];
      ctx.fillStyle = j.myColor || "#000";
      ctx.beginPath(); ctx.arc(sx(j.x), sy(j.y), 2.2, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillText(String(a), sx(j.x) + 2, sy(j.y) - 2);
    }

    // Easter egg (port of Framework.paint's `jokingMode`, which the original
    // set permanently to true): once the whole creature has marched off the
    // right edge of the view -- center of mass past the edge AND no joint still
    // on screen -- show the picture. This is always active, exactly as the
    // original was; it only actually fires with the follow-camera OFF (the
    // original had no follow camera). With follow on the center of mass stays
    // pinned to screen center, so the condition never triggers.
    var escaped = sx(cogx) > W;
    if (escaped) {
      for (a = 1; a <= ub(fw.joints); a++) {
        if (sx(fw.joints[a].x) < W) { escaped = false; break; }
      }
    }
    if (escaped) drawJokePicture(ctx, W, H);
  }

  // The authentic easter egg: the project's own left.pict ("The Little Jiggly
  // Walking Thing Has Left The Building!"), drawn centered exactly as the
  // original Framework.paint did: drawpicture left, (w/2)-(lw/2), (h/2)-(lh/2).
  // Loaded lazily and robustly: we read window.LEFT_PICT at draw time (so script
  // load order can't matter), redraw once it decodes, and -- if the embedded
  // image is somehow unavailable -- fall back to drawing the text so the canvas
  // is never just blank.
  var jokeImg = null, jokeOnLoad = null;
  function ensureJokeImg() {
    if (jokeImg || typeof window === "undefined" || !window.LEFT_PICT) return;
    jokeImg = new Image();
    jokeImg.onload = function () { if (jokeOnLoad) jokeOnLoad(); };
    jokeImg.src = window.LEFT_PICT;
  }
  ensureJokeImg(); // preload now so it's decoded long before any creature escapes
  function drawJokePicture(ctx, W, H) {
    ensureJokeImg();
    if (jokeImg && jokeImg.complete && jokeImg.naturalWidth) {
      var iw = jokeImg.naturalWidth, ih = jokeImg.naturalHeight;
      var s = Math.min(1, (W - 16) / iw); // shrink only if it won't fit
      iw *= s; ih *= s;
      ctx.drawImage(jokeImg, (W - iw) / 2, (H - ih) / 2, iw, ih);
      return;
    }
    // Fallback: the image hasn't loaded (or left-pict.js is missing). Draw the
    // line as text so the joke still lands.
    ctx.save();
    ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "italic bold 17px Geneva, sans-serif";
    ctx.fillText("The Little Jiggly Walking Thing", W / 2, H / 2 - 12);
    ctx.fillText("Has Left The Building!", W / 2, H / 2 + 12);
    ctx.restore();
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  // Porting Framework.paintWave: the summed muscle waveform + muscle positions.
  function renderWave(ctx, W, H, fw) {
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    var ub = M.ub, a, b;
    var mid = H / 2;
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (a = 1; a <= W; a++) {
      var c = 0;
      for (b = 1; b <= ub(fw.waveforms); b++) c += fw.waveforms[b].at(a);
      var y = mid - c;
      if (a === 1) ctx.moveTo(a, y); else ctx.lineTo(a, y);
    }
    ctx.stroke();
    // muscle sample positions
    ctx.strokeStyle = "#0000ff"; ctx.fillStyle = "#0000ff";
    ctx.font = "9px Geneva, sans-serif";
    for (a = 1; a <= ub(fw.springs); a++) {
      var sp = fw.springs[a];
      if (sp.wavePosition > -1 && sp.wavePosition <= W) {
        ctx.beginPath(); ctx.moveTo(sp.wavePosition, 0); ctx.lineTo(sp.wavePosition, H); ctx.stroke();
        ctx.fillText(String(a), sp.wavePosition + 2, 10);
      }
    }
  }

  // ================================================== Creature Display
  var Display = (function () {
    var outC = $("outputCanvas"), outCtx = outC.getContext("2d");
    var waveC = $("waveCanvas"), waveCtx = waveC.getContext("2d");
    var sel = $("creatureSelect");
    var running = false, raf = null;
    var f = null, baseText = null, tickCount = 0;

    function populate() {
      (window.CREATURE_DATA || []).forEach(function (c, i) {
        var o = document.createElement("option");
        o.value = String(i); o.textContent = c.name; sel.appendChild(o);
      });
    }

    function autoScale() {
      // keep the creature comfortably inside the view
      var ub = M.ub, miny = 1e9, maxy = -1e9, minx = 1e9, maxx = -1e9;
      for (var a = 1; a <= ub(f.joints); a++) {
        var j = f.joints[a];
        miny = Math.min(miny, j.y); maxy = Math.max(maxy, j.y);
        minx = Math.min(minx, j.x); maxx = Math.max(maxx, j.x);
      }
      var hNeed = Math.max(120, maxy - C.floorY + 30);
      var s = (outC.height - 30) / hNeed;
      return Math.max(0.45, Math.min(1.1, s));
    }

    var curScale = 1.0;
    var panX = 0;   // camera world-x when Follow camera is off (the pan offset)

    // Re-render once the easter-egg image finishes decoding (matters if the
    // creature has already escaped while paused).
    jokeOnLoad = function () { render(); };

    function render() {
      renderCreature(outCtx, outC.width, outC.height, f, { follow: $("followCam").checked, scale: curScale, camX: panX });
      renderWave(waveCtx, waveC.width, waveC.height, f);
      $("dispStats").textContent =
        "joints " + M.ub(f.joints) + "  springs " + M.ub(f.springs) +
        "  moved " + f.distMoved().toFixed(1) + "  t=" + tickCount;
    }

    function loadByIndex(i) {
      var data = window.CREATURE_DATA[i];
      loadText(data.text);
    }

    function loadText(text) {
      baseText = text;
      f = M.loadFramework(text);
      tickCount = 0;
      panX = 0;
      curScale = autoScale();
      render();
    }

    function loadFramework(fw) {
      loadText(M.saveFramework(fw));
    }

    function loop() {
      if (!running) return;
      for (var i = 0; i < 2; i++) { f.tick(C.tickAmt); tickCount++; }
      curScale = autoScale();
      render();
      raf = requestAnimationFrame(loop);
    }

    function setRunning(on) {
      running = on;
      $("runBtn").textContent = on ? "Stop" : "Run";
      if (on) { raf = requestAnimationFrame(loop); }
      else if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    function reset() {
      if (baseText) loadText(baseText);
    }

    function stepFwd() { if (!f) return; f.tick(C.tickAmt); tickCount++; render(); }
    function stepBack() {
      if (!f || tickCount <= 0) return;
      var n = tickCount - 1;
      f = M.loadFramework(baseText);
      for (var i = 0; i < n; i++) f.tick(C.tickAmt);
      tickCount = n; render();
    }

    function init() {
      populate();
      sel.addEventListener("change", function () { setRunning(false); loadByIndex(parseInt(sel.value, 10)); });
      $("runBtn").addEventListener("click", function () { setRunning(!running); });
      $("resetBtn").addEventListener("click", function () { setRunning(false); reset(); });
      $("stepFwd").addEventListener("click", function () { setRunning(false); stepFwd(); });
      $("stepBack").addEventListener("click", function () { setRunning(false); stepBack(); });
      // Follow camera vs. manual pan. The original had no follow camera; it had
      // a horizontal scrollbar (CreatureDisplay.ScrollBar1) that shifted every
      // joint by +/-100 world units to chase a creature off the fixed view.
      // Here that scrollbar pans the camera instead (so it doesn't perturb the
      // physics or the distance stat), and is active only with Follow camera off.
      function panBy(d) { panX += d; if (!running) render(); }
      function syncPanEnabled() {
        $("panScroll").classList.toggle("disabled", $("followCam").checked);
      }
      $("followCam").addEventListener("change", function () {
        if ($("followCam").checked) panX = 0; // re-centering is automatic again
        syncPanEnabled();
        render();
      });

      // Arrow buttons: nudge +/-100 world units, auto-repeating while held
      // (like a real scrollbar arrow). Right scrolls the view right.
      var STEP = 100;
      function holdRepeat(btn, dir) {
        var iv = null;
        function start(e) { e.preventDefault(); panBy(dir * STEP); iv = setInterval(function () { panBy(dir * STEP); }, 110); }
        function stop() { if (iv) { clearInterval(iv); iv = null; } }
        btn.addEventListener("mousedown", start);
        btn.addEventListener("mouseup", stop);
        btn.addEventListener("mouseleave", stop);
        document.addEventListener("mouseup", stop);
      }
      holdRepeat($("sbLeft"), -1);
      holdRepeat($("sbRight"), +1);

      // Track click (the "page" region): jump a page in that direction.
      $("sbTrack").addEventListener("mousedown", function (e) {
        if (e.target.id === "sbThumb") return;
        var r = e.currentTarget.getBoundingClientRect();
        panBy(e.clientX < r.left + r.width / 2 ? -3 * STEP : 3 * STEP);
      });

      // Thumb drag: a relative jog -- pan proportionally to the drag, then the
      // thumb springs back to center on release (the scrollbar had no absolute
      // position to track, since the world is unbounded).
      (function () {
        var thumb = $("sbThumb"), track = $("sbTrack"), drag = null;
        thumb.addEventListener("mousedown", function (e) {
          e.preventDefault();
          var tr = track.getBoundingClientRect();
          drag = { x: e.clientX, panX: panX, max: (tr.width - thumb.offsetWidth) / 2 };
          thumb.classList.add("dragging");
          thumb.style.left = (tr.width - thumb.offsetWidth) / 2 + "px";
        });
        document.addEventListener("mousemove", function (e) {
          if (!drag) return;
          var dx = e.clientX - drag.x;
          var off = Math.max(-drag.max, Math.min(drag.max, dx));
          thumb.style.left = (track.getBoundingClientRect().width - thumb.offsetWidth) / 2 + off + "px";
          panX = drag.panX + dx * 4;   // 4 world units per pixel dragged
          if (!running) render();
        });
        document.addEventListener("mouseup", function () {
          if (!drag) return;
          drag = null;
          thumb.classList.remove("dragging"); // CSS re-centers it
          thumb.style.left = "";
        });
      })();

      syncPanEnabled();
      loadByIndex(0);
    }

    return { init: init, open: function () { openWindow("displayWin"); }, loadFramework: loadFramework, setRunning: setRunning };
  })();

  // =============================================== Evolving Creatures
  var Evolution = (function () {
    var run = null;
    var running = false;
    var watching = false;
    var watchRaf = null, watchCreature = null;
    var history = []; // {cycle, moved, complexity}
    var detailLines = [];        // ring buffer for the verbose log
    var bestEver = -Infinity, lastImprove = 0; // for progress display
    var watchC = $("watchCanvas"), watchCtx = watchC.getContext("2d");
    var graphC = $("graphCanvas"), graphCtx = graphC.getContext("2d");

    function setStatus(cycle) {
      // The original's header label: "Evolution cycle running...   <count>".
      $("evoStatus").textContent = "Evolution cycle running...   " + cycle;
    }

    function fresh() {
      run = new Evo.EvolutionRun(M.defaultCreature());
      run.storeSteps = $("storeSteps").checked;
      history = []; detailLines = [];
      bestEver = -Infinity; lastImprove = 0;
      $("statLog").innerHTML = "";
      $("detailLog").textContent = "";
      run.onLog = function (s) {
        detailLines.push(s);
        if (detailLines.length > 250) detailLines.splice(0, detailLines.length - 250);
        var el = $("detailLog"); el.textContent = detailLines.join(""); el.scrollTop = el.scrollHeight;
      };
      run.onStat = function (cycle, idx, moved, complexity) {
        history.push({ cycle: cycle, moved: moved, complexity: complexity });
        if (moved > bestEver + 1e-9) { bestEver = moved; lastImprove = cycle; }
        // The original listed EVERY cycle's best creature, e.g.
        //   "0) Best creature: 1  Moved: 2.5390905 Complex.: 14"
        var line = document.createElement("div");
        line.className = "statline";
        line.textContent = cycle + ") Best creature: " + idx + "  Moved: " + moved.toFixed(4) + "  Complex.: " + complexity;
        line.addEventListener("click", function () { viewStored(cycle); });
        var log = $("statLog");
        log.appendChild(line);
        while (log.childNodes.length > 600) log.removeChild(log.firstChild); // bound the DOM
        log.scrollTop = log.scrollHeight;
        setStatus(cycle);
        if ($("showGraph").checked) drawGraph();
      };
      setWatchCreature();
      $("evoStatus").textContent = "Evolution idle";
    }

    function setWatchCreature() {
      watchCreature = new M.Framework();
      watchCreature.mirror(run.frames[1]);
      watchCreature.doStart();
    }

    function generation() {
      if (!running) return;
      run.step();           // pickBestCreature + spawnCreatures + cycles++
      setWatchCreature();    // refresh the watched champion
      // status is updated from onStat (shows cycle / best / last improvement)
      setTimeout(generation, 0);
    }

    function setRunning(on) {
      running = on;
      $("evoStart").textContent = on ? "Stop" : "Start";
      $("storeSteps").disabled = on;
      if (on) {
        if (!run) fresh();
        run.storeSteps = $("storeSteps").checked;
        run.onLog("Starting run\n");
        setTimeout(generation, 0);
      } else if (run) {
        run.onLog("Run stopped\n");
        $("evoStatus").textContent = "Evolution paused at cycle " + run.cycles;
      }
    }

    function watchLoop() {
      if (!watching) return;
      if (watchCreature) {
        for (var i = 0; i < 2; i++) watchCreature.tick(C.tickAmt);
        // restart the little animation when it wanders too far
        if (Math.abs(watchCreature.distMoved()) > 6000) setWatchCreature();
        renderCreature(watchCtx, watchC.width, watchC.height, watchCreature, { follow: true, scale: 0.7 });
      }
      watchRaf = requestAnimationFrame(watchLoop);
    }

    function setWatching(on) {
      watching = on;
      $("evoWatch").textContent = on ? "Stop Watching" : "Watch";
      $("watchPanel").style.display = on ? "" : "none";
      if (on) { if (!run) fresh(); watchRaf = requestAnimationFrame(watchLoop); }
      else if (watchRaf) { cancelAnimationFrame(watchRaf); watchRaf = null; }
    }

    function drawGraph() {
      var W = graphC.width, H = graphC.height;
      graphCtx.clearRect(0, 0, W, H); graphCtx.fillStyle = "#fff"; graphCtx.fillRect(0, 0, W, H);
      if (history.length < 2) return;
      var maxMoved = 1, maxCx = 1, maxCycle = history[history.length - 1].cycle || 1;
      history.forEach(function (h) { maxMoved = Math.max(maxMoved, h.moved); maxCx = Math.max(maxCx, h.complexity); });
      function gx(c) { return 30 + (c / maxCycle) * (W - 45); }
      // axes ticks
      graphCtx.strokeStyle = "#ddd";
      for (var t = 0; t <= maxCycle; t += 5) { var x = gx(t); graphCtx.beginPath(); graphCtx.moveTo(x, H); graphCtx.lineTo(x, H - (t % 25 === 0 ? 12 : 6)); graphCtx.stroke(); }
      // displacement (black)
      graphCtx.strokeStyle = "#000"; graphCtx.beginPath();
      history.forEach(function (h, i) { var x = gx(h.cycle), y = H - 14 - (h.moved / maxMoved) * (H - 28); if (i === 0) graphCtx.moveTo(x, y); else graphCtx.lineTo(x, y); });
      graphCtx.stroke();
      // complexity (blue)
      graphCtx.strokeStyle = "#0000ff"; graphCtx.beginPath();
      history.forEach(function (h, i) { var x = gx(h.cycle), y = H - 14 - (h.complexity / maxCx) * (H - 28); if (i === 0) graphCtx.moveTo(x, y); else graphCtx.lineTo(x, y); });
      graphCtx.stroke();
      graphCtx.font = "10px Geneva"; graphCtx.fillStyle = "#000";
      graphCtx.fillText("Displacement", W - 90, 14);
      graphCtx.fillStyle = "#0000ff"; graphCtx.fillText("Complexity", W - 90, 28);
    }

    function viewStored(cycle) {
      if (!run) return;
      var idx = cycle + 1; // storage is appended once per cycle (1-based, [0]=null)
      if (run.storeSteps && run.storage[idx]) {
        Display.open(); Display.setRunning(false); Display.loadFramework(run.storage[idx]); Display.setRunning(true);
      } else {
        alert("Enable “Store Steps in RAM” before running to inspect individual cycles.");
      }
    }

    function viewBest() {
      if (!run) { fresh(); }
      var which = $("viewIndex").value.trim();
      if (which === "" || which.toLowerCase() === "best") {
        Display.open(); Display.setRunning(false); Display.loadFramework(run.frames[1]); Display.setRunning(true);
      } else {
        viewStored(parseInt(which, 10));
      }
    }

    // Start over from the default creature. The original had no Reset button --
    // you reopened the evolution window (Windows menu), which rebuilt the box in
    // MainWindow.Open. This does the same: stop, discard the run, and rebuild the
    // default creature with a cleared log, graph and history.
    function resetRun() {
      setRunning(false);
      fresh();                 // new run from M.defaultCreature(), logs cleared
      drawGraph();             // clears the graph canvas (history is empty)
      $("evoStatus").textContent = "Evolution reset — idle";
    }

    function init() {
      $("evoStart").addEventListener("click", function () { setRunning(!running); });
      $("evoWatch").addEventListener("click", function () { setWatching(!watching); });
      $("evoReset").addEventListener("click", resetRun);
      $("evoView").addEventListener("click", viewBest);
      $("showGraph").addEventListener("change", function () {
        $("graphPanel").style.display = this.checked ? "" : "none";
        if (this.checked) drawGraph();
      });
      $("storeSteps").addEventListener("change", function () { if (run) run.storeSteps = this.checked; });
    }

    return { init: init, open: function () { openWindow("evoWin"); if (!run) fresh(); } };
  })();

  // ----------------------------------------------------------- bootstrap
  $("btnViewCreatures").addEventListener("click", function () { Display.open(); });
  $("btnLaunchEvo").addEventListener("click", function () { Evolution.open(); });

  Display.init();
  Evolution.init();

  // On launch, show the Creature Display with "gallop [evolved]" (the first
  // preset) loaded and already simulating.
  Display.open();
  Display.setRunning(true);
})();
