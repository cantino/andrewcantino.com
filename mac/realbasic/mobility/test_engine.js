// Headless physics sanity + tuning harness.
const M = require("./engine.js");

function stats(fw) {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, nan = false;
  for (let a = 1; a < fw.joints.length; a++) {
    const j = fw.joints[a];
    if (!isFinite(j.x) || !isFinite(j.y)) nan = true;
    minx = Math.min(minx, j.x); maxx = Math.max(maxx, j.x);
    miny = Math.min(miny, j.y); maxy = Math.max(maxy, j.y);
  }
  return { minx, maxx, miny, maxy, nan };
}

function run(label, fw, ticks) {
  for (let t = 0; t < ticks; t++) fw.tick(M.CONST.tickAmt);
  const s = stats(fw);
  console.log(
    `${label.padEnd(22)} moved=${fw.distMoved().toFixed(2).padStart(8)}  ` +
    `x[${s.minx.toFixed(0)},${s.maxx.toFixed(0)}] y[${s.miny.toFixed(0)},${s.maxy.toFixed(0)}]  ` +
    `NaN=${s.nan}`
  );
  return s;
}

console.log("=== Default box (no muscles): should settle, stay bounded ===");
run("default box", M.defaultCreature(), 600);

console.log("\n=== Box with a muscle on the bottom spring: should move ===");
function muscleBox() {
  const fw = M.defaultCreature();
  fw.springs[2].wavePosition = 50;   // bottom spring becomes a muscle
  fw.doStart();
  return fw;
}
run("muscle box", muscleBox(), 600);

console.log("\n=== Authentic evolved walkers (2000 ticks, as scored) ===");
["slow-walker-evolved", "two-leg-walker-evolved", "gallop-evolved", "runner-evolved"].forEach(function (n) {
  var txt = require("fs").readFileSync(__dirname + "/examples/" + n + ".txt", "utf8");
  run(n, M.loadFramework(txt), 2000);
});

console.log("\n=== Round-trip save/load ===");
const a = M.defaultCreature();
const b = M.loadFramework(M.saveFramework(a));
console.log("joints", a.joints.length, b.joints.length, "springs", a.springs.length, b.springs.length);
