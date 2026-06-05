/*
 * playwright-helpers.js -- headless browser test helpers for RB web ports.
 *
 * Playwright is installed GLOBALLY in this environment, so we point NODE_PATH at
 * the global modules dir before requiring it. Import this module first.
 *
 *   const { launch, hashCanvas, fileUrl } = require("../../shared/test/playwright-helpers");
 *   (async () => {
 *     const { browser, page, errors } = await launch();
 *     await page.goto(fileUrl(__dirname, "../index.html"));
 *     // ... assertions ...
 *     await browser.close();
 *     process.exit(errors.length ? 1 : 0);
 *   })();
 *
 * `errors` collects console.error + pageerror messages so a smoke test can fail
 * if the app logged anything. `hashCanvas` lets you assert a <canvas> is
 * actually animating (its pixel hash changes between frames).
 */
const { execSync } = require("child_process");
process.env.NODE_PATH = execSync("npm root -g").toString().trim();
require("module")._initPaths();
const { chromium } = require("playwright");
const path = require("path");

async function launch(opts) {
  opts = opts || {};
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: opts.viewport || { width: 1040, height: 760 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  return { browser, page, errors };
}

function fileUrl(dir, rel) {
  return "file://" + path.resolve(dir, rel);
}

// Cheap perceptual hash of a canvas's pixels; compare across a delay to confirm
// the canvas is animating.
function hashCanvas(page, id) {
  return page.evaluate((id) => {
    const c = document.getElementById(id);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0;
    return h;
  }, id);
}

module.exports = { launch, fileUrl, hashCanvas };
