// Headless engine sanity + behaviour harness for the 1999 speciation sim.
const SSS = require("./engine.js");
const fs = require("fs");

// A small seeded RNG so runs are reproducible across machines.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function beakStats(sim) {
  let minL = Infinity, maxL = -Infinity, minW = Infinity, maxW = -Infinity,
      minC = Infinity, maxC = -Infinity, nan = false;
  for (const b of sim.birds) {
    if (!isFinite(b.length) || !isFinite(b.width) || !isFinite(b.curve)) nan = true;
    minL = Math.min(minL, b.length); maxL = Math.max(maxL, b.length);
    minW = Math.min(minW, b.width);  maxW = Math.max(maxW, b.width);
    minC = Math.min(minC, b.curve);  maxC = Math.max(maxC, b.curve);
  }
  return { minL, maxL, minW, maxW, minC, maxC, nan };
}

function run(label, matemode, years, seed) {
  const sim = new SSS.Sim({ rng: mulberry32(seed), prefs: { matemode } });
  sim.startup();
  let extinct = -1;
  for (let y = 0; y < years; y++) {
    sim.mainloop();
    if (sim.total() === 0) { extinct = y; break; }
  }
  const s = beakStats(sim);
  console.log(
    `${label.padEnd(26)} yrs=${String(sim.year).padStart(4)} birds=${String(sim.total()).padStart(4)} ` +
    `L[${s.minL.toFixed(1)},${s.maxL.toFixed(1)}] W[${s.minW.toFixed(1)},${s.maxW.toFixed(1)}] ` +
    `C[${s.minC.toFixed(1)},${s.maxC.toFixed(1)}] NaN=${s.nan}` +
    (extinct >= 0 ? `  (extinct @ ${extinct})` : "")
  );
  return sim;
}

console.log("=== Founder population: starts with exactly 2 birds ===");
{
  const sim = new SSS.Sim().startup();
  console.log("initial birds:", sim.total(),
    "beak:", sim.birds[0].length, sim.birds[0].width, sim.birds[0].curve,
    "sexes:", sim.birds[0].sex, sim.birds[1].sex);
}

console.log("\n=== Evolution under each mating mode (100 yrs, seeded) ===");
run("random mating",      1, 100, 12345);
run("assortative mating", 2, 100, 12345);
run("semi-random mating", 3, 100, 12345);

console.log("\n=== Beak traits always clamped to [0,5] over a long run ===");
{
  const sim = run("random, 300 yrs", 1, 300, 999);
  const s = beakStats(sim);
  const ok = s.minL >= 0 && s.maxL <= 5 && s.minW >= 0 && s.maxW <= 5 && s.minC >= 0 && s.maxC <= 5;
  console.log("clamped to [0,5]:", ok);
}

console.log("\n=== Speciation detector on a real two-species saved run ===");
{
  const txt = fs.readFileSync(__dirname + "/examples/two-species.txt", "utf8");
  const sim = new SSS.Sim().load(txt);
  console.log("loaded", sim.total(), "birds, year", sim.year);
  console.log("speci_check() reports two clusters:", sim.speci_check(120, 120));
}
{
  const sim = new SSS.Sim().startup();
  console.log("founder (1 cluster) speci_check():", sim.speci_check(120, 120));
}

console.log("\n=== Round-trip save / load ===");
{
  const sim = new SSS.Sim({ rng: mulberry32(7) }).startup();
  for (let i = 0; i < 30; i++) sim.mainloop();
  const txt = sim.save();
  const sim2 = new SSS.Sim().load(txt);
  console.log("birds", sim.total(), "->", sim2.total(), "year", sim.year, "->", sim2.year,
    "match:", sim.total() === sim2.total() && sim.year === sim2.year);
}
