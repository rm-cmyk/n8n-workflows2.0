/* Prüft, dass keine Formation bei gleich guten Spielern systematisch überlegen ist */
const FM = require('./load.js');
const w = FM.World.create({ clubId: 'SCV', manager: 't', seed: 3 });
const A = w.clubs.SCF, B = w.clubs.M05; const N = +(process.argv[2] || 150);
const F = FM.FORMATION_NAMES; const pts = {}, gf = {}, n = {};
F.forEach((f) => { pts[f] = 0; gf[f] = 0; n[f] = 0; });
function play(fa, fb) {
  A.formation = fa; B.formation = fb;
  for (const id in w.players) { const p = w.players[id]; p.fit = 100; p.inj = 0; p.sus = 0; p.form = 50; }
  const m = FM.Match.simulate(w, { h: A.id, a: B.id }, { neutral: true, friendly: true });
  const a = m.sides[0].goals, b = m.sides[1].goals;
  pts[fa] += a > b ? 3 : a === b ? 1 : 0; pts[fb] += b > a ? 3 : a === b ? 1 : 0; gf[fa] += a; gf[fb] += b; n[fa]++; n[fb]++;
}
for (const f1 of F) for (const f2 of F) { if (f1 === f2) continue; for (let i = 0; i < N; i++) play(f1, f2); }
// Die KI passt ihre Ausrichtung an – das gehört dazu. Gemessen wird also das Gesamtpaket.
console.log(F.map((f) => `${f.padEnd(12)} ${(pts[f] / n[f]).toFixed(3)} Pkt/Spiel · ${(gf[f] / n[f]).toFixed(2)} Tore`).join('\n'));
const v = F.map((f) => pts[f] / n[f]); console.log('Spanne', (Math.max(...v) - Math.min(...v)).toFixed(3));
