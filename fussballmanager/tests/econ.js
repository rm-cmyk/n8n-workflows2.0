const FM = require('./load.js'); const { U, Econ: E, Team } = FM;
for (const cid of ['FCB', 'BVB', 'SCF', 'SVE', 'WOB', 'FCK', 'OSN', 'F95', 'RWE', 'HAV']) {
  const w = FM.World.create({ clubId: cid, manager: 'T', seed: 3 }); const c = w.clubs[cid]; const m0 = c.money;
  let g = 0; while (w.season === 2026 && w.week < 47 && g++ < 400) FM.Game.advanceAuto(w);
  const f = c.fin; const inc = U.sum(E.INCOME, (k) => f[k] || 0), exp = U.sum(E.EXPENSE, (k) => f[k] || 0);
  console.log(`${c.short.padEnd(12)} rep ${c.rep} start ${U.money(m0).padStart(12)} end ${U.money(c.money).padStart(12)} | Ein ${U.money(inc)} Aus ${U.money(exp)} | ` + E.INCOME.concat(E.EXPENSE).filter((k) => f[k]).map((k) => k + ' ' + (f[k] / 1e6).toFixed(1)).join(' '));
}
