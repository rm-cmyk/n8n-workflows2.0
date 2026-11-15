/* FLUTLICHT · Neues Spiel aus der Datenbank aufbauen + Speichern/Laden mit Integritätsprüfung */
(function (root) {
  'use strict';
  const FM = root.FM; const R = FM.R; const U = FM.U; const Cal = FM.Cal; const E = FM.Econ; const Team = FM.Team; const Gen = FM.Gen;
  const W = (FM.World = {});

  function infraLevel(rep, salt) { return U.clamp(Math.round((rep - 30) / 14) + ((salt % 3) - 1 > 0 ? 1 : 0) - ((salt % 5) === 0 ? 1 : 0), 1, 5); }
  function startMoney(tier, rep) {
    if (tier === 1) return 4e6 + Math.pow(Math.max(0, rep - 55), 2) * 30e3;
    if (tier === 2) return 1.5e6 + Math.max(0, rep - 42) * 130e3;
    if (tier === 3) return 0.3e6 + Math.max(0, rep - 32) * 22e3;
    if (tier === 9) return 5e6 + Math.pow(Math.max(0, rep - 50), 2) * 40e3;
    return 0.1e6;
  }

  function mkClub(world, d, tier) {
    const h = FM.hash(d.id);
    const c = {
      id: d.id, name: d.name, short: d.short, city: d.city, stadium: d.stadium, cap: d.cap, tier, rep: d.rep, col: d.col || ['#2b6', '#fff'], coach: d.coach || '',
      reserve: d.reserve ? 1 : 0, squad: [], formation: '4-4-2', lineup: null, tactics: FM.defaultTactics(), training: { focus: 'allround', intens: 1 },
      money: U.roundMoney(startMoney(tier, d.rep)), loan: 0, ticket: E.TICKET[tier], sponsor: null, fanbase: d.fanbase || Math.round(d.cap * 0.8), fans: 55,
      infra: { train: infraLevel(d.rep, h), youth: infraLevel(d.rep, h >>> 3), med: infraLevel(d.rep, h >>> 6), shop: infraLevel(d.rep, h >>> 9) },
      buildS: null, buildI: null, board: { trust: 60, goal: '', target: 0, warned: 0 }, fin: null, cond: 2, tac: 2,
      lastPos: d.lastPos || 10, lastTier: d.lastTier || tier, euro: 0, wageF: 1, rb: d.rb || 0,
    };
    if (tier === 9) { c.nat = d.nat; c.ec0 = d.ec0; c.base = d.lvl; c.city = c.city || ''; }
    world.clubs[c.id] = c;
    return c;
  }

  const AM_TEMPLATE = ['TW', 'TW', 'IV', 'IV', 'IV', 'IV', 'LV', 'LV', 'RV', 'RV', 'DM', 'DM', 'ZM', 'ZM', 'ZM', 'OM', 'LA', 'LA', 'RA', 'RA', 'ST', 'ST', 'ST'];

  /* Ausländische Europapokal-Klubs (echte Kader, soweit die Quelle sie hergibt) in die Spielwelt setzen */
  W.addIntl = function (world) {
    const DB = FM.DB; const made = [];
    for (const d of DB.intl || []) {
      if (world.clubs[d.id]) continue;
      const c = mkClub(world, d, 9); made.push(c);
      if (d.p.length) {
        for (const r of d.p) {
          if (world.nameSet) world.nameSet[r[0]] = 1;
          const age = DB.season - r[4];
          const p = Gen.makePlayer(world, { name: r[0], nat: r[1], pos: r[2], pos2: r[3], by: r[4], bm: r[5], ovr: r[6], pot: r[7], no: r[8], club: c.id, tr: Gen.traitsFor(r[0], r[2], age, !!r[9]), until: world.season + 1 + (FM.hash(r[0] + 'c') % 4) });
          c.squad.push(p.id);
        }
      } else {
        for (const pos of AM_TEMPLATE) { const p = Gen.genPlayer(world, { pos, mean: d.lvl - 3, sd: 3, minAge: 19, maxAge: 32, club: c.id, nat: d.nat }); c.squad.push(p.id); }
      }
      Team.ensureDepth(world, c, true); c.formation = Team.chooseFormation(world, c); c.wageF = 1.4;
      for (const p of Team.squad(world, c)) p.wage = U.roundMoney(p.wage * 1.4);
    }
    if (!world.euroQual && DB.euro) world.euroQual = JSON.parse(JSON.stringify(DB.euro));
    if (!world.euroQuota && DB.euro) world.euroQuota = { CL: DB.euro.CL.length, EL: DB.euro.EL.length, ECL: DB.euro.ECL.length };
    return made;
  };

  W.create = function (opts) {
    const DB = FM.DB;
    const world = {
      v: FM.SAVE_VERSION, a: (opts.seed != null ? opts.seed : (Date.now() ^ (Math.random() * 1e9))) | 0, season: DB.season, week: 1, stage: 0,
      user: opts.clubId, manager: opts.manager || 'Trainer', players: {}, nextPid: 1, nextOid: 1, clubs: {}, leagues: {}, cup: null, releg: null, friendlies: {},
      news: [], ticker: [], offers: [], youthOffer: [], history: [], nameSet: {}, cal: Cal.build(), lastMatch: null, lastOthers: null, pendingEvent: null, sacked: null,
      sponsorOffers: null, lastSeason: null, over: 0, created: DB.built, euro: null, euroQual: null, euroQuota: null, euroStarted: 0,
    };
    R.use(world);
    for (const d of DB.clubs) {
      const c = mkClub(world, d, d.tier);
      for (const r of d.p) {
        world.nameSet[r[0]] = 1;
        const age = DB.season - r[4];
        const p = Gen.makePlayer(world, { name: r[0], nat: r[1], pos: r[2], pos2: r[3], by: r[4], bm: r[5], ovr: r[6], pot: r[7], no: r[8], club: c.id, tr: Gen.traitsFor(r[0], r[2], age, !!r[9]), until: DB.season + 1 + (FM.hash(r[0] + 'c') % 4) });
        c.squad.push(p.id);
      }
    }
    for (const d of DB.amateurs) {
      const c = mkClub(world, d, 4);
      for (const pos of AM_TEMPLATE) { const p = Gen.genPlayer(world, { pos, mean: d.lvl, sd: 3, minAge: 19, maxAge: 32, club: c.id, nat: R.chance(0.85) ? 'GER' : null }); c.squad.push(p.id); }
    }
    for (const id in world.clubs) { const c = world.clubs[id]; Team.ensureDepth(world, c, true); c.formation = Team.chooseFormation(world, c); }
    W.addIntl(world);
    world.season--; // startSeason zählt hoch und richtet Spielplan, Pokal, Ziele ein
    FM.Game.startSeasonInternal(world);
    // Gehaltsniveau je Klub an die wirtschaftliche Kraft anpassen (rund die Hälfte der Einnahmen)
    for (const id in world.clubs) {
      const c = world.clubs[id]; const bill = Team.wageBill(world, c); if (!bill || c.tier === 9) continue;
      const k = U.clamp(E.yearIncome(world, c) * 0.55 / bill, 0.6, 2.4);
      c.wageF = U.round(k, 3);
      for (const p of Team.squad(world, c)) p.wage = U.roundMoney(p.wage * k);
    }
    FM.Transfer.refreshMarket(world);
    world.news = [];
    const u = world.clubs[world.user];
    FM.Game.news(world, 'Willkommen bei ' + u.name, 'Der Vorstand begrüßt dich als neuen Cheftrainer und Manager. Saisonziel: ' + u.board.goal + '. Stell die Mannschaft auf, wähle einen Trikotsponsor und führe den Verein durch die Saison ' + Cal.seasonLabel(world.season) + '.', 'board');
    return world;
  };

  /* ---------- Kompression (LZW über UTF-8-Bytes, Ausgabe als unkritische UTF-16-Zeichen) ----------
     Ein Spielstand schrumpft damit auf rund ein Fünftel und passt mehrfach in den Browser-Speicher. */
  const LZ = (FM.LZ = {
    MAX: 55000, OFF: 32,
    compress(str) {
      const s = unescape(encodeURIComponent(str)); let dict = new Map(); let next = 256; const out = [];
      let w = '';
      for (let i = 0; i < s.length; i++) {
        const c = s[i]; const wc = w + c;
        if (wc.length === 1 || dict.has(wc)) { w = wc; continue; }
        out.push(w.length === 1 ? w.charCodeAt(0) : dict.get(w));
        if (next < LZ.MAX) dict.set(wc, next++); else { dict = new Map(); next = 256; }
        w = c;
      }
      if (w !== '') out.push(w.length === 1 ? w.charCodeAt(0) : dict.get(w));
      let res = ''; const CH = 8192;
      for (let i = 0; i < out.length; i += CH) res += String.fromCharCode.apply(null, out.slice(i, i + CH).map((x) => x + LZ.OFF));
      return res;
    },
    decompress(packed) {
      let dict = []; let next = 256; const parts = []; let prev = null;
      for (let i = 0; i < packed.length; i++) {
        const code = packed.charCodeAt(i) - LZ.OFF; let entry;
        if (code < 0) throw new Error('lz');
        if (code < 256) entry = String.fromCharCode(code);
        else if (dict[code] !== undefined) entry = dict[code];
        else if (code === next && prev !== null) entry = prev + prev[0];
        else throw new Error('lz');
        parts.push(entry);
        if (prev !== null) { if (next < LZ.MAX) dict[next++] = prev + entry[0]; else { dict = []; next = 256; } }
        prev = entry;
        if (next === 256 && dict.length === 0 && i > 0 && parts.length > 1 && prev !== entry) prev = entry;
      }
      return decodeURIComponent(escape(parts.join('')));
    },
  });

  /* ---------- Speichern & Laden ---------- */
  const S = (FM.Save = {});
  S.KEY = 'flutlicht.save.';
  S.SLOTS = ['auto', '1', '2'];
  let mem = {}; // Ausweich-Speicher, falls der Browser keinen localStorage erlaubt
  function store() { try { const ls = root.localStorage; if (!ls) return null; ls.setItem('flutlicht.probe', '1'); ls.removeItem('flutlicht.probe'); return ls; } catch (e) { return null; } }
  S.persistent = function () { return !!store(); };

  S.serialize = function (world) {
    const copy = Object.assign({}, world); delete copy.nameSet;
    const data = LZ.compress(JSON.stringify(copy));
    const c = world.clubs[world.user];
    return JSON.stringify({ app: 'flutlicht', v: FM.SAVE_VERSION, ts: Date.now(), meta: { club: c ? c.name : '', manager: world.manager, season: world.season, week: world.week }, z: 1, sum: FM.hash(data), data });
  };
  /* Prüft Struktur und Plausibilität. Ein beschädigter Stand wird nie stillschweigend geladen. */
  S.validate = function (w) {
    const err = [];
    if (!w || typeof w !== 'object') return ['Der Spielstand ist leer.'];
    if (!w.clubs || !w.players || !w.leagues || !w.cal) err.push('Grunddaten fehlen.');
    else {
      if (!w.clubs[w.user]) err.push('Der eigene Verein fehlt.');
      for (const t of [1, 2, 3]) { const L = w.leagues[t]; if (!L || !Array.isArray(L.clubs) || !Array.isArray(L.rounds)) { err.push('Liga ' + t + ' ist unvollständig.'); continue; } for (const cid of L.clubs) if (!w.clubs[cid]) err.push('Unbekannter Klub im Spielplan: ' + cid); }
      for (const cid in w.clubs) { const c = w.clubs[cid]; if (!U.isNum(c.money)) err.push('Kontostand von ' + cid + ' ist ungültig.'); if (!Array.isArray(c.squad)) err.push('Kader von ' + cid + ' fehlt.'); else for (const pid of c.squad) if (!w.players[pid]) err.push('Kader von ' + cid + ' verweist auf einen unbekannten Spieler.'); }
      if (!U.isNum(w.season) || !U.isNum(w.week) || w.week < 1 || w.week > Cal.WEEKS) err.push('Datum ist ungültig.');
    }
    return err.slice(0, 5);
  };
  S.parse = function (text) {
    let env;
    try { env = JSON.parse(text); } catch (e) { return { err: 'Die Datei ist kein gültiger Spielstand (kein lesbares JSON).' }; }
    if (!env || env.app !== 'flutlicht' || typeof env.data !== 'string') return { err: 'Das ist kein FLUTLICHT-Spielstand.' };
    if (env.v > FM.SAVE_VERSION) return { err: 'Der Spielstand stammt aus einer neueren Spielversion.' };
    if (FM.hash(env.data) !== env.sum) return { err: 'Die Prüfsumme stimmt nicht – der Spielstand ist beschädigt.' };
    let w; try { w = JSON.parse(env.z ? LZ.decompress(env.data) : env.data); } catch (e) { return { err: 'Der Spielstand ist beschädigt.' }; }
    const errs = S.validate(w); if (errs.length) return { err: 'Der Spielstand ist unvollständig: ' + errs[0] };
    S.migrate(w);
    return { world: w, meta: env.meta, ts: env.ts };
  };
  S.migrate = function (w) { // Felder nachrüsten, damit ältere Stände weiter funktionieren
    w.nameSet = {}; for (const id in w.players) w.nameSet[w.players[id].name] = 1;
    w.offers = w.offers || []; w.ticker = w.ticker || []; w.youthOffer = w.youthOffer || []; w.friendlies = w.friendlies || {}; w.history = w.history || []; w.news = w.news || [];
    w.nextOid = w.nextOid || 1; w.v = FM.SAVE_VERSION;
    if (w.euro === undefined) w.euro = null; // Stände von vor dem Europapokal: Europa startet mit der nächsten Saison
  };
  S.save = function (world, slot) {
    const text = S.serialize(world); const ls = store(); const key = S.KEY + slot;
    if (!ls) { mem[key] = text; return { ok: true, volatile: true }; }
    try {
      if (slot === 'auto') { const prev = ls.getItem(key); if (prev) { try { ls.setItem(key + '.bak', prev); } catch (e) { ls.removeItem(key + '.bak'); } } }
      ls.setItem(key, text);
      return { ok: true };
    } catch (e) {
      try { ls.removeItem(S.KEY + 'auto.bak'); ls.setItem(key, text); return { ok: true }; } catch (e2) { mem[key] = text; return { ok: false, err: 'Der Browser-Speicher ist voll. Exportiere den Spielstand als Datei.' }; }
    }
  };
  S.raw = function (slot) { const ls = store(); const key = S.KEY + slot; let t = null; try { t = ls ? ls.getItem(key) : null; } catch (e) { t = null; } return t || mem[key] || null; };
  S.load = function (slot) {
    const t = S.raw(slot); if (!t) return { err: 'In diesem Speicherplatz liegt kein Spielstand.' };
    const r = S.parse(t);
    if (r.err && slot === 'auto') { const b = S.raw('auto.bak'); if (b) { const rb = S.parse(b); if (!rb.err) { rb.restored = true; return rb; } } }
    return r;
  };
  S.info = function (slot) {
    const t = S.raw(slot); if (!t) return null;
    try { const env = JSON.parse(t); return env && env.meta ? { meta: env.meta, ts: env.ts, size: t.length } : null; } catch (e) { return null; }
  };
  S.remove = function (slot) { const ls = store(); try { if (ls) ls.removeItem(S.KEY + slot); } catch (e) { /* egal */ } delete mem[S.KEY + slot]; };
})(typeof globalThis !== 'undefined' ? globalThis : this);
