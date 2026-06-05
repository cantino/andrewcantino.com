// Validates the shared UI kit (retro-mac.css + windowing.js) via the demo page.
const { launch, fileUrl, hashCanvas } = require("./playwright-helpers");

(async () => {
  const { browser, page, errors } = await launch();
  await page.goto(fileUrl(__dirname, "../demo.html"));
  await page.waitForTimeout(300);

  // canvas animates
  const a = await hashCanvas(page, "c");
  await page.waitForTimeout(300);
  const b = await hashCanvas(page, "c");
  console.log("canvas animating:", a !== b);

  // close box hides a window
  await page.click("[data-close=win2]");
  const win2Hidden = await page.evaluate(() => getComputedStyle(document.getElementById("win2")).display === "none");
  console.log("close box hides window:", win2Hidden);

  // dragging the title bar moves the window
  const before = await page.evaluate(() => document.getElementById("win1").style.left);
  const bar = await page.$("#win1 .titlebar");
  const box = await bar.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 9);
  await page.mouse.down();
  await page.mouse.move(box.x + 140, box.y + 39, { steps: 5 });
  await page.mouse.up();
  const after = await page.evaluate(() => document.getElementById("win1").style.left);
  console.log("drag moves window:", before, "->", after, before !== after);

  console.log("ERRORS:", errors.length ? errors : "none");
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
