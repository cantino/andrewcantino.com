// Capture screenshots of the 1999 speciation simulator.
const { launch, fileUrl } = require("../shared/test/playwright-helpers");

(async () => {
  const { browser, page } = await launch({ viewport: { width: 1040, height: 720 } });
  await page.goto(fileUrl(__dirname, "index.html"));
  await page.waitForTimeout(300);

  // Intro window.
  await page.screenshot({ path: "shot-intro.png" });

  // Open the simulator, load a two-species run, position windows, snapshot.
  await page.click("#btnLaunch");
  await page.evaluate(() => {
    const m = document.getElementById("mainWin"); m.style.left = "20px"; m.style.top = "70px";
    const g = document.getElementById("graphsWin"); g.style.left = "360px"; g.style.top = "60px";
  });
  await page.selectOption("#runSelect", "1");
  await page.check('.hl[data-fn="caneatseedlarge"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: "shot-main.png" });

  // Speciation check window + options.
  await page.click("#openSpeci");
  await page.click("#speciCheckBtn");
  await page.evaluate(() => {
    const s = document.getElementById("speciWin"); s.style.left = "360px"; s.style.top = "360px";
    const o = document.getElementById("optionsWin"); o.style.left = "470px"; o.style.top = "120px";
  });
  await page.click("#openOptions");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "shot-options.png" });

  // Per-tab snapshots of the Options dialog (for fidelity checking).
  const tabs = [["tabFood", "shot-opt-food.png"],
                ["tabMating", "shot-opt-mating.png"],
                ["tabSpeci", "shot-opt-speci.png"]];
  for (const [pane, file] of tabs) {
    await page.click(`#optTabs .tab[data-tab="${pane}"]`);
    await page.waitForTimeout(120);
    await page.screenshot({ path: file });
  }

  await browser.close();
})();
