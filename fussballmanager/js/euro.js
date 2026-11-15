/* FLUTLICHT · Europapokal: Champions League, Europa League, Conference League
   Format wie seit 2024/25: Ligaphase mit 36 Klubs (jeder acht bzw. sechs Spiele gegen verschiedene Gegner),
   Platz 1–8 direkt ins Achtelfinale, Platz 9–24 in die Playoffs, danach Hin- und Rückspiele bis zum Finale. */
(function (root) {
  'use strict';
  const FM = root.FM; const R = FM.R; const U = FM.U; const E = FM.Econ; const Team = FM.Team;
  const EU = (FM.Euro = {});

  EU.ORDER = ['CL', 'EL', 'ECL'];
  EU.COMPS = {
    CL: { n: 'Champions League', md: 8, est: 42e6, start: 12e6, win: 1.5e6, draw: 0.5e6, pos: 0.2e6, po: 0.8e6, r16: 7e6, qf: 8e6, sf: 10e6, f: 12e6, w: 4e6 },
    EL: { n: 'Europa League', md: 8, est: 12e6, start: 3.5e6, win: 0.4e6, draw: 0.13e6, pos: 0.055e6, po: 0.25e6, r16: 1.5e6, qf: 2e6, sf: 3.5e6, f: 5e6, w: 4e6 },
    ECL: { n: 'Conference League', md: 6, est: 7e6, start: 2.5e6, win: 0.3e6, draw: 0.1e6, pos: 0.03e6, po: 0.15e6, r16: 0.6e6, qf: 1e6, sf: 2e6, f: 3e6, w: 2e6 },
  };
  EU.STAGES = ['po', 'r16', 'qf', 'sf', 'f'];
  EU.STAGE_NAME = { po: 'Playoffs', r16: 'Achtelfinale', qf: 'Viertelfinale', sf: 'Halbfinale', f: 'Finale' };
  EU.natOf = function (c) { return c.tier === 9 ? c.nat || '?' : 'GER'; };
  EU.intl = function (world) { return FM.Game.clubList(world).filter((c) => c.tier === 9); };
  EU.compOf = function (world, cid) { // in welchem Wettbewerb spielt der Klub diese Saison?
    if (!world.euro) return null;
    for (const k of EU.ORDER) if (world.euro.comps[k] && world.euro.comps[k].teams.indexOf(cid) >= 0) return k;
    return null;
  };

  /* ---------- Auslosung der Ligaphase ---------- */
  // Ein Spieltag = zufällige Paarung aller Klubs; kein Gegner doppelt, keine Duelle innerhalb eines Landes.
  function matchday(world, teams, used, strict) {
    const clubs = world.clubs;
    for (let attempt = 0; attempt < 400; attempt++) {
      const free = {}; teams.forEach((t) => { free[t] = 1; }); const pairs = []; let ok = true;
      const order = R.shuffle(teams);
      for (const t of order) {
        if (!free[t]) continue;
        const cand = order.filter((o) => o !== t && free[o] && !used[t + '|' + o] && (!strict || EU.natOf(clubs[t]) !== EU.natOf(clubs[o])));
        if (!cand.length) { ok = false; break; }
        const o = R.pick(cand); free[t] = 0; free[o] = 0; pairs.push([t, o]);
      }
      if (ok) return pairs;
    }
    return null;
  }
  // Heimrecht: Jeder Klub soll gleich viele Heim- wie Auswärtsspiele haben. Weil jeder Klub eine gerade Zahl
  // an Spielen hat, lässt sich das immer erreichen (Rundlauf über alle Paarungen, Heimrecht in Laufrichtung).
  function orient(teams, edges) {
    const adj = {}; teams.forEach((t) => { adj[t] = []; });
    edges.forEach((e, i) => { adj[e.x].push(i); adj[e.y].push(i); });
    const done = new Array(edges.length).fill(false); const ptr = {}; teams.forEach((t) => { ptr[t] = 0; });
    for (const start of teams) {
      let cur = start;
      for (;;) {
        const list = adj[cur]; while (ptr[cur] < list.length && done[list[ptr[cur]]]) ptr[cur]++;
        if (ptr[cur] >= list.length) break;
        const ei = list[ptr[cur]]; const e = edges[ei]; done[ei] = true;
        const next = e.x === cur ? e.y : e.x; e.h = cur; e.a = next; cur = next;
      }
    }
  }
  EU.drawLeague = function (world, teams, nMd) {
    const used = {}; const edges = [];
    for (let md = 0; md < nMd; md++) {
      const pairs = matchday(world, teams, used, true) || matchday(world, teams, used, false);
      if (!pairs) throw new Error('Europapokal-Auslosung nicht möglich');
      for (const p of pairs) { used[p[0] + '|' + p[1]] = 1; used[p[1] + '|' + p[0]] = 1; edges.push({ x: p[0], y: p[1], md }); }
    }
    orient(teams, edges);
    const rounds = []; for (let md = 0; md < nMd; md++) rounds.push([]);
    for (const e of edges) rounds[e.md].push({ h: e.h, a: e.a, hg: 0, ag: 0, p: 0 });
    return rounds;
  };

  /* ---------- Saisonstart: Teilnehmerfelder und Auslosung ---------- */
  EU.init = function (world) {
    const intl = EU.intl(world);
    if (!intl.length) { world.euro = null; return; }
    const q = world.euroQual || { CL: [], EL: [], ECL: [] };
    const first = !world.euroStarted; world.euroStarted = 1;
    // Ausländische Klubs: in der ersten Saison die echten Teilnehmerfelder, danach nach Spielstärke
    let pool;
    if (first && intl.every((c) => c.ec0)) pool = { CL: intl.filter((c) => c.ec0 === 'CL'), EL: intl.filter((c) => c.ec0 === 'EL'), ECL: intl.filter((c) => c.ec0 === 'ECL') };
    else {
      const ranked = U.sortBy(intl, (c) => Team.level(world, c) + R.gauss() * 1.3, true);
      const nCL = 36 - (q.CL || []).length, nEL = 36 - (q.EL || []).length;
      pool = { CL: ranked.slice(0, nCL), EL: ranked.slice(nCL, nCL + nEL), ECL: ranked.slice(nCL + nEL) };
    }
    world.euro = { comps: {} };
    for (const k of EU.ORDER) {
      let teams = (q[k] || []).filter((cid) => world.clubs[cid]).concat(pool[k].map((c) => c.id)).slice(0, 36);
      if (teams.length % 2) teams.pop(); // gerade Teilnehmerzahl nötig
      const def = EU.COMPS[k];
      world.euro.comps[k] = { teams, rounds: EU.drawLeague(world, teams, def.md), ko: [], winner: null, paid: 0 };
      for (const cid of teams) { const c = world.clubs[cid]; c.euro = c.tier === 9 ? 0 : def.est; if (c.tier !== 9) E.add(world, c, 'euro', def.start); }
    }
    const k = EU.compOf(world, world.user);
    if (k) {
      const u = world.clubs[world.user]; const opp = [];
      world.euro.comps[k].rounds.forEach((rd) => { const f = rd.find((x) => x.h === u.id || x.a === u.id); if (f) opp.push(world.clubs[f.h === u.id ? f.a : f.h].short + (f.h === u.id ? ' (H)' : ' (A)')); });
      FM.Game.news(world, EU.COMPS[k].n + ': Auslosung', 'Europa ruft! Startprämie: ' + U.money(EU.COMPS[k].start) + '. Die Gegner der Ligaphase: ' + opp.join(', ') + '.', 'match');
    }
  };

  EU.table = function (world, k) {
    const comp = world.euro.comps[k]; const rows = {};
    for (const cid of comp.teams) rows[cid] = { cid, sp: 0, s: 0, u: 0, n: 0, tf: 0, ta: 0, pts: 0, form: [] };
    for (const rd of comp.rounds) for (const f of rd) {
      if (!f.p) continue; const H = rows[f.h], A = rows[f.a];
      H.sp++; A.sp++; H.tf += f.hg; H.ta += f.ag; A.tf += f.ag; A.ta += f.hg;
      if (f.hg > f.ag) { H.s++; A.n++; H.pts += 3; H.form.push('S'); A.form.push('N'); }
      else if (f.hg < f.ag) { A.s++; H.n++; A.pts += 3; H.form.push('N'); A.form.push('S'); }
      else { H.u++; A.u++; H.pts++; A.pts++; H.form.push('U'); A.form.push('U'); }
    }
    const list = Object.keys(rows).map((x) => rows[x]);
    list.sort((x, y) => (y.pts - x.pts) || ((y.tf - y.ta) - (x.tf - x.ta)) || (y.tf - x.tf) || (y.s - x.s) || (FM.hash(x.cid + k + world.season) - FM.hash(y.cid + k + world.season)));
    list.forEach((r, i) => { r.pos = i + 1; r.form = r.form.slice(-5); });
    return list;
  };

  /* ---------- Spiele eines Termins ---------- */
  EU.slotItemsAll = function (world, def) { return EU.slotItems(world, def, true); };
  EU.slotItems = function (world, def, all) {
    const items = []; if (!world.euro) return items;
    for (const k of EU.ORDER) {
      const comp = world.euro.comps[k]; if (!comp) continue; const name = EU.COMPS[k].n;
      if (def.md) {
        const rd = comp.rounds[def.md - 1]; if (!rd) continue;
        for (const f of rd) if (all || !f.p) items.push({ f, kind: 'euro', ec: k, md: def.md, comp: name, label: def.md + '. Spieltag' });
      } else if (def.ko) {
        const st = comp.ko.find((s) => s.stage === def.ko); if (!st) continue;
        for (const tie of st.ties) {
          const f = tie.legs[def.leg || 0]; if (!f || (f.p && !all)) continue;
          const second = def.ko !== 'f' && def.leg === 1;
          items.push({ f, kind: 'euro', ec: k, stage: def.ko, leg: def.leg || 0, tie, comp: name, label: EU.STAGE_NAME[def.ko] + (def.ko === 'f' ? '' : second ? ' · Rückspiel' : ' · Hinspiel'),
            knockout: def.ko === 'f' || second, neutral: def.ko === 'f', agg: second ? [tie.legs[0].ag, tie.legs[0].hg] : null });
        }
      }
    }
    return items;
  };

  function pay(world, cid, amount) { const c = world.clubs[cid]; if (c && c.tier !== 9) E.add(world, c, 'euro', amount); }
  function mkTies(pairs, stage) { // pairs: [[zuerst Heimrecht, im Rückspiel Heimrecht]]
    return { stage, ties: pairs.map((p) => ({ a: p[0], b: p[1], legs: stage === 'f' ? [{ h: p[0], a: p[1], hg: 0, ag: 0, p: 0, n: 1 }] : [{ h: p[0], a: p[1], hg: 0, ag: 0, p: 0 }, { h: p[1], a: p[0], hg: 0, ag: 0, p: 0 }], w: null })) };
  }
  function userNews(world, k, stage) {
    const comp = world.euro.comps[k]; const st = comp.ko.find((s) => s.stage === stage); if (!st) return;
    const tie = st.ties.find((t) => t.a === world.user || t.b === world.user); if (!tie) return;
    const opp = world.clubs[tie.a === world.user ? tie.b : tie.a];
    FM.Game.news(world, EU.COMPS[k].n + ': ' + EU.STAGE_NAME[stage], stage === 'f' ? 'FINALE! Es geht gegen ' + opp.name + '.' : 'Der Gegner heißt ' + opp.name + '. ' + (tie.b === world.user ? 'Das Rückspiel findet zu Hause statt.' : 'Zuerst wird zu Hause gespielt.'), 'match');
  }

  /* Nach jedem Europapokal-Termin: Prämien, Tabellenabschluss, nächste Runde auslosen */
  EU.afterSlot = function (world, def) {
    if (!world.euro) return;
    for (const k of EU.ORDER) {
      const comp = world.euro.comps[k]; if (!comp) continue; const D = EU.COMPS[k];
      if (def.md) {
        const rd = comp.rounds[def.md - 1]; if (!rd || !rd.every((f) => f.p) || comp.paid >= def.md) continue;
        comp.paid = def.md;
        for (const f of rd) { if (f.hg > f.ag) pay(world, f.h, D.win); else if (f.hg < f.ag) pay(world, f.a, D.win); else { pay(world, f.h, D.draw); pay(world, f.a, D.draw); } }
        if (def.md === comp.rounds.length && !comp.ko.length) { // Ligaphase beendet
          const tab = EU.table(world, k); const n = tab.length;
          tab.forEach((r) => pay(world, r.cid, D.pos * (n - r.pos + 1)));
          const pairs = []; for (let i = 0; i < 8; i++) { const seeded = tab[8 + i], un = tab[23 - i]; if (seeded && un) pairs.push([un.cid, seeded.cid]); }
          comp.seeded = tab.slice(0, 8).map((r) => r.cid);
          comp.ko.push(mkTies(pairs, 'po'));
          for (const p of pairs) { pay(world, p[0], D.po); pay(world, p[1], D.po); }
          for (const cid of comp.seeded) pay(world, cid, D.r16);
          const me = tab.find((r) => r.cid === world.user);
          if (me) {
            if (me.pos <= 8) FM.Game.news(world, D.n, 'Platz ' + me.pos + ' in der Ligaphase – direkt im Achtelfinale! Prämie: ' + U.money(D.r16) + '.', 'match');
            else if (me.pos <= 24) userNews(world, k, 'po');
            else FM.Game.news(world, D.n, 'Platz ' + me.pos + ' in der Ligaphase. Das europäische Abenteuer ist für diese Saison beendet.', 'match');
          }
        }
      } else if (def.ko) {
        const st = comp.ko.find((s) => s.stage === def.ko); if (!st) continue;
        const last = def.ko === 'f' ? 0 : 1; if ((def.leg || 0) !== last) continue;
        if (!st.ties.every((t) => t.legs[last].p) || st.done) continue;
        st.done = 1;
        for (const t of st.ties) t.w = t.legs[last].w || t.b;
        const winners = st.ties.map((t) => t.w);
        if (def.ko === 'f') {
          comp.winner = winners[0]; pay(world, comp.winner, D.w);
          const c = world.clubs[comp.winner];
          if (comp.winner === world.user) { c.board.trust = U.clamp(c.board.trust + 25, 0, 100); c.fans = U.clamp(c.fans + 20, 0, 100); FM.Game.news(world, 'EUROPAPOKALSIEGER!', c.name + ' gewinnt die ' + D.n + '! Ein Abend für die Ewigkeit.', 'match'); }
          else FM.Game.news(world, D.n + ': Finale', c.name + ' gewinnt die ' + D.n + '.', 'match');
          continue;
        }
        const lost = st.ties.find((t) => (t.a === world.user || t.b === world.user) && t.w !== world.user);
        if (lost) FM.Game.news(world, D.n, 'Aus im ' + EU.STAGE_NAME[def.ko] + ' gegen ' + world.clubs[lost.w].name + '. Erhobenen Hauptes.', 'match');
        let pairs = []; let next;
        if (def.ko === 'po') { next = 'r16'; const s = R.shuffle(comp.seeded || []); const wn = R.shuffle(winners); for (let i = 0; i < Math.min(s.length, wn.length); i++) pairs.push([wn[i], s[i]]); winners.forEach((cid) => pay(world, cid, D.r16)); }
        else {
          next = EU.STAGES[EU.STAGES.indexOf(def.ko) + 1]; const wn = R.shuffle(winners);
          for (let i = 0; i + 1 < wn.length; i += 2) pairs.push([wn[i], wn[i + 1]]);
          winners.forEach((cid) => pay(world, cid, D[next]));
        }
        comp.ko.push(mkTies(pairs, next)); userNews(world, k, next);
      }
    }
  };

  /* Qualifikation für die nächste Saison (vor Auf- und Abstieg aufrufen) */
  EU.qualify = function (world, bundesliga, cupWinner) {
    const quota = world.euroQuota || { CL: 4, EL: 2, ECL: 1 };
    const order = bundesliga.map((r) => r.cid); const q = { CL: [], EL: [], ECL: [] }; const taken = {};
    const take = (k, cid) => { if (cid && !taken[cid] && world.clubs[cid] && !world.clubs[cid].reserve) { q[k].push(cid); taken[cid] = 1; return true; } return false; };
    for (const cid of order) { if (q.CL.length >= quota.CL) break; take('CL', cid); }
    if (quota.EL > 0) take('EL', cupWinner);
    for (const cid of order) { if (q.EL.length >= quota.EL) break; take('EL', cid); }
    for (const cid of order) { if (q.ECL.length >= quota.ECL) break; take('ECL', cid); }
    return q;
  };

  /* Ausländische Klubs halten ihr Niveau: Abgänge und Altersschwund werden durch Zugänge ausgeglichen */
  EU.refreshIntl = function (world) {
    const P = world.players;
    for (const c of EU.intl(world)) {
      const base = c.base || Team.level(world, c); let guard = 0;
      while (Team.level(world, c) < base - 0.6 && guard++ < 8) {
        const p = FM.Gen.genPlayer(world, { nat: c.nat, minAge: 20, maxAge: 27, ovr: Math.round(base + R.int(0, 4)), club: c.id, until: world.season + R.int(2, 4) });
        c.squad.push(p.id);
      }
      guard = 0;
      while (Team.level(world, c) > base + 1.5 && guard++ < 8) { // zu stark geworden: Leistungsträger wechseln in Ligen außerhalb der Spielwelt
        const best = U.sortBy(Team.squad(world, c), (p) => p.ovr, true)[R.int(0, 4)]; if (!best) break;
        const i = c.squad.indexOf(best.id); if (i >= 0) c.squad.splice(i, 1); delete P[best.id];
      }
      const sq = U.sortBy(Team.squad(world, c), (p) => p.ovr + (p.pos === 'TW' ? 6 : 0));
      let over = sq.length - 26;
      for (const p of sq) { if (over <= 0) break; const g = FM.POS_GROUP[p.pos]; if (Team.groupCount(world, c)[g] <= FM.Transfer.MIN[g] + 1) continue; const i = c.squad.indexOf(p.id); if (i >= 0) c.squad.splice(i, 1); delete P[p.id]; over--; }
    }
  };

  /* Sicherheitsnetz zum Saisonabschluss: Es darf kein Europapokalspiel offen bleiben */
  EU.winners = function (world) { const o = {}; if (world.euro) for (const k of EU.ORDER) o[k] = world.euro.comps[k] ? world.euro.comps[k].winner : null; return o; };
})(typeof globalThis !== 'undefined' ? globalThis : this);
