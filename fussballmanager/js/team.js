/* FLUTLICHT · Mannschaft: Kader, Aufstellung, Prüfung, Notfall-Auffüllung */
(function (root) {
  'use strict';
  const FM = root.FM; const R = FM.R; const U = FM.U;
  const T = (FM.Team = {});

  T.squad = function (world, club) { return club.squad.map((id) => world.players[id]).filter(Boolean); };
  T.available = function (p, friendly) { return p.inj <= 0 && (friendly || p.sus <= 0); };

  function val(p, pos) { return p.ovr * FM.posFit(p, pos) * (0.72 + 0.28 * p.fit / 100) * (0.94 + 0.12 * p.form / 100); }

  /* Beste Elf für eine Formation: gierige Zuteilung + Verbesserungsdurchgang */
  T.bestXI = function (world, club, formation, friendly) {
    const slots = FM.FORMATIONS[formation];
    const pool = T.squad(world, club).filter((p) => T.available(p, friendly));
    const used = {}; const xi = new Array(11).fill(0);
    const order = slots.map((s, i) => i).sort((a, b) => (slots[a].pos === 'TW' ? -1 : 0) - (slots[b].pos === 'TW' ? -1 : 0));
    for (const i of order) {
      let best = null, bv = -1;
      for (const p of pool) { if (used[p.id]) continue; const v = val(p, slots[i].pos); if (v > bv) { bv = v; best = p; } }
      if (best) { xi[i] = best.id; used[best.id] = 1; }
    }
    const P = world.players;
    let improved = true, guard = 0;
    while (improved && guard++ < 6) {
      improved = false;
      for (let i = 0; i < 11; i++) for (let j = i + 1; j < 11; j++) {
        if (!xi[i] || !xi[j]) continue;
        const cur = val(P[xi[i]], slots[i].pos) + val(P[xi[j]], slots[j].pos);
        const alt = val(P[xi[i]], slots[j].pos) + val(P[xi[j]], slots[i].pos);
        if (alt > cur + 0.01) { const t = xi[i]; xi[i] = xi[j]; xi[j] = t; improved = true; }
      }
      for (let i = 0; i < 11; i++) {
        if (!xi[i]) continue;
        for (const p of pool) {
          if (used[p.id]) continue;
          if (val(p, slots[i].pos) > val(P[xi[i]], slots[i].pos) + 0.01) { delete used[xi[i]]; xi[i] = p.id; used[p.id] = 1; improved = true; }
        }
      }
    }
    let score = 0; for (let i = 0; i < 11; i++) if (xi[i]) score += val(P[xi[i]], slots[i].pos);
    return { xi, score, used };
  };

  function pickBench(world, club, used, friendly) {
    const pool = T.squad(world, club).filter((p) => !used[p.id] && T.available(p, friendly));
    const byOvr = U.sortBy(pool, (p) => p.ovr * (0.8 + 0.2 * p.fit / 100), true);
    const bench = []; const gk = byOvr.find((p) => p.pos === 'TW'); if (gk) bench.push(gk.id);
    for (const g of ['A', 'M', 'S', 'A', 'M', 'S']) {
      const p = byOvr.find((x) => FM.POS_GROUP[x.pos] === g && bench.indexOf(x.id) < 0); if (p && bench.length < 9) bench.push(p.id);
    }
    for (const p of byOvr) { if (bench.length >= 9) break; if (bench.indexOf(p.id) < 0 && p.pos !== 'TW') bench.push(p.id); }
    return bench;
  }

  function pickRoles(world, lineup) {
    const P = world.players; const field = lineup.xi.map((id) => P[id]).filter((p) => p && p.pos !== 'TW');
    const all = lineup.xi.map((id) => P[id]).filter(Boolean);
    const best = (fn) => { const s = U.sortBy(field, fn, true)[0]; return s ? s.id : 0; };
    lineup.pen = best((p) => p.ovr + (p.tr.indexOf('elfer') >= 0 ? 25 : 0) + (FM.POS_GROUP[p.pos] === 'S' ? 3 : 0));
    lineup.fk = best((p) => p.ovr + (p.tr.indexOf('freistoss') >= 0 ? 25 : 0) + (FM.POS_GROUP[p.pos] === 'M' ? 3 : 0));
    const cap = U.sortBy(all, (p) => (p.tr.indexOf('fuehrung') >= 0 ? 30 : 0) + p.ovr * 0.5 + (world.season - p.by) * 0.8, true)[0];
    lineup.cap = cap ? cap.id : 0;
  }

  T.autoLineup = function (world, club, formation, friendly) {
    T.ensureDepth(world, club, friendly);
    const f = formation || club.formation || '4-4-2';
    const b = T.bestXI(world, club, f, friendly);
    const lineup = { formation: f, xi: b.xi, bench: pickBench(world, club, b.used, friendly), pen: 0, fk: 0, cap: 0 };
    pickRoles(world, lineup);
    return lineup;
  };

  T.chooseFormation = function (world, club) {
    let best = '4-4-2', bv = -1;
    for (const f of FM.FORMATION_NAMES) {
      const b = T.bestXI(world, club, f, true);
      const bias = 1 + ((FM.hash(club.id + f) % 7) - 3) * 0.004; // leichte Vereinsvorlieben
      if (b.score * bias > bv) { bv = b.score * bias; best = f; }
    }
    return best;
  };

  /* Prüft die vom Spieler gesetzte Aufstellung. Gibt eine Liste verständlicher Probleme zurück. */
  T.validate = function (world, club, friendly) {
    const out = []; const L = club.lineup; const P = world.players;
    if (!L || !FM.FORMATIONS[L.formation]) return [{ k: 'none', text: 'Es ist keine Aufstellung festgelegt.' }];
    const slots = FM.FORMATIONS[L.formation]; const seen = {};
    for (let i = 0; i < 11; i++) {
      const p = P[L.xi[i]];
      if (!p || p.club !== club.id) { out.push({ k: 'empty', i, text: 'Position ' + slots[i].pos + ' ist nicht besetzt.' }); continue; }
      if (seen[p.id]) out.push({ k: 'dup', i, text: p.name + ' ist doppelt aufgestellt.' });
      seen[p.id] = 1;
      if (p.inj > 0) out.push({ k: 'inj', i, text: p.name + ' ist verletzt.' });
      else if (p.sus > 0 && !friendly) out.push({ k: 'sus', i, text: p.name + ' ist gesperrt.' });
    }
    const gk = P[L.xi[0]];
    if (gk && gk.pos !== 'TW' && gk.club === club.id) out.push({ k: 'gk', i: 0, warn: 1, text: gk.name + ' ist kein gelernter Torwart.' });
    for (const id of L.bench) {
      const p = P[id];
      if (!p || p.club !== club.id) out.push({ k: 'bench', text: 'Ein Bankplatz ist ungültig besetzt.' });
      else if (seen[id]) out.push({ k: 'bench', text: p.name + ' steht in der Startelf und auf der Bank.' });
    }
    return out;
  };
  T.hardProblems = function (world, club, friendly) { return T.validate(world, club, friendly).filter((x) => !x.warn); };

  /* Repariert die Aufstellung, ohne gültige Entscheidungen des Spielers zu verwerfen */
  T.repair = function (world, club, friendly) {
    T.ensureDepth(world, club, friendly);
    const P = world.players; let L = club.lineup;
    if (!L || !FM.FORMATIONS[L.formation] || !Array.isArray(L.xi)) { club.lineup = T.autoLineup(world, club, club.formation, friendly); return club.lineup; }
    const slots = FM.FORMATIONS[L.formation]; const used = {};
    const ok = (id) => { const p = P[id]; return p && p.club === club.id && T.available(p, friendly) && !used[id]; };
    for (let i = 0; i < 11; i++) { if (ok(L.xi[i])) used[L.xi[i]] = 1; else L.xi[i] = 0; }
    L.bench = (L.bench || []).filter((id) => { if (ok(id)) { used[id] = 1; return true; } return false; });
    for (let i = 0; i < 11; i++) {
      if (L.xi[i]) continue;
      const pos = slots[i].pos;
      // zuerst von der Bank, dann aus dem Restkader
      const cands = T.squad(world, club).filter((p) => T.available(p, friendly) && (!used[p.id] || L.bench.indexOf(p.id) >= 0) && L.xi.indexOf(p.id) < 0 && (pos === 'TW' ? true : p.pos !== 'TW'));
      const best = U.sortBy(cands, (p) => val(p, pos), true)[0];
      if (best) { L.xi[i] = best.id; used[best.id] = 1; const bi = L.bench.indexOf(best.id); if (bi >= 0) L.bench.splice(bi, 1); }
    }
    const usedAll = {}; L.xi.forEach((id) => { if (id) usedAll[id] = 1; }); L.bench.forEach((id) => { usedAll[id] = 1; });
    if (L.bench.length < 9) {
      const extra = pickBench(world, club, usedAll, friendly);
      const hasGK = L.bench.some((id) => P[id].pos === 'TW');
      for (const id of extra) { if (L.bench.length >= 9) break; if (P[id].pos === 'TW' && hasGK) continue; L.bench.push(id); }
    }
    L.bench = L.bench.slice(0, 9);
    const inXI = (id) => L.xi.indexOf(id) >= 0;
    if (!inXI(L.pen) || !inXI(L.fk) || !inXI(L.cap)) { const keep = { pen: L.pen, fk: L.fk, cap: L.cap }; pickRoles(world, L); for (const k of ['pen', 'fk', 'cap']) if (inXI(keep[k])) L[k] = keep[k]; }
    return L;
  };

  /* Aufstellung für ein Spiel: KI stellt frisch auf; beim Spieler wird notfalls repariert (nie ein Abbruch) */
  T.matchLineup = function (world, club, isUser, friendly) {
    if (isUser) {
      if (T.hardProblems(world, club, friendly).length || !club.lineup) T.repair(world, club, friendly);
      const L = club.lineup;
      return { formation: L.formation, xi: L.xi.slice(), bench: L.bench.slice(), pen: L.pen, fk: L.fk, cap: L.cap };
    }
    return T.autoLineup(world, club, club.formation, friendly);
  };

  /* Garantie: Jeder Klub kann immer elf Spieler inklusive Torwart aufbieten.
     Fehlen Spieler (Verletzungen, Sperren, Verkäufe), rücken Nachwuchskräfte auf. */
  T.ensureDepth = function (world, club, friendly) {
    const sq = T.squad(world, club); const av = sq.filter((p) => T.available(p, friendly));
    const need = [];
    const gks = av.filter((p) => p.pos === 'TW').length;
    for (let i = gks; i < 2; i++) if (sq.filter((p) => p.pos === 'TW').length + need.length < 4 || gks === 0) need.push('TW');
    const field = av.length - gks;
    const cnt = (g) => av.filter((p) => FM.POS_GROUP[p.pos] === g).length;
    if (cnt('A') < 4) for (let i = cnt('A'); i < 4; i++) need.push(R.pick(['IV', 'IV', 'LV', 'RV']));
    if (cnt('M') < 4) for (let i = cnt('M'); i < 4; i++) need.push(R.pick(['DM', 'ZM', 'ZM', 'OM']));
    if (cnt('S') < 3) for (let i = cnt('S'); i < 3; i++) need.push(R.pick(['ST', 'LA', 'RA']));
    let extra = 15 - (field + need.filter((x) => x !== 'TW').length);
    while (extra-- > 0) need.push(R.pick(['IV', 'ZM', 'ST', 'LV', 'RV', 'DM', 'LA', 'RA']));
    if (!need.length) return [];
    const lvl = T.level(world, club);
    const made = [];
    for (const pos of need) {
      const p = FM.Gen.genPlayer(world, { pos, age: R.int(17, 19), mean: lvl - 14, sd: 2.5, club: club.id, nat: 'GER', until: FM.Cal.year(world) + 2 });
      p.wage = FM.Gen.wageFor(p.ovr, 18); p.youth = 1;
      club.squad.push(p.id); made.push(p);
    }
    if (world.user === club.id && made.length) {
      FM.Game.news(world, 'Nachwuchs rückt auf', 'Personalnot! Aus der eigenen Jugend rücken auf: ' + made.map((p) => p.name + ' (' + p.pos + ')').join(', ') + '.', 'team');
    }
    return made;
  };

  /* Spielstärke der ersten Elf (ohne Tagesform) – Grundlage für Erwartungen und KI-Entscheidungen */
  T.level = function (world, club) {
    const sq = U.sortBy(T.squad(world, club), (p) => p.ovr, true).slice(0, 14);
    if (!sq.length) return 50;
    let s = 0, w = 0; sq.forEach((p, i) => { const k = i < 11 ? 1 : 0.4; s += p.ovr * k; w += k; });
    return s / w;
  };
  T.wageBill = function (world, club) { return U.sum(T.squad(world, club), (p) => p.wage); };
  T.groupCount = function (world, club) {
    const c = { T: 0, A: 0, M: 0, S: 0 }; T.squad(world, club).forEach((p) => { c[FM.POS_GROUP[p.pos]]++; }); return c;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
