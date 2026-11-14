const FM = require('./load.js');
const w = FM.World.create({ clubId: process.argv[2] || 'FCB', manager: 'Test', seed: 42 });
console.log('players', Object.keys(w.players).length, 'clubs', Object.keys(w.clubs).length);
const u = w.clubs[w.user];
console.log(u.name, 'money', FM.U.money(u.money), 'goal', u.board.goal, 'lvl', FM.Team.level(w, u).toFixed(1), 'wageBill', FM.U.money(FM.Team.wageBill(w, u)), 'income', FM.U.money(FM.Econ.yearIncome(w, u)));
let steps = 0; const t0 = Date.now();
while (w.season === 2026 && steps++ < 400) FM.Game.advanceAuto(w);
console.log('season done in', Date.now() - t0, 'ms, steps', steps);
for (const t of [1, 2, 3]) { const tab = w.history[0].champs[t]; console.log(t, 'champ', w.clubs[tab].name); }
console.log(JSON.stringify(w.lastSeason.user), 'money', FM.U.money(u.money));
