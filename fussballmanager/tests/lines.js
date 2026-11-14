const FM = require('./load.js');
const w = FM.World.create({ clubId: 'SCV', manager: 'T', seed: 1 });
let sa = 0, sd = 0, sm = 0, sg = 0, n = 0; const rows = [];
for (const cid of w.leagues[1].clubs) {
  const c = w.clubs[cid]; const opp = w.clubs[w.leagues[1].clubs.find((x) => x !== cid)];
  const m = FM.Match.create(w, { h: cid, a: opp.id }, { fast: true, neutral: true });
  const s = m.sides[0].str; sa += s.a; sd += s.d; sm += s.m; sg += s.g; n++;
  const L = FM.Team.autoLineup(w, c);
  const P = w.players; const slots = FM.FORMATIONS[L.formation];
  rows.push(`${c.short.padEnd(13)} ${L.formation.padEnd(11)} G ${s.g.toFixed(1)} D ${s.d.toFixed(1)} M ${s.m.toFixed(1)} A ${s.a.toFixed(1)} | ` + L.xi.map((id, i) => `${slots[i].pos}:${P[id].pos}${P[id].ovr}`).join(' '));
}
console.log(rows.join('\n'));
console.log('avg G', (sg / n).toFixed(2), 'D', (sd / n).toFixed(2), 'M', (sm / n).toFixed(2), 'A', (sa / n).toFixed(2), 'A/D', (sa / sd).toFixed(3));
const cnt = {}; for (const id in w.players) { const p = w.players[id]; if (!p.gen) cnt[p.pos] = (cnt[p.pos] || 0) + 1; } console.log(cnt);
