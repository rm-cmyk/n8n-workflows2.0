/* FLUTLICHT · Oberfläche – Finanzen, Verein, Wettbewerbe */
(function (root) {
  'use strict';
  const FM = root.FM; const U = FM.U; const Cal = FM.Cal; const E = FM.Econ; const Team = FM.Team;
  const UI = FM.UI; const h = UI.h;

  /* ---------- Finanzen ---------- */
  UI.V.finance = function () {
    const w = UI.world; const c = UI.user(); const f = c.fin || {}; const wp = E.weeklyParts(w, c);
    const inc = U.sum(E.INCOME, (k) => f[k] || 0), exp = U.sum(E.EXPENSE, (k) => f[k] || 0);
    const line = E.creditLine(w, c); const step = Math.max(50e3, U.roundMoney(line / 10));
    const def = E.TICKET[c.tier]; const price = c.ticket || def;
    const expAtt = Math.round(Math.min(c.cap, c.fanbase * (0.75 + c.fans / 200) * 1.03 * U.clamp(Math.pow(def / Math.max(4, price), 1.2), 0.35, 1.5)));
    const weekNet = U.sum(Object.keys(wp), (k) => wp[k]);
    const rows = (keys, sign) => keys.filter((k) => f[k]).map((k) => '<tr><td>' + E.CATS[k] + '</td><td class="r ' + (sign > 0 ? 'good' : 'bad') + '">' + U.money(f[k]) + '</td></tr>').join('') || '<tr><td class="muted" colspan="2">Noch keine Buchungen.</td></tr>';
    return '<div class="head"><div><h1>Finanzen</h1><p>Alle Buchungen der Saison ' + Cal.seasonLabel(w.season) + '. Gehälter, Personal und Unterhalt laufen jede Woche; Zuschauereinnahmen kommen mit jedem Heimspiel.</p></div></div>' +
      '<div class="grid g4"><div class="card"><div class="label">Kontostand</div><div class="big ' + (c.money < 0 ? 'bad' : '') + '">' + U.money(c.money) + '</div></div>' +
      '<div class="card"><div class="label">Saisonergebnis bisher</div><div class="big ' + (inc + exp < 0 ? 'bad' : 'good') + '">' + U.money(inc + exp) + '</div></div>' +
      '<div class="card"><div class="label">Laufend pro Woche (ohne Spieltage)</div><div class="big ' + (weekNet < 0 ? 'bad' : 'good') + '">' + U.money(weekNet) + '</div></div>' +
      '<div class="card"><div class="label">Kredit · Rahmen ' + U.money(line) + '</div><div class="big">' + U.money(c.loan || 0) + '</div></div></div>' +
      '<div class="grid g2"><div class="card flat"><h3>Einnahmen <small>' + U.money(inc) + '</small></h3><div class="tw"><table class="t"><tbody>' + rows(E.INCOME, 1) + '</tbody></table></div></div>' +
      '<div class="card flat"><h3>Ausgaben <small>' + U.money(exp) + '</small></h3><div class="tw"><table class="t"><tbody>' + rows(E.EXPENSE, -1) + '</tbody></table></div></div></div>' +
      '<div class="grid g2"><div class="card"><h3>Eintrittspreis <small>üblich in dieser Liga: ' + def + ' €</small></h3><div class="row"><input type="range" id="ticket" min="' + Math.round(def * 0.4) + '" max="' + Math.round(def * 2.2) + '" step="1" value="' + price + '" data-c="ticket" aria-label="Durchschnittlicher Eintrittspreis"><b class="num" style="min-width:52px;text-align:right">' + price + ' €</b></div>' +
      '<dl class="kv"><dt>Erwartete Zuschauer (bei durchschnittlichem Gegner)</dt><dd>' + U.num(expAtt) + ' von ' + U.num(c.cap) + '</dd><dt>Erwartete Einnahme je Heimspiel</dt><dd>' + U.money(expAtt * (price + [0, 5, 4, 3, 2][c.tier])) + '</dd></dl><p class="muted" style="font-size:13px">Höhere Preise bringen mehr pro Karte, aber leere Ränge kosten Heimvorteil.</p></div>' +
      '<div class="card"><h3>Bank</h3><p class="muted">Zinsen: 7 % pro Jahr. Liegt das Konto mehr als fünf Wochen unter −' + U.money(line) + ', verkauft der Vorstand einen Spieler.</p><div class="row"><button class="btn" data-a="loan" data-v="' + step + '">' + U.money(step) + ' aufnehmen</button><button class="btn" data-a="loan" data-v="' + (-step) + '"' + (c.loan ? '' : ' disabled') + '>' + U.money(Math.min(step, c.loan || step)) + ' tilgen</button></div>' +
      '<dl class="kv"><dt>Trikotsponsor</dt><dd>' + (c.sponsor ? h(c.sponsor.name) : '–') + '</dd>' + (c.sponsor ? '<dt>Pro Jahr' + (c.sponsor.win ? ' · je Sieg' : '') + '</dt><dd>' + U.money(c.sponsor.base) + (c.sponsor.win ? ' · ' + U.money(c.sponsor.win) : '') + '</dd><dt>Vertrag bis</dt><dd>Saisonende ' + Cal.seasonLabel(c.sponsor.until) + '</dd>' : '') + '</dl>' + (!c.sponsor && w.sponsorOffers ? '<button class="btn pri" data-a="sponsorPick">Sponsorenangebote ansehen</button>' : '') + '</div></div>';
  };
  UI.C.ticket = (v) => { UI.user().ticket = U.clamp(Math.round(+v), 4, 150); UI.render(); };
  UI.A.loan = (d) => { const err = E.loan(UI.world, UI.user(), +d.v); UI.toast(err || (+d.v > 0 ? 'Kredit aufgenommen.' : 'Kredit getilgt.')); UI.render(); };

  /* ---------- Verein ---------- */
  UI.V.club = function () {
    const w = UI.world; const c = UI.user(); const tab = UI.p.tab || 'ground'; let body;
    if (tab === 'board') {
      body = '<div class="grid g2"><div class="card"><h3>Vorstand</h3><dl class="kv"><dt>Saisonziel</dt><dd>' + h(c.board.goal) + '</dd><dt>Vertrauen</dt><dd>' + Math.round(c.board.trust) + ' %</dd></dl>' + UI.bar(c.board.trust, 1) + '<p class="muted">Das Vertrauen steigt, wenn du besser abschneidest als erwartet – gemessen an der Stärke beider Mannschaften. Fällt es dauerhaft unter 10 %, ist dein Stuhl nicht mehr zu retten.</p></div>' +
        '<div class="card"><h3>Fans</h3><dl class="kv"><dt>Stimmung</dt><dd>' + Math.round(c.fans) + ' %</dd><dt>Fanbasis</dt><dd>' + U.num(c.fanbase) + '</dd><dt>Ansehen des Vereins</dt><dd>' + Math.round(c.rep) + ' von 99</dd></dl>' + UI.bar(c.fans, 1) + '<p class="muted">Gute Stimmung füllt das Stadion und den Fanshop. Die Fanbasis wächst langsam mit dem Erfolg.</p></div></div>';
    } else if (tab === 'history') {
      body = '<div class="card flat"><div class="tw"><table class="t"><thead><tr><th>Saison</th><th>Meister</th><th>Pokalsieger</th><th>Dein Verein</th><th class="r">Platz</th><th class="r">Punkte</th></tr></thead><tbody>' + (w.history.length ? w.history.slice().reverse().map((x) => '<tr><td>' + Cal.seasonLabel(x.s) + '</td><td>' + UI.clubName(x.champs[1], 1) + '</td><td>' + UI.clubName(x.cup, 1) + '</td><td>' + (x.u ? UI.clubName(x.u.cid, 1) + ' <span class="muted">(' + h(Cal.LEAGUE_NAME[x.u.tier]) + ')</span>' : '–') + '</td><td class="r">' + (x.u ? x.u.pos + '.' : '') + '</td><td class="r">' + (x.u ? x.u.pts : '') + '</td></tr>').join('') : '<tr><td colspan="6" class="muted">Die erste Saison läuft noch. Hier entsteht deine Vereinschronik.</td></tr>') + '</tbody></table></div></div>';
    } else {
      body = '<div class="card"><h3>' + h(c.stadium) + ' <small>' + U.num(c.cap) + ' Plätze</small></h3>' + (c.buildS ? '<p class="msg">Ausbau um ' + U.num(c.buildS.seats) + ' Plätze läuft – fertig in ' + c.buildS.weeks + ' Wochen.</p>' : '<div class="grid g3">' + E.STADIUM_OPTS.map((o, i) => { const cost = E.stadiumCost(c, o.seats); return '<div class="stack"><b>+' + U.num(o.seats) + ' Plätze</b><span class="muted">' + o.weeks + ' Wochen Bauzeit</span><button class="btn ' + (c.money >= cost ? 'pri' : '') + '" data-a="build" data-t="stadium" data-i="' + i + '"' + (c.money >= cost ? '' : ' disabled') + '>' + U.money(cost) + '</button></div>'; }).join('') + '</div>') + '<p class="muted" style="font-size:13px">Ausbauen lohnt sich nur, wenn die Nachfrage da ist: Fanbasis ' + U.num(c.fanbase) + ', zuletzt ' + (c.fanbase >= c.cap ? 'regelmäßig ausverkauft' : 'nicht ausverkauft') + '.</p></div>' +
        '<div class="grid g2">' + Object.keys(E.INFRA).map((k) => { const lv = c.infra[k]; const up = E.infraCost(c, k); const busy = c.buildI && c.buildI.key === k; return '<div class="card"><h3>' + E.INFRA[k].n + ' <small>' + UI.pips(lv, 5) + '</small></h3><p class="muted">' + E.INFRA[k].d + '</p>' + (busy ? '<p class="msg">Ausbau läuft – fertig in ' + c.buildI.weeks + ' Wochen.</p>' : !up ? '<p class="good">Höchste Ausbaustufe erreicht.</p>' : '<div class="row"><button class="btn ' + (c.money >= up.cost && !c.buildI ? 'pri' : '') + '" data-a="build" data-t="' + k + '"' + (c.money >= up.cost && !c.buildI ? '' : ' disabled') + '>Ausbau auf Stufe ' + (lv + 1) + ' · ' + U.money(up.cost) + '</button><span class="muted">' + up.weeks + ' Wochen' + (c.buildI ? ' · es läuft bereits ein Projekt' : '') + '</span></div>') + '</div>'; }).join('') + '</div>';
    }
    return '<div class="head"><div><h1>' + h(c.name) + '</h1><p>' + h(c.city) + ' · ' + h(Cal.LEAGUE_NAME[c.tier]) + ' · Cheftrainer und Manager: ' + h(w.manager) + '</p></div></div>' + UI.tabs('tab', [['ground', 'Stadion & Gelände'], ['board', 'Vorstand & Fans'], ['history', 'Chronik']], tab) + body;
  };
  UI.A.build = (d) => { const err = E.startBuild(UI.world, UI.user(), d.t, d.i != null ? +d.i : undefined); UI.toast(err || 'Die Bagger rollen.'); UI.render(); };

  /* ---------- Wettbewerbe ---------- */
  UI.V.comp = function () {
    const w = UI.world; const c = UI.user(); const tier = +(UI.p.tier || (c.tier <= 3 ? c.tier : 3)); const tab = UI.p.tab || 'table'; const L = w.leagues[tier]; let body = '';
    const top = '<div class="row"><label class="f">Wettbewerb<select data-c="compTier">' + UI.opt([[1, 'Bundesliga'], [2, '2. Bundesliga'], [3, '3. Liga']], tier) + '</select></label></div>';
    if (tab === 'table') {
      const t = Cal.table(w, tier);
      body = '<div class="card flat"><div class="tw"><table class="t"><thead><tr><th></th><th>#</th><th>Verein</th><th class="r">Sp</th><th class="r">S</th><th class="r">U</th><th class="r">N</th><th class="r">Tore</th><th class="r">Diff</th><th class="r">Pkt</th><th>Form</th></tr></thead><tbody>' +
        t.map((r) => '<tr class="' + (r.cid === w.user ? 'me' : '') + '"><td class="zone ' + UI.zone(tier, r.pos, t.length) + '"></td><td class="num">' + r.pos + '</td><td class="name">' + UI.crest(w.clubs[r.cid], 'sm') + ' ' + UI.clubName(r.cid) + '</td><td class="r">' + r.sp + '</td><td class="r">' + r.s + '</td><td class="r">' + r.u + '</td><td class="r">' + r.n + '</td><td class="r">' + r.tf + ':' + r.ta + '</td><td class="r">' + (r.tf - r.ta > 0 ? '+' : '') + (r.tf - r.ta) + '</td><td class="r"><b>' + r.pts + '</b></td><td><span class="form5">' + r.form.map((x) => '<i class="' + x + '">' + x + '</i>').join('') + '</span></td></tr>').join('') + '</tbody></table></div></div>' +
        '<p class="muted" style="font-size:13px"><span class="chip info">Europapokal</span> <span class="chip good">' + (tier === 1 ? 'Europapokal' : 'Aufstieg') + '</span> <span class="chip warn">Relegation</span> <span class="chip bad">Abstieg</span>' + (tier === 3 ? ' · Zweite Mannschaften dürfen nicht aufsteigen; der nächstplatzierte Klub rückt nach.' : '') + '</p>';
    } else if (tab === 'fixtures') {
      const played = Cal.playedRounds(w, tier); const md = U.clamp(+(UI.p.md || Math.min(L.rounds.length, played + 1)), 1, L.rounds.length);
      body = '<div class="card"><div class="row between"><button class="btn sm" data-a="md" data-v="' + (md - 1) + '"' + (md <= 1 ? ' disabled' : '') + '>◂ zurück</button><h3>' + md + '. Spieltag</h3><button class="btn sm" data-a="md" data-v="' + (md + 1) + '"' + (md >= L.rounds.length ? ' disabled' : '') + '>weiter ▸</button></div><div class="conf" style="font-size:15px;gap:6px 10px">' +
        L.rounds[md - 1].map((f) => '<span class="h" ' + (f.h === w.user ? 'style="font-weight:700"' : '') + '>' + UI.clubName(f.h) + '</span><span class="s">' + UI.fxScore(f) + '</span><span class="a" ' + (f.a === w.user ? 'style="font-weight:700"' : '') + '>' + UI.clubName(f.a) + '</span>').join('') + '</div></div>';
    } else if (tab === 'mine') {
      const list = Cal.clubFixtures(w, c.id);
      body = '<div class="card flat"><div class="tw"><table class="t"><thead><tr><th>Woche</th><th>Datum</th><th>Wettbewerb</th><th></th><th>Gegner</th><th class="r">Ergebnis</th></tr></thead><tbody>' + list.map((x) => { const home = x.f.h === c.id; return '<tr><td>' + x.w + '</td><td>' + Cal.fmt(Cal.dateOf(w.season, x.w, x.where === 'mid' ? 2 : 5)) + '</td><td>' + h(x.comp) + ' <span class="muted">' + h(x.label) + '</span></td><td>' + (x.f.n ? 'N' : home ? 'H' : 'A') + '</td><td class="name">' + UI.clubName(home ? x.f.a : x.f.h) + '</td><td class="r"><b>' + UI.fxScore(x.f) + '</b></td></tr>'; }).join('') + '</tbody></table></div></div>';
    } else if (tab === 'cup') {
      body = w.cup.rounds.slice().reverse().map((rd, k) => { const r = w.cup.rounds.length - 1 - k; return '<div class="card"><h3>' + Cal.CUP_ROUND[r] + '</h3><div class="conf" style="font-size:14px">' + rd.map((f) => '<span class="h" style="' + (f.w === f.h ? 'font-weight:700' : '') + '">' + UI.clubName(f.h) + (f.h === w.user ? ' ●' : '') + '</span><span class="s">' + UI.fxScore(f) + '</span><span class="a" style="' + (f.w === f.a ? 'font-weight:700' : '') + '">' + (f.a === w.user ? '● ' : '') + UI.clubName(f.a) + '</span>').join('') + '</div></div>'; }).join('') + (w.cup.winner ? '<p class="msg good">Pokalsieger ' + Cal.seasonLabel(w.season) + ': ' + UI.clubName(w.cup.winner) + '</p>' : '');
      if (w.releg) body = '<div class="card"><h3>Relegation</h3><div class="conf" style="font-size:14px">' + w.releg.map((rl) => rl.legs.map((f) => '<span class="h">' + UI.clubName(f.h) + '</span><span class="s">' + UI.fxScore(f) + '</span><span class="a">' + UI.clubName(f.a) + '</span>').join('')).join('') + '</div></div>' + body;
    } else {
      const ids = {}; L.clubs.forEach((x) => { ids[x] = 1; });
      const pl = Object.keys(w.players).map((k) => w.players[k]).filter((p) => ids[p.club] && p.st.ap > 0);
      const lst = (fn, val, label) => '<div class="card flat"><h3>' + label + '</h3><div class="tw"><table class="t"><tbody>' + (U.sortBy(pl.filter((p) => val(p)), fn, true).slice(0, 12).map((p, i) => '<tr class="click ' + (p.club === w.user ? 'me' : '') + '" data-a="player" data-id="' + p.id + '"><td class="num">' + (i + 1) + '</td><td class="name">' + h(p.name) + '</td><td>' + UI.clubName(p.club, 1) + '</td><td class="r"><b>' + val(p) + '</b></td></tr>').join('') || '<tr><td class="muted">Noch keine Daten.</td></tr>') + '</tbody></table></div></div>';
      body = '<div class="grid g3">' + lst((p) => p.st.go * 1000 - p.st.ap, (p) => p.st.go, 'Torjäger') + lst((p) => p.st.as, (p) => p.st.as, 'Vorlagen') + lst((p) => (p.st.rn >= 5 ? 10 - p.st.ra / p.st.rn : 0), (p) => (p.st.rn >= 5 ? (p.st.ra / p.st.rn).toFixed(2).replace('.', ',') : ''), 'Notenbeste (ab 5 Spielen)') + '</div>';
    }
    return '<div class="head"><div><h1>Wettbewerbe</h1><p>Tabellen werden direkt aus den Ergebnissen berechnet – was im Spielplan steht, steht auch in der Tabelle.</p></div>' + top + '</div>' +
      UI.tabs('tab', [['table', 'Tabelle'], ['fixtures', 'Spieltage'], ['mine', 'Mein Spielplan'], ['cup', 'Pokal & Relegation'], ['stats', 'Statistik']], tab) + body;
  };
  UI.C.compTier = (v) => { UI.p.tier = +v; UI.p.md = null; UI.render(); };
  UI.A.md = (d) => { UI.p.md = +d.v; UI.render(); };
})(typeof globalThis !== 'undefined' ? globalThis : this);
