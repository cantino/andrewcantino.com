/*
 * windowing.js -- reusable classic-Mac window behaviour for RB ports.
 *
 * Markup contract (works with retro-mac.css):
 *
 *   <div class="window" id="fooWin" style="left:60px; top:50px; width:640px;">
 *     <div class="titlebar">
 *       <div class="close" data-close="fooWin"></div>
 *       <div class="title">Foo</div>
 *       <div class="zoom"></div>
 *     </div>
 *     <div class="body"> ... </div>
 *   </div>
 *
 * Tabbed dialogs (RB TabPanel) use this markup inside a window body:
 *
 *   <div class="tabview">
 *     <div class="tabbar">
 *       <button class="tab active" data-tab="paneA">General</button>
 *       <button class="tab"        data-tab="paneB">Advanced</button>
 *     </div>
 *     <div class="tabpanes">
 *       <div class="tabpane active" id="paneA"> ... </div>
 *       <div class="tabpane"        id="paneB"> ... </div>
 *     </div>
 *   </div>
 *
 * Behaviour added:
 *   - drag windows by their title bar (clamped to stay under the top bar)
 *   - clicking a window raises it (z-order)
 *   - clicking a [data-close] box hides that window
 *   - clicking a .tab[data-tab] shows the matching .tabpane in its .tabview
 *
 * Auto-initialises on DOMContentLoaded. Also exposes window.MacWindows with
 *   open(id)  -> show + raise a window
 *   close(id) -> hide a window
 *   init(root) -> (re)wire windows under an optional root element
 */
(function (root) {
  "use strict";
  var z = 10;

  function wire(win) {
    if (win._macWired) return;
    win._macWired = true;
    win.addEventListener("mousedown", function () { win.style.zIndex = ++z; });

    var bar = win.querySelector(".titlebar");
    if (!bar) return;
    var drag = null;
    bar.addEventListener("mousedown", function (e) {
      if (e.target.classList.contains("close")) return;
      drag = {
        x: e.clientX, y: e.clientY,
        left: parseInt(win.style.left, 10) || win.offsetLeft,
        top: parseInt(win.style.top, 10) || win.offsetTop
      };
      e.preventDefault();
    });
    document.addEventListener("mousemove", function (e) {
      if (!drag) return;
      win.style.left = (drag.left + e.clientX - drag.x) + "px";
      win.style.top = Math.max(0, drag.top + e.clientY - drag.y) + "px";
    });
    document.addEventListener("mouseup", function () { drag = null; });
  }

  function init(rootEl) {
    var scope = rootEl || document;
    scope.querySelectorAll(".window").forEach(wire);
    scope.querySelectorAll("[data-close]").forEach(function (c) {
      if (c._macClose) return;
      c._macClose = true;
      c.addEventListener("click", function () {
        var t = document.getElementById(c.getAttribute("data-close"));
        if (t) t.style.display = "none";
      });
    });
    // tab controls: a .tab[data-tab] selects the matching .tabpane in its .tabview
    scope.querySelectorAll(".tab[data-tab]").forEach(function (tab) {
      if (tab._macTab) return;
      tab._macTab = true;
      tab.addEventListener("click", function () {
        var view = tab.closest(".tabview");
        if (!view) return;
        view.querySelectorAll(".tabbar .tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        view.querySelectorAll(".tabpane").forEach(function (p) { p.classList.remove("active"); });
        var pane = view.querySelector("#" + tab.getAttribute("data-tab"));
        if (pane) pane.classList.add("active");
      });
    });
  }

  function open(id) {
    var w = document.getElementById(id);
    if (!w) return null;
    w.style.display = "";
    w.style.zIndex = ++z;
    return w;
  }
  function close(id) {
    var w = document.getElementById(id);
    if (w) w.style.display = "none";
  }

  var API = { init: init, open: open, close: close };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else {
    root.MacWindows = API;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); });
    else init();
  }
})(typeof window !== "undefined" ? window : this);
