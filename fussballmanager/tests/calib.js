const FM = require('./load.js');
const seeds = [1, 2, 3, 4, 5, 6];
for (const kv of (process.env.CFG || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); FM.Match.CFG[k] = +v; }
const QUIET = !!process.env.QUIET;
const agg = {}; let goals = 0, games = 0, hw = 0, dr = 0, aw = 0; const ptsRank = {};
let cards = 0, reds = 0;
for (const seed of seeds) {
  const w = FM.World.create({ clubId: 'SCV', manager: 'T', seed });
  let steps = 0;
  while (w.season === 2026 && w.week < 45 && steps++ < 400) FM.Game.advanceAuto(w);
  const tab = FM.Cal.table(w, 1);
  tab.forEach((r, i) => { (agg[r.cid] = agg[r.cid] || []).push(r.pts); (ptsRank[i] = ptsRank[i] || []).push(r.pts); });
  for (const rd of w.leagues[1].rounds) for (const f of rd) { games++; goals += f.hg + f.ag; if (f.hg > f.ag) hw++; else if (f.hg === f.ag) dr++; else aw++; }
  for (const id in w.players) { const p = w.players[id]; if (w.clubs[p.club] && w.clubs[p.club].tier === 1) { cards += p.st.ye; reds += p.st.re; } }
  if (seed === 1 && !QUIET) {
    console.log(tab.map((r) => `${r.pos}. ${w.clubs[r.cid].short.padEnd(14)} ${r.s}-${r.u}-${r.n} ${r.tf}:${r.ta} ${r.pts}  lvl ${FM.Team.level(w, w.clubs[r.cid]).toFixed(1)}`).join('\n'));
    const sc = Object.values(w.players).filter((p) => p.club && w.clubs[p.club].tier === 1).sort((a, b) => b.st.go - a.st.go).slice(0, 8);
    console.log(sc.map((p) => `${p.name} ${p.st.go} (${p.st.ap} Sp, Note ${(p.st.ra / p.st.rn).toFixed(2)})`).join(' | '));
    const inj = Object.values(w.players).filter((p) => p.inj > 0).length; console.log('injured now', inj, 'of', Object.keys(w.players).length);
    const u = w.clubs.FCB; console.log('FCB fit avg', FM.U.avg(FM.Team.squad(w, u), (p) => p.fit).toFixed(0), 'squad', u.squad.length);
  }
}
const W1 = FM.World.create({ clubId: 'SCV', manager: 'T', seed: 1 });
console.log('goals/game', (goals / games).toFixed(2), 'H/U/A %', (100 * hw / games).toFixed(0), (100 * dr / games).toFixed(0), (100 * aw / games).toFixed(0), 'yellow/game', (cards / games).toFixed(2), 'red/game', (reds / games).toFixed(3));
console.log('avg pts by rank', Object.keys(ptsRank).map((k) => Math.round(FM.U.avg(ptsRank[k]))).join(' '));
console.log(Object.keys(agg).sort((a, b) => FM.U.avg(agg[b]) - FM.U.avg(agg[a])).map((c) => `${c} ${FM.U.avg(agg[c]).toFixed(0)} (${FM.Team.level(W1, W1.clubs[c]).toFixed(1)})`).join(', '));
