/* Langzeit-Test: simuliert mehrere Saisons und prüft nach JEDEM Schritt die Regeln, deren Verletzung
   in Managerspielen typischerweise als Bug auffällt (kaputte Tabellen, Geisterspieler, NaN-Konten, Sackgassen). */
const FM = require('./load.js');
const { Cal, Team, U } = FM;
const SEASONS = +(process.argv[2] || 6); const SEED = +(process.argv[3] || 7); const CLUB = process.argv[4] || 'FCK';
const ASSIST = process.argv[5] !== 'noassist';
let fails = 0; const seen = {};
function fail(msg) { if (!seen[msg]) { seen[msg] = 1; console.log('FAIL:', msg); } fails++; }
function check(w, where) {
  const owner = {};
  for (const cid in w.clubs) {
    const c = w.clubs[cid];
    if (!U.isNum(c.money)) fail(`${where}: Kontostand ${cid} = ${c.money}`);
    if (!U.isNum(c.rep) || !U.isNum(c.fans) || !U.isNum(c.fanbase) || c.cap <= 0) fail(`${where}: Klubwerte ${cid}`);
    const sq = Team.squad(w, c);
    if (sq.length !== c.squad.length) fail(`${where}: Kader ${cid} enthält gelöschte Spieler`);
    if (new Set(c.squad).size !== c.squad.length) fail(`${where}: Spieler doppelt im Kader ${cid}`);
    for (const p of sq) { if (p.club !== cid) fail(`${where}: ${p.name} im Kader ${cid}, aber club=${p.club}`); if (owner[p.id]) fail(`${where}: ${p.name} bei zwei Klubs`); owner[p.id] = cid; }
    if (c.tier <= 3) {
      if (sq.length < 16) fail(`${where}: Kader ${cid} zu klein (${sq.length})`);
      if (sq.length > 40) fail(`${where}: Kader ${cid} zu groß (${sq.length})`);
    }
    if (c.lineup) for (const id of c.lineup.xi.concat(c.lineup.bench)) if (id && (!w.players[id] || w.players[id].club !== cid)) fail(`${where}: Aufstellung ${cid} verweist auf fremden/gelöschten Spieler`);
  }
  for (const id in w.players) {
    const p = w.players[id];
    if (p.club && !owner[p.id]) fail(`${where}: ${p.name} hat club=${p.club}, steht aber in keinem Kader`);
    for (const k of ['ovr', 'pot', 'fit', 'form', 'mor', 'wage', 'val', 'inj', 'sus', 'xp']) if (!U.isNum(p[k])) fail(`${where}: ${p.name}.${k} = ${p[k]}`);
    if (p.ovr < 30 || p.ovr > 99 || p.fit < 0 || p.fit > 100 || p.inj < 0 || p.sus < 0 || p.wage < 0) fail(`${where}: Wertebereich ${p.name} ovr=${p.ovr} fit=${p.fit} inj=${p.inj} sus=${p.sus}`);
  }
  const sizes = { 1: 18, 2: 18, 3: 20 };
  for (const t of [1, 2, 3]) {
    const L = w.leagues[t];
    if (L.clubs.length !== sizes[t]) fail(`${where}: Liga ${t} hat ${L.clubs.length} Klubs`);
    if (L.rounds.length !== (sizes[t] - 1) * 2) fail(`${where}: Liga ${t} hat ${L.rounds.length} Spieltage`);
    for (const cid of L.clubs) if (w.clubs[cid].tier !== t) fail(`${where}: ${cid} in Liga ${t}, tier=${w.clubs[cid].tier}`);
    const tab = Cal.table(w, t); let pts = 0, gd = 0, games = 0, sp = 0;
    for (const r of tab) { pts += r.pts; gd += r.tf - r.ta; sp += r.sp; if (r.s + r.u + r.n !== r.sp) fail(`${where}: S+U+N != Spiele (${r.cid})`); if (r.pts !== r.s * 3 + r.u) fail(`${where}: Punkte falsch (${r.cid})`); }
    for (const rd of L.rounds) for (const f of rd) if (f.p) { games++; pts -= f.hg === f.ag ? 2 : 3; if (!U.isNum(f.hg) || !U.isNum(f.ag) || f.hg < 0 || f.ag < 0) fail(`${where}: Ergebnis ungültig`); }
    if (pts !== 0) fail(`${where}: Punktesumme Liga ${t} passt nicht zu den Ergebnissen`);
    if (gd !== 0) fail(`${where}: Tordifferenzen Liga ${t} summieren sich nicht zu 0`);
    if (sp !== games * 2) fail(`${where}: Spielezahl Liga ${t} inkonsistent`);
  }
  const u = w.clubs[w.user]; if (!u) fail(`${where}: kein Spielerklub`);
}
function scheduleCheck(w) {
  for (const t of [1, 2, 3]) {
    const L = w.leagues[t]; const n = L.clubs.length; const home = {}, pair = {};
    L.rounds.forEach((rd, i) => {
      const inRound = {};
      if (rd.length !== n / 2) fail(`Spielplan Liga ${t}: Spieltag ${i + 1} hat ${rd.length} Partien`);
      for (const f of rd) { if (inRound[f.h] || inRound[f.a] || f.h === f.a) fail(`Spielplan Liga ${t}: Klub doppelt am Spieltag ${i + 1}`); inRound[f.h] = inRound[f.a] = 1; home[f.h] = (home[f.h] || 0) + 1; const k = f.h + '>' + f.a; pair[k] = (pair[k] || 0) + 1; }
    });
    for (const c of L.clubs) if (home[c] !== n - 1) fail(`Spielplan Liga ${t}: ${c} hat ${home[c]} Heimspiele`);
    for (const a of L.clubs) for (const b of L.clubs) if (a !== b && pair[a + '>' + b] !== 1) fail(`Spielplan Liga ${t}: ${a} gegen ${b} ${pair[a + '>' + b]}x`);
  }
  if (w.cup.rounds[0].length !== 32) fail('Pokal: 1. Runde hat nicht 32 Partien');
  const cupTeams = new Set(); for (const f of w.cup.rounds[0]) { cupTeams.add(f.h); cupTeams.add(f.a); }
  if (cupTeams.size !== 64) fail('Pokal: nicht 64 verschiedene Teilnehmer');
}

const t0 = Date.now();
const w = FM.World.create({ clubId: CLUB, manager: 'Test', seed: SEED });
check(w, 'Start'); scheduleCheck(w);
// Spielstand-Roundtrip
require('../js/world.js');
const text = FM.Save.serialize(w); const back = FM.Save.parse(text);
if (back.err) fail('Speichern/Laden: ' + back.err);
else { const a = JSON.parse(FM.LZ.decompress(JSON.parse(text).data)); const b = Object.assign({}, back.world); delete b.nameSet; if (JSON.stringify(a) !== JSON.stringify(b)) fail('Speichern/Laden: Stand verändert sich beim Roundtrip'); }
{ const uni = 'Äöü ß € 日本 \u2028 "quote" \\ ' + 'abcabcabc'.repeat(5000); if (FM.LZ.decompress(FM.LZ.compress(uni)) !== uni) fail('Kompression: Roundtrip fehlerhaft'); }
if (!FM.Save.parse(text.replace('"sum":', '"sum":1')).err) fail('Speichern/Laden: manipulierte Prüfsumme wird nicht erkannt');
if (!FM.Save.parse(text.slice(0, text.length / 2)).err) fail('Speichern/Laden: abgeschnittener Stand wird nicht erkannt');

let steps = 0; const stats = [];
for (let s = 0; s < SEASONS; s++) {
  const season = w.season; let guard = 0;
  while (w.season === season && guard++ < 500) {
    const before = w.week * 10 + w.stage;
    const st = FM.Game.advanceAuto(w, ASSIST); steps++;
    check(w, `S${season} W${w.week} nach ${st.kind}${st.slot ? ':' + st.slot : ''}`);
    if (w.season === season && w.week * 10 + w.stage === before) { fail(`Stillstand in S${season} W${w.week} Stufe ${w.stage}`); break; }
    if (w.season === season && w.week === 45 && w.stage === 0) { for (const t of [1, 2, 3]) for (const rd of w.leagues[t].rounds) for (const f of rd) if (!f.p) { fail(`S${season}: Liga ${t} hat vor der Relegation ungespielte Partien`); break; } if (!w.releg || w.releg.length !== 2) fail(`S${season}: Relegation nicht angesetzt`); }
  }
  if (guard >= 500) fail('Saison endet nicht');
  scheduleCheck(w);
  const h = w.history[w.history.length - 1]; const ls = w.lastSeason;
  if (!h || !w.clubs[h.champs[1]]) fail('Saisonabschluss: kein Meister');
  if (!h.cup) fail('Saisonabschluss: kein Pokalsieger');
  const up = ls.up.length, down = ls.down.length; if (up !== down) fail(`Auf-/Abstieg unausgeglichen: ${up} hoch, ${down} runter`);
  const lv = (t) => U.avg(w.leagues[t].clubs, (c) => Team.level(w, w.clubs[c])).toFixed(1);
  const nPl = Object.keys(w.players).length; const free = Object.values(w.players).filter((p) => !p.club && !p.ab && !p.yo).length;
  const sq = Object.values(w.clubs).filter((c) => c.tier <= 3).map((c) => c.squad.length);
  const money = (t) => U.money(U.avg(w.leagues[t].clubs, (c) => w.clubs[c].money));
  stats.push(`${season}: Meister ${w.clubs[h.champs[1]].short.padEnd(12)} Pokal ${w.clubs[h.cup].short.padEnd(12)} | Niveau ${lv(1)}/${lv(2)}/${lv(3)} | Spieler ${nPl} (frei ${free}) Kader ${Math.min(...sq)}–${Math.max(...sq)} | Ø-Konto ${money(1)} / ${money(2)} / ${money(3)} | Ich: ${w.clubs[ls.user.cid].short} L${ls.user.tier} Platz ${ls.user.pos} (${ls.user.pts} P.)`);
}
console.log(stats.join('\n'));
console.log(`${steps} Schritte, ${SEASONS} Saisons, ${Date.now() - t0} ms, Spielstandgröße ${(FM.Save.serialize(w).length / 1024).toFixed(0)} kB`);
console.log(fails ? `FEHLGESCHLAGEN: ${fails} Regelverstöße` : 'OK: keine Regelverstöße');
process.exit(fails ? 1 : 0);
