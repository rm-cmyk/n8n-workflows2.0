/* FLUTLICHT · Wirtschaft: Einnahmen, Ausgaben, Sponsoren, Stadion, Infrastruktur, Vorstand */
(function (root) {
  'use strict';
  const FM = root.FM; const R = FM.R; const U = FM.U;
  const E = (FM.Econ = {});

  E.WPS = 47; // Abrechnungswochen je Saison
  E.TV = { 1: 46e6, 2: 12.5e6, 3: 1.35e6, 4: 0.08e6 };
  E.TICKET = { 1: 36, 2: 22, 3: 14, 4: 9 };
  const MERCH = { 1: 4.6, 2: 2.3, 3: 1.1, 4: 0.5 };       // € je Fan und Woche
  const STAFF = { 1: 9e6, 2: 3e6, 3: 0.9e6, 4: 0.25e6 };   // Trainerstab, Geschäftsstelle, Reisen
  const TIERF = { 1: 1, 2: 0.6, 3: 0.35, 4: 0.2 };
  E.EURO = [38e6, 32e6, 30e6, 28e6, 12e6, 6e6];             // pauschale Europapokal-Einnahmen nach Vorjahresplatz
  E.CUP_PRIZE = [0.22e6, 0.43e6, 0.86e6, 1.7e6, 3.4e6, 4.3e6];
  E.CATS = {
    tickets: 'Zuschauereinnahmen', tv: 'TV-Gelder', sponsor: 'Sponsoring', merch: 'Fanartikel', transIn: 'Transfererlöse', prize: 'Prämien', euro: 'Europapokal (pauschal)', other: 'Sonstiges',
    wages: 'Spielergehälter', staff: 'Personal & Betrieb', upkeep: 'Stadion & Anlagen', transOut: 'Transferausgaben', build: 'Bauprojekte', interest: 'Zinsen', bonus: 'Handgelder & Abfindungen', misc: 'Sonstige Ausgaben',
  };
  E.INCOME = ['tickets', 'tv', 'sponsor', 'merch', 'transIn', 'prize', 'euro', 'other'];
  E.EXPENSE = ['wages', 'staff', 'upkeep', 'transOut', 'build', 'interest', 'bonus', 'misc'];

  E.add = function (world, club, cat, amount) {
    if (!U.isNum(amount)) return; // niemals NaN/Infinity in die Kasse lassen
    club.money = Math.round(club.money + amount);
    if (world.user === club.id) {
      const f = club.fin || (club.fin = {});
      f[cat] = Math.round((f[cat] || 0) + amount);
    }
  };

  E.sponsorBase = function (club) {
    const r = club.rep;
    if (club.tier === 1) return 2e6 + Math.pow(Math.max(0, r - 55), 2) * 28e3;
    if (club.tier === 2) return 0.8e6 + Math.pow(Math.max(0, r - 42), 2) * 6e3;
    if (club.tier === 3) return 0.25e6 + Math.max(0, r - 32) * 25e3;
    return 0.06e6 + Math.max(0, r - 25) * 6e3;
  };

  E.tvWeekly = function (world, club) {
    const L = world.leagues[club.tier];
    if (!L) return E.TV[4] / E.WPS;
    const n = L.clubs.length; let pos;
    if (FM.Cal.playedRounds(world, club.tier) >= 4) pos = FM.Cal.posOf(world, club.id);
    else pos = 1 + U.sortBy(L.clubs, (c) => world.clubs[c].rep, true).indexOf(club.id);
    const q = 1 - (pos - 1) / (n - 1);
    return E.TV[club.tier] * (0.55 + 0.9 * q) / E.WPS;
  };

  E.attendance = function (world, home, away, kind, cupRound) {
    if (!home.cap) return 0;
    const def = E.TICKET[home.tier];
    let a = home.fanbase * (0.75 + home.fans / 200) * (0.9 + away.rep / 500);
    a *= U.clamp(Math.pow(def / Math.max(4, home.ticket || def), 1.2), 0.35, 1.5);
    if (kind === 'cup') a *= 1 + 0.05 * (cupRound || 0);
    else if (kind === 'rel') a *= 1.25;
    else if (kind === 'friendly') a *= 0.22;
    return Math.round(Math.min(home.cap, a * R.range(0.95, 1.05)));
  };

  E.matchIncome = function (world, home, att, kind) {
    const price = (home.ticket || E.TICKET[home.tier]) * (kind === 'friendly' ? 0.4 : 1);
    const gross = att * (price + [0, 5, 4, 3, 2][home.tier]);
    E.add(world, home, 'tickets', gross);
    E.add(world, home, 'upkeep', -gross * 0.09);
    return gross;
  };

  E.weeklyParts = function (world, club) {
    const wages = FM.Team.wageBill(world, club) / E.WPS;
    const infra = club.infra; const lv = infra.train + infra.youth + infra.med + infra.shop;
    const tv = E.tvWeekly(world, club), sponsor = (club.sponsor ? club.sponsor.base : E.sponsorBase(club)) / E.WPS;
    const merch = club.fanbase * MERCH[club.tier] * (0.7 + club.fans / 166) * (1 + 0.12 * (infra.shop - 1));
    const gate = Math.min(club.cap, club.fanbase) * (E.TICKET[club.tier] + 4) * (club.tier === 3 ? 19 : 17) / E.WPS;
    return {
      tv, sponsor, merch,
      wages: -wages,
      // Trainerstab, Geschäftsstelle, Reisen, Spielbetrieb: wächst mit der Größe des Vereins
      staff: -(STAFF[club.tier] * 0.35 / E.WPS + (tv + sponsor + merch + gate) * 0.2),
      upkeep: -(club.cap * 16 + lv * 70e3 * TIERF[club.tier]) / E.WPS,
      interest: -(club.loan || 0) * 0.07 / E.WPS,
    };
  };
  E.weekly = function (world, club) {
    const p = E.weeklyParts(world, club);
    for (const k in p) E.add(world, club, k, p[k]);
  };

  /* Geschätzte Jahreseinnahmen (für Gehaltsniveau, Kreditrahmen, KI) */
  E.yearIncome = function (world, club) {
    const p = E.weeklyParts(world, club);
    const games = club.tier === 3 ? 19 : 17;
    const tick = Math.min(club.cap, club.fanbase) * (E.TICKET[club.tier] + 4) * games;
    return (p.tv + p.sponsor + p.merch) * E.WPS + tick + (club.euro || 0);
  };
  E.creditLine = function (world, club) { return U.roundMoney(E.yearIncome(world, club) * 0.3); };

  /* ---------- Sponsoren ---------- */
  const SPONSORS = E.SPONSORS = ['Brauerei Hopfenglück', 'Autohaus Kolbenhuber', 'Wurstwaren Zipfelmann', 'Baumarkt Dübelparadies', 'Versicherung Rundum & Söhne', 'Bäckerei Goldkruste', 'Energie Nordwind', 'Software-Schmiede Bitwerk', 'Molkerei Almglück', 'Reisebüro Fernweh', 'Küchenstudio Topfgucker', 'Direktbank Zasterly', 'Möbelhaus Sitzfleisch', 'Getränke Sprudelkönig', 'Spedition Rollmops', 'Fahrradwerk Kettenblatt'];
  E.sponsorOffers = function (world, club) {
    const base = E.sponsorBase(club) * (0.9 + club.fans / 500);
    const names = R.shuffle(SPONSORS).slice(0, 3);
    return [
      { name: names[0], kind: 'fix', base: U.roundMoney(base), win: 0, years: 1, text: 'Feste Jahressumme, ein Jahr Laufzeit.' },
      { name: names[1], kind: 'erfolg', base: U.roundMoney(base * 0.78), win: U.roundMoney(base * 0.014), years: 1, text: 'Niedrigere Grundsumme, dafür eine Prämie für jeden Pflichtspielsieg.' },
      { name: names[2], kind: 'lang', base: U.roundMoney(base * 0.93), win: 0, years: 3, text: 'Drei Jahre Planungssicherheit, etwas weniger Geld pro Jahr.' },
    ];
  };

  /* ---------- Stadion & Infrastruktur ---------- */
  E.STADIUM_OPTS = [{ seats: 2000, weeks: 14 }, { seats: 5000, weeks: 22 }, { seats: 10000, weeks: 34 }];
  E.stadiumCost = function (club, seats) { return U.roundMoney(seats * (2600 + club.cap * 0.012)); };
  E.INFRA = {
    train: { n: 'Trainingsgelände', d: 'Schnellere Entwicklung aller Spieler.' },
    youth: { n: 'Nachwuchsleistungszentrum', d: 'Mehr und bessere Talente im Sommer.' },
    med: { n: 'Medizinische Abteilung', d: 'Weniger und kürzere Verletzungen, bessere Erholung.' },
    shop: { n: 'Fanshop & Vermarktung', d: 'Höhere Fanartikel-Einnahmen.' },
  };
  E.infraCost = function (club, key) {
    const lvl = club.infra[key]; if (lvl >= 5) return null;
    return { cost: U.roundMoney([0, 0.8e6, 2e6, 5e6, 11e6][lvl] * TIERF[club.tier] * 1.4), weeks: [0, 8, 12, 16, 20][lvl] };
  };
  E.startBuild = function (world, club, type, arg) {
    if (type === 'stadium') {
      if (club.buildS) return 'Im Stadion wird bereits gebaut.';
      const opt = E.STADIUM_OPTS[arg]; if (!opt) return 'Unbekannte Ausbaustufe.';
      if (club.cap + opt.seats > 95000) return 'Größer darf das Stadion nicht werden – das Bauamt winkt ab.';
      const cost = E.stadiumCost(club, opt.seats);
      if (club.money < cost) return 'Dafür reicht das Geld nicht.';
      E.add(world, club, 'build', -cost); club.buildS = { seats: opt.seats, weeks: opt.weeks };
      return '';
    }
    if (club.buildI) return 'Es läuft bereits ein Bauprojekt auf dem Vereinsgelände.';
    const c = E.infraCost(club, type); if (!c) return 'Die höchste Ausbaustufe ist erreicht.';
    if (club.money < c.cost) return 'Dafür reicht das Geld nicht.';
    E.add(world, club, 'build', -c.cost); club.buildI = { key: type, weeks: c.weeks };
    return '';
  };
  E.buildTick = function (world, club) {
    if (club.buildS && --club.buildS.weeks <= 0) {
      club.cap += club.buildS.seats;
      if (world.user === club.id) FM.Game.news(world, 'Stadionausbau abgeschlossen', club.stadium + ' fasst jetzt ' + U.num(club.cap) + ' Zuschauer.', 'club');
      club.buildS = null;
    }
    if (club.buildI && --club.buildI.weeks <= 0) {
      club.infra[club.buildI.key] = Math.min(5, club.infra[club.buildI.key] + 1);
      if (world.user === club.id) FM.Game.news(world, 'Bauprojekt fertig', E.INFRA[club.buildI.key].n + ' erreicht Stufe ' + club.infra[club.buildI.key] + '.', 'club');
      club.buildI = null;
    }
  };

  E.loan = function (world, club, delta) { // delta > 0: aufnehmen, < 0: tilgen
    const max = E.creditLine(world, club);
    if (delta > 0) {
      if ((club.loan || 0) + delta > max) return 'Die Bank gibt höchstens ' + U.money(max) + ' Kredit.';
      club.loan = (club.loan || 0) + delta; E.add(world, club, 'other', delta); return '';
    }
    const pay = Math.min(-delta, club.loan || 0);
    if (pay <= 0) return 'Es gibt keinen Kredit zu tilgen.';
    if (club.money < pay) return 'Für die Tilgung fehlt das Geld.';
    club.loan -= pay; E.add(world, club, 'misc', -pay); return '';
  };

  /* ---------- Vorstand ---------- */
  E.setGoal = function (world, club) {
    const L = world.leagues[club.tier]; if (!L) { club.board.goal = 'Aufstieg in die 3. Liga'; club.board.target = 1; return; }
    const rank = 1 + U.sortBy(L.clubs, (c) => FM.Team.level(world, world.clubs[c]), true).indexOf(club.id);
    const n = L.clubs.length; let target, goal;
    if (club.tier === 1) {
      if (rank <= 1) { target = 1; goal = 'Deutsche Meisterschaft'; }
      else if (rank <= 4) { target = 4; goal = 'Platz unter den ersten vier'; }
      else if (rank <= 7) { target = 7; goal = 'Internationales Geschäft (Platz 7)'; }
      else if (rank <= 12) { target = 12; goal = 'Gesichertes Mittelfeld'; }
      else { target = 15; goal = 'Klassenerhalt'; }
    } else if (club.tier === 2) {
      if (rank <= 3) { target = 3; goal = 'Aufstieg (mindestens Relegationsplatz)'; }
      else if (rank <= 8) { target = 8; goal = 'Obere Tabellenhälfte'; }
      else if (rank <= 13) { target = 13; goal = 'Gesichertes Mittelfeld'; }
      else { target = 15; goal = 'Klassenerhalt'; }
    } else {
      if (rank <= 3 && !club.reserve) { target = 3; goal = 'Aufstieg (mindestens Relegationsplatz)'; }
      else if (rank <= 9) { target = 9; goal = 'Obere Tabellenhälfte'; }
      else { target = n - 4; goal = 'Klassenerhalt'; }
    }
    club.board.goal = goal; club.board.target = target;
  };

  // Erwartete Punkte gegen diesen Gegner (für Vorstands- und Fan-Reaktion)
  E.expectedPts = function (world, club, opp, home) {
    const d = FM.Team.level(world, club) - FM.Team.level(world, opp) + (home ? 1.6 : -1.6);
    return 0.35 + 2.3 / (1 + Math.pow(10, -d / 9));
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
