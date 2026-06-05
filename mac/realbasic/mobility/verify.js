process.env.NODE_PATH = require("child_process").execSync("npm root -g").toString().trim();
require("module")._initPaths();
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("file://" + path.join(__dirname, "index.html"));
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => ({
    topbarLink: (document.querySelector("#topbar a") || {}).textContent,
    href: (document.querySelector("#topbar a") || {}).href,
    menubarGone: !document.getElementById("menubar"),
    displayVisible: getComputedStyle(document.getElementById("displayWin")).display !== "none",
    firstOption: document.querySelector("#creatureSelect option").textContent,
    selectValue: document.getElementById("creatureSelect").value,
    runBtn: document.getElementById("runBtn").textContent,
    footer: document.querySelector("#introWin .hint").textContent.replace(/\s+/g, " ").trim(),
    options: [...document.querySelectorAll("#creatureSelect option")].map(o => o.textContent),
  }));
  console.log(JSON.stringify(state, null, 2));
  // confirm it's animating
  function h(id){return page.evaluate(id=>{const c=document.getElementById(id);const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let x=0;for(let i=0;i<d.length;i+=97)x=(x*31+d[i])>>>0;return x;},id);}
  const a = await h("outputCanvas"); await page.waitForTimeout(500); const b = await h("outputCanvas");
  console.log("display animating:", a !== b);
  await page.screenshot({ path: "shot-launch.png" });
  console.log("ERRORS:", errors.length ? errors : "none");
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
