/* FLUTLICHT · Transfermarkt, Verträge, KI-Transfers, Saisonwechsel im Kader */
(function (root) {
  'use strict';
  const FM = root.FM; const R = FM.R; const U = FM.U; const Cal = FM.Cal; const E = FM.Econ; const Team = FM.Team; const Gen = FM.Gen;
  const X = (FM.Transfer = {});

  X.MIN = { T: 2, A: 6, M: 6, S: 4 };       // Mindestbesetzung je Mannschaftsteil
  X.MAX_SQUAD = 34;
  X.windowOpen = function (world) { return !!Cal.week(world).win; };
  X.status = function (p) { return p.club ? 'club' : p.ab ? 'abroad' : p.yo ? 'youth' : 'free'; };

  X.asking = function (world, p) {
    if (!p.club) return p.ab ? U.roundMoney(p.val * 1.12) : 0;
    const club = world.clubs[p.club];
    const rank = U.sortBy(Team.squad(world, club), (x) => x.ovr, true).indexOf(p);
    let k = 1.2 + (rank < 3 ? 0.5 : rank < 11 ? 0.25 : 0);
    if (p.listed) k = 0.9;
    return U.roundMoney(p.val * k);
  };

  /* Will der Spieler überhaupt zu diesem Klub? */
  X.interest = function (world, p, club) {
    if (p.club === club.id) return { ok: false, why: 'Der Spieler steht bereits bei dir unter Vertrag.' };
    const lvl = Team.level(world, club); const gap = p.ovr - lvl;
    if (p.club) {
      const cur = world.clubs[p.club];
      if (p.joined === world.season && p.joinW && world.week - p.joinW < 20) return { ok: false, why: p.name + ' ist gerade erst gewechselt und will nicht schon wieder umziehen.' };
      if (club.tier > cur.tier && gap > 1 && !p.listed) return { ok: false, why: p.name + ' möchte nicht in eine tiefere Liga wechseln.' };
    }
    const limit = 6 + (club.rep - 50) / 6;
    if (gap > limit) return { ok: false, why: p.name + ' sieht sich bei einem größeren Klub.' };
    if (p.noTalk && p.noTalk > world.season * 100 + world.week) return { ok: false, why: 'Nach den geplatzten Gesprächen herrscht Funkstille. Versuch es in ein paar Wochen wieder.' };
    return { ok: true, gap };
  };

  X.wageDemand = function (world, p, club) {
    const age = FM.age(world, p); const lvl = Team.level(world, club);
    let w = Gen.wageFor(p.ovr, age) * (0.8 + club.rep / 250) * (club.wageF || 1) * (1 + Math.max(0, p.ovr - lvl) * 0.03);
    if (p.club && p.club !== club.id) w = Math.max(w, Math.min(p.wage * 1.05, w * 1.5));
    return U.roundMoney(w);
  };

  function groupAfterSale(world, club, p) {
    const c = Team.groupCount(world, club); c[FM.POS_GROUP[p.pos]]--; return c;
  }
  function sellerKeeps(world, club, p) { // darf der abgebende Klub den Spieler ziehen lassen?
    const c = groupAfterSale(world, club, p); const g = FM.POS_GROUP[p.pos];
    return c[g] >= X.MIN[g] && club.squad.length - 1 >= 18;
  }

  X.ticker = function (world, p, from, to, fee) {
    world.ticker.unshift({ s: world.season, w: world.week, name: p.name, pos: p.pos, ovr: p.ovr, from, to, fee: fee || 0 });
    if (world.ticker.length > 90) world.ticker.length = 90;
  };

  function removeFromClub(world, p) {
    const club = world.clubs[p.club]; if (!club) return;
    const i = club.squad.indexOf(p.id); if (i >= 0) club.squad.splice(i, 1);
    if (club.lineup) {
      const L = club.lineup; for (let k = 0; k < L.xi.length; k++) if (L.xi[k] === p.id) L.xi[k] = 0;
      L.bench = L.bench.filter((id) => id !== p.id);
      for (const r of ['pen', 'fk', 'cap']) if (L[r] === p.id) L[r] = 0;
    }
    world.offers = world.offers.filter((o) => o.pid !== p.id);
  }

  /* Wechsel vollziehen – die einzige Stelle, an der ein Spieler den Klub wechselt */
  X.move = function (world, p, to, fee, wage, until) {
    const from = p.club ? world.clubs[p.club] : null;
    const fromName = from ? from.short : p.ab ? p.ab : 'vereinslos';
    if (from) { removeFromClub(world, p); if (fee) E.add(world, from, 'transIn', fee); }
    if (fee) E.add(world, to, 'transOut', -fee);
    p.club = to.id; to.squad.push(p.id);
    p.wage = wage; p.until = until; p.joined = world.season; p.joinW = world.week; p.listed = 0; p.bench = 0; p.mor = U.clamp(p.mor + 10, 5, 99);
    delete p.ab; delete p.yo; delete p.noTalk;
    X.ticker(world, p, fromName, to.short, fee);
  };
  X.sellAbroad = function (world, p, fee, silent) {
    const from = world.clubs[p.club]; if (!from) return;
    removeFromClub(world, p); E.add(world, from, 'transIn', fee);
    X.ticker(world, p, from.short, 'Ausland', fee);
    delete world.players[p.id];
    if (!silent && from.id === world.user) FM.Game.news(world, 'Transfer', p.name + ' wechselt für ' + U.money(fee) + ' ins Ausland.', 'transfer');
  };
  X.toFree = function (world, p) {
    if (p.club) removeFromClub(world, p);
    p.club = null; p.listed = 0; p.freeSince = world.season; delete p.ab; delete p.yo;
  };

  /* ---------- Aktionen des Spielers ---------- */
  X.canDeal = function (world, p) {
    if (!p.club && !p.ab) return { ok: true }; // vereinslos: immer
    if (!X.windowOpen(world)) return { ok: false, why: 'Das Transferfenster ist geschlossen. Nur vereinslose Spieler können jetzt verpflichtet werden.' };
    return { ok: true };
  };
  X.bid = function (world, pid, fee) {
    const p = world.players[pid]; const club = FM.Game.user(world);
    if (!p) return { status: 'reject', msg: 'Der Spieler ist nicht mehr auf dem Markt.' };
    const cd = X.canDeal(world, p); if (!cd.ok) return { status: 'reject', msg: cd.why };
    const it = X.interest(world, p, club); if (!it.ok) return { status: 'reject', msg: it.why };
    if (club.squad.length >= X.MAX_SQUAD) return { status: 'reject', msg: 'Dein Kader ist voll (maximal ' + X.MAX_SQUAD + ' Spieler).' };
    if (!p.club && !p.ab) return { status: 'accept', fee: 0, msg: p.name + ' ist vereinslos – es wird keine Ablöse fällig.' };
    fee = Math.max(0, Math.round(fee || 0));
    if (fee > club.money) return { status: 'reject', msg: 'So viel Geld ist nicht in der Kasse.' };
    const ask = X.asking(world, p);
    if (p.club) {
      const seller = world.clubs[p.club];
      if (!sellerKeeps(world, seller, p)) return { status: 'reject', msg: seller.name + ' kann ' + p.name + ' nicht abgeben – der Kader wäre zu dünn besetzt.' };
      if (fee >= ask * 0.97) return { status: 'accept', fee, msg: seller.name + ' nimmt das Angebot über ' + U.money(fee) + ' an.' };
      if (fee >= ask * 0.75) return { status: 'counter', ask, msg: seller.name + ' lehnt ab, wäre aber ab ' + U.money(ask) + ' gesprächsbereit.' };
      return { status: 'counter', ask, msg: seller.name + ' empfindet das Angebot als Frechheit. Unter ' + U.money(ask) + ' läuft nichts.' };
    }
    if (fee >= ask * 0.97) return { status: 'accept', fee, msg: 'Der abgebende Klub aus dem Ausland (' + p.ab + ') stimmt zu.' };
    return { status: 'counter', ask, msg: 'Der Klub aus dem Ausland verlangt ' + U.money(ask) + '.' };
  };
  X.sign = function (world, pid, fee, wage, years) {
    const p = world.players[pid]; const club = FM.Game.user(world);
    if (!p) return { ok: false, msg: 'Der Spieler ist nicht mehr auf dem Markt.' };
    years = U.clamp(Math.round(years), 1, 5); wage = Math.round(wage);
    const demand = X.wageDemand(world, p, club);
    const free = !p.club && !p.ab;
    const bonus = free ? U.roundMoney(demand * 0.15) : 0; // Handgeld bei ablösefreien Spielern
    if (fee + bonus > club.money) return { ok: false, msg: 'Ablöse und Handgeld (' + U.money(fee + bonus) + ') übersteigen den Kontostand.' };
    const age = FM.age(world, p);
    const wantYears = age >= 32 ? 2 : age <= 22 ? 4 : 3;
    const need = demand * (1 + Math.abs(years - wantYears) * 0.025);
    if (wage < need * 0.98) {
      p.talks = (p.talks || 0) + 1;
      if (p.talks >= 3) { p.talks = 0; p.noTalk = world.season * 100 + world.week + 6; return { ok: false, broke: true, msg: p.name + ' bricht die Verhandlungen ab. „So kommen wir nicht zusammen.“' }; }
      return { ok: false, msg: p.name + ' lehnt ab und fordert etwa ' + U.money(U.roundMoney(need)) + ' pro Jahr bei ' + years + ' Jahr' + (years > 1 ? 'en' : '') + ' Laufzeit. (Versuch ' + p.talks + ' von 3)' };
    }
    p.talks = 0;
    if (bonus) E.add(world, club, 'bonus', -bonus);
    X.move(world, p, club, fee, wage, world.season + years);
    FM.Game.news(world, 'Neuzugang', p.name + ' (' + p.pos + ', Stärke ' + p.ovr + ') unterschreibt bis ' + p.until + '.' + (fee ? ' Ablöse: ' + U.money(fee) + '.' : ' Ablösefrei.') + (bonus ? ' Handgeld: ' + U.money(bonus) + '.' : ''), 'transfer');
    return { ok: true, msg: p.name + ' unterschreibt!' };
  };

  X.renewDemand = function (world, p) {
    const club = world.clubs[p.club];
    return U.roundMoney(Math.max(p.wage * 1.06, X.wageDemand(world, p, club) * 0.95));
  };
  X.renew = function (world, pid, wage, years) {
    const p = world.players[pid]; const club = FM.Game.user(world);
    if (!p || p.club !== club.id) return { ok: false, msg: 'Der Spieler gehört nicht zu deinem Kader.' };
    years = U.clamp(Math.round(years), 1, 5);
    if (p.mor < 25) return { ok: false, msg: p.name + ' ist unzufrieden und möchte derzeit nicht verlängern.' };
    if (p.ovr - Team.level(world, club) > 8 + (club.rep - 50) / 6) return { ok: false, msg: p.name + ' will den nächsten Karriereschritt machen und verlängert nicht.' };
    if (p.noRenew && p.noRenew > world.season * 100 + world.week) return { ok: false, msg: p.name + ' will erst später wieder über einen neuen Vertrag sprechen.' };
    const need = X.renewDemand(world, p);
    if (wage < need * 0.98) {
      p.talks = (p.talks || 0) + 1;
      if (p.talks >= 3) { p.talks = 0; p.noRenew = world.season * 100 + world.week + 8; p.mor = U.clamp(p.mor - 8, 5, 99); return { ok: false, msg: p.name + ' ist verstimmt und beendet die Gespräche vorerst.' }; }
      return { ok: false, msg: p.name + ' fordert mindestens ' + U.money(need) + ' pro Jahr. (Versuch ' + p.talks + ' von 3)' };
    }
    p.talks = 0; p.wage = Math.round(wage); p.until = world.season + 1 + years; p.mor = U.clamp(p.mor + 8, 5, 99);
    return { ok: true, msg: p.name + ' verlängert bis ' + p.until + '.' };
  };
  X.releaseCost = function (world, p) { return U.roundMoney(p.wage * Math.max(0.25, (p.until - world.season - 1) * 0.5 + 0.25)); };
  X.release = function (world, pid) {
    const p = world.players[pid]; const club = FM.Game.user(world);
    if (!p || p.club !== club.id) return 'Der Spieler gehört nicht zu deinem Kader.';
    if (club.squad.length <= 16) return 'Dein Kader ist zu klein, um weitere Spieler abzugeben.';
    const cost = X.releaseCost(world, p);
    E.add(world, club, 'bonus', -cost); X.toFree(world, p);
    X.ticker(world, p, club.short, 'vereinslos', 0);
    return '';
  };
  X.acceptOffer = function (world, oid) {
    const o = world.offers.find((x) => x.id === oid); if (!o) return 'Das Angebot ist nicht mehr gültig.';
    const p = world.players[o.pid]; const club = FM.Game.user(world);
    if (!p || p.club !== club.id) { world.offers = world.offers.filter((x) => x.id !== oid); return 'Der Spieler gehört nicht mehr zu deinem Kader.'; }
    if (club.squad.length <= 16) return 'Mit weniger als 16 Spielern lässt dich der Vorstand nicht verkaufen.';
    if (p.pos === 'TW' && Team.squad(world, club).filter((x) => x.pos === 'TW').length <= 2) return 'Du brauchst mindestens zwei Torhüter im Kader.';
    if (o.from === 'AUS') { X.sellAbroad(world, p, o.fee, true); }
    else {
      const to = world.clubs[o.from]; if (!to) return 'Der Interessent hat sich zurückgezogen.';
      X.move(world, p, to, o.fee, X.wageDemand(world, p, to), world.season + R.int(2, 4));
    }
    FM.Game.news(world, 'Verkauf', p.name + ' wechselt für ' + U.money(o.fee) + ' zu ' + o.fromName + '.', 'transfer');
    return '';
  };
  X.rejectOffer = function (world, oid) { world.offers = world.offers.filter((x) => x.id !== oid); };
  X.signYouth = function (world, pid) {
    const p = world.players[pid]; const club = FM.Game.user(world);
    if (!p || !p.yo) return 'Dieses Talent steht nicht mehr zur Verfügung.';
    if (club.squad.length >= X.MAX_SQUAD) return 'Dein Kader ist voll.';
    delete p.yo; p.club = club.id; club.squad.push(p.id); p.until = world.season + 3; p.joined = world.season; p.joinW = world.week;
    world.youthOffer = world.youthOffer.filter((id) => id !== pid);
    return '';
  };

  /* ---------- Markt der KI ---------- */
  function aiDeal(world, forced) {
    const clubs = FM.Game.clubList(world).filter((c) => c.id !== world.user && c.tier <= 3 && c.money > 0.3e6);
    if (!clubs.length) return;
    const buyer = forced || R.weighted(clubs, (c) => Math.sqrt(c.money));
    if (buyer.squad.length >= 30 || buyer.money <= 0) return;
    const cnt = Team.groupCount(world, buyer); const ideal = { T: 3, A: 8, M: 8, S: 6 };
    let g = U.sortBy(['T', 'A', 'M', 'S'], (k) => cnt[k] - ideal[k] + R.f())[0];
    if (forced) { // gezielte Verstärkung: schwächster Mannschaftsteil der ersten Elf
      const xi = U.sortBy(Team.squad(world, buyer), (p) => p.ovr, true).slice(0, 14); const q = { A: [], M: [], S: [] };
      xi.forEach((p) => { const k = FM.POS_GROUP[p.pos]; if (q[k]) q[k].push(p.ovr); });
      g = U.sortBy(['A', 'M', 'S'], (k) => (q[k].length ? U.avg(q[k]) : 0) + R.f() * 2)[0];
    }
    const lvl = Team.level(world, buyer) + (forced ? 3 : 0); let best = null, bv = -1e9;
    for (const id in world.players) {
      const p = world.players[id];
      if (FM.POS_GROUP[p.pos] !== g || p.club === buyer.id || p.club === world.user || p.yo) continue;
      if (p.ovr < lvl - 4 || p.ovr > lvl + 5) continue;
      const ask = X.asking(world, p); if (ask > buyer.money * 0.55) continue;
      if (p.club) { const s = world.clubs[p.club]; if (s.rep > buyer.rep + 4 && !p.listed) continue; if (!sellerKeeps(world, s, p)) continue; }
      if (!X.interest(world, p, buyer).ok) continue;
      const age = Cal.year(world) - p.by;
      const v = p.ovr - Math.max(0, age - 27) * 0.9 + (p.pot - p.ovr) * 0.3 + R.f() * 4 - ask / Math.max(1, buyer.money) * 3;
      if (v > bv) { bv = v; best = p; }
    }
    if (!best) return;
    const fee = X.asking(world, best);
    X.move(world, best, buyer, best.club || best.ab ? fee : 0, X.wageDemand(world, best, buyer), world.season + R.int(2, 4));
  }

  function offersToUser(world) {
    const club = FM.Game.user(world); if (!club) return;
    const P = world.players; const others = FM.Game.clubList(world).filter((c) => c.id !== club.id && c.tier <= 3);
    for (const id of club.squad) {
      const p = P[id]; if (!p) continue;
      if (world.offers.filter((o) => o.pid === id).length >= 2) continue;
      const age = Cal.year(world) - p.by;
      const prob = p.listed ? 0.3 : 0.009 + Math.max(0, p.pot - p.ovr) * 0.0012 + (age <= 25 ? 0.004 : 0);
      if (!R.chance(prob)) continue;
      const cands = others.filter((c) => { const l = Team.level(world, c); return p.ovr >= l - 5 && p.ovr <= l + 6 && c.squad.length < 30 && X.interest(world, p, c).ok; });
      let fee = U.roundMoney(p.val * (p.listed ? R.range(0.75, 1.1) : R.range(0.95, 1.4)));
      const buyers = cands.filter((c) => c.money >= fee);
      let from, fromName;
      if (buyers.length && R.chance(0.75)) { const b = R.pick(buyers); from = b.id; fromName = b.name; }
      else if (p.ovr >= 62 || p.listed) { from = 'AUS'; fromName = R.pick(['einem Klub aus England', 'einem Klub aus Italien', 'einem Klub aus Spanien', 'einem Klub aus Frankreich', 'einem Klub aus den Niederlanden', 'einem Klub aus der Türkei', 'einem Klub aus Saudi-Arabien', 'einem Klub aus den USA', 'einem Klub aus Österreich', 'einem Klub aus der Schweiz']); if (p.ovr < 70) fee = U.roundMoney(fee * 0.85); }
      else continue;
      world.offers.push({ id: world.nextOid++, pid: id, from, fromName, fee, exp: world.week + 2 });
      FM.Game.news(world, 'Angebot für ' + p.name, 'Von ' + fromName + ' liegt ein Angebot über ' + U.money(fee) + ' vor. Es gilt zwei Wochen.', 'transfer');
    }
  }

  function aiFill(world, club) { // Mindestkader der KI sichern: erst vereinslose Spieler, dann eigener Nachwuchs
    const lvl = Team.level(world, club); let guard = 0;
    while (guard++ < 12) {
      const cnt = Team.groupCount(world, club); let g = null;
      for (const k of ['T', 'A', 'M', 'S']) if (cnt[k] < X.MIN[k] + (k === 'T' ? 0 : 1)) { g = k; break; }
      if (!g && club.squad.length >= 20) break;
      if (!g) g = U.sortBy(['A', 'M', 'S'], (k) => cnt[k] / X.MIN[k])[0];
      let best = null;
      for (const id in world.players) { const p = world.players[id]; if (p.club || p.ab || p.yo || FM.POS_GROUP[p.pos] !== g) continue; if (p.ovr > lvl + 3 || p.ovr < lvl - 9) continue; if (!best || p.ovr > best.ovr) best = p; }
      if (best) { X.move(world, best, club, 0, X.wageDemand(world, best, club), world.season + R.int(1, 3)); continue; }
      const pos = g === 'T' ? 'TW' : R.pick(FM.POS.filter((x) => FM.POS_GROUP[x] === g));
      const p = Gen.genPlayer(world, { pos, age: R.int(17, 20), mean: lvl - 11, sd: 2.5, club: club.id, nat: R.chance(0.8) ? 'GER' : null, until: world.season + 3 });
      club.squad.push(p.id);
    }
  }

  X.weekly = function (world) {
    world.offers = world.offers.filter((o) => o.exp >= world.week && world.players[o.pid]);
    const clubs = FM.Game.clubList(world);
    for (const c of clubs) if (c.id !== world.user && (c.squad.length < 20 || world.week % 6 === 0)) aiFill(world, c);
    if (X.windowOpen(world)) {
      const n = world.week <= 9 ? R.int(2, 5) : R.int(1, 3);
      for (let i = 0; i < n; i++) aiDeal(world);
      // Klubs, die für ihre Liga zu schwach besetzt sind (z. B. Aufsteiger), rüsten gezielt nach
      for (const t of [1, 2, 3]) {
        const L = world.leagues[t]; if (!L) continue;
        const avg = U.avg(L.clubs, (c) => Team.level(world, world.clubs[c]));
        for (const cid of L.clubs) { const c = world.clubs[cid]; if (cid !== world.user && Team.level(world, c) < avg - 1.5 && R.chance(0.5)) aiDeal(world, c); }
      }
      offersToUser(world);
    }
    const u = FM.Game.user(world);
    if (u && !u.sponsor && world.week >= 4 && world.sponsorOffers) { // nicht entschieden → sicherste Variante
      const o = world.sponsorOffers[0]; u.sponsor = { name: o.name, base: o.base, win: o.win, until: world.season + o.years - 1 }; world.sponsorOffers = null;
      FM.Game.news(world, 'Sponsor', 'Der Vorstand hat für dich entschieden: ' + o.name + ' wird Trikotsponsor (' + U.money(o.base) + ' pro Jahr).', 'fin');
    }
  };

  const AB = { TUR: 'Süper Lig', POL: 'Ekstraklasa', FRA: 'Ligue 2', ESP: 'Segunda División', ENG: 'Championship', NED: 'Eredivisie', CRO: 'HNL', DEN: 'Superligaen', JPN: 'J1 League', BRA: 'Série A', USA: 'MLS', GHA: 'Ghana Premier League' };
  X.refreshMarket = function (world) {
    for (const id in world.players) if (world.players[id].ab) delete world.players[id];
    for (let i = 0; i < 40; i++) {
      const nat = Gen.randomNat(true);
      const p = Gen.genPlayer(world, { nat, mean: R.pick([56, 60, 64, 68, 72]), sd: 4, minAge: 19, maxAge: 29 });
      p.ab = AB[nat] || 'Ausland';
    }
  };

  /* ---------- Saisonwechsel: Verträge, Karriereenden, Nachwuchs ---------- */
  X.seasonEnd = function (world, sum) {
    const year = Cal.year(world); const user = FM.Game.user(world); const P = world.players;
    const left = [], retired = [];
    for (const club of FM.Game.clubList(world)) {
      for (const p of Team.squad(world, club)) {
        const age = year - p.by; const old = p.pos === 'TW' ? age - 2 : age;
        if (old >= 38 || (old >= 34 && R.chance((old - 33) * 0.3)) || (old >= 33 && p.ovr < Team.level(world, club) - 8 && R.chance(0.5))) {
          removeFromClub(world, p); delete P[p.id]; if (club === user) retired.push(p.name); continue;
        }
        if (p.until <= world.season + 1) {
          if (club === user) { X.toFree(world, p); left.push(p.name); }
          else if (old < 34 && R.chance(p.ovr >= Team.level(world, club) - 6 ? 0.8 : 0.45)) { p.until = world.season + 1 + R.int(1, 3); p.wage = U.roundMoney(Math.max(p.wage, X.wageDemand(world, p, club) * 0.9)); }
          else X.toFree(world, p);
        }
      }
    }
    // vereinslose Spieler: Alte hören auf, Ladenhüter verschwinden
    const free = Object.keys(P).map((k) => P[k]).filter((p) => !p.club && !p.ab && !p.yo);
    for (const p of free) { const age = year - p.by; if (age >= 34 || (p.freeSince != null && p.freeSince < world.season && (p.ovr < 66 || R.chance(0.5)))) delete P[p.id]; }
    for (const id of world.youthOffer || []) delete P[id];
    world.youthOffer = [];
    // Nachwuchs
    for (const club of FM.Game.clubList(world)) {
      const lvl = Team.level(world, club);
      if (club === user) {
        const n = 2 + Math.floor(club.infra.youth / 2) + (R.chance(0.5) ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const p = Gen.genPlayer(world, { age: R.int(16, 18), mean: lvl - 21 + club.infra.youth * 1.5, sd: 3.5, nat: R.chance(0.85) ? 'GER' : null });
          p.pot = U.clamp(p.pot + club.infra.youth, p.ovr, 95); p.wage = Gen.wageFor(p.ovr, 17); p.yo = 1; world.youthOffer.push(p.id);
        }
      } else {
        // Kader verschlanken, dann Talente hochziehen
        const sq = U.sortBy(Team.squad(world, club), (p) => p.ovr + (p.pot - p.ovr) * 0.4);
        let over = sq.length - 27;
        for (const p of sq) { if (over <= 0) break; const c = groupAfterSale(world, club, p); const g = FM.POS_GROUP[p.pos]; if (c[g] < X.MIN[g] + 1) continue; if (p.gen && p.ovr < lvl - 10) { removeFromClub(world, p); delete P[p.id]; } else X.toFree(world, p); over--; }
        const n = club.tier === 4 ? 3 : R.int(2, 3);
        for (let i = 0; i < n; i++) {
          const p = Gen.genPlayer(world, { age: R.int(17, 19), mean: lvl - 19 + club.infra.youth * 1.4 + (club.tier === 4 ? 6 : 0), sd: 3.5, club: club.id, nat: R.chance(0.85) ? 'GER' : null, until: world.season + 4 });
          club.squad.push(p.id);
        }
        aiFill(world, club);
      }
    }
    X.refreshMarket(world);
    if (left.length) FM.Game.news(world, 'Verträge ausgelaufen', 'Diese Spieler haben den Verein ablösefrei verlassen: ' + left.join(', ') + '.', 'team');
    if (retired.length) FM.Game.news(world, 'Karriereende', retired.join(', ') + (retired.length > 1 ? ' beenden ihre Karrieren.' : ' beendet seine Karriere.') + ' Danke für alles!', 'team');
    if (world.youthOffer.length) FM.Game.news(world, 'Talente aus der Jugend', world.youthOffer.length + ' Nachwuchsspieler stehen zur Übernahme bereit (Menü „Kader“ → „Jugend“). Die Entscheidung muss bis Woche 3 fallen.', 'team');
    world.offers = [];
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
