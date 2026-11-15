/* Europapokal-Prüfung: Auslosung (jeder gleich viele Heim- und Auswärtsspiele, kein Gegner doppelt, keine
   Duelle innerhalb eines Landes), Ablauf bis zum Finale, Prämien und Qualifikation über mehrere Saisons */
const FM = require('./load.js'); const { U, Euro: EU, Team } = FM;
const SEASONS = +(process.argv[2] || 3); const CLUB = process.argv[3] || 'VFB'; const SEED = +(process.argv[4] || 5);
let fails = 0; const fail = (m) => { console.log('FAIL:', m); fails++; };
const w = FM.World.create({ clubId: CLUB, manager: 'T', seed: SEED });
function checkDraw(tag) {
  for (const k of EU.ORDER) {
    const comp = w.euro.comps[k]; const D = EU.COMPS[k]; const home = {}, games = {}, opp = {};
    if (comp.teams.length !== 36) fail(`${tag} ${k}: ${comp.teams.length} Teilnehmer`);
    if (new Set(comp.teams).size !== comp.teams.length) fail(`${tag} ${k}: Teilnehmer doppelt`);
    if (comp.rounds.length !== D.md) fail(`${tag} ${k}: ${comp.rounds.length} Spieltage`);
    comp.rounds.forEach((rd, i) => {
      const seen = {};
      if (rd.length !== comp.teams.length / 2) fail(`${tag} ${k}: Spieltag ${i + 1} hat ${rd.length} Partien`);
      for (const f of rd) {
        if (seen[f.h] || seen[f.a]) fail(`${tag} ${k}: Klub doppelt am Spieltag ${i + 1}`); seen[f.h] = seen[f.a] = 1;
        home[f.h] = (home[f.h] || 0) + 1; games[f.h] = (games[f.h] || 0) + 1; games[f.a] = (games[f.a] || 0) + 1;
        const key = [f.h, f.a].sort().join('|'); if (opp[key]) fail(`${tag} ${k}: ${key} doppelt`); opp[key] = 1;
        if (EU.natOf(w.clubs[f.h]) === EU.natOf(w.clubs[f.a])) fail(`${tag} ${k}: Duell innerhalb eines Landes (${w.clubs[f.h].short} – ${w.clubs[f.a].short})`);
      }
    });
    for (const c of comp.teams) { if (games[c] !== D.md) fail(`${tag} ${k}: ${c} hat ${games[c]} Spiele`); if (home[c] !== D.md / 2) fail(`${tag} ${k}: ${c} hat ${home[c]} Heimspiele`); }
  }
  const all = EU.ORDER.flatMap((k) => w.euro.comps[k].teams); if (new Set(all).size !== all.length) fail(`${tag}: Klub in zwei Wettbewerben`);
}
const t0 = Date.now();
for (let s = 0; s < SEASONS; s++) {
  const season = w.season; checkDraw('S' + season);
  const u = w.clubs[w.user]; const uk = EU.compOf(w, w.user); let g = 0;
  while (w.season === season && g++ < 600) {
    FM.Game.advanceAuto(w, true);
    for (const cid in w.clubs) if (!U.isNum(w.clubs[cid].money)) { fail('Konto ' + cid + ' ungültig'); break; }
  }
  const ls = w.lastSeason; const h = w.history[w.history.length - 1];
  for (const k of EU.ORDER) if (!ls.euro[k] || !w.clubs[ls.euro[k]]) fail(`S${season}: kein Sieger ${k}`);
  const q = ls.euroQual; const n = q.CL.length + q.EL.length + q.ECL.length; if (n !== 7) fail(`S${season}: ${n} deutsche Startplätze`);
  const ger = (k) => q[k].map((c) => w.clubs[c].short).join(', ');
  console.log(`${season}: CL ${w.clubs[ls.euro.CL].short} · EL ${w.clubs[ls.euro.EL].short} · ECL ${w.clubs[ls.euro.ECL].short} | ${u.short}${uk ? ' (' + uk + ')' : ''} Europapokal-Einnahmen ${U.money((u.finPrev || {}).euro || 0)} | nächste Saison: CL ${ger('CL')} · EL ${ger('EL')} · ECL ${ger('ECL')}`);
  void h;
}
const lv = FM.Euro.intl(w).map((c) => Team.level(w, c) - c.base); console.log('Niveau-Drift Ausland: Ø', U.avg(lv).toFixed(2), 'min', Math.min(...lv).toFixed(1), 'max', Math.max(...lv).toFixed(1), '· Spieler', Object.keys(w.players).length, '· Spielstand', (FM.Save.serialize(w).length / 1024).toFixed(0), 'kB ·', Date.now() - t0, 'ms');
console.log(fails ? 'FEHLGESCHLAGEN: ' + fails : 'OK: Europapokal ohne Regelverstöße');
process.exit(fails ? 1 : 0);
