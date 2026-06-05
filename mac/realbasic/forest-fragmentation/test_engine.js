// Headless engine harness for the 2000 species-extinction / fragmentation sim.
const Frag = require("./engine.js");

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runYears(sim, n) {
  for (let i = 0; i < n; i++) sim.do_tick();
  return sim.get_total();
}

console.log("=== Intact habitat settles near carrying capacity ===");
{
  const sim = new Frag.Sim({ size: 10, rng: mulberry32(1) });
  const start = sim.get_total();
  const after = runYears(sim, 150);
  const cap = sim.w.get_total_capacity();
  console.log(`start total=${start.toFixed(0)}  after 150yr=${after.toFixed(0)}  capacity=${cap.toFixed(0)}`);
  console.log("population persisted:", after > 0, " near/under capacity:", after <= cap * 1.05);
}

console.log("\n=== Fragmentation reduces the surviving population ===");
{
  const totals = {};
  for (const frag of [0, 30, 60, 90]) {
    const sim = new Frag.Sim({ size: 12, rng: mulberry32(42), settings: { frag } });
    sim.do_frag();
    totals[frag] = runYears(sim, 150);
    const walls = (() => { let n = 0; for (let a = 1; a <= 12; a++) for (let b = 1; b <= 12; b++) if (sim.w.p[a][b].wall_mode > 0) n++; return n; })();
    console.log(`frag=${String(frag).padStart(2)}%  walls=${String(walls).padStart(3)}  total@150=${totals[frag].toFixed(0)}`);
  }
  console.log("more fragmentation -> fewer animals:",
    totals[0] >= totals[30] && totals[30] >= totals[60] && totals[60] >= totals[90]);
}

console.log("\n=== Random mortality events depress the population ===");
{
  const calm = new Frag.Sim({ size: 12, rng: mulberry32(7) });
  const chaos = new Frag.Sim({ size: 12, rng: mulberry32(7), settings: { rhalf: true, prob: 50 } });
  const c1 = runYears(calm, 150), c2 = runYears(chaos, 150);
  console.log(`no events=${c1.toFixed(0)}  frequent events=${c2.toFixed(0)}`);
  console.log("random events hurt:", c2 < c1);
}

console.log("\n=== Walls erode their neighbours' habitat quality (d1/d2) ===");
{
  const sim = new Frag.Sim({ size: 5, rng: mulberry32(3) });
  const before = { d1: sim.w.p[2][3].d1, d2: sim.w.p[2][3].d2 };
  sim.add_wall(3, 3, 2);          // wall at (3,3); (2,3) is a neighbour
  const after = { d1: sim.w.p[2][3].d1, d2: sim.w.p[2][3].d2 };
  sim.rem_wall(3, 3);             // removing it should restore the neighbour
  const restored = { d1: sim.w.p[2][3].d1, d2: sim.w.p[2][3].d2 };
  console.log("neighbour d1:", before.d1.toFixed(3), "->", after.d1.toFixed(3), "->", restored.d1.toFixed(3));
  console.log("penalty applied & reversible:",
    Math.abs(after.d1 - (before.d1 - sim.s.wall_d1)) < 1e-9 &&
    Math.abs(restored.d1 - before.d1) < 1e-9);
}

console.log("\n=== Round-trip save / load ===");
{
  const sim = new Frag.Sim({ size: 8, rng: mulberry32(9), settings: { frag: 25 } });
  sim.do_frag();
  runYears(sim, 20);
  const txt = sim.save();
  const sim2 = new Frag.Sim().load(txt);
  console.log("size", sim.w.size, "->", sim2.w.size, "year", sim.year, "->", sim2.year,
    "total", sim.get_total().toFixed(2), "->", sim2.get_total().toFixed(2),
    "match:", sim.w.size === sim2.w.size && Math.abs(sim.get_total() - sim2.get_total()) < 1e-6);
}
