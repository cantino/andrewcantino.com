process.env.NODE_PATH = require("child_process").execSync("npm root -g").toString().trim();
require("module")._initPaths();
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
  page.on("pageerror", e => errors.push("pageerror: " + e.message));

  const url = "file://" + path.join(__dirname, "index.html");
  await page.goto(url);
  await page.waitForTimeout(300);

  // engine + data present
  const ready = await page.evaluate(() => ({
    mob: !!window.Mobility, evo: !!window.MobilityEvolution,
    creatures: (window.CREATURE_DATA || []).length,
    options: document.querySelectorAll("#creatureSelect option").length
  }));
  console.log("ready:", JSON.stringify(ready));

  // The creature display auto-opens and runs gallop on launch; confirm that,
  // then switch to another creature and keep it running.
  const launch = await page.evaluate(() => ({
    visible: getComputedStyle(document.getElementById("displayWin")).display !== "none",
    running: document.getElementById("runBtn").textContent,
    first: document.querySelector("#creatureSelect option").textContent
  }));
  console.log("auto-launch:", JSON.stringify(launch));
  await page.selectOption("#creatureSelect", "2"); // Two leg walker
  await page.click("#runBtn");
  function hashCanvas(id) {
    return page.evaluate((id) => {
      const c = document.getElementById(id);
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; return h;
    }, id);
  }
  const h1 = await hashCanvas("outputCanvas");
  await page.waitForTimeout(500);
  const h2 = await hashCanvas("outputCanvas");
  console.log("creature animating (output hash changed):", h1 !== h2, h1, h2);
  const dispStats = await page.textContent("#dispStats");
  console.log("display stats:", dispStats.trim());
  await page.click("#runBtn"); // stop

  // Evolution: open, enable graph + store steps, run a bit, expect stat lines.
  await page.click("[data-close=displayWin]");
  await page.click("#btnLaunchEvo");
  await page.check("#showGraph");
  await page.check("#storeSteps");
  await page.click("#evoWatch");
  await page.click("#evoStart");
  await page.waitForTimeout(2500);
  await page.click("#evoStart"); // stop
  const evo = await page.evaluate(() => ({
    cycles: document.querySelectorAll("#statLog .statline").length,
    status: document.getElementById("evoStatus").textContent,
    lastStat: (document.querySelector("#statLog .statline:last-child") || {}).textContent || ""
  }));
  console.log("evolution cycles run:", evo.cycles);
  console.log("evo status:", evo.status);
  console.log("evo last stat:", evo.lastStat);

  // watch canvas animating?
  const w1 = await hashCanvas("watchCanvas");
  await page.waitForTimeout(400);
  const w2 = await hashCanvas("watchCanvas");
  console.log("watch animating:", w1 !== w2);

  // Click a stat line to view a stored creature
  if (evo.cycles > 1) {
    await page.click("#statLog .statline:nth-child(2)");
    await page.waitForTimeout(200);
    const dispVisible = await page.isVisible("#displayWin");
    console.log("clicking stat opened display:", dispVisible);
  }

  console.log("\nERRORS:", errors.length ? errors : "none");
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
