// Headless browser smoke test for the 2000 species-extinction simulator.
const { launch, fileUrl, hashCanvas } = require("../shared/test/playwright-helpers");

(async () => {
  const { browser, page, errors } = await launch();
  await page.goto(fileUrl(__dirname, "index.html"));
  await page.waitForTimeout(200);

  const ready = await page.evaluate(() => ({
    frag: !!window.Frag,
    scenarios: (window.FRAG_SCENARIOS || []).length,
    options: document.querySelectorAll("#scenarioSelect option").length
  }));
  console.log("ready:", JSON.stringify(ready));

  await page.click("#btnLaunch");
  // Raise the Options window so its tabs aren't under the Display window.
  await page.evaluate(() => { document.getElementById("settingsWin").style.zIndex = 999; });
  const visible = await page.evaluate(() => ({
    display: getComputedStyle(document.getElementById("displayWin")).display !== "none",
    settings: getComputedStyle(document.getElementById("settingsWin")).display !== "none"
  }));
  console.log("windows open:", JSON.stringify(visible));

  // Run the intact-habitat default; grid + graph should animate, pop should grow.
  const g0 = await hashCanvas(page, "grid");
  await page.click("#goBtn");
  await page.waitForTimeout(1200);
  await page.click("#stopBtn");
  const g1 = await hashCanvas(page, "grid");
  const yr = parseInt(await page.textContent("#yrs"), 10);
  const tot = await page.textContent("#totLabel");
  console.log("grid animated:", g0 !== g1, "year:", yr, tot.trim());

  // Load the 60% fragmentation scenario and confirm walls were placed.
  await page.click('#optTabs .tab[data-tab="ffFiles"]');
  await page.selectOption("#scenarioSelect", "2");
  await page.waitForTimeout(100);
  const walls = await page.evaluate(() => {
    // count non-habitat cells via the engine
    const ev = window;
    let n = 0; const w = document.defaultView;
    return n; // placeholder; recomputed below
  });
  const wallCount = await page.evaluate(() => {
    // reach into the running sim through a known global is not exposed; instead
    // sample the grid canvas for green/blue pixels.
    const c = document.getElementById("grid");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let green = 0, blue = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === 0 && d[i + 1] === 255 && d[i + 2] === 0) green++;
      if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 255) blue++;
    }
    return { green, blue };
  });
  console.log("fragmented scenario wall pixels:", JSON.stringify(wallCount), "(green=solid walls present:", wallCount.green > 0, ")");

  // Drop the Options window back below the Display window so it no longer
  // covers the grid (it was raised earlier to reach the Files tab).
  await page.evaluate(() => { document.getElementById("settingsWin").style.zIndex = 1; });

  // Click a cell -> info window populates.
  await page.click("#grid", { position: { x: 30, y: 30 } });
  const info = await page.textContent("#infoOut");
  console.log("cell info first line:", info.split("\n")[0]);

  // Run the fragmented scenario a while; the graph should render a line.
  await page.click("#goBtn");
  await page.waitForTimeout(1000);
  await page.click("#stopBtn");
  const grHash1 = await hashCanvas(page, "graph");
  await page.waitForTimeout(50);
  console.log("graph drawn (non-empty hash):", grHash1 !== 0);

  console.log("\nERRORS:", errors.length ? errors : "none");
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
