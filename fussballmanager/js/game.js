/* FLUTLICHT · Spielablauf: Wochen, Spieltage, Ergebnisverbuchung, Training, Saisonwechsel */
(function (root) {
  'use strict';
  const FM = root.FM; const R = FM.R; const U = FM.U; const Cal = FM.Cal; const E = FM.Econ; const Team = FM.Team;
  const G = (FM.Game = {});

  G.news = function (world, title, text, kind) {
    world.news.unshift({ s: world.season, w: world.week, t: title, x: text, k: kind || 'info', r: 0 });
    if (world.news.length > 150) world.news.length = 150;
  };
  G.user = function (world) { return world.clubs[world.user]; };
  G.clubList = function (world) { return Object.keys(world.clubs).map((k) => world.clubs[k]); };

  /* ---------- Spiele eines Termins sammeln ---------- */
  G.slotItems = function (world, slotName) {
    const wk = Cal.week(world); const def = wk[slotName]; const items = [];
    if (!def) return items;
    if (def.t === 'league') {
      for (let tier = 1; tier <= 3; tier++) {
        const md = def.md[tier]; if (!md) continue;
        for (const f of world.leagues[tier].rounds[md - 1]) if (!f.p) items.push({ f, kind: 'league', tier, md, comp: Cal.LEAGUE_NAME[tier] });
      }
    } else if (def.t === 'cup') {
      const rd = world.cup.rounds[def.r] || [];
      for (const f of rd) if (!f.p) items.push({ f, kind: 'cup', r: def.r, comp: 'DFB-Pokal', knockout: true, neutral: !!f.n });
    } else if (def.t === 'rel') {
      for (const rl of world.releg || []) {
        const f = rl.legs[def.leg]; if (!f || f.p) continue;
        items.push({ f, kind: 'rel', leg: def.leg, rl, comp: 'Relegation', knockout: def.leg === 1, agg: def.leg === 1 ? [rl.legs[0].ag, rl.legs[0].hg] : null });
      }
    } else if (def.t === 'friendly') {
      const f = world.friendlies[wk.w]; if (f && !f.p) items.push({ f, kind: 'friendly', comp: 'Testspiel', friendly: true });
    }
    return items;
  };
  G.isUserItem = function (world, it) { return it.f.h === world.user || it.f.a === world.user; };

  /* Was passiert beim nächsten Klick auf „Weiter“? */
  G.nextStep = function (world) {
    if (world.over) return { kind: 'over' };
    for (const slot of ['mid', 'we']) {
      const idx = slot === 'mid' ? 0 : 1;
      if (world.stage > idx) continue;
      const items = G.slotItems(world, slot);
      if (items.length) { const ui = items.find((it) => G.isUserItem(world, it)); return { kind: 'slot', slot, items, userItem: ui || null, def: Cal.week(world)[slot] }; }
    }
    return world.week >= Cal.WEEKS ? { kind: 'seasonEnd' } : { kind: 'endWeek' };
  };

  function matchOpts(world, it, live) {
    const hc = world.clubs[it.f.h], ac = world.clubs[it.f.a];
    return {
      knockout: !!it.knockout, neutral: !!it.neutral, friendly: !!it.friendly, agg: it.agg || null, fast: !live, user: world.user,
      att: it.neutral ? Math.round(74000 * R.range(0.9, 1)) : E.attendance(world, hc, ac, it.kind, it.r),
    };
  }

  /* Termin öffnen: alle Partien ohne Beteiligung des Spielers werden sofort berechnet.
     Für das eigene Spiel gibt es eine Live-Instanz zurück. */
  G.openSlot = function (world, slotName) {
    const items = G.slotItems(world, slotName); const others = []; let userItem = null;
    for (const it of items) {
      if (G.isUserItem(world, it)) { userItem = it; continue; }
      const m = FM.Match.simulate(world, it.f, matchOpts(world, it, false));
      G.applyMatch(world, it, m);
      others.push({ h: it.f.h, a: it.f.a, goals: m.goals.map((g) => [g[0], g[1]]), comp: it.comp, tier: it.tier || 0, hg: it.f.hg, ag: it.f.ag });
    }
    const ctx = { slot: slotName, userItem, others, match: null };
    if (userItem) ctx.match = FM.Match.create(world, userItem.f, matchOpts(world, userItem, true));
    return ctx;
  };
  /* Termin abschließen (nach dem eigenen Spiel bzw. sofort, wenn der Spieler nicht beteiligt ist) */
  G.closeSlot = function (world, ctx) {
    if (ctx.userItem && ctx.match) {
      if (!ctx.match.done) FM.Match.runToEnd(ctx.match);
      G.applyMatch(world, ctx.userItem, ctx.match);
    }
    const def = Cal.week(world)[ctx.slot];
    if (def && def.t === 'cup') cupAfterRound(world, def.r);
    if (def && def.t === 'rel' && def.leg === 1) relegDecide(world);
    if (def && def.t === 'league') { if ([1, 2, 3].every((t) => world.leagues[t].rounds.every((rd) => rd.every((f) => f.p))) && !world.releg) setupReleg(world); }
    if (ctx.slot === 'mid') { // kurze Erholung zwischen Mittwoch und Samstag
      for (const id in world.players) { const p = world.players[id]; if (p.fit < 100) p.fit = Math.min(100, p.fit + 13); }
    }
    world.stage = ctx.slot === 'mid' ? 1 : 2;
    world.lastOthers = ctx.others;
  };
  G.runSlot = function (world, slotName) { const ctx = G.openSlot(world, slotName); if (ctx.match) FM.Match.runToEnd(ctx.match); G.closeSlot(world, ctx); return ctx; };

  const INJ = [[1, 'Prellung'], [1, 'Zerrung'], [2, 'Zerrung'], [2, 'Kapselverletzung'], [3, 'Muskelfaserriss'], [4, 'Muskelfaserriss'], [5, 'Bänderdehnung'], [7, 'Muskelbündelriss'], [9, 'Bänderriss'], [13, 'Mittelfußbruch'], [20, 'Syndesmoseriss'], [30, 'Kreuzbandriss']];
  const INJ_W = [20, 22, 16, 9, 10, 7, 6, 4, 3, 1.6, 0.9, 0.5];
  G.injure = function (world, p, club) {
    const k = R.weighted(INJ.map((x, i) => i), (i) => INJ_W[i] * (p.tr.indexOf('verletzlich') >= 0 && i > 3 ? 1.6 : 1));
    const med = club ? club.infra.med : 1;
    p.inj = Math.max(1, Math.round(INJ[k][0] * (1 - 0.07 * (med - 1)))); p.injT = INJ[k][1];
    return p.inj;
  };

  /* Ergebnis verbuchen: Spielplan, Spielerstatistiken, Sperren, Verletzungen, Kasse, Stimmung */
  G.applyMatch = function (world, it, m) {
    const f = it.f; const res = FM.Match.result(m); const P = world.players;
    const friendly = !!it.friendly;
    f.hg = res.hg; f.ag = res.ag; f.p = 1; f.att = m.att;
    if (it.knockout) { f.et = res.et ? 1 : 0; if (res.pens) f.pens = res.pens; f.w = res.winner === 0 ? f.h : f.a; }
    const clubs = [world.clubs[f.h], world.clubs[f.a]];
    if (!it.neutral) E.matchIncome(world, clubs[0], m.att, it.kind);
    else { E.add(world, clubs[0], 'tickets', m.att * 18); E.add(world, clubs[1], 'tickets', m.att * 18); }
    const report = { h: f.h, a: f.a, hg: res.hg, ag: res.ag, et: res.et, pens: res.pens, comp: it.comp, att: m.att, sides: [], poss: res.poss, kind: it.kind };
    for (let si = 0; si < 2; si++) {
      const side = m.sides[si]; const club = clubs[si]; const played = {};
      const rows = [];
      for (const pl of side.pl) {
        const p = P[pl.pid]; if (!p) continue;
        if (pl.mi > 0 || pl.hurt) played[p.id] = 1;
        const grade = FM.Match.grade(pl);
        if (!friendly) {
          if (pl.mi > 0) { p.st.ap++; p.car.ap++; p.st.mi += pl.mi; p.bench = 0; }
          p.st.go += pl.go; p.car.go += pl.go; p.st.as += pl.as;
          if (grade) { p.st.ra += grade; p.st.rn++; }
          if (pl.red) { p.st.re++; p.sus = Math.max(p.sus, pl.yel >= 2 ? 1 : R.int(1, 3)); }
          else if (pl.yel) { p.st.ye++; p.yel++; if (p.yel % 5 === 0) { p.sus = Math.max(p.sus, 1); if (club.id === world.user) G.news(world, 'Gelbsperre', p.name + ' hat die fünfte Gelbe Karte gesehen und fehlt im nächsten Pflichtspiel.', 'team'); } }
        }
        if (pl.mi > 0) {
          p.fit = U.clamp(Math.round(pl.sta), 25, 100);
          if (grade) p.form = U.clamp(p.form + (3.4 - grade) * 5 + (pl.go ? 2 : 0), 5, 99);
        }
        if (pl.hurt) {
          const wks = G.injure(world, p, club);
          if (club.id === world.user) G.news(world, 'Verletzung', p.name + ' fällt mit ' + p.injT + ' etwa ' + wks + (wks === 1 ? ' Woche' : ' Wochen') + ' aus.', 'team');
        }
        rows.push({ pid: p.id, pos: pl.pos, mi: pl.mi, go: pl.go, as: pl.as, yel: pl.yel, red: pl.red, grade, start: pl.start, hurt: pl.hurt ? 1 : 0 });
      }
      // Sperren absitzen: wer gesperrt war und nicht gespielt hat, hat ein Spiel abgebrummt
      if (!friendly) for (const id of club.squad) { const p = P[id]; if (p && p.sus > 0 && !played[id] && !justSuspended(side, id)) p.sus--; }
      if (!friendly) for (const id of club.squad) { const p = P[id]; if (p && !played[id] && p.inj <= 0) p.bench = (p.bench || 0) + 1; }
      const my = si === 0 ? res.hg : res.ag, their = si === 0 ? res.ag : res.hg;
      if (!friendly) {
        const mor = my > their ? 4 : my < their ? -4 : 0;
        for (const id of club.squad) { const p = P[id]; if (p) p.mor = U.clamp(p.mor + mor + (played[id] ? 1 : 0), 5, 99); }
        if (club.sponsor && club.sponsor.win && my > their) E.add(world, club, 'sponsor', club.sponsor.win);
        const exp = E.expectedPts(world, club, clubs[1 - si], si === 0 && !it.neutral);
        const pts = my > their ? 3 : my === their ? 1 : 0;
        const w = it.kind === 'league' ? 1 : 1.4;
        club.fans = U.clamp(club.fans + (pts - exp) * 2.0 * w + (my >= 4 ? 1 : 0), 0, 100);
        club.board.trust = U.clamp(club.board.trust + (pts - exp) * 1.3 * w, 0, 100);
      }
      report.sides.push({ cid: club.id, rows, shots: side.shots, onT: side.onT, corners: side.corners, fouls: side.fouls, formation: side.formation });
    }
    if (f.h === world.user || f.a === world.user) {
      report.events = m.events.filter((e) => e.type !== 'info').map((e) => ({ label: e.label, type: e.type, side: e.side, pid: e.pid || 0, pid2: e.pid2 || 0, text: e.text || '' }));
      world.lastMatch = report;
    }
    return report;
  };
  function justSuspended(side, id) { return side.pl.some((pl) => pl.pid === id && pl.red); }

  /* ---------- Pokal ---------- */
  function cupAfterRound(world, r) {
    const cup = world.cup; const rd = cup.rounds[r]; if (!rd || !rd.every((f) => f.p)) return;
    if (cup.rounds.length > r + 1 || cup.winner) return; // schon ausgelost
    cup.alive = rd.map((f) => f.w);
    for (const f of rd) { E.add(world, world.clubs[f.w], 'prize', E.CUP_PRIZE[r]); }
    if (r >= 5) {
      cup.winner = rd[0].w; const c = world.clubs[cup.winner];
      if (cup.winner === world.user) { c.board.trust = U.clamp(c.board.trust + 15, 0, 100); c.fans = U.clamp(c.fans + 12, 0, 100); G.news(world, 'POKALSIEGER!', 'Der Pott gehört euch! ' + c.name + ' gewinnt den DFB-Pokal. Die Stadt steht kopf.', 'match'); }
      else G.news(world, 'Pokalfinale', c.name + ' gewinnt den DFB-Pokal.', 'match');
      return;
    }
    Cal.cupDraw(world);
    const nf = cup.rounds[r + 1].find((f) => f.h === world.user || f.a === world.user);
    if (nf) { const opp = world.clubs[nf.h === world.user ? nf.a : nf.h]; G.news(world, 'Pokal-Auslosung', Cal.CUP_ROUND[r + 1] + ': Es geht ' + (r + 1 === 5 ? 'im Finale' : nf.h === world.user ? 'zu Hause' : 'auswärts') + ' gegen ' + opp.name + '.', 'match'); }
  }

  /* ---------- Relegation ---------- */
  function eligible3(world) { return Cal.table(world, 3).filter((r) => !world.clubs[r.cid].reserve); }
  function setupReleg(world) {
    const t1 = Cal.table(world, 1), t2 = Cal.table(world, 2), e3 = eligible3(world);
    const mk = (upper, lower, tier) => ({ tier, upper, lower, legs: [{ h: upper, a: lower, hg: 0, ag: 0, p: 0 }, { h: lower, a: upper, hg: 0, ag: 0, p: 0 }], winner: null });
    world.releg = [mk(t1[15].cid, t2[2].cid, 1), mk(t2[15].cid, e3[2].cid, 2)];
    for (const rl of world.releg) if (rl.upper === world.user || rl.lower === world.user) G.news(world, 'Relegation!', 'Zwei Endspiele entscheiden über die Liga: ' + world.clubs[rl.upper].name + ' gegen ' + world.clubs[rl.lower].name + '.', 'match');
  }
  function relegDecide(world) {
    for (const rl of world.releg || []) {
      const f = rl.legs[1]; if (!f.p || rl.winner) continue;
      rl.winner = f.w || (rl.legs[0].hg + f.ag >= rl.legs[0].ag + f.hg ? rl.upper : rl.lower);
      if (rl.upper === world.user || rl.lower === world.user) G.news(world, 'Relegation entschieden', world.clubs[rl.winner].name + ' setzt sich durch und spielt nächste Saison in der ' + Cal.LEAGUE_NAME[rl.tier] + '.', 'match');
    }
  }

  /* ---------- Training ---------- */
  G.TRAIN = {
    allround: { n: 'Allround', d: 'Von allem etwas. Solide, unspektakulär.' },
    kondition: { n: 'Kondition', d: 'Die Mannschaft ermüdet im Spiel langsamer. Wirkung baut sich über Wochen auf.' },
    taktik: { n: 'Taktik', d: 'Bessere Abstimmung: leichter Stärkebonus im Spiel. Baut sich über Wochen auf.' },
    technik: { n: 'Technik', d: 'Junge Spieler (bis 23) entwickeln sich schneller.' },
    torschuss: { n: 'Torschuss', d: 'Bessere Form für Offensivspieler.' },
    regeneration: { n: 'Regeneration', d: 'Deutlich mehr Frische, bessere Stimmung – aber kaum Entwicklung.' },
  };
  G.INTENS = ['Locker', 'Normal', 'Hart'];

  function weeklyPlayers(world) {
    const year = Cal.year(world);
    for (const cid in world.clubs) {
      const club = world.clubs[cid]; const tr = club.training || { focus: 'allround', intens: 1 };
      const pre = world.week <= 3 ? 1.5 : 1;
      const intens = tr.intens; const focus = tr.focus;
      club.cond = U.clamp((club.cond || 0) + (focus === 'kondition' ? 1.2 * pre : focus === 'allround' ? 0.1 : -0.5), 0, 10);
      club.tac = U.clamp((club.tac || 0) + (focus === 'taktik' ? 1.2 * pre : focus === 'allround' ? 0.1 : -0.5), 0, 10);
      if (club.camp) { club.cond = U.clamp(club.cond + club.camp.cond, 0, 10); club.tac = U.clamp(club.tac + club.camp.tac, 0, 10); club.camp = null; }
      const devMul = [0.75, 1, 1.22][intens] * (focus === 'regeneration' ? 0.4 : 1) * (1 + 0.05 * (club.infra.train - 1)) * pre;
      const rec = [33, 26, 19][intens] + (focus === 'regeneration' ? 12 : 0) + 1.5 * (club.infra.med - 1);
      const injRisk = [0.0025, 0.0045, 0.0085][intens] * (1 - 0.1 * (club.infra.med - 1)) * (focus === 'regeneration' ? 0.5 : 1);
      for (const id of club.squad) {
        const p = world.players[id]; if (!p) continue;
        const age = year - p.by;
        // Verletzungen
        if (p.inj > 0) { p.inj--; if (p.inj === 0) { p.fit = Math.min(p.fit, 80); p.injT = ''; if (cid === world.user) G.news(world, 'Wieder fit', p.name + ' ist zurück im Mannschaftstraining.', 'team'); } }
        else if (R.chance(injRisk * (p.tr.indexOf('verletzlich') >= 0 ? 2 : 1) * (p.fit < 60 ? 1.6 : 1))) {
          const wks = G.injure(world, p, club);
          if (cid === world.user) G.news(world, 'Trainingsverletzung', p.name + ' verletzt sich im Training (' + p.injT + ') und fehlt etwa ' + wks + (wks === 1 ? ' Woche.' : ' Wochen.'), 'team');
        }
        // Frische, Form, Moral
        p.fit = U.clamp(p.fit + (p.inj > 0 ? rec * 0.6 : rec), 30, 100);
        const sw = p.tr.indexOf('launisch') >= 0 ? 9 : p.tr.indexOf('musterprofi') >= 0 ? 3 : 5;
        p.form = U.clamp(p.form + R.gauss() * sw + (52 - p.form) * 0.12 + (focus === 'torschuss' && FM.POS_GROUP[p.pos] === 'S' ? 2.5 : 0) + (focus === 'regeneration' ? 1 : 0), 5, 99);
        p.mor = U.clamp(p.mor + (66 - p.mor) * 0.06 + (focus === 'regeneration' ? 1 : 0) - (intens === 2 ? 0.6 : 0) - ((p.bench || 0) > 5 && p.ovr >= Team.level(world, club) - 1 ? 2 : 0), 5, 99);
        // Entwicklung
        const gap = p.pot - p.ovr; let d = 0; const aging = p.pos === 'TW' ? age - 2 : age;
        if (aging <= 23 && gap > 0) d = Math.min(0.09, 0.016 + gap * 0.0065) * (focus === 'technik' ? 1.2 : 1);
        else if (aging <= 27 && gap > 0) d = 0.004 + gap * 0.003;
        if (aging >= 29) d -= (aging - 28) * 0.0125;
        if (d > 0) {
          d *= devMul * (p.st.ap > 0 && (p.bench || 0) < 3 ? 1.15 : 0.92);
          if (p.tr.indexOf('musterprofi') >= 0) d *= 1.25; if (p.tr.indexOf('trainingsmuffel') >= 0) d *= 0.7;
          if (p.inj > 0) d *= 0.2;
        }
        p.xp += d;
        while (p.xp >= 1 && p.ovr < 99) { p.ovr++; p.xp -= 1; if (p.ovr > p.pot) p.pot = p.ovr; }
        while (p.xp <= -1 && p.ovr > 30) { p.ovr--; p.xp += 1; if (aging >= 29) p.pot = Math.min(p.pot, p.ovr + 1); }
        p.val = FM.Gen.valueFor(p, age, world.season);
      }
    }
    for (const id in world.players) { const p = world.players[id]; if (!p.club) { p.fit = 100; p.val = FM.Gen.valueFor(p, year - p.by, world.season); } }
  }

  /* Trainingslager (einmal pro Saison, in der Vorbereitung oder Winterpause) */
  G.CAMPS = [
    { n: 'Höhenluft in den Alpen', d: 'Kondition bolzen auf 1.800 Metern.', cond: 3, tac: 0.5, cost: 260e3 },
    { n: 'Taktikschule an der Algarve', d: 'Laufwege, Standards, Videoanalyse – und abends Meerblick.', cond: 0.5, tac: 3, cost: 320e3 },
    { n: 'Sportschule um die Ecke', d: 'Solide, günstig, Jugendherbergs-Charme.', cond: 1.3, tac: 1.3, cost: 60e3 },
  ];
  G.campCost = function (club, i) { return U.roundMoney(G.CAMPS[i].cost * { 1: 1, 2: 0.5, 3: 0.22, 4: 0.1 }[club.tier]); };
  G.campAllowed = function (world) { return world.week <= 3 || world.week === 22 || world.week === 23; };
  G.bookCamp = function (world, i) {
    const club = G.user(world); const camp = G.CAMPS[i];
    if (!camp) return 'Unbekanntes Trainingslager.';
    if (!G.campAllowed(world)) return 'Ein Trainingslager ist nur in der Vorbereitung oder in der Winterpause möglich.';
    if (club.campDone === world.week + world.season * 100) return 'Diese Woche ist die Mannschaft bereits im Trainingslager.';
    if (club.campDone && Math.floor(club.campDone / 100) === world.season && ((club.campDone % 100 <= 3) === (world.week <= 3))) return 'In diesem Abschnitt war die Mannschaft schon im Trainingslager.';
    const cost = G.campCost(club, i);
    if (club.money < cost) return 'Dafür reicht das Geld nicht.';
    E.add(world, club, 'misc', -cost); club.camp = { cond: camp.cond, tac: camp.tac }; club.campDone = world.season * 100 + world.week;
    Team.squad(world, club).forEach((p) => { p.mor = U.clamp(p.mor + 3, 5, 99); });
    return '';
  };

  /* ---------- Wochenabschluss ---------- */
  G.endWeek = function (world) {
    const out = { events: [] };
    for (const cid in world.clubs) { const club = world.clubs[cid]; E.weekly(world, club); E.buildTick(world, club); }
    weeklyPlayers(world);
    FM.Transfer.weekly(world);
    aiFinanceGuard(world);
    boardCheck(world);
    world.week++; world.stage = 0;
    weekStart(world);
    return out;
  };

  function weekStart(world) {
    const wk = Cal.week(world); const club = G.user(world);
    // Testspiel ansetzen
    for (const s of ['mid', 'we']) {
      if (wk[s] && wk[s].t === 'friendly' && !world.friendlies[wk.w] && club) {
        const pool = G.clubList(world).filter((c) => c.id !== club.id && Math.abs(c.tier - club.tier) <= 1 && c.tier !== club.tier);
        const opp = R.pick(pool.length ? pool : G.clubList(world).filter((c) => c.id !== club.id));
        const home = R.chance(0.5);
        world.friendlies[wk.w] = { h: home ? club.id : opp.id, a: home ? opp.id : club.id, hg: 0, ag: 0, p: 0 };
      }
    }
    if (world.week === 4 && world.youthOffer && world.youthOffer.length) {
      for (const id of world.youthOffer) delete world.players[id];
      world.youthOffer = [];
      G.news(world, 'Jugendspieler abgewandert', 'Die nicht übernommenen Talente haben sich anderen Vereinen angeschlossen.', 'team');
    }
    if (wk.w === 10) G.news(world, 'Transferfenster geschlossen', 'Der Sommer-Transfermarkt ist zu. Vereinslose Spieler dürfen weiterhin verpflichtet werden.', 'transfer');
    if (wk.w === 22) G.news(world, 'Winter-Transferfenster geöffnet', 'Bis einschließlich Woche 26 darf wieder gehandelt werden.', 'transfer');
    if (wk.w === 27) G.news(world, 'Transferfenster geschlossen', 'Das Winter-Transferfenster ist beendet.', 'transfer');
    if (club && (wk.w === 20 || wk.w === 36)) {
      const ending = Team.squad(world, club).filter((p) => p.until <= world.season + 1);
      if (ending.length) G.news(world, 'Auslaufende Verträge', ending.length + ' Verträge enden im Sommer: ' + ending.slice(0, 8).map((p) => p.name).join(', ') + (ending.length > 8 ? ' …' : '') + '. Ohne Verlängerung gehen die Spieler ablösefrei.', 'team');
    }
    if (club && world.week > 4 && !world.pendingEvent && R.chance(0.16)) world.pendingEvent = FM.Events.roll(world);
  }
  G.weekStart = weekStart;

  // KI-Klubs gehen nie pleite: bei Schieflage wird der wertvollste entbehrliche Spieler ins Ausland verkauft
  function aiFinanceGuard(world) {
    for (const cid in world.clubs) {
      const club = world.clubs[cid]; if (cid === world.user) continue;
      const limit = -E.yearIncome(world, club) * 0.12;
      if (club.money < limit) {
        const sq = U.sortBy(Team.squad(world, club), (p) => p.val, true);
        const p = sq[R.int(0, Math.min(3, sq.length - 1))];
        if (p && club.squad.length > 20) { FM.Transfer.sellAbroad(world, p, p.val, true); }
        if (club.money < limit) club.money = Math.round(limit * 0.5); // Gönner gleicht den Rest aus
      }
    }
  }

  function boardCheck(world) {
    const club = G.user(world); if (!club) return;
    const line = E.creditLine(world, club);
    if (club.money < -line) {
      club.debtWeeks = (club.debtWeeks || 0) + 1;
      if (club.debtWeeks === 1) G.news(world, 'Der Vorstand ist alarmiert', 'Das Konto ist weit überzogen (' + U.money(club.money) + '). Wenn sich das nicht innerhalb von vier Wochen ändert, greift der Vorstand ein.', 'board');
      if (club.debtWeeks >= 5) {
        const sq = U.sortBy(Team.squad(world, club), (p) => p.val, true);
        const p = sq[0];
        if (p && club.squad.length > 16) {
          FM.Transfer.sellAbroad(world, p, U.roundMoney(p.val * 0.8), true);
          G.news(world, 'Notverkauf', 'Der Vorstand hat ' + p.name + ' über deinen Kopf hinweg für ' + U.money(U.roundMoney(p.val * 0.8)) + ' ins Ausland verkauft, um die Zahlungsfähigkeit zu sichern.', 'board');
        } else { club.money = Math.round(-line * 0.5); G.news(world, 'Bürgschaft', 'Ein Gönner springt mit einer Bürgschaft ein. Der Vorstand ist trotzdem bedient.', 'board'); }
        club.board.trust = U.clamp(club.board.trust - 18, 0, 100); club.debtWeeks = 0;
      }
    } else club.debtWeeks = 0;
    const played = Cal.playedRounds(world, club.tier);
    if (club.tier > 3) return;
    if (club.board.trust < 7 && played >= 12 && !world.sackGrace) { G.sack(world, 'Der Vorstand hat das Vertrauen verloren. Nach der sportlichen Talfahrt wirst du mit sofortiger Wirkung freigestellt.'); }
    else if (club.board.trust < 22 && played >= 6 && !club.board.warned) { club.board.warned = 1; G.news(world, 'Der Stuhl wackelt', 'Der Vorstand ist mit der Entwicklung unzufrieden. Es müssen dringend Ergebnisse her.', 'board'); }
    else if (club.board.trust > 40) club.board.warned = 0;
    if (club.board.trust < 45) club.board.trust += 0.25; // Gras wächst über alte Niederlagen
    if (world.sackGrace) world.sackGrace--;
  }

  /* Entlassung: Es gibt immer mindestens ein neues Angebot – das Spiel endet nie in einer Sackgasse */
  G.sack = function (world, reason) {
    const club = G.user(world);
    const pool = U.sortBy(G.clubList(world).filter((c) => c.id !== club.id && c.tier <= 3 && !c.reserve && c.rep <= club.rep + 2), (c) => c.rep, true);
    const offers = [];
    const start = Math.min(pool.length - 3, Math.max(0, Math.floor(pool.length * 0.25)));
    const cand = R.shuffle(pool.slice(Math.max(0, start))).slice(0, 3);
    for (const c of cand) offers.push(c.id);
    if (offers.length < 2) { // zu wenige passende Klubs: die kleinsten Profivereine fragen an
      for (const c of U.sortBy(G.clubList(world).filter((x) => x.id !== club.id && x.tier <= 3 && !x.reserve), (x) => x.rep)) { if (offers.length >= 3) break; if (offers.indexOf(c.id) < 0) offers.push(c.id); }
    }
    world.sacked = { reason, from: club.id, offers };
    G.news(world, 'Entlassen', reason, 'board');
  };
  G.takeJob = function (world, cid) {
    const old = G.user(world); if (old) { old.lineup = null; old.fin = null; }
    world.user = cid; world.sacked = null; world.sackGrace = 12;
    const club = G.user(world);
    club.board.trust = 60; club.fin = {}; club.training = { focus: 'allround', intens: 1 };
    club.lineup = Team.autoLineup(world, club, club.formation);
    E.setGoal(world, club);
    world.offers = []; world.youthOffer = [];
    G.news(world, 'Neuer Job', 'Du übernimmst ab sofort ' + club.name + '. Saisonziel: ' + club.board.goal + '.', 'board');
  };

  /* ---------- Saisonabschluss ---------- */
  G.seasonEnd = function (world) {
    const sum = { season: world.season, champs: {}, up: [], down: [], cup: world.cup.winner, user: null, scorers: [] };
    const tabs = { 1: Cal.table(world, 1), 2: Cal.table(world, 2), 3: Cal.table(world, 3) };
    const user = G.user(world); const uTier = user.tier; const uRow = tabs[uTier] ? tabs[uTier].find((r) => r.cid === user.id) : null;
    for (const t of [1, 2, 3]) sum.champs[t] = tabs[t][0].cid;
    // Preisgelder und Vorjahresplatz
    for (const t of [1, 2, 3]) tabs[t].forEach((r) => {
      const c = world.clubs[r.cid]; c.lastPos = r.pos; c.lastTier = t;
      const prize = t === 1 ? (19 - r.pos) * 0.6e6 : t === 2 ? (19 - r.pos) * 0.12e6 : (21 - r.pos) * 20e3;
      E.add(world, c, 'prize', prize);
    });
    // Auf- und Abstieg
    const move = (cid, to, list) => { world.clubs[cid].tier = to; list.push({ cid, to }); };
    const rl1 = world.releg && world.releg[0], rl2 = world.releg && world.releg[1];
    const e3 = tabs[3].filter((r) => !world.clubs[r.cid].reserve);
    const t1 = tabs[1], t2 = tabs[2], t3 = tabs[3];
    const moves = [];
    moves.push([t1[17].cid, 2, 'down'], [t1[16].cid, 2, 'down'], [t2[0].cid, 1, 'up'], [t2[1].cid, 1, 'up']);
    if (rl1 && rl1.winner === rl1.lower) moves.push([rl1.upper, 2, 'down'], [rl1.lower, 1, 'up']);
    moves.push([t2[17].cid, 3, 'down'], [t2[16].cid, 3, 'down'], [e3[0].cid, 2, 'up'], [e3[1].cid, 2, 'up']);
    if (rl2 && rl2.winner === rl2.lower) moves.push([rl2.upper, 3, 'down'], [rl2.lower, 2, 'up']);
    const n3 = t3.length; const down3 = [t3[n3 - 1].cid, t3[n3 - 2].cid, t3[n3 - 3].cid, t3[n3 - 4].cid];
    for (const cid of down3) moves.push([cid, 4, 'down']);
    const am = G.clubList(world).filter((c) => c.tier === 4);
    const ups = []; const pool = am.slice();
    for (let i = 0; i < 4 && pool.length; i++) { const c = R.weighted(pool, (x) => Math.pow(Team.level(world, x) / 50, 8)); pool.splice(pool.indexOf(c), 1); ups.push(c.id); }
    for (const cid of ups) moves.push([cid, 3, 'up']);
    const lvl3 = U.avg(t3, (r) => Team.level(world, world.clubs[r.cid]));
    for (const cid of ups) boostPromoted(world, world.clubs[cid], lvl3 - 2.5);
    for (const mv of moves) move(mv[0], mv[1], mv[2] === 'up' ? sum.up : sum.down);
    // Torjäger
    const all = Object.keys(world.players).map((k) => world.players[k]).filter((p) => p.club && p.st.go > 0);
    for (const t of [1, 2, 3]) {
      const ids = {}; tabs[t].forEach((r) => { ids[r.cid] = 1; });
      const best = U.sortBy(all.filter((p) => ids[p.club]), (p) => p.st.go * 1000 - p.st.ap, true)[0];
      if (best) sum.scorers.push({ tier: t, pid: best.id, name: best.name, club: best.club, go: best.st.go });
    }
    // Bilanz des Spielers
    if (uRow) {
      const target = user.board.target; const diff = target - uRow.pos;
      let verdict; let dt;
      if (diff >= 3) { verdict = 'Das Saisonziel wurde klar übertroffen. Der Vorstand ist begeistert.'; dt = 20; }
      else if (diff >= 0) { verdict = 'Das Saisonziel wurde erreicht. Der Vorstand ist zufrieden.'; dt = 12; }
      else if (diff >= -3) { verdict = 'Das Saisonziel wurde knapp verfehlt. Der Vorstand erwartet eine Steigerung.'; dt = -5; }
      else { verdict = 'Das Saisonziel wurde deutlich verfehlt. Der Vorstand ist verärgert.'; dt = -14; }
      user.board.trust = U.clamp(user.board.trust + dt, 0, 100);
      sum.user = { cid: user.id, tier: uTier, pos: uRow.pos, pts: uRow.pts, goal: user.board.goal, verdict, moved: (sum.up.concat(sum.down).find((m) => m.cid === user.id) || {}).to || 0 };
      if (uRow.pos === 1) { user.fans = U.clamp(user.fans + 15, 0, 100); }
    }
    world.history.push({ s: world.season, champs: sum.champs, cup: sum.cup, u: sum.user ? { cid: user.id, tier: uTier, pos: uRow.pos, pts: uRow.pts } : null, scorers: sum.scorers.map((s) => ({ tier: s.tier, name: s.name, club: s.club, go: s.go })) });
    world.lastSeason = sum;
    FM.Transfer.seasonEnd(world, sum);
    // Entlassung zum Saisonende?
    const sackNow = uRow && user.board.trust < 12 && !world.sackGrace;
    startSeason(world);
    if (G.user(world).tier === 4) G.sack(world, 'Der Abstieg in die Regionalliga kostet dich den Job. Der Verein plant den Neuaufbau ohne dich.');
    else if (sackNow) G.sack(world, 'Nach der enttäuschenden Saison trennt sich der Verein von dir.');
    return sum;
  };

  function startSeason(world) {
    world.season++; world.week = 1; world.stage = 0;
    world.cal = Cal.build(); world.releg = null; world.friendlies = {}; world.lastOthers = null;
    const clubs = G.clubList(world);
    for (const t of [1, 2, 3]) world.leagues[t] = { clubs: clubs.filter((c) => c.tier === t).map((c) => c.id), rounds: [] };
    for (const t of [1, 2, 3]) world.leagues[t].rounds = Cal.roundRobin(world.leagues[t].clubs);
    for (const id in world.players) {
      const p = world.players[id];
      p.st = FM.Gen.blankStats(); p.yel = 0; p.sus = 0; p.fit = 100; p.inj = Math.max(0, p.inj - 7); if (!p.inj) p.injT = ''; p.bench = 0; p.form = U.clamp(50 + R.gauss() * 6, 20, 80);
    }
    for (const c of clubs) {
      c.euro = c.lastTier === 1 && c.lastPos <= 6 && c.tier === 1 ? E.EURO[c.lastPos - 1] : 0;
      if (c.euro) E.add(world, c, 'euro', c.euro);
      c.fanbase = Math.round(c.fanbase * (0.97 + c.fans / 1600)); // Fanbasis wächst und schrumpft langsam mit der Stimmung
      c.rep = U.clamp(Math.round(c.rep * 0.9 + repTarget(world, c) * 0.1), 20, 99);
      if (c.id !== world.user) {
        c.formation = Team.chooseFormation(world, c);
        c.sponsor = { name: E.SPONSORS[FM.hash(c.id + world.season) % E.SPONSORS.length], base: U.roundMoney(E.sponsorBase(c)), win: 0, until: world.season };
        aiInvest(world, c);
      } else {
        const old = c.fin; c.finPrev = old; c.fin = {}; if (c.euro) c.fin.euro = c.euro;
        if (c.sponsor && c.sponsor.until < world.season) c.sponsor = null;
        world.sponsorOffers = c.sponsor ? null : E.sponsorOffers(world, c);
        c.campDone = 0;
      }
      E.setGoal(world, c);
      c.board.warned = 0;
    }
    Cal.cupInit(world);
    const u = G.user(world);
    if (u) {
      Team.repair(world, u);
      G.news(world, 'Saison ' + Cal.seasonLabel(world.season), 'Trainingsauftakt! Saisonziel des Vorstands: ' + u.board.goal + '.' + (u.euro ? ' Für die Europapokal-Teilnahme fließen pauschal ' + U.money(u.euro) + '.' : ''), 'board');
    }
    weekStart(world);
  }
  G.startSeasonInternal = startSeason;

  function repTarget(world, c) {
    const lvl = Team.level(world, c);
    return U.clamp(2.36 * lvl - 106 + (c.tier === 1 ? 0 : c.tier === 2 ? -2 : -4) + (c.rb || 0), 20, 99);
  }
  // Aufsteiger aus der Regionalliga verstärken ihren Kader auf Drittliga-Niveau
  function boostPromoted(world, c, target) {
    const shift = Math.round(target - Team.level(world, c)); if (shift <= 0) return;
    for (const p of Team.squad(world, c)) { p.ovr = Math.min(90, p.ovr + shift); p.pot = Math.max(p.pot, p.ovr); p.wage = FM.Gen.wageFor(p.ovr, FM.age(world, p)); }
  }
  function aiInvest(world, c) { // KI baut gelegentlich aus, damit die Liga nicht stehen bleibt
    const cap = E.yearIncome(world, c) * 0.4;
    if (c.money > cap) c.money = Math.round(cap + (c.money - cap) * 0.4); // Überschüsse fließen in Rücklagen, Nachwuchs, Steine
    if (c.money > E.yearIncome(world, c) * 0.5 && R.chance(0.3)) {
      const key = R.pick(['train', 'youth', 'med', 'shop']); const k = E.infraCost(c, key);
      if (k && c.money > k.cost * 2) { c.money -= k.cost; c.infra[key]++; }
    }
  }

  /* Weiterklicken ohne eigenes Live-Spiel (Tests, „Sofortergebnis“, Auto-Modus) */
  /* Co-Trainer: stellt auf, verlängert auslaufende Verträge und übernimmt Talente (Auto-Modus, Tests) */
  G.assist = function (world) {
    const c = G.user(world); if (!c) return;
    c.lineup = Team.autoLineup(world, c, c.formation);
    if (world.week === 30 || world.week === 44) for (const p of Team.squad(world, c)) { if (p.until <= world.season + 1 && FM.age(world, p) < 34) FM.Transfer.renew(world, p.id, FM.Transfer.renewDemand(world, p), 2); }
    for (const id of (world.youthOffer || []).slice()) if (c.squad.length < 27) FM.Transfer.signYouth(world, id);
  };
  G.advanceAuto = function (world, assist) {
    if (world.sacked) { G.takeJob(world, world.sacked.offers[0]); }
    if (assist) G.assist(world);
    if (world.pendingEvent) FM.Events.resolve(world, 0);
    const st = G.nextStep(world);
    if (st.kind === 'slot') { G.runSlot(world, st.slot); return st; }
    if (st.kind === 'endWeek') { G.endWeek(world); return st; }
    if (st.kind === 'seasonEnd') { G.seasonEnd(world); return st; }
    return st;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
