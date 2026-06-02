/* =====================================================================
 *  The Cursed Puzzle  —  faithful web re-translation
 *  Original: Microsoft QuickBASIC for Macintosh, by Andrew Cantino (1996).
 *
 *  This is a line-by-line port of the recovered ASCII source
 *  (original/The_Cursed_Puzzle.source.bas.txt).  Routine numbers from the
 *  BASIC are noted in comments (e.g. "310" = movement sort).  All text,
 *  numbers, combat odds, item/piece placement, spell costs (including the
 *  original's quirks) and the leveling table are reproduced exactly.
 *
 *  The author's home mailing address / e-mail are redacted to match the
 *  emulator screenshots that were provided as the fidelity reference.
 * ===================================================================== */

/* ----------------------------- helpers ------------------------------- */
// BASIC: INT(n*RND+1)  ->  1..n
function R(n) { return Math.floor(n * Math.random()) + 1; }
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* --------------------------- game state ------------------------------ */
const S = {};
function resetState() {
  Object.assign(S, {
    pc: 1, namee: "Not-known", nameee: "Not-known",
    hit: 70, mxhit: 70, spelp: 30, level: 1, ex: 0, pqu: 0, coin: 0,
    sword: 0, rock: 0, stick: 0, key: 0, bag: 0, powder: 0,  // 0 none, 1 have, 2 sold/used
    spell: 0,            // bought a spell (enables 'light me')
    por: 0,              // portal room (0 none)
    blast: 0, blastt: 0, // rocks blasted ; piece@54 taken
    pasa: 0, pasaa: 0, pasaaa: 0, pasaaaa: 0, swim: 0, // pieces @31,35,43,49,27
    ml: 0,               // lit (stick or 'light me') — never cleared
    coinn: 0,            // ten coins @7 taken
    doorfind: 0,         // all 6 pieces found, must reach room 11
    wimpy: 0, codeenter: 0,
    killer: "", hitt: 0, pccc: 0,     // active monster (name, hp, room)
    mon: 0, monn: 0,                  // fixed monsters @32 (thing) / @39 (warg)
    killerr: 0, killerr_: "", killerrp: 0,            // dead monster on the ground
    killerrr: 0, killerrr_: "", killercount: 1,       // dead monster being carried
    gcoin: 0, gcoina: 0, pcc: 0,      // loose gold coins
    movestop: 0, grow: 0, ann: 0,
    playing: false, inModal: false, inFight: false,
  });
}

/* ----------------------------- output -------------------------------- */
function pcls() { $("textcol").innerHTML = ""; }
function P(s = "", cls = "") {            // PRINT into the text column (WINDOW 2)
  const d = document.createElement("div");
  d.className = "ln " + cls; d.textContent = s;
  $("textcol").appendChild(d); $("textcol").scrollTop = $("textcol").scrollHeight;
}

/* --------------------------- picture / status ------------------------ */
const DARK = [53,54,28,29,30,31,32,33,34,35,39,40,41,42,43];   // routine 6000/320
function picForRoom() {
  let id = S.pc;                                // getpicture ref%,pc
  if (S.blast === 1 && S.pc === 52) id = 55;    // blasted rocks
  if (DARK.includes(S.pc) && S.ml !== 1) id = 56; // "You can't see."
  return id;
}
function drawPic(id) { $("pic").src = "img/" + id + ".png"; }
function drawStatus() {                          // routine 4100
  $("statusfig").src = "img/" + (S.sword === 1 ? 107 : 106) + ".png";
  $("statustext").textContent =
    "Hit: " + S.hit + " / " + S.mxhit + "  Spell: " + S.spelp + " / " + (S.level * 40);
}

/* ============================ MAIN LOOP ============================== *
 * Routine 10 mostly handles passive regeneration on a 20-second timer.  */
let regenTimer = null;
function startRegen() {
  if (regenTimer) clearInterval(regenTimer);
  regenTimer = setInterval(() => {
    if (!S.playing || S.inModal || S.inFight) return;
    // line 16/17/18
    S.hit += 3; S.grow += 1; S.spelp += 5;
    if (S.hit > S.mxhit) S.hit = S.mxhit;
    if (S.grow === 30) { S.mxhit += 2; S.grow = 0; P("You grow a little."); }
    if (S.spelp > 40 * S.level) S.spelp = 40 * S.level;
    drawStatus();
  }, 20000);
}

/* ============================ ROOM DISPLAY ========================== *
 * Routines 320 + 330/340 : draw the room, spawn monsters, show items,
 * award fixed puzzle pieces, and start fixed-monster fights.            */
async function showRoom() {
  refreshMenus();                                // 320 enables Store etc.
  // ----- description (or darkness) -----
  let cannotsee = false;
  if (S.ml !== 1 && DARK.includes(S.pc)) cannotsee = true;
  if (cannotsee) {
    P("You can't see.");
  } else {
    const r = ROOMS[S.pc];
    P("");
    for (let i = 0; i < 8; i++) P(r.lines[i], "bold");
  }
  if (S.blast === 1 && S.pc === 52) { P("There is a dark"); P("hole in the rocks."); }
  drawPic(picForRoom());

  // ----- 330/340 : random encounters & contents -----
  let x = R(8);
  if (x === 2) {                                 // spawn a wandering monster
    x = R(10);
    if (S.killer !== "" && S.pccc === S.pc) P("The " + S.killer + " left.");
    S.pccc = S.pc;
    const T = {1:["ghoul",20],2:["skeleton",25],3:["ghost",10],4:["zorg",15],5:["wight",7],
               6:["troll",40],7:["wolf",15],8:["worg",20],9:["rat",5],10:["ork",10]};
    [S.killer, S.hitt] = T[x];
  }
  if (S.killer !== "" && S.pccc === S.pc) P("A " + S.killer + ".", "mon");
  if (S.killerr > 0 && S.killerrp === S.pc) { P("There is a dead "); P(S.killerr_ + " on the ground."); }

  x = R(20);
  if (x === 5) { x = R(10); S.gcoin = 1; S.gcoina = x; S.pcc = S.pc; }
  if (S.gcoin === 1 && S.pcc === S.pc) P("You see " + S.gcoina + " gold coins!");

  if (S.pc === 2 && S.por > 0) portalHere();
  if (S.por === S.pc) portalHere();

  if (S.sword === 0 && S.pc === 27) P("You see a old sword.");
  if (S.rock === 0 && S.pc === 14) P("You see a dirty rock.");
  if (S.coinn === 0 && S.pc === 7) P("You see ten gold coins!");
  if (S.stick === 0 && S.pc === 13) P("You see a dry stick!");
  if (S.key === 0 && S.pc === 3) P("You see a rusty key.");
  if (S.powder === 0 && S.pc === 23) P("You see some powder.");

  drawStatus();

  // fixed monsters (line 777/778) — immediate fight
  if (S.mon === 0 && S.pc === 32 && !(S.ann === 1)) { S.killer = "thing"; S.hitt = 22; await fight(); S.mon = 1; }
  if (S.monn === 0 && S.pc === 39) { S.killer = "warg"; S.hitt = 20; await fight(); S.monn = 1; }

  // fixed puzzle pieces (lines 780-784)
  if (S.pc === 31 && S.pasa === 0)    piece("pasa", 50);
  if (S.pc === 35 && S.pasaa === 0)   piece("pasaa", 50);
  if (S.pc === 43 && S.pasaaa === 0)  piece("pasaaa", 50);
  if (S.pc === 49 && S.pasaaaa === 0) piece("pasaaaa", 50);
  if (S.pc === 54 && S.blastt === 0)  piece("blastt", 100);

  if (S.ann === 1 && S.pc === 32) { /* arrived by jump: skip extras (line 786) */ }
  if (S.doorfind === 1 && S.pc === 11) { await won(); return; }

  checkLastPiece();
}
function portalHere() { P("There is a glowing"); P("portal here. (Select"); P("portal to enter it)."); }
function piece(flag, xp) {
  P("You get a piece", "yay"); P("of the puzzle!  Yay!", "yay");
  S[flag] = 1; S.pqu += 1; S.ex += xp; drawStatus();
}
function checkLastPiece() { if (S.pqu === 6 && S.doorfind === 0) lastPiece(); }

/* ============================ MOVEMENT ============================== *
 * Routines 300 (sort) and 310 (move).                                   */
function go(rr) {
  pcls();
  // 300: validate direction words
  const dirs = ["n","s","e","w","u","d","west","south","north","east","up","down"];
  if (rr === "down tree") { P("You climb down the old"); P("tree and look around."); }
  else if (rr === "look") { showRoom(); return; }
  else if (rr === "help") { helpScreen(); return; }
  else if (!dirs.includes(rr)) return;

  // 310
  if (S.pc === 38 && (rr === "n" || rr === "north")) { P("You fall off the cliff!"); S.killer = "cliff"; die(); return; }
  if (S.pc === 12 && rr === "down tree") { S.pc = 13; showRoom(); return; }
  const r = ROOMS[S.pc];
  const map = { n:r.n, north:r.n, e:r.e, east:r.e, s:r.s, south:r.s, w:r.w, west:r.w, u:r.u, up:r.u, d:r.d, down:r.d };
  const dest = map[rr] | 0;
  if (dest > 0) { S.pc = dest; showRoom(); return; }
  P("You can't go that way!", "warn");
}

/* ============================ SPELLS (552) ========================== */
async function cast(spell) {
  pcls();
  S.spell$ = spell;
  P("You start chanting.");
  await sleep(450);
  P("You finish the chant.");
  if (R(4) === 1) { P("You fumble your spell."); P("What a thing to do!"); S.spelp -= 5; drawStatus(); return; }

  if (spell === "telejump" && S.spelp >= 30) { S.spelp -= 30; S.pc = R(54); P("You chant 'grak zorny'"); P("You teleport...."); showRoom(); return; }
  if (spell === "telejump") { P("You don't have that"); P("many spell points."); return; }
  if (spell === "make portal" && S.spelp >= 25) { S.spelp -= 25; P("You chant 'portal make!' "); P("You now have a"); P("portal that will send"); P("you to town."); S.spelp -= 25; S.por = S.pc; S.ex += 20; drawStatus(); return; }
  if (spell === "make portal") { P("You do not have that"); P("many spell points."); return; }
  if (spell === "wind" && S.spelp >= 15 && S.level >= 2) { S.spelp -= 15; P("You try to fly and"); P("chant 'wwiinndd'"); P("There is a gust"); P("of wind!"); S.spelp -= 15; drawStatus(); return; }
  if (spell === "wind" && S.spelp < 15 && S.level >= 2) { P("You do not have that"); P("many spell points!"); return; }
  if (spell === "make gold" && S.spelp >= 30 && S.level >= 2) { S.spelp -= 30; P("You get a glow in"); P("your eyes and chant"); P("'asslis goild'"); P("You get 5 gold coins!"); S.coin += 5; drawStatus(); return; }
  if (spell === "make gold" && S.spelp < 30 && S.level >= 2) { P("You do not have that"); P("many spell points!"); return; }
  if (spell === "heal me" && S.spelp >= 40 && S.level >= 3) { S.spelp -= 40; P("You jump up and down"); P("and chant 'higris mor'!"); P("You get back 10"); P("hit points!"); S.hit += 10; drawStatus(); return; }
  if (spell === "heal me" && S.spelp < 40 && S.level >= 3) { P("You do not have that"); P("many spell points!"); return; }
  if (spell === "fireball" && S.spelp >= 45 && S.level >= 3) { P("You chant 'goris magis'"); P("A fileball shoots"); P("at the " + S.killer + "."); S.spelp -= 45; S.hitt -= 10; S.ex += 220; drawStatus(); return; }
  if (spell === "fireball" && S.spelp < 45 && S.level >= 3) { P("You do not have that"); P("many spell points!"); return; }
  if (S.spell === 1) {  // 558
    if (spell === "light me" && S.spelp >= 15) { S.ml = 1; S.spelp -= 15; P("You chant 'ful'"); P("You now give off a"); P("glowing light."); drawStatus(); return; }
    if (spell === "light me" && S.spelp < 15) { P("You do not have that"); P("many spell points."); return; }
  }
  P("You do not have", "warn"); P("that spell.", "warn");   // 555
}

/* ============================ USE / LIGHT / GET / DROP =============== */
function useThing(rrr) {              // 573
  pcls();
  if (rrr === "key" && S.pc === 47 && S.key === 1) { S.pc = 48; S.ex += 20; showRoom(); return; }
  if (rrr === "key") { P("You search for a"); P("door, but find none."); return; }
  if (rrr === "sword" && S.sword === 1) { P("You are wielding the"); P("sword in your hand"); P("to fight!"); return; }
  if (rrr === "stick") { P("You might light"); P("the stick?"); return; }
  if (rrr === "rock") { P("It has no use that"); P("you can see."); return; }
  if (rrr === "powder") { P("You could light it."); return; }
  P("You can't use"); P("that here!");
}
function lightThing(rr) {             // 590
  pcls();
  if (rr === "stick" && S.stick === 1) { P("The stick bursts in"); P("to flame. is now lit!"); S.ml = 1; drawStatus(); return; }
  if (rr === "black powder" && S.powder === 1) { P("Just type 'light powder'"); return; }
  if (rr === "powder" && S.powder === 1 && S.pc === 52) { P("There is a BIG flash"); P("of light and a"); P("loud nose.  There's"); P("a hole in the rocks."); S.blast = 1; S.powder = 2; drawPic(picForRoom()); return; }
  if (rr === "powder" && S.powder === 1) { P("You think that you"); P("might nead the"); P("powder later."); return; }
  P("You can't light that"); P("here.");
}
function getThing(rre) {              // 602 / 610
  pcls();
  if (rre === "star" && S.pc === 8) { P("As you reach for"); P("the star..."); P("A trap door opens"); P("and you fall down a"); P("long shaft."); S.pc = 28; showRoom(); return; }
  if (rre !== "coins") {              // weight check (skipped for coins via GOTO 610)
    let weight = 0;
    if (S.sword === 1) weight++; if (S.powder === 1) weight++; if (S.key === 1) weight++;
    if (S.rock === 1) weight++; if (S.stick === 1) weight++; if (S.bag === 1) weight++;
    if (weight > 3) { P("You can't pick up"); P("any more stuff."); P("Drop something."); return; }
  }
  if ((rre === "black powder" || rre === "powder") && S.pc === 23 && S.powder === 0) { P("You get some powder."); P("It rubs on your hands."); S.powder = 1; return; }
  if (rre === S.killerr_ && S.killerr > 0 && S.killerrp === S.pc) { P("You get a"); P("DEAD " + S.killerr_ + "."); S.killerrr_ = S.killerr_; S.killerrr = 1; S.killerr = 0; S.killerrp = 0; return; }
  if (rre === "coins" && S.gcoin === 1 && S.pcc === S.pc) { P("You get " + S.gcoina + " coins!"); S.coin += S.gcoina; S.gcoin = 0; S.pcc = 0; drawStatus(); return; }
  if (rre === "sword" && S.pc === 27 && S.sword === 0) { P("You get the old sword. "); P("As you hold it"); P("power flows in to"); P("your body!"); S.sword = 1; S.ex += 10; drawStatus(); return; }
  if (rre === "rock" && S.pc === 14 && S.rock === 0) { P("You get the old rock."); S.rock = 1; S.ex += 10; return; }
  if (rre === "coins" && S.pc === 7 && S.coinn === 0) { P("You get the ten coins."); S.coin += 10; S.coinn = 1; drawStatus(); return; }
  if (rre === "stick" && S.pc === 13 && S.stick === 0) { P("You get the stick."); P("It seems nice and dry."); S.ex += 10; S.stick = 1; return; }
  if (rre === "key" && S.pc === 3 && S.key === 0) { P("You get the rusty key."); S.ex += 10; S.key = 1; return; }
  P("You see no " + rre + ".", "warn");
}
function dropThing(drop) {            // 703
  pcls();
  if (drop === "all") { P("You can't drop all!"); return; }
  if (drop === "sword" && S.sword === 1) { P("You drop the sword."); S.sword = 0; P("It vanishes!"); drawStatus(); return; }
  if (drop === "coin" && S.coin >= 1) { P("You drop a coin."); S.coin -= 1; P("It vanishes!"); drawStatus(); return; }
  if (drop === "stick" && S.stick === 1) { P("You drop the stick."); S.stick = 0; P("It vanishes!"); return; }
  if (drop === "rock" && S.rock === 1) { P("You drop the rock."); S.rock = 0; P("It vanishes!"); return; }
  if (drop === "key" && S.key === 1) { P("You drop the key."); S.key = 0; P("It vanishes!"); return; }
  if (drop === "bag" && S.bag === 1) { P("You drop the"); P("nice new bag."); S.bag = 0; P("It vanishes!"); return; }
  P("You don't have"); P("a " + drop + "!");
}

/* ============================ SPECIAL MOVES ========================= */
function jump() {                     // 1950
  pcls();
  if (S.pc === 22) { P("You jump and fall"); P("down the falls."); S.pc = 32; S.ann = 1; showRoom(); return; }
  P("Weeeeeeee!"); P("You are the next"); P("Peter Pan!");
}
function swim() {                     // 1980
  pcls();
  if (S.pc === 27 && S.swim === 0) { P("You swim down and"); P("find a piece of the"); P("puzzle!"); S.swim = 1; S.pqu += 1; S.ex += 50; drawStatus(); checkLastPiece(); return; }
  P("You can't swim here!");
}
function enterPortal() {              // 2000
  pcls();
  if (S.pc === 2 && S.por > 0) { S.pc = S.por; showRoom(); return; }
  if (S.pc === S.por) { S.pc = 2; showRoom(); return; }
  P("You must cast the"); P("'make portal' spell"); P("first!");
}
function enterHole() {                // 2010
  pcls();
  if (S.blast === 1 && S.pc === 52) { S.pc = 53; showRoom(); return; }
  P("You can't do that!");
}

/* ============================ STORE ================================= */
function storeSell(rr) {              // 440
  pcls();
  if (rr === "sword" && S.sword === 1) { P("You sell a sword"); P("for 200 gold coins."); S.coin += 200; S.sword = 2; }
  else if (rr === "rock" && S.rock === 1) { P("You sell a rock"); P("for 15 gold coins."); S.coin += 15; S.rock = 2; }
  else if (rr === "stick" && S.stick === 1) { P("You sell a stick"); P("for 5 gold coins."); S.coin += 5; S.stick = 2; }
  else if (rr === "key" && S.key === 1) { P("You sell a key"); P("for 50 gold coins."); S.coin += 50; S.key = 2; }
  drawStatus();
}
function storeBuy(bbb) {              // 450
  pcls();
  if (S.coin >= 200 && bbb === "sword" && S.sword !== 1) { P("You get a new sword."); S.sword = 1; S.coin -= 200; drawStatus(); return; }
  if (S.coin >= 20 && bbb === "rock" && S.rock !== 1) { P("You get a old rock."); S.rock = 1; S.coin -= 20; drawStatus(); return; }
  if (S.coin >= 10 && bbb === "stick" && S.stick !== 1) { P("You get a stick."); S.stick = 1; S.coin -= 10; drawStatus(); return; }
  if (S.coin >= 60 && bbb === "key" && S.key !== 1) { P("You get a new key."); S.key = 1; S.coin -= 60; drawStatus(); return; }
  if (S.coin >= 20 && bbb === "bag" && S.bag === 0) { P("You get a new bag."); S.bag = 1; S.coin -= 20; drawStatus(); return; }
  if (S.coin >= 100 && bbb === "spell" && S.spell === 0) { P("You get a spell."); S.spell = 1; S.coin -= 100; drawStatus(); return; }
  P("You do not have"); P("that many gold coins.");
}

/* ============================ COMBAT (800/810) ====================== */
async function fight() {
  S.inFight = true; S.killercount = 1;
  const body = openModal("Kill", true);
  const head = document.createElement("div"); head.className = "ln bold"; body.appendChild(head);
  const log = document.createElement("div"); body.appendChild(log);
  const mp = (s, c = "") => { const d = document.createElement("div"); d.className = "ln " + c; d.textContent = s; log.appendChild(d); $("modalbody").scrollTop = $("modalbody").scrollHeight; };
  const status = () => head.textContent = "YOU : " + S.hit + " / " + S.mxhit + "        " + S.killer.toUpperCase() + " : " + S.hitt;

  mp("You jump at the " + S.killer + " and start to fight!");
  status();
  let result = null;            // 'dead-you' | 'dead-mon' | 'flee'

  while (result === null) {
    await sleep(260);
    S.killercount = 1;
    let x = R(6);                                  // monster phase
    if (S.wimpy === 1 && S.hit <= 10) { mp("You run away!        "); S.pc = ROOMS[S.pc].flee; result = "flee"; break; }
    if (S.hit === 3) mp("You are hurting bad!", "warn");
    if (S.hit < 2) mp("You are about to DIE!!", "warn");
    if (S.hit === 1) mp("You wish you could run!", "warn");
    if (x === 1) {
      S.hit -= 1; if (S.hit <= 0) { result = "dead-you"; break; }
      const xx = R(10);
      if (xx === 10) { mp("The " + S.killer + " pushes you down in to the mud!"); S.hit -= 3; }
      else if (xx === 1) { mp("The " + S.killer + "'s hit sends you flying!"); S.hit -= 2; }
      else if (xx === 2) mp("The " + S.killer + " hits!");
      else if (xx === 3) { mp("The " + S.killer + " bashes you hard in the head!"); S.hit -= 3; }
      else if (xx === 4) { mp("The " + S.killer + " kickes you!"); S.hit -= 1; }
      else if (xx === 5) { mp("The " + S.killer + " CLAWS your legs making large wounds."); S.hit -= 7; }
      else if (xx === 6) { mp("You try to jump away but the " + S.killer + " stabes you with its sword!"); S.hit -= 5; }
      else if (xx === 7) { mp("The " + S.killer + " dose a turn kick and hits you on the side!"); S.hit -= 5; }
      else if (xx === 8) { mp("The " + S.killer + " stabes your exposed leg!"); S.hit -= 2; }
      else if (xx === 9) { mp("The " + S.killer + " chants 'foris stabis stopis'!"); mp("A stoner ray HITS you!"); mp("YOU CAN'T MOVE!!!!"); S.movestop = 5; }
    } else if (x === 2) mp("The " + S.killer + " falls down and misses the swing!        ");
    else if (x === 3) mp("The " + S.killer + " swings and misses!        ");
    else if (x === 4) mp("The " + S.killer + " swings, but you block it!        ");
    else if (x === 5) mp("The " + S.killer + " tries to stab you with its sword but you jump away!");
    status(); drawStatus();

    if (S.hitt <= 0) { mp("The " + S.killer + " is DEAD!  R.I.P!        ", "warn"); result = "dead-mon"; break; }
    if (S.movestop > 0) { S.movestop -= 1; continue; }

    await sleep(160);
    x = R(6); if (S.sword === 1) x = R(4);
    if (S.sword === 1) mp("Your sword flashes as you brandish it!");
    if (S.pc === 32 && x === 1 && S.hitt <= 1) S.mon = 1;
    if (S.pc === 39 && x === 1 && S.hitt <= 1) S.monn = 1;
    if (x === 1) {
      S.hitt -= 1; S.ex += 13;
      if (S.hitt <= 0) { mp("The " + S.killer + " is dead!  R.I.P", "warn"); S.ex += 100; result = "dead-mon"; break; }
      const xx = R(10);
      if (xx === 1) { mp("Your hit sends the " + S.killer + " flying!", "you"); S.hitt -= 1; S.ex += 10; }
      else if (xx === 2) { mp("You pound the " + S.killer + "!", "you"); mp("The " + S.killer + " says, 'Now you will die " + S.namee + "!'"); S.hitt -= 2; S.ex += 20; }
      else if (xx === 3) { mp("You smack the " + S.killer + " very hard in the side!", "you"); S.hitt -= 3; S.ex += 15; }
      else if (xx === 4) { mp("You smash the " + S.killer + " with a shout!", "you"); S.hitt -= 2; S.ex += 15; }
      else if (xx === 5) { mp("You do a turn kick and smash the " + S.killer + " in the face!", "you"); S.hitt -= 5; S.ex += 10; }
      else if (xx === 6) { mp("You chant 'gagris magris'", "you"); mp("A fire blast hits the " + S.killer + "!"); S.hitt -= 10; S.ex += 50; }
      else if (xx === 7) { mp("You pound the " + S.killer + "'s exposed leg!", "you"); S.hitt -= 5; S.ex += 20; }
      else if (xx === 8) { mp("You stab at the " + S.killer + "'s leg, making a larg wound", "you"); S.hitt -= 5; S.ex += 20; }
      else if (xx === 9) { mp("You chant 'harmis attackeris'!", "you"); mp("You cheer as your mana leach hits the " + S.killer + "!"); mp("You get 5 extra hit points!"); S.hit += 5; S.hitt -= 5; S.ex += 30; }
      else if (xx === 10) { mp("You pertend that you are a vortex and start to spin!", "you"); mp("You hit the " + S.killer + " five times in a row!"); mp("You shout 'Die " + S.killer + "!'"); S.hitt -= 15; S.ex += 60; }
    } else if (x === 2) mp("You swing at the " + S.killer + "'s side but miss!        ");
    else if (x === 3) mp("You try to bash the " + S.killer + " but fall flat on your face!        ");
    else if (x === 4) mp("Your hit is blocked by the " + S.killer + "!        ");
    else if (x === 5) mp("You miss the " + S.killer + "!");
    status(); drawStatus();
  }

  // resolve
  if (result === "dead-mon") {
    S.killerr_ = S.killer; S.killerr = 1; S.killer = ""; S.killerrp = S.pc;
  }
  await modalButton("Press return");
  closeModal();
  S.inFight = false;
  if (result === "dead-you") { die(); return; }
  if (result === "flee") { pcls(); showRoom(); return; }
  drawPic(picForRoom());
}

/* ============================ SCREENS (modal windows) =============== */
function inventory() {                // 400
  // carcass aging (lines 799-805)
  const body = openModal("Inventory", false);
  const L = s => { const d = document.createElement("div"); d.className = "ln"; d.textContent = s; body.appendChild(d); };
  const B = s => { const d = document.createElement("div"); d.className = "ln bold"; d.textContent = s; body.appendChild(d); };
  L("_____________________________________________________________");
  L("Name: " + S.namee + "        Real name: " + S.nameee);
  L("_____________________________________________________________");
  L("You have:");
  L(S.coin + " gold coin(s)");
  if (S.killerrr > 0) {
    const msg = {1:"A newly killed ",2:"A dead ",3:"A long dead ",4:"The remains of a ",5:"The bones of a "}[S.killercount];
    if (msg) B(msg + S.killerrr_ + ".");
    S.killercount += 1;
    if (S.killercount === 6) { S.killerrr = 0; S.killercount = 1; S.killerrr_ = ""; }
  }
  if (S.sword === 1) B("A sword.");
  if (S.rock === 1) B("A rock.");
  if (S.stick === 1) B("A stick.");
  if (S.key === 1) B("A key.");
  if (S.bag === 1) B("A bag.");
  if (S.powder === 1) B("Some black powder.");
  L("");
  L("You have " + S.pqu + " out of 6 puzzle pieces.");
  L("Hit = " + S.hit + "/" + S.mxhit + "       Spell Points = " + S.spelp + "/" + (S.level * 40));
  L("You have " + S.ex + " experience!");
  setLevelFromEx();
  if (S.codeenter === 0) { S.level = 1; L("You can not go up levels"); L("This is an unregistered version."); }
  L("Level = " + S.level);
  if (S.codeenter === 1) L("To get to level " + (S.level + 1) + " you must get " + (S.level * 1000 + 500 - S.ex) + " more ex.");
  modalButton("Press return").then(closeModal);
}
function setLevelFromEx() {            // lines 817-830
  let lv = 1;
  for (let n = 2; n <= 15; n++) if (S.ex > (n - 1) * 1000 + 500) lv = n;
  S.level = lv;
}
function spellsScreen() {              // 520
  const body = openModal("Spells", false);
  const L = (s, c = "") => { const d = document.createElement("div"); d.className = "ln " + c; d.textContent = s; body.appendChild(d); };
  L("The spells you have at this point are:");
  L("_Spell name________casting cost________What it does__"); L("");
  L("make portal                      25        Makes a portal to the town square.");
  if (S.spell >= 1) L("light me                            15        Makes you into a torch.");
  if (S.level >= 2) L("make gold                          30        Makes some gold coins for you.");
  if (S.level >= 2) L("wind                                 15        Makes a wind.");
  if (S.level >= 3) L("heal me                             25        Gives you back 10 hit points.");
  if (S.level >= 3) L("fireball                            45        Makes a fireball that hits the enemy.");
  L("telejump                           30        Jumps you to a random room in the game.");
  L("You have " + S.spelp + " casting points.");
  modalButton("Press return").then(closeModal);
}
function mapScreen() {                 // 70
  const body = openModal("Map", false);
  const L = (s, c = "ln") => { const d = document.createElement("div"); d.className = c; d.textContent = s; body.appendChild(d); };
  if (S.codeenter === 0) { L("This copy is not registered."); L("Please register this copy to have"); L("full functions."); }
  else [
    "          W - C                          R - River             ",
    "           I                                B - Bridge ",
    "          W                 P             P - Pond     ",
    "        / I                  I             A - Alley",
    "     S - B   S            R             W - Woods ",
    "           I    I            I             ST - Start",
    " LL - TS - A   A      R              C - Cave  ",
    "          I     I    I       I             T - Town wall",
    "   J - ST   A - A ?- R              H - House",
    "                 I           I              F - Field",
    "     T - T - T - T     R              WF - Water fall",
    "                 I           I              J - jail",
    "          C - W - W - R               ? - You find out",
    "                      I     I               LL - Library ",
    "                H - F  - R              S - Store",
    "                            I             ",
    "                            R           ",
    "                            I              ",
    "                          WF                ",
  ].forEach(l => L(l, "ln map"));
  modalButton("Press return").then(closeModal);
}
function helpScreen() {                // 500
  const body = openModal("Help", false);
  const L = (s, c = "ln") => { const d = document.createElement("div"); d.className = c; d.textContent = s; body.appendChild(d); };
  [
    "--------------TO MOVE----------------",
    "    east                                   west",
    "    north                                 south",
    "    up                                      down",
    "    jump                                  swim",
    "----------USING AND FINDING-----------",
    "    inventory                  list spells ",
    "    get <object>                use <object>",
    "    look                          drop <object>",
    "    cast  <spell name>      kill <thing>",
    "    light <object>             look <object>",
    "----------------PLAYING---------------",
    "    wimpy (on/off)           map",
    "    quit                            help",
    "    save                           z = scan",
  ].forEach(l => L(l));
  modalButton("Press return").then(() => {
    const b2 = openModal("Help", false);
    const L2 = (s, c = "ln") => { const d = document.createElement("div"); d.className = c; d.textContent = s; b2.appendChild(d); };
    ["TIPS:", "",
     "¥ The Hit point info in the window at",
     "   the bottom of the screen tells you",
     "   your hit points, or how much damage",
     "   you have on you.", "",
     "¥ The Spell point info in the window",
     "   at the bottom of the screen",
     "   tells you how many points",
     "   you have to cast a spell with.", "",
     "¥ If wimpy is on, you will",
     "   run away if you are going to die.", "",
     "¥ You should try to get up levels",
     "   so you can get more spells.",
    ].forEach(l => L2(l));
    modalButton("Press return").then(closeModal);
  });
}
function storeWindow(which) {
  const body = openModal(which === "prices" ? "Buy" : "Sell", false);
  const L = (s, c = "ln") => { const d = document.createElement("div"); d.className = c; d.textContent = s; body.appendChild(d); };
  if (which === "prices") {            // 460
    L("--Object------ Amount in gold coins--");
    if (S.sword === 0 || S.sword === 2) L("Sword           200 gold coins.");
    if (S.rock === 0 || S.rock === 2) L("Rock                20 gold coins.");
    if (S.stick === 0 || S.stick === 2) L("Stick              10 gold coins.");
    if (S.key === 0 || S.key === 2) L("Key                   60 gold coins.");
    L("Bag                20 gold coins.");
    L("Spell             100 gold coins.");
  } else {                             // 430 "What I will get"
    L("--Object------ Amount we will give in gold coins--");
    if (S.sword === 1) L("Sword           200 gold coins.");
    if (S.rock === 1) L("Rock                15 gold coins.");
    if (S.coin > 1) L("Coin                 0 gold coins.");
    if (S.stick === 1) L("Stick              5 gold coins.");
    if (S.key === 1) L("Key                   50 gold coins.");
  }
  modalButton("Press return").then(closeModal);
}
function scoresScreen() {              // 50
  const body = openModal("Scores", false);
  const L = s => { const d = document.createElement("div"); d.className = "ln"; d.textContent = s; body.appendChild(d); };
  let s = []; try { s = JSON.parse(localStorage.getItem("tcp_scores") || "[]"); } catch (e) {}
  if (!s.length) L("  (no scores yet)");
  s.forEach((l, i) => L((i + 1) + "  " + l));
  modalButton("Press return").then(closeModal);
}
function saveScore(line) {
  let s = []; try { s = JSON.parse(localStorage.getItem("tcp_scores") || "[]"); } catch (e) {}
  s.unshift(line); localStorage.setItem("tcp_scores", JSON.stringify(s.slice(0, 50)));
}

/* ============================ SAVE / LOAD =========================== */
const SAVE_FIELDS = ["pc","namee","nameee","pqu","hit","mxhit","ex","spelp","hitt","mon","monn",
  "wimpy","por","coin","spell","level","pasa","pasaa","pasaaa","pasaaaa","swim","powder","blast","blastt","doorfind","ml",
  "sword","rock","stick","key","bag","coinn","codeenter","killer","pccc"];
function saveGame() {                  // 765
  if (S.codeenter === 0) { pcls(); P("Saving is for"); P("registered copies."); return; }
  const o = {}; SAVE_FIELDS.forEach(f => o[f] = S[f]);
  localStorage.setItem("tcp_save", JSON.stringify(o));
  pcls(); P("Done");
}
function loadGame() {                  // 780
  const raw = localStorage.getItem("tcp_save");
  if (!raw) { pcls(); P("No saved game found."); return; }
  const o = JSON.parse(raw); SAVE_FIELDS.forEach(f => { if (f in o) S[f] = o[f]; });
  pcls(); showRoom();
}

/* ============================ REGISTRATION (5000) =================== */
function registrationDialog() {
  const body = openModal("Start", false);
  const L = (s, c = "ln") => { const d = document.createElement("div"); d.className = c; d.textContent = s; body.appendChild(d); };
  L("To regester send $5 - $20 to:");
  L("Andrew Cantino, --- ----- ----, ------, OH, -----", "bold");
  L("When you register you will be sent a code that will let");
  L("you win the game, find all of the puzzle pieces,");
  L("get past level 1, be able to save, have your name added");
  L("to an online list of members, and much much more!");
  return new Promise(resolve => {
    const foot = $("modalfoot"); foot.innerHTML = "";
    const inp = document.createElement("input"); inp.type = "text"; inp.placeholder = "registration code";
    const bNo = document.createElement("button"); bNo.textContent = "Not yet";
    const bYes = document.createElement("button"); bYes.textContent = "Register now!"; bYes.className = "default";
    foot.append(inp, bNo, bYes);
    bNo.onclick = () => { S.codeenter = 0; closeModal(); resolve(); };
    bYes.onclick = () => {
      if (inp.value.trim() === "magic can zap!") { S.codeenter = 1; closeModal(); registeredThanks().then(resolve); }
      else { inp.value = ""; inp.placeholder = "try again…"; }
    };
    inp.focus();
  });
}
function registeredThanks() {          // 5200
  const body = openModal("Start", false);
  const L = s => { const d = document.createElement("div"); d.className = "ln"; d.textContent = s; body.appendChild(d); };
  ["Thank you for registering this","game!  Your money will be spent","to help this programer live.  Your",
   "help will be noted on an online list","of registered users.","",
   "Please DO NOT give away registered","copys of this game.  If you wish",
   "to give away copys.  Please select","'Unregister' from the File menu.","Thank-you.  "].forEach(L);
  localStorage.setItem("tcp_reg", "1");
  return modalButton("Press return").then(closeModal);
}
function unregister() {                // 6200
  S.codeenter = 0; localStorage.removeItem("tcp_reg");
  pcls(); showRoom(); refreshMenus();
}

/* ============================ WIN / LOSE ============================ */
function lastPiece() {                 // 950
  S.inModal = true;
  const body = openModal("The Cursed Puzzle", false);
  const L = (s, c = "ln") => { const d = document.createElement("div"); d.className = c; d.textContent = s; body.appendChild(d); };
  L("You pick up the last puzzle piece and with a boom");
  L("all the puzzle pieces fly together!"); L("");
  L("A magic message floats up next to you and it reads:");
  L("YOU GOT THE LAST PIECE OF THE PUZZLE", "bold");
  L("AND MUST GO HOME BUT YOU STILL MUST", "bold");
  L("FIND THE DOOR TO YOUR LAND.", "bold");
  L(""); L("There is a flash like lightning and the message is gone!");
  L("All you know is that the door is now open if you can find it!");
  L(""); L("This is your last quest.");
  S.doorfind = 1;
  modalButton("Press return").then(() => { closeModal(); S.inModal = false; });
}
async function won() {                 // 970
  saveScore(S.namee + " won on level  " + S.level + " with " + S.pqu + " pieces.");
  const body = openModal("The Cursed Puzzle", false);
  const L = s => { const d = document.createElement("div"); d.className = "ln bold"; d.textContent = s; body.appendChild(d); };
  L("YOU WON!"); L("You are lifted off"); L("your feet, and vanish"); L("in a flash of"); L("light!  Welcome"); L("back to Earth!");
  const img = document.createElement("img"); img.src = "img/104.png"; img.width = 200; body.appendChild(img);
  S.playing = false;
  await modalButton("Press return"); closeModal();
  bootScreen();
}
async function die() {                 // 6 -> 15 -> 17 -> 18
  saveScore(S.namee + " died on level  " + S.level + " with " + S.pqu + " pieces.");
  S.playing = false; S.inFight = false;
  const body = openModal("YOU DIED!", false);
  const fr = document.createElement("img"); fr.width = 240; body.appendChild(fr);
  const t1 = document.createElement("div"); t1.className = "ln bold"; t1.textContent = "YOU DIED!  YOU LOST!  HA! HA! HA!"; body.appendChild(t1);
  const t2 = document.createElement("div"); t2.className = "ln"; t2.textContent = "Press any key to end."; body.appendChild(t2);
  // flip death frames 100-103 every .5s
  const frames = [100,101,102,103]; let i = 0; fr.src = "img/100.png";
  const anim = setInterval(() => { i = (i + 1) % 4; fr.src = "img/" + frames[i] + ".png"; }, 500);
  await modalButton("Press return"); clearInterval(anim);
  const b2 = openModal("YOU DIED!", false);
  const L = s => { const d = document.createElement("div"); d.className = "ln bold"; d.textContent = s; b2.appendChild(d); };
  L("Please come again!"); L("Better luck next time!");
  await modalButton("Press return"); closeModal();
  bootScreen();
}

/* ============================ MODAL plumbing ======================== */
function openModal(title, isFight) {
  S.inModal = !isFight;
  $("modaltitle").textContent = title;
  $("modalbody").innerHTML = ""; $("modalfoot").innerHTML = "";
  $("overlay").classList.remove("hidden");
  return $("modalbody");
}
function closeModal() { $("overlay").classList.add("hidden"); S.inModal = false; }
function modalButton(label) {
  return new Promise(resolve => {
    const foot = $("modalfoot"); foot.innerHTML = "";
    const b = document.createElement("button"); b.textContent = label; b.className = "default";
    b.onclick = () => resolve();
    foot.appendChild(b); b.focus();
  });
}
// Mac verb dialog: "X what?" + field + button labelled X  (routines 1710..)
function verbDialog(title, prompt, run) {
  const body = openModal(title, false);
  const q = document.createElement("div"); q.className = "ln bold"; q.textContent = prompt; body.appendChild(q);
  const foot = $("modalfoot"); foot.innerHTML = "";
  const inp = document.createElement("input"); inp.type = "text";
  const ok = document.createElement("button"); ok.textContent = title; ok.className = "default";
  foot.append(inp, ok);
  const submit = () => { const v = inp.value.trim().toLowerCase(); closeModal(); run(v); };
  ok.onclick = submit;
  inp.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  inp.focus();
}

/* ============================ MENUS ================================= */
function refreshMenus() {              // 4000 + 320 store-enable
  const dis = (cmd, off) => { const b = document.querySelector(`[data-cmd="${cmd}"]`); if (b) b.disabled = off; };
  const r = ROOMS[S.pc];
  dis("save", S.codeenter === 0); dis("open", S.codeenter === 0);
  dis("jump", S.codeenter === 0); dis("swim", S.codeenter === 0);
  document.querySelector(`[data-cmd="jump"]`).textContent = S.codeenter === 0 ? "Jump (Not registered)" : "Jump";
  document.querySelector(`[data-cmd="swim"]`).textContent = S.codeenter === 0 ? "Swim (Not registered)" : "Swim";
  dis("n", !(r.n > 0 || S.pc === 38)); dis("e", !(r.e > 0)); dis("s", !(r.s > 0)); dis("w", !(r.w > 0));
  dis("u", !(r.u > 0)); dis("d", !(r.d >= 1));
  dis("downtree", S.pc !== 12);
  dis("portal", !(S.por > 0));
  dis("hole", !(S.blast === 1 && S.pc === 52));
  dis("unregister", S.codeenter === 0);
  // Store menu only in room 8
  const storeMenu = document.querySelector('.menu[data-m="7"]');
  storeMenu.classList.toggle("disabled", S.pc !== 8);
}

/* ============================ COMMAND DISPATCH ====================== */
function command(cmd, arg) {
  if (!S.playing) return;
  switch (cmd) {
    // movement
    case "n": case "s": case "e": case "w": case "u": case "d": go(cmd); break;
    case "north": case "south": case "east": case "west": case "up": case "down": go(cmd); break;
    case "downtree": case "down tree": go("down tree"); break;
    // The original jump/swim handlers (routines 1950/1980) have no registration
    // check — the gate is purely the greyed-out Move menu item.  So typed
    // jump/swim run the real code; the menu stays disabled when unregistered.
    case "jump": jump(); break;
    case "swim": swim(); break;
    case "portal": enterPortal(); break;
    case "hole": enterHole(); break;
    case "look": go("look"); break;
    // use-find (with prompt if no arg)
    case "use": arg ? useThing(arg) : verbDialog("Use", "Use what?", useThing); break;
    case "get": case "take": arg ? getThing(arg) : verbDialog("Get", "Get what?", getThing); break;
    case "drop": arg ? dropThing(arg) : verbDialog("Drop", "Drop what?", dropThing); break;
    case "cast": arg ? cast(arg) : verbDialog("Cast", "Cast what?", cast); break;
    case "light": arg ? lightThing(arg) : verbDialog("Light", "Light what?", lightThing); break;
    case "kill": case "fight": case "attack":
      if (S.pccc === S.pc && S.killer !== "") { pcls(); P("You shout and"); P("jump in to battle!"); fight(); }
      else { pcls(); P("You do not"); P("see that here."); }
      break;
    // store
    case "sell": arg ? storeSell(arg) : verbDialog("Sell", "Sell what?", storeSell); break;
    case "buy": arg ? storeBuy(arg) : verbDialog("Buy", "Buy what?", storeBuy); break;
    case "prices": storeWindow("prices"); break;
    case "whatiget": storeWindow("whatiget"); break;
    // game / info
    case "inventory": case "i": inventory(); break;
    case "spells": case "list spells": spellsScreen(); break;
    case "map": mapScreen(); break;
    case "help": helpScreen(); break;
    case "scores": scoresScreen(); break;
    case "wimpy": S.wimpy ? command("wimpyoff") : command("wimpyon"); break;
    case "wimpyon": S.wimpy = 1; pcls(); P("Wimpy is ON!"); break;
    case "wimpyoff": S.wimpy = 0; pcls(); P("Wimpy is OFF!"); break;
    // file
    case "save": saveGame(); break;
    case "open": case "load": loadGame(); break;
    case "scan": case "z": pcls(); P("YOU : " + S.hit + " / " + S.mxhit + (S.killer ? "        " + S.killer.toUpperCase() + " : " + S.hitt : "")); break;
    case "quit": pcls(); P("Thanks for playing!"); S.playing = false; bootScreen(); break;
    case "unregister": unregister(); break;
    case "register": registrationDialog().then(() => { refreshMenus(); pcls(); showRoom(); }); break;
    default: pcls(); P("You can't do that!");
  }
}

/* ============================ START FLOW ============================ */
function bootScreen() {
  // shareware / name-entry intro (routine 100, redacted address)
  const body = openModal("Start", false);
  const L = (s, c = "ln") => { const d = document.createElement("div"); d.className = c; d.textContent = s; body.appendChild(d); };
  L("This program is free for you to try...");
  L("But if you like it please send 20$ to:");
  L("    Andrew Cantino");
  L("    --- ----- ----");
  L("    ------, OH, -----");
  L("You can E-mail me at: ");
  L("    -----@seorf.ohiou.edu");
  L(""); L("Thank-you ever so much....");
  const foot = $("modalfoot"); foot.innerHTML = "";
  const q1 = document.createElement("div"); q1.className = "ln"; q1.textContent = "Your name in this game will be";
  const inp1 = document.createElement("input"); inp1.type = "text";
  const ok = document.createElement("button"); ok.textContent = "OK"; ok.className = "default";
  foot.append(q1, inp1, ok);
  inp1.focus();
  const go1 = () => {
    S.namee = inp1.value.trim() || "Not-known";
    foot.innerHTML = "";
    const q2 = document.createElement("div"); q2.className = "ln"; q2.textContent = "Your real name is";
    const inp2 = document.createElement("input"); inp2.type = "text";
    const ok2 = document.createElement("button"); ok2.textContent = "OK"; ok2.className = "default";
    foot.append(q2, inp2, ok2); inp2.focus();
    const go2 = () => { S.nameee = inp2.value.trim() || "Not-known"; welcomeScreen(); };
    ok2.onclick = go2; inp2.addEventListener("keydown", e => { if (e.key === "Enter") go2(); });
  };
  ok.onclick = go1; inp1.addEventListener("keydown", e => { if (e.key === "Enter") go1(); });
}
function welcomeScreen() {             // pic 105 + welcome text
  const body = openModal("Start", false);
  const img = document.createElement("img"); img.src = "img/105.png"; img.width = 340; body.appendChild(img);
  const L = s => { const d = document.createElement("div"); d.className = "ln bold"; d.textContent = s; body.appendChild(d); };
  L("Welcome to a new world!"); L("Your job, to find all the puzzle pieces."); L("Good luck!  You will need it!");
  modalButton("Press return to continue...").then(() => { closeModal(); modeChoice(); });
}
// Start-of-game choice: play exactly like the author's registered copy
// (simulates entering the code 'magic can zap!') or the shareware build.
function modeChoice() {
  const body = openModal("The Cursed Puzzle", false);
  const L = (s, c = "ln") => { const d = document.createElement("div"); d.className = c; d.textContent = s; body.appendChild(d); };
  L("How would you like to play?"); L("");
  L("¥ Registered — the full game, exactly as the author's", "bold");
  L("  registered copy.  Simulates entering the code 'magic can zap!'.");
  L("  Jump, swim, saving, leveling and winning are all unlocked.");
  L("");
  L("¥ Unregistered — the original shareware build.", "bold");
  L("  No jump / swim / save, capped at level 1 — so you can't");
  L("  reach every puzzle piece (the real game's registration gate).");
  const foot = $("modalfoot"); foot.innerHTML = "";
  const bReg = document.createElement("button"); bReg.textContent = "Registered (magic can zap!)"; bReg.className = "default";
  const bUn = document.createElement("button"); bUn.textContent = "Unregistered";
  foot.append(bReg, bUn);
  bReg.onclick = () => { S.codeenter = 1; closeModal(); beginPlay(); };
  bUn.onclick = () => { S.codeenter = 0; closeModal(); beginPlay(); };
}
function beginPlay() {                 // 115 : enter room 1
  S.playing = true; S.inModal = false;
  pcls(); S.pc = 1; showRoom(); refreshMenus(); startRegen();
}

function newGame() { resetState(); if (localStorage.getItem("tcp_reg") === "1") {/*keep reg*/} bootScreen(); }

/* ============================ DOM WIRING ============================ */
window.addEventListener("DOMContentLoaded", () => {
  resetState();
  drawPic(105); drawStatus();

  // menu buttons
  document.querySelectorAll("#menubar [data-cmd]").forEach(b => {
    b.addEventListener("click", () => {
      if (b.disabled) return;
      const c = b.getAttribute("data-cmd");
      if (!S.playing && c !== "scores") return;
      command(c);
      // close any open hover menu by blurring
      document.activeElement && document.activeElement.blur();
    });
  });

  // command line (a convenience; maps to the same routines)
  $("cmdform").addEventListener("submit", e => {
    e.preventDefault();
    const v = $("cmd").value.trim(); $("cmd").value = "";
    if (!v) return;
    if (!S.playing) { newGame(); return; }
    const lc = v.toLowerCase();
    if (lc === "down tree") { command("downtree"); return; }
    if (lc === "list spells") { command("spells"); return; }
    if (lc === "enter portal") { command("portal"); return; }
    if (lc === "enter hole") { command("hole"); return; }
    const sp = lc.indexOf(" ");
    const cmd = sp === -1 ? lc : lc.slice(0, sp);
    const arg = sp === -1 ? "" : lc.slice(sp + 1).trim();
    command(cmd, arg);
  });

  // ⌘-key shortcuts (cmdkey from routine 3000)
  const keymap = { i:"inventory", l:"look", g:"get", k:"kill", c:"cast",
                   e:"e", w:"w", n:"n", s:"s", u:"u", d:"d", q:"quit" };
  document.addEventListener("keydown", e => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (keymap[k] && S.playing && !S.inModal && !S.inFight) {
      if (document.activeElement === $("cmd")) return;
      e.preventDefault(); command(keymap[k]);
    }
  });

  // intro splash in the text column
  pcls();
  P("*********The Cursed Puzzle*********", "bold");
  P("");
  P("by Andrew Cantino (1996)");
  P("");
  P("Choose  File ▸ New Game,  or type  new  below.");
  P("This is a faithful re-translation of the original");
  P("Microsoft QuickBASIC for Macintosh source.");
  P("");
  P("(To unlock the full game — leveling, jump/swim, saving —");
  P(" register with the code  magic can zap!  )");

  // a File ▸ New Game entry
  const fileDrop = document.querySelector('.menu[data-m="1"] .drop');
  const ng = document.createElement("button"); ng.textContent = "New Game";
  ng.addEventListener("click", () => { document.activeElement && document.activeElement.blur(); newGame(); });
  fileDrop.insertBefore(ng, fileDrop.firstChild);

  // Start the intro / name-entry flow immediately on load (routine 100).
  newGame();
});
