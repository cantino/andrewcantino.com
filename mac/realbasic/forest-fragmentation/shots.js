// Capture screenshots of the 2000 species-extinction simulator.
const { launch, fileUrl } = require("../shared/test/playwright-helpers");

(async () => {
  const { browser, page } = await launch({ viewport: { width: 1000, height: 740 } });
  await page.goto(fileUrl(__dirname, "index.html"));
  await page.waitForTimeout(300);

  await page.screenshot({ path: "shot-intro.png" });

  await page.click("#btnLaunch");
  // Lay the windows out like the original ui-overview.png.
  await page.evaluate(() => {
    const pos = (id, l, t) => { const w = document.getElementById(id); w.style.left = l + "px"; w.style.top = t + "px"; };
    pos("settingsWin", 20, 50);
    pos("graphWin", 660, 50);
    pos("experWin", 20, 300);
    pos("displayWin", 300, 250);
    document.getElementById("settingsWin").style.zIndex = 50;
    document.getElementById("graphWin").style.zIndex = 50;
  });
  // Run the intact (un-fragmented) default world -> grayscale density, like
  // the original screenshot.
  await page.click("#goBtn");
  await page.waitForTimeout(2200);
  await page.click("#stopBtn");
  await page.waitForTimeout(150);
  await page.screenshot({ path: "shot-display.png" });

  // A second shot showing fragmentation: load the 30% scenario (solid walls
  // render green / passable-hurting render blue -- faithful to the RB source).
  await page.click('#optTabs .tab[data-tab="ffFiles"]');
  await page.selectOption("#scenarioSelect", "1");
  await page.click("#grid", { position: { x: 200, y: 150 } });
  await page.evaluate(() => {
    const i = document.getElementById("infoWin"); i.style.left = "20px"; i.style.top = "470px";
    document.getElementById("settingsWin").style.zIndex = 50;
  });
  await page.click('#optTabs .tab[data-tab="ffGeneral"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: "shot-frag.png" });

  await browser.close();
})();
