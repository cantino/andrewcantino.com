process.env.NODE_PATH = require("child_process").execSync("npm root -g").toString().trim();
require("module")._initPaths();
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1040, height: 760 } });
  const url = "file://" + path.join(__dirname, "index.html");
  await page.goto(url);
  await page.waitForTimeout(400);

  // Intro on its own (the display auto-opens, so hide it for this shot).
  await page.evaluate(() => { document.getElementById("displayWin").style.display = "none"; });
  await page.screenshot({ path: "shot-intro.png" });

  // Creature Display, gallop already loaded + running on launch.
  await page.evaluate(() => {
    const w = document.getElementById("displayWin");
    w.style.display = ""; w.style.left = "30px"; w.style.top = "60px"; w.style.zIndex = 9999;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shot-display.png" });

  // Evolution window, laid out like the original Picture 6: the cycle list on
  // the right, the verbose mutation log along the bottom (no graph/watch).
  await page.evaluate(() => { document.getElementById("displayWin").style.display = "none"; });
  await page.click("#btnLaunchEvo");
  await page.evaluate(() => { const w = document.getElementById("evoWin"); w.style.left = "20px"; w.style.top = "40px"; });
  await page.check("#storeSteps");
  await page.click("#evoStart");
  await page.waitForTimeout(3500);
  await page.click("#evoStart");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "shot-evolution.png" });

  // A second shot showing the port's extra graph + live "watch" panels.
  await page.check("#showGraph");
  await page.click("#evoWatch");
  await page.click("#evoStart");
  await page.waitForTimeout(2500);
  await page.click("#evoStart");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "shot-evolution-graph.png" });

  await browser.close();
})();
