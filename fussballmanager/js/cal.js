/* FLUTLICHT · Kalender, Spielplan, Tabellen, Pokal-Auslosung */
(function (root) {
  'use strict';
  const FM = root.FM; const R = FM.R; const U = FM.U;
  const C = (FM.Cal = {});

  C.WEEKS = 47;               // letzte Woche = Saisonabschluss
  C.LEAGUE_NAME = { 1: 'Bundesliga', 2: '2. Bundesliga', 3: '3. Liga', 4: 'Regionalliga' };
  C.CUP_ROUND = ['1. Runde', '2. Runde', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
  const SKIP = { 4: 1, 9: 1, 13: 1, 30: 1 }; // Länderspielpausen: 1. und 2. Liga ruhen, die 3. Liga spielt
  const CUP_SLOT = { 8: 1, 14: 2, 22: 3, 31: 4 }; // Liga-Slot → Pokalrunde (Index) unter der Woche

  function slotWeek(s) { return 4 + s + (s > 17 ? 2 : 0); }

  /* Wochenplan einer Saison */
  C.build = function () {
    const weeks = [null];
    for (let w = 1; w <= C.WEEKS; w++) weeks.push({ w, mid: null, we: null, win: (w <= 9) || (w >= 22 && w <= 26), label: '' });
    weeks[1].label = 'Trainingsauftakt'; weeks[2].label = 'Vorbereitung'; weeks[3].label = 'Vorbereitung';
    weeks[2].we = { t: 'friendly' }; weeks[3].we = { t: 'friendly' };
    weeks[4].we = { t: 'cup', r: 0 }; weeks[4].label = 'DFB-Pokal';
    let md12 = 0;
    for (let s = 1; s <= 38; s++) {
      const w = slotWeek(s); const skip = !!SKIP[s];
      if (!skip) md12++;
      weeks[w].we = { t: 'league', md: [0, skip ? 0 : md12, skip ? 0 : md12, s] };
      weeks[w].label = skip ? 'Länderspielpause' : md12 + '. Spieltag';
      if (CUP_SLOT[s]) weeks[w].mid = { t: 'cup', r: CUP_SLOT[s] };
    }
    weeks[22].label = 'Winterpause'; weeks[23].label = 'Winterpause'; weeks[23].we = { t: 'friendly' };
    weeks[45].mid = { t: 'rel', leg: 0 }; weeks[45].we = { t: 'cup', r: 5 }; weeks[45].label = 'Relegation & Pokalfinale';
    weeks[46].we = { t: 'rel', leg: 1 }; weeks[46].label = 'Relegation';
    weeks[47].label = 'Saisonabschluss';
    return weeks;
  };
  C.week = function (world) { return world.cal[U.clamp(world.week, 1, C.WEEKS)]; };

  /* Datum: Woche 1 beginnt am letzten Juli-Montag der Saison */
  C.dateOf = function (season, week, dayOffset) {
    const d = new Date(Date.UTC(season, 6, 31));
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() - 1);
    d.setUTCDate(d.getUTCDate() + (week - 1) * 7 + (dayOffset || 0));
    return d;
  };
  C.date = function (world, dayOffset) { return C.dateOf(world.season, world.week, dayOffset == null ? 5 : dayOffset); };
  const DOW = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
  C.fmt = function (d, short) {
    const p = (n) => (n < 10 ? '0' : '') + n;
    return (short ? '' : DOW[d.getUTCDay()] + ' ') + p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
  };
  C.year = function (world) { return C.date(world).getUTCFullYear(); };
  C.month = function (world) { return C.date(world).getUTCMonth() + 1; };
  C.seasonLabel = function (season) { return season + '/' + String((season + 1) % 100).padStart(2, '0'); };
  FM.age = function (world, p) {
    const d = C.date(world);
    return d.getUTCFullYear() - p.by - (d.getUTCMonth() + 1 < p.bm ? 1 : 0);
  };

  /* Doppelrunde nach dem Kreisverfahren: jeder gegen jeden, Heimrecht in der Rückrunde getauscht */
  C.roundRobin = function (ids) {
    const arr = R.shuffle(ids); const n = arr.length; const first = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        let a = arr[i], b = arr[n - 1 - i];
        if (i === 0 ? r % 2 === 1 : i % 2 === 1) { const t = a; a = b; b = t; }
        pairs.push({ h: a, a: b, hg: 0, ag: 0, p: 0 });
      }
      first.push(pairs);
      arr.splice(1, 0, arr.pop());
    }
    const second = first.map((pairs) => pairs.map((f) => ({ h: f.a, a: f.h, hg: 0, ag: 0, p: 0 })));
    return first.concat(second);
  };

  /* Tabelle wird immer frisch aus den Ergebnissen berechnet – sie kann nie vom Spielplan abweichen */
  C.table = function (world, tier, uptoMd) {
    const L = world.leagues[tier]; const rows = {};
    for (const cid of L.clubs) rows[cid] = { cid, sp: 0, s: 0, u: 0, n: 0, tf: 0, ta: 0, pts: 0, form: [] };
    const max = uptoMd == null ? L.rounds.length : uptoMd;
    for (let r = 0; r < max; r++) {
      for (const f of L.rounds[r]) {
        if (!f.p) continue;
        const H = rows[f.h], A = rows[f.a];
        H.sp++; A.sp++; H.tf += f.hg; H.ta += f.ag; A.tf += f.ag; A.ta += f.hg;
        if (f.hg > f.ag) { H.s++; A.n++; H.pts += 3; H.form.push('S'); A.form.push('N'); }
        else if (f.hg < f.ag) { A.s++; H.n++; A.pts += 3; H.form.push('N'); A.form.push('S'); }
        else { H.u++; A.u++; H.pts++; A.pts++; H.form.push('U'); A.form.push('U'); }
      }
    }
    const list = Object.keys(rows).map((k) => rows[k]);
    list.sort((x, y) => (y.pts - x.pts) || ((y.tf - y.ta) - (x.tf - x.ta)) || (y.tf - x.tf) || (FM.hash(x.cid + world.season) - FM.hash(y.cid + world.season)));
    list.forEach((r, i) => { r.pos = i + 1; r.form = r.form.slice(-5); });
    return list;
  };
  C.posOf = function (world, cid) {
    const c = world.clubs[cid]; if (!world.leagues[c.tier]) return 0;
    const row = C.table(world, c.tier).find((r) => r.cid === cid); return row ? row.pos : 0;
  };
  C.playedRounds = function (world, tier) { // Anzahl komplett gespielter Spieltage
    const L = world.leagues[tier]; let n = 0;
    if (!L) return 0;
    for (const rd of L.rounds) { if (rd.every((f) => f.p)) n++; else break; }
    return n;
  };

  /* ---------- Pokal ---------- */
  C.cupDraw = function (world) {
    const cup = world.cup; const r = cup.rounds.length; const clubs = world.clubs;
    let alive = cup.alive.slice(); const fx = [];
    if (r === 0) {
      // Topf 1: Bundesliga + 14 Zweitligisten, Topf 2 (Heimrecht): übrige Zweitligisten, Drittligisten, Amateure
      const t1 = alive.filter((c) => clubs[c].tier === 1); let t2 = R.shuffle(alive.filter((c) => clubs[c].tier === 2));
      const need = 32 - t1.length; const pot1 = t1.concat(t2.slice(0, need)); const pot2 = R.shuffle(t2.slice(need).concat(alive.filter((c) => clubs[c].tier >= 3)));
      const p1 = R.shuffle(pot1);
      for (let i = 0; i < 32; i++) fx.push({ h: pot2[i], a: p1[i], hg: 0, ag: 0, p: 0 });
    } else {
      alive = R.shuffle(alive);
      for (let i = 0; i + 1 < alive.length; i += 2) {
        let h = alive[i], a = alive[i + 1];
        if (clubs[h].tier < clubs[a].tier) { const t = h; h = a; a = t; } // unterklassiger Klub hat Heimrecht
        fx.push({ h, a, hg: 0, ag: 0, p: 0, n: r === 5 ? 1 : 0 });
      }
    }
    cup.rounds.push(fx);
  };
  C.cupInit = function (world) {
    const all = Object.keys(world.clubs).map((k) => world.clubs[k]);
    const pros = all.filter((c) => c.tier <= 3 && !c.reserve).map((c) => c.id);
    const am = R.shuffle(all.filter((c) => c.tier === 4 && !c.reserve).map((c) => c.id));
    const alive = pros.concat(am.slice(0, 64 - pros.length)).slice(0, 64);
    world.cup = { rounds: [], alive, winner: null };
    C.cupDraw(world);
  };

  /* Alle Pflichtspiele eines Klubs (für Spielplan-Ansicht) */
  C.clubFixtures = function (world, cid) {
    const out = []; const c = world.clubs[cid];
    const L = world.leagues[c.tier];
    world.cal.forEach((wk) => {
      if (!wk) return;
      const add = (slot, where) => {
        if (!slot) return;
        if (slot.t === 'league' && L) {
          const md = c.tier <= 2 ? slot.md[1] : slot.md[3];
          if (md) { const f = L.rounds[md - 1].find((x) => x.h === cid || x.a === cid); if (f) out.push({ w: wk.w, where, comp: C.LEAGUE_NAME[c.tier], label: md + '. Spieltag', f }); }
        } else if (slot.t === 'cup') {
          const rd = world.cup.rounds[slot.r]; if (rd) { const f = rd.find((x) => x.h === cid || x.a === cid); if (f) out.push({ w: wk.w, where, comp: 'DFB-Pokal', label: C.CUP_ROUND[slot.r], f }); }
        } else if (slot.t === 'rel' && world.releg) {
          for (const rl of world.releg) { const f = rl.legs[slot.leg]; if (f && (f.h === cid || f.a === cid)) out.push({ w: wk.w, where, comp: 'Relegation', label: slot.leg ? 'Rückspiel' : 'Hinspiel', f }); }
        } else if (slot.t === 'friendly' && world.friendlies && world.friendlies[wk.w]) {
          const f = world.friendlies[wk.w]; if (f.h === cid || f.a === cid) out.push({ w: wk.w, where, comp: 'Testspiel', label: 'Testspiel', f });
        }
      };
      add(wk.mid, 'mid'); add(wk.we, 'we');
    });
    return out;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
