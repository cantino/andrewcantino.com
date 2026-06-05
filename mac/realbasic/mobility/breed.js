// Curate a varied, good-looking example set across behaviour categories.
const fs = require("fs");
const path = require("path");
const M = require("./engine.js");
const { EvolutionRun } = require("./evolution.js");

function analyze(fw) {
  const c = new M.Framework(); c.mirror(fw); c.doStart();
  let maxY = -1e9, minY = 1e9, maxSpeed = 0, nan = false;
  const path0 = c.centerOfGravityX();
  for (let t = 0; t < M.CONST.numberOfCycles; t++) {
    c.tick(M.CONST.tickAmt);
    for (let a = 1; a < c.joints.length; a++) {
      const j = c.joints[a];
      if (!isFinite(j.x) || !isFinite(j.y)) nan = true;
      maxY = Math.max(maxY, j.y); minY = Math.min(minY, j.y);
      maxSpeed = Math.max(maxSpeed, j.velocity.mag);
    }
  }
  return { moved: c.distMoved(), maxY, maxSpeed, nan, joints: M.ub(c.joints), springs: M.ub(c.springs),
           muscles: (()=>{let m=0;for(let s=1;s<c.springs.length;s++)if(c.springs[s].wavePosition>-1)m++;return m;})() };
}
function seedRng(seed){let s=seed;Math.random=function(){s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};}

const buckets = {
  crawler:  { test: a => a.maxY < 115 && a.maxSpeed < 55, best: null },
  walker:   { test: a => a.maxY < 160 && a.maxSpeed >= 55 && a.maxSpeed < 90, best: null },
  hopper:   { test: a => a.maxY >= 160 && a.maxY < 260 && a.maxSpeed < 130, best: null },
  galloper: { test: a => a.maxY < 150 && a.maxSpeed >= 90 && a.maxSpeed < 130, best: null },
};

for (let seed = 1; seed <= 60; seed++) {
  seedRng(seed * 2654435761 % 2147483647 + 11);
  const run = new EvolutionRun();
  for (let g = 0; g < 90; g++) {
    run.pickBestCreature();
    const champ = run.frames[1];
    const a = analyze(champ);
    if (!a.nan && a.moved > 20 && a.moved < 3000 && a.joints >= 3 && a.muscles >= 1) {
      for (const k in buckets) {
        if (buckets[k].test(a) && (!buckets[k].best || a.moved > buckets[k].best.a.moved)) {
          buckets[k].best = { a, txt: M.saveFramework(champ), seed, gen: g };
        }
      }
    }
    run.spawnCreatures();
    run.cycles++;
  }
}

for (const k in buckets) {
  const b = buckets[k].best;
  if (b) console.log(`${k.padEnd(9)} moved=${b.a.moved.toFixed(1)} maxY=${b.a.maxY.toFixed(0)} maxSpeed=${b.a.maxSpeed.toFixed(1)} J=${b.a.joints} S=${b.a.springs} M=${b.a.muscles}  (seed ${b.seed} gen ${b.gen})`);
  else console.log(`${k.padEnd(9)} (none)`);
}

if (process.argv[2] === "save") {
  for (const k in buckets) {
    const b = buckets[k].best;
    if (b) { fs.writeFileSync(path.join(__dirname, "examples", "evolved-" + k + ".txt"), b.txt + "\n"); console.log("saved evolved-" + k); }
  }
}
