// Headless browser smoke test for the 1999 speciation simulator.
const { launch, fileUrl, hashCanvas } = require("../shared/test/playwright-helpers");

(async () => {
  const { browser, page, errors } = await launch();
  await page.goto(fileUrl(__dirname, "index.html"));
  await page.waitForTimeout(200);

  const ready = await page.evaluate(() => ({
    sss: !!window.SSS,
    runs: (window.SSS_RUNS || []).length,
    options: document.querySelectorAll("#runSelect option").length
  }));
  console.log("ready:", JSON.stringify(ready));

  await page.click("#btnLaunch");
  const visible = await page.evaluate(() => ({
    main: getComputedStyle(document.getElementById("mainWin")).display !== "none",
    graphs: getComputedStyle(document.getElementById("graphsWin")).display !== "none"
  }));
  console.log("windows open:", JSON.stringify(visible));

  // Run the simulation; graphs should animate and the year should advance.
  const g1a = await hashCanvas(page, "g1");
  await page.click("#goBtn");
  await page.waitForTimeout(1200);
  await page.click("#stopBtn");
  const g1b = await hashCanvas(page, "g1");
  const yr = await page.textContent("#years");
  const birds = await page.textContent("#totbirds");
  console.log("graphs animated:", g1a !== g1b, "year:", yr.trim(), "birds:", birds.trim());

  // Highlight toggling redraws without errors.
  await page.check('.hl[data-fn="caneatseedlarge"]');
  await page.waitForTimeout(100);

  // Load a saved two-species run and check the speciation detector.
  await page.selectOption("#runSelect", "1"); // first saved run
  await page.waitForTimeout(100);
  await page.click("#openSpeci");
  await page.click("#speciCheckBtn");
  const speci = await page.textContent("#speciStatus");
  console.log("loaded run speciation status:", speci.trim());

  // Options apply (switch to the Mating Settings tab, pick semi-random mating).
  await page.click("#openOptions");
  await page.click('#optTabs .tab[data-tab="tabMating"]');
  await page.check('input[name="matemode"][value="3"]');
  await page.click("#optApply");
  const status = await page.textContent("#status");
  console.log("options status:", status.trim());

  console.log("\nERRORS:", errors.length ? errors : "none");
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
