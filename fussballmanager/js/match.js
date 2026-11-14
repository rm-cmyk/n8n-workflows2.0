/* FLUTLICHT · Spiel-Engine: Minute für Minute, mit Live-Ticker, Wechseln, Karten, Verletzungen,
   Verlängerung und Elfmeterschießen. Dieselbe Engine berechnet auch alle KI-Partien (fast-Modus). */
(function (root) {
  'use strict';
  const FM = root.FM; const R = FM.R; const U = FM.U;
  const M = (FM.Match = {});

  // Stellschrauben der Engine (kalibriert über tests/calib.js auf Bundesliga-typische Werte)
  const CFG = (M.CFG = { chance: 0.057, goal: 0.268, expC: 2.1, expG: 1.25, expM: 3, home: 0.01, yellow: 0.0215, red: 0.0003 });
  const HOME_ADV = 1.04;

  /* ---------- Ticker-Texte (eigene Texte, mit Augenzwinkern) ---------- */
  const T = {
    kickoff: ['Anpfiff! Der Ball rollt.', 'Los geht\'s – der Schiedsrichter gibt die Partie frei.', 'Anstoß. Die Bratwurst ist noch warm, das Spiel beginnt.'],
    goal: [
      'TOR für {t}! {s} zieht ab und der Ball zappelt im Netz.',
      'TOOOR! {s} trifft für {t} – {g} streckt sich vergeblich.',
      'Da ist das Ding! {s} schiebt eiskalt ein.',
      '{s} macht ihn! Der Stadionsprecher überschlägt sich.',
      'Tor für {t}! {s} bleibt vor {g} ganz cool.',
      '{s} trifft! Den hätte auch die Oma des Zeugwarts gemacht – aber man muss da eben stehen.',
      'Trocken, flach, drin: {s} lässt {g} keine Chance.',
    ],
    goalAssist: [
      'TOR für {t}! {a} legt mustergültig auf, {s} vollendet.',
      'Was für ein Spielzug! {a} findet {s}, und der bedankt sich mit dem Treffer.',
      '{a} mit dem Auge für den Mitspieler – {s} muss nur noch den Fuß hinhalten. Tor!',
      'Flanke {a}, Abschluss {s}, Tor für {t}! So einfach kann Fußball sein.',
    ],
    header: ['Ecke für {t} … {s} steigt am höchsten und köpft ein! TOR!', 'Standardsituation, Kopfball {s}, Tor! Die Zuordnung bei {o}: ein Rätsel.', 'Hoher Ball in den Strafraum – {s} nickt ein. Tor für {t}!'],
    headerMiss: ['Ecke für {t}, {s} kommt zum Kopfball – knapp drüber.', 'Kopfball {s}! {g} fischt ihn aus dem Winkel.', 'Nach der Ecke Durcheinander im Strafraum, am Ende klärt {o} mit vereinten Kräften.'],
    fkGoal: ['Freistoß aus 22 Metern … {s} zirkelt ihn über die Mauer – TOR! Traumhaft.', '{s} legt sich den Ball zurecht, drei Schritte Anlauf – drin! Was für ein Freistoß.'],
    fkMiss: ['Freistoß {s} – an die Latte! Das Aluminium wackelt noch.', 'Freistoß für {t}, {s} versucht es direkt. {g} hat aufgepasst.', '{s} setzt den Freistoß in die dritte Etage. Der Balljunge braucht eine Leiter.'],
    save: [
      '{s} kommt frei zum Abschluss – {g} pariert glänzend!',
      'Riesenchance für {t}! {s} scheitert an {g}.',
      '{g} mit einer Glanztat gegen {s}. Der Mann hat heute Pranken wie Bratpfannen.',
      'Schuss {s}, aber {g} ist auf dem Posten.',
      '{s} prüft {g} aus der Distanz – sicher gehalten.',
    ],
    miss: [
      '{s} zieht ab – weit vorbei. Der Ball wurde zuletzt auf dem Parkplatz gesehen.',
      'Gute Möglichkeit für {t}, doch {s} verzieht knapp.',
      '{s} hat die Führung auf dem Fuß und trifft nur das Außennetz.',
      'Das muss das Tor sein! {s} schiebt den Ball am leeren Tor vorbei.',
      '{s} versucht es mit einem Schlenzer. Sagen wir so: Die Idee war gut.',
    ],
    post: ['PFOSTEN! {s} trifft nur das Aluminium.', 'Latte! {s} hat Pech, der Ball springt zurück ins Feld.', 'Innenpfosten und raus! {s} rauft sich die Haare.'],
    penAward: ['Elfmeter für {t}! {s} wird im Strafraum gelegt.', 'Der Schiedsrichter zeigt auf den Punkt – Strafstoß für {t}!', 'Handspiel im Sechzehner! Es gibt Elfmeter für {t}.'],
    penGoal: ['{s} tritt an … und verwandelt sicher. TOR für {t}!', '{s} verlädt {g} – Tor! Links unten, wie im Training.', 'Eiskalt! {s} haut den Elfmeter unter die Latte.'],
    penMiss: ['{s} tritt an … {g} HÄLT! Was für eine Parade.', '{s} schießt den Elfmeter in den Abendhimmel. Kein Tor.', 'Pfosten! {s} vergibt vom Punkt.'],
    yellow: ['Gelb für {s} ({t}) nach einem taktischen Foul.', '{s} kommt zu spät – Gelbe Karte.', 'Der Schiedsrichter zückt Gelb: {s} hat zu lange diskutiert.', 'Gelb für {s}. Das Trikot des Gegners war offenbar sehr anziehend.'],
    yellowRed: ['Gelb-Rot für {s}! {t} ist nur noch zu zehnt.', '{s} sieht die Ampelkarte und darf vorzeitig duschen.'],
    red: ['ROT für {s}! Grobes Foulspiel, da gibt es keine zwei Meinungen.', 'Platzverweis! {s} ({t}) fliegt nach einer Notbremse vom Platz.', 'Rot für {s}. Der Schiedsrichter hatte beste Sicht – leider.'],
    injury: ['{s} bleibt liegen und muss behandelt werden. Das sieht nicht gut aus.', '{s} fasst sich an den Oberschenkel – für ihn geht es nicht weiter.', 'Verletzungsunterbrechung: {s} humpelt vom Feld.'],
    sub: ['Wechsel bei {t}: {a} kommt für {s}.', '{t} wechselt: {s} geht, {a} kommt.'],
    half: ['Halbzeit. Zeit für Tee und deutliche Worte.', 'Pausenpfiff. Die Mannschaften gehen in die Kabinen.'],
    second: ['Weiter geht\'s mit der zweiten Halbzeit.', 'Wiederanpfiff. Die zweiten 45 Minuten laufen.'],
    end: ['Abpfiff!', 'Schluss, aus, vorbei!', 'Das Spiel ist aus.'],
    et: ['Es geht in die Verlängerung. Jetzt entscheiden die Körner.'],
    pens: ['Elfmeterschießen! Jetzt braucht es Nerven aus Drahtseilen.'],
    filler: [
      'Viel Kampf im Mittelfeld, wenig Glanz. Der Rasen leidet am meisten.',
      '{t} lässt den Ball laufen, {o} läuft hinterher.',
      'Einwurf für {t}. Auch das gehört zum Fußball.',
      'Die Fans von {t} machen Stimmung, auf dem Platz passiert gerade wenig.',
      '{t} kontrolliert das Geschehen, ohne zwingend zu werden.',
      'Befreiungsschlag von {o}. Der Ball landet in Reihe 27.',
      'Ecke für {t} – die verpufft ohne Gefahr.',
      'Abseits! Die Fahne des Assistenten ist oben, {t} muss neu aufbauen.',
      'Kurze Trinkpause für die Nerven: Beide Teams sortieren sich.',
      'Foul im Mittelkreis. Freistoß für {t}, nichts Wildes.',
    ],
    gkOut: ['{s} muss nach dem Platzverweis des Torwarts zwischen die Pfosten. Abenteuerlich.'],
  };
  function fill(tpl, v) { return tpl.replace(/\{(\w)\}/g, (m, k) => (v[k] != null ? v[k] : '')); }
  function txt(key, v) { return fill(R.pick(T[key]), v || {}); }

  /* ---------- Spielerwirkung auf dem Platz ---------- */
  function effOf(pl, p) {
    const base = p.ovr * FM.posFit(p, pl.pos) * (0.72 + 0.28 * pl.sta / 100) * (0.94 + 0.12 * p.form / 100) * (0.97 + 0.06 * p.mor / 100);
    return pl.pos === 'TW' && p.pos !== 'TW' ? base : base;
  }

  function buildSide(world, club, isHome, lineup, tactics, ai) {
    const slots = FM.FORMATIONS[lineup.formation];
    const side = {
      cid: club.id, name: club.short, home: isHome, ai: !!ai, formation: lineup.formation,
      tactics: Object.assign(FM.defaultTactics(), tactics || {}),
      pl: [], bench: (lineup.bench || []).slice(0, 9), subsLeft: 5, subWindows: 0, usedSubs: [],
      goals: 0, shots: 0, onT: 0, corners: 0, fouls: 0, yel: 0, red: 0, possT: 0,
      pen: lineup.pen || 0, fk: lineup.fk || 0, cap: lineup.cap || 0,
      str: null, dirty: true, talk: 1, off: [], // off: Spieler, die den Platz verlassen haben
      bonus: 1 + 0.003 * (club.tac || 0), drainF: 1 - 0.02 * (club.cond || 0),
    };
    for (let i = 0; i < 11; i++) {
      const pid = lineup.xi[i]; const p = world.players[pid];
      side.pl.push({ pid, pos: slots[i].pos, role: slots[i].role, x: slots[i].x, y: slots[i].y, sta: p ? p.fit : 0, on: !!p, yel: 0, red: 0, go: 0, as: 0, pts: 0, mi: 0, start: 1, hurt: 0 });
    }
    return side;
  }

  function calcStr(m, si) {
    const side = m.sides[si]; const W = FM.POS_W; const P = m.world.players;
    let d = 0, mid = 0, a = 0, gk = 0, n = 0, hasGK = false, leader = false;
    for (const pl of side.pl) {
      if (!pl.on) continue;
      const p = P[pl.pid]; const e = effOf(pl, p); pl.eff = e; n++;
      if (pl.pos === 'TW') { gk = e; hasGK = true; continue; }
      const w = W[pl.role] || W[pl.pos]; d += e * w[0]; mid += e * w[1]; a += e * w[2];
      if (p.tr.indexOf('fuehrung') >= 0 || pl.pid === side.cap) leader = true;
    }
    const fg = FM.FORM_G[side.formation] || 1;
    d *= fg / FM.LINE_NORM[0]; mid *= fg / FM.LINE_NORM[1]; a *= fg / FM.LINE_NORM[2];
    const t = side.tactics;
    a *= 1 + 0.07 * t.stance; d *= 1 - 0.06 * t.stance; mid *= 1 - 0.012 * Math.abs(t.stance);
    if (t.press === 0) { mid *= 0.97; d *= 1.03; } else if (t.press === 2) { mid *= 1.06; d *= 0.97; }
    if (t.hard === 0) d *= 0.985; else if (t.hard === 2) d *= 1.025;
    if (t.style === 'kurz') { mid *= 1.03; a *= 0.99; } else if (t.style === 'konter') { mid *= 0.96; d *= 1.02; } else if (t.style === 'lang') { mid *= 0.96; a *= 1.02; } else if (t.style === 'fluegel') {
      const wings = side.pl.filter((x) => x.on && (x.pos === 'LA' || x.pos === 'RA')).length; a *= wings >= 2 ? 1.03 : 0.98;
    }
    let f = side.talk * side.bonus;
    if (side.home && !m.opts.neutral) f *= m.homeAdv;
    const diff = side.goals - m.sides[1 - si].goals;
    if (leader && diff < 0) f *= 1.015;
    side.str = { g: Math.max(gk * f, 12), d: Math.max(d * f, 8), m: Math.max(mid * f, 8), a: Math.max(a * f, 6), n, hasGK };
    side.dirty = false;
  }

  /* ---------- Spiel anlegen ---------- */
  M.create = function (world, fx, opts) {
    const o = Object.assign({ knockout: false, neutral: false, friendly: false, fast: false, agg: null, user: null }, opts || {});
    const hc = world.clubs[fx.h], ac = world.clubs[fx.a];
    const m = {
      world, fx, opts: o, min: 0, phase: 'pre', done: false, events: [], goals: [],
      added: [R.int(0, 3), R.int(2, 6)], pensRes: null, et: false, forced: null, homeAdv: HOME_ADV,
    };
    const userCid = o.user;
    m.sides = [
      buildSide(world, hc, true, FM.Team.matchLineup(world, hc, userCid === hc.id, o.friendly), hc.tactics, userCid !== hc.id),
      buildSide(world, ac, false, FM.Team.matchLineup(world, ac, userCid === ac.id, o.friendly), ac.tactics, userCid !== ac.id),
    ];
    // Zuschauer & Heimvorteil
    m.att = o.att != null ? o.att : 0;
    if (!o.neutral && hc.cap) m.homeAdv = 1 + CFG.home + 0.025 * U.clamp(m.att / hc.cap, 0, 1);
    for (let s = 0; s < 2; s++) { if (m.sides[s].ai) aiPreMatch(m, s); calcStr(m, s); }
    return m;
  };

  function aiPreMatch(m, si) {
    const me = m.sides[si], op = m.sides[1 - si];
    calcStr(m, si); if (!op.str) calcStr(m, 1 - si);
    const club = m.world.clubs[me.cid];
    const base = Object.assign(FM.defaultTactics(), club.tactics || {});
    const ratio = (me.str.a + me.str.m + me.str.d) / (op.str.a + op.str.m + op.str.d);
    base.stance = ratio > 1.12 ? 1 : ratio < 0.86 ? -1 : 0;
    if (!me.home && ratio < 1.0 && base.stance === 0 && (FM.hash(club.id) % 3 === 0)) base.style = 'konter';
    me.tactics = base; me.dirty = true;
  }

  function ev(m, type, si, data) {
    const e = Object.assign({ min: m.min, label: M.minLabel(m), type, side: si, score: [m.sides[0].goals, m.sides[1].goals] }, data || {});
    m.events.push(e); return e;
  }
  M.minLabel = function (m) {
    if (m.phase === 'h1' && m.min > 45) return '45+' + (m.min - 45);
    if (m.phase === 'h2' && m.clock > 90) return '90+' + (m.clock - 90);
    if (m.phase === 'et1' && m.clock > 105) return '105+' + (m.clock - 105);
    if (m.phase === 'et2' && m.clock > 120) return '120+' + (m.clock - 120);
    return String(m.clock || m.min);
  };
  function nm(m, pid) { const p = m.world.players[pid]; return p ? p.name : '?'; }
  function gkOf(side) { return side.pl.find((x) => x.on && x.pos === 'TW'); }
  function onPitch(side) { return side.pl.filter((x) => x.on); }

  function pickShooter(m, si, kind) {
    const side = m.sides[si]; const P = m.world.players;
    const cand = onPitch(side).filter((x) => x.pos !== 'TW');
    if (!cand.length) return null;
    return R.weighted(cand, (x) => {
      const p = P[x.pid]; let w = Math.pow(FM.POS_W[x.pos][2], 0.8) + 0.1;
      if (kind === 'header') { w = (x.pos === 'IV' ? 0.6 : x.pos === 'ST' ? 1 : 0.25) * (p.tr.indexOf('kopfball') >= 0 ? 2.4 : 1); }
      if (kind === 'long') w = FM.POS_W[x.pos][1] + 0.2;
      if (!x.start && p.tr.indexOf('joker') >= 0) w *= 1.8;
      return w * Math.pow(x.eff / 60, 1.3);
    });
  }
  function pickAssist(m, si, shooter) {
    const side = m.sides[si];
    const cand = onPitch(side).filter((x) => x !== shooter && x.pos !== 'TW');
    if (!cand.length || R.chance(0.24)) return null;
    return R.weighted(cand, (x) => (FM.POS_W[x.pos][1] * 0.8 + FM.POS_W[x.pos][2] * 0.6 + 0.08) * Math.pow(x.eff / 60, 2));
  }

  function scoreGoal(m, si, shooter, assist, text, kind) {
    const side = m.sides[si], opp = m.sides[1 - si];
    side.goals++; shooter.go++; shooter.pts += 1.25; if (assist) { assist.as++; assist.pts += 0.7; }
    for (const x of opp.pl) { if (!x.on) continue; if (x.pos === 'TW') x.pts -= 0.3; else if (FM.POS_W[x.pos][0] >= 0.5) x.pts -= 0.18; }
    for (const x of side.pl) if (x.on) x.pts += 0.05;
    m.goals.push([m.clock, si, shooter.pid, assist ? assist.pid : 0, kind === 'pen' ? 1 : 0]);
    side.dirty = opp.dirty = true;
    ev(m, 'goal', si, { pid: shooter.pid, pid2: assist ? assist.pid : 0, text, pen: kind === 'pen' });
    if (opp.ai) aiReact(m, 1 - si); if (side.ai) aiReact(m, si);
  }

  function doChance(m, si) {
    const side = m.sides[si], opp = m.sides[1 - si]; const P = m.world.players; const fast = m.opts.fast;
    const gk = gkOf(opp); const gkEff = gk ? gk.eff : opp.str.g;
    const names = { t: side.name, o: opp.name, g: gk ? nm(m, gk.pid) : 'der Aushilfstorwart' };
    let r = R.f(); const hardOpp = opp.tactics.hard;
    const penP = 0.04 * (hardOpp === 2 ? 1.35 : hardOpp === 0 ? 0.8 : 1);
    let headerP = 0.11 + (side.tactics.style === 'lang' ? 0.04 : 0) + (side.tactics.style === 'fluegel' ? 0.03 : 0);
    side.shots++;
    if (r < penP) { // Elfmeter
      let taker = side.pl.find((x) => x.on && x.pid === side.pen && x.pos !== 'TW');
      if (!taker) taker = U.sortBy(onPitch(side).filter((x) => x.pos !== 'TW'), (x) => x.eff + (P[x.pid].tr.indexOf('elfer') >= 0 ? 30 : 0), true)[0];
      if (!taker) return;
      const fouled = pickShooter(m, si) || taker; names.s = nm(m, fouled.pid);
      if (!fast) ev(m, 'pen', si, { pid: fouled.pid, text: txt('penAward', names) });
      let pg = 0.76 + (P[taker.pid].tr.indexOf('elfer') >= 0 ? 0.09 : 0) - (gk && P[gk.pid].tr.indexOf('elferkiller') >= 0 ? 0.09 : 0) + (taker.eff - gkEff) * 0.002;
      names.s = nm(m, taker.pid); side.onT++;
      if (R.chance(U.clamp(pg, 0.5, 0.93))) scoreGoal(m, si, taker, null, fast ? '' : txt('penGoal', names), 'pen');
      else { taker.pts -= 0.5; if (gk) gk.pts += 0.8; if (!fast) ev(m, 'chance', si, { pid: taker.pid, text: txt('penMiss', names) }); }
      return;
    }
    r -= penP;
    if (r < 0.05) { // direkter Freistoß
      let taker = side.pl.find((x) => x.on && x.pid === side.fk && x.pos !== 'TW');
      if (!taker) taker = U.sortBy(onPitch(side).filter((x) => x.pos !== 'TW'), (x) => x.eff * (FM.POS_W[x.pos][1] + 0.3) + (P[x.pid].tr.indexOf('freistoss') >= 0 ? 40 : 0), true)[0];
      if (!taker) return;
      names.s = nm(m, taker.pid);
      const pg = (P[taker.pid].tr.indexOf('freistoss') >= 0 ? 0.2 : 0.085) * Math.pow(taker.eff / gkEff, 1.2);
      if (R.chance(pg)) { side.onT++; scoreGoal(m, si, taker, null, fast ? '' : txt('fkGoal', names), 'fk'); }
      else { if (R.chance(0.45)) { side.onT++; if (gk) gk.pts += 0.2; } if (!fast) ev(m, 'chance', si, { pid: taker.pid, text: txt('fkMiss', names) }); }
      return;
    }
    r -= 0.05;
    const header = r < headerP;
    if (header) side.corners++;
    const shooter = pickShooter(m, si, header ? 'header' : null); if (!shooter) return;
    const assist = pickAssist(m, si, shooter);
    names.s = nm(m, shooter.pid); names.a = assist ? nm(m, assist.pid) : '';
    let pg = CFG.goal * Math.pow(shooter.eff / gkEff, CFG.expG) * (header ? 0.8 : 1);
    if (side.tactics.style === 'konter' && side.possShare < 0.5) pg *= 1.14;
    if (m.clock > 80 && P[shooter.pid].tr.indexOf('nerven') >= 0) pg *= 1.15;
    if (!opp.str.hasGK) pg *= 1.7;
    pg = U.clamp(pg, 0.05, 0.6);
    const x = R.f();
    if (x < pg) {
      side.onT++;
      scoreGoal(m, si, shooter, assist, fast ? '' : header ? txt('header', names) : assist && R.chance(0.6) ? txt('goalAssist', names) : txt('goal', names), header ? 'header' : 'play');
    } else if (x < pg + 0.34) {
      side.onT++; if (gk) gk.pts += 0.28; shooter.pts += 0.05;
      if (R.chance(0.35)) side.corners++;
      if (!fast) ev(m, 'chance', si, { pid: shooter.pid, text: header ? txt('headerMiss', names) : txt('save', names) });
    } else if (x < pg + 0.39) {
      if (!fast) ev(m, 'chance', si, { pid: shooter.pid, text: txt('post', names) });
    } else {
      shooter.pts -= 0.1;
      if (!fast && R.chance(0.7)) ev(m, 'chance', si, { pid: shooter.pid, text: txt('miss', names) });
    }
  }

  function sendOff(m, si, pl, type) {
    const side = m.sides[si]; pl.on = false; pl.red = 1; pl.pts -= 1.2; side.red++; side.off.push(pl.pid);
    side.dirty = true;
    const names = { s: nm(m, pl.pid), t: side.name };
    ev(m, type === 'yr' ? 'yellowred' : 'red', si, { pid: pl.pid, text: m.opts.fast ? '' : txt(type === 'yr' ? 'yellowRed' : 'red', names) });
    if (pl.pos === 'TW') replaceKeeper(m, si);
    if (side.ai) aiReact(m, si);
  }

  // Torwart vom Platz (Rot/Verletzung ohne Wechselmöglichkeit): Ersatzkeeper einwechseln oder Feldspieler ins Tor
  function replaceKeeper(m, si) {
    const side = m.sides[si]; const P = m.world.players;
    const benchGK = side.bench.find((pid) => P[pid] && P[pid].pos === 'TW');
    const field = U.sortBy(onPitch(side).filter((x) => x.pos !== 'TW'), (x) => FM.POS_W[x.pos][2] * 100 - x.eff * 0.1, true);
    if (!field.length) return;
    if (benchGK && side.subsLeft > 0) {
      const out = field[0];
      doSub(m, si, out, benchGK, 'TW');
    } else {
      const worst = U.sortBy(onPitch(side).filter((x) => x.pos !== 'TW'), (x) => x.eff)[0];
      worst.pos = 'TW'; worst.role = 'TW'; worst.x = 50; worst.y = 5;
      if (!m.opts.fast) ev(m, 'info', si, { pid: worst.pid, text: txt('gkOut', { s: nm(m, worst.pid) }) });
    }
    side.dirty = true;
  }

  function doSub(m, si, outPl, inPid, forcePos) {
    const side = m.sides[si]; const p = m.world.players[inPid];
    const idx = side.bench.indexOf(inPid);
    if (idx < 0 || !p || side.subsLeft <= 0 || !outPl || (!outPl.on && !outPl.hurt)) return false;
    side.bench.splice(idx, 1); side.subsLeft--; side.usedSubs.push(inPid);
    outPl.on = false; outPl.subOut = m.clock; side.off.push(outPl.pid);
    const npl = { pid: inPid, pos: forcePos || outPl.pos, role: forcePos || outPl.role, x: forcePos ? 50 : outPl.x, y: forcePos ? 5 : outPl.y, sta: p.fit, on: true, yel: 0, red: 0, go: 0, as: 0, pts: 0, mi: 0, start: 0, hurt: 0, subIn: m.clock };
    side.pl.push(npl); side.dirty = true;
    ev(m, 'sub', si, { pid: outPl.pid, pid2: inPid, text: m.opts.fast ? '' : txt('sub', { t: side.name, s: nm(m, outPl.pid), a: p.name }) });
    return true;
  }

  function doInjury(m, si) {
    const side = m.sides[si]; const P = m.world.players;
    const cand = onPitch(side); if (!cand.length) return;
    const pl = R.weighted(cand, (x) => (P[x.pid].tr.indexOf('verletzlich') >= 0 ? 2.2 : 1) * (1.3 - x.sta / 250));
    pl.hurt = 1; pl.on = false; side.dirty = true;
    ev(m, 'injury', si, { pid: pl.pid, text: m.opts.fast ? '' : txt('injury', { s: nm(m, pl.pid) }) });
    if (side.ai || m.opts.fast) autoReplace(m, si, pl);
    else m.forced = { side: si, pid: pl.pid };
  }

  function bestBenchFor(m, si, pos, minSta) {
    const side = m.sides[si]; const P = m.world.players;
    let best = null, bv = -1;
    for (const pid of side.bench) {
      const p = P[pid]; if (!p) continue;
      if (pos !== 'TW' && p.pos === 'TW') continue;
      const v = p.ovr * FM.posFit(p, pos) * (0.72 + 0.28 * p.fit / 100);
      if (v > bv && p.fit >= (minSta || 0)) { bv = v; best = pid; }
    }
    return best ? { pid: best, v: bv } : null;
  }
  function autoReplace(m, si, pl) {
    const side = m.sides[si];
    if (side.subsLeft > 0) {
      const b = bestBenchFor(m, si, pl.pos);
      if (b && doSub(m, si, pl, b.pid)) { if (m.forced && m.forced.pid === pl.pid) m.forced = null; return; }
    }
    side.off.push(pl.pid);
    if (pl.pos === 'TW') replaceKeeper(m, si);
    if (m.forced && m.forced.pid === pl.pid) m.forced = null;
  }

  function aiReact(m, si) { // Ausrichtung an Spielstand anpassen
    const side = m.sides[si]; const diff = side.goals - m.sides[1 - si].goals; const c = m.clock;
    let aggDiff = diff;
    if (m.opts.agg) aggDiff = diff + (si === 0 ? m.opts.agg[0] - m.opts.agg[1] : m.opts.agg[1] - m.opts.agg[0]);
    const t = side.tactics; const before = t.stance;
    if (aggDiff < 0 && c >= 80) t.stance = 2; else if (aggDiff < 0 && c >= 60) t.stance = Math.max(t.stance, 1);
    else if (aggDiff > 0 && c >= 78) t.stance = -1; else if (aggDiff >= 2 && c >= 60) t.stance = Math.min(t.stance, 0);
    else if (aggDiff === 0 && c >= 60 && before === 2) t.stance = 0;
    if (t.stance !== before) side.dirty = true;
  }

  function aiSubs(m, si) {
    const side = m.sides[si]; if (side.subsLeft <= 0 || !side.bench.length) return;
    const c = m.clock; if (c < 46) return;
    if (side.subWindows >= 3 && m.phase !== 'ht' && m.phase !== 'et1' && m.phase !== 'et2') return;
    const P = m.world.players; let made = 0;
    const cand = U.sortBy(onPitch(side).filter((x) => x.pos !== 'TW'), (x) => x.sta - (x.yel ? 6 : 0) + x.pts * 6);
    for (const pl of cand) {
      if (side.subsLeft <= 0 || made >= 2) break;
      const tired = pl.sta < (c >= 75 ? 62 : c >= 60 ? 55 : 45);
      if (!tired && !(c >= 70 && pl.pts < -0.6)) continue;
      const b = bestBenchFor(m, si, pl.pos, 60); if (!b) continue;
      if (b.v < effOf(pl, P[pl.pid]) * 0.9) continue;
      if (doSub(m, si, pl, b.pid)) made++;
    }
    if (made) side.subWindows++;
  }

  /* ---------- Eine Spielminute ---------- */
  function minute(m) {
    const P = m.world.players; const A = m.sides[0], B = m.sides[1];
    if (m.forced) { const f = m.forced; const pl = m.sides[f.side].pl.find((x) => x.pid === f.pid); autoReplace(m, f.side, pl); m.forced = null; }
    if (A.dirty || m.clock % 5 === 0) calcStr(m, 0);
    if (B.dirty || m.clock % 5 === 0) calcStr(m, 1);
    const ma = Math.pow(A.str.m, CFG.expM), mb = Math.pow(B.str.m, CFG.expM);
    const pA = U.clamp(ma / (ma + mb), 0.2, 0.8);
    A.possT += pA; B.possT += 1 - pA; A.possShare = pA; B.possShare = 1 - pA;
    m.ticks = (m.ticks || 0) + 1;
    let something = false;
    for (let si = 0; si < 2; si++) {
      const side = m.sides[si], opp = m.sides[1 - si]; const share = si === 0 ? pA : 1 - pA;
      // Chance
      const pc = CFG.chance * Math.pow(2 * share, 0.8) * Math.pow(side.str.a / opp.str.d, CFG.expC) * (m.et ? 0.85 : 1);
      if (R.chance(Math.min(pc, 0.3))) { doChance(m, si); something = true; }
      // Fouls & Karten
      const hf = side.tactics.hard === 2 ? 1.5 : side.tactics.hard === 0 ? 0.7 : 1;
      if (R.chance(0.135 * hf)) side.fouls++;
      if (R.chance(CFG.yellow * hf * (m.opts.friendly ? 0.4 : 1))) {
        const cand = onPitch(side);
        const pl = R.weighted(cand, (x) => (x.pos === 'TW' ? 0.15 : 0.5 + FM.POS_W[x.pos][0]) * (P[x.pid].tr.indexOf('heisssporn') >= 0 ? 2.1 : 1) * (x.yel ? 0.16 : 1));
        if (pl) {
          pl.yel++; side.yel++; pl.pts -= 0.2; something = true;
          if (pl.yel >= 2) sendOff(m, si, pl, 'yr');
          else ev(m, 'yellow', si, { pid: pl.pid, text: m.opts.fast ? '' : txt('yellow', { s: nm(m, pl.pid), t: side.name }) });
        }
      }
      if (R.chance(CFG.red * hf) && !m.opts.friendly) {
        const cand = onPitch(side); const pl = R.weighted(cand, (x) => (x.pos === 'TW' ? 0.25 : 0.4 + FM.POS_W[x.pos][0]));
        if (pl) { sendOff(m, si, pl, 'red'); something = true; }
      }
      // Verletzung (härterer Gegner → mehr Risiko)
      const oh = opp.tactics.hard === 2 ? 1.35 : opp.tactics.hard === 0 ? 0.85 : 1;
      if (R.chance(0.00085 * oh * (m.opts.friendly ? 0.6 : 1))) { doInjury(m, si); something = true; }
      // Ermüdung
      const drainT = (side.tactics.press === 2 ? 1.18 : side.tactics.press === 0 ? 0.93 : 1) * (side.str.n < 11 ? 1.08 : 1);
      for (const pl of side.pl) {
        if (!pl.on) continue; pl.mi++;
        const p = P[pl.pid]; const age = m.year - p.by;
        let dr = (pl.pos === 'TW' ? 0.08 : 0.3) * drainT * side.drainF * (age > 31 ? 1.12 : 1);
        if (p.tr.indexOf('dauerlaeufer') >= 0) dr *= 0.75;
        pl.sta = Math.max(20, pl.sta - dr);
      }
      if (side.ai && (m.clock === 60 || m.clock === 70 || m.clock === 78 || m.clock === 85 || m.clock === 100 || m.clock === 110)) { aiSubs(m, si); aiReact(m, si); }
    }
    if (!something && !m.opts.fast && R.chance(0.085)) {
      const si = R.chance(pA) ? 0 : 1;
      ev(m, 'info', si, { text: txt('filler', { t: m.sides[si].name, o: m.sides[1 - si].name }) });
    }
  }

  function needsExtra(m) {
    if (!m.opts.knockout) return false;
    let h = m.sides[0].goals, a = m.sides[1].goals;
    if (m.opts.agg) { h += m.opts.agg[0]; a += m.opts.agg[1]; }
    return h === a;
  }

  function shootout(m) {
    const P = m.world.players; const res = [0, 0]; const seq = [];
    const order = [0, 1].map((si) => U.sortBy(onPitch(m.sides[si]), (x) => (x.pos === 'TW' ? -50 : 0) + x.eff + (P[x.pid].tr.indexOf('elfer') >= 0 ? 15 : 0) + (P[x.pid].tr.indexOf('nerven') >= 0 ? 8 : 0), true));
    const first = R.chance(0.5) ? 0 : 1; let k = 0;
    const kick = (si, i) => {
      const side = m.sides[si], opp = m.sides[1 - si]; const list = order[si]; if (!list.length) return false;
      const t = list[i % list.length]; const gk = gkOf(opp);
      let pg = 0.74 + (P[t.pid].tr.indexOf('elfer') >= 0 ? 0.08 : 0) + (P[t.pid].tr.indexOf('nerven') >= 0 ? 0.05 : 0) - (gk && P[gk.pid].tr.indexOf('elferkiller') >= 0 ? 0.1 : 0);
      const ok = R.chance(U.clamp(pg, 0.5, 0.92)); if (ok) res[si]++;
      seq.push([si, t.pid, ok ? 1 : 0]);
      if (!m.opts.fast) ev(m, ok ? 'pengoal' : 'penmiss', si, { pid: t.pid, shoot: 1, pens: res.slice(), text: nm(m, t.pid) + (ok ? ' verwandelt.' : ' vergibt!') + ' (' + res[0] + ':' + res[1] + ')' });
      return ok;
    };
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 2; j++) {
        const si = j === 0 ? first : 1 - first; kick(si, i); k++;
        const remA = 5 - (i + (si === first || j === 1 ? 1 : 0)); // verbleibende Schüsse grob
        const leftFirst = 5 - (i + 1), leftSecond = 5 - (j === 1 ? i + 1 : i);
        const a = res[first], b = res[1 - first];
        if (a > b + leftSecond || b > a + leftFirst) { i = 99; break; }
        void remA;
      }
    }
    let i = 5; let guard = 0;
    while (res[0] === res[1] && guard++ < 60) { kick(first, i); kick(1 - first, i); i++; }
    if (res[0] === res[1]) res[R.chance(0.5) ? 0 : 1]++; // theoretischer Notausgang, damit nie eine Endlosschleife entsteht
    m.pensRes = res; m.pensSeq = seq;
  }

  /* Einen Schritt weiter (eine Minute oder ein Phasenwechsel). Gibt die neuen Ereignisse zurück. */
  M.step = function (m) {
    if (m.done) return [];
    const from = m.events.length; const fast = m.opts.fast;
    if (!m.year) m.year = FM.Cal.year(m.world);
    switch (m.phase) {
      case 'pre': m.phase = 'h1'; m.clock = 0; m.min = 0; if (!fast) ev(m, 'whistle', -1, { text: txt('kickoff') }); break;
      case 'h1':
        m.min++; m.clock = m.min; minute(m);
        if (m.min >= 45 + m.added[0]) { m.phase = 'ht'; if (!fast) ev(m, 'whistle', -1, { text: txt('half'), half: 1 }); }
        break;
      case 'ht':
        for (let s = 0; s < 2; s++) { const sd = m.sides[s]; for (const pl of sd.pl) if (pl.on) pl.sta = Math.min(100, pl.sta + 4); if (sd.ai) { aiSubs(m, s); aiTalk(m, s); } sd.dirty = true; }
        m.phase = 'h2'; m.min = 45; m.clock = 45; if (!fast) ev(m, 'whistle', -1, { text: txt('second') });
        break;
      case 'h2':
        m.min++; m.clock = m.min; minute(m);
        if (m.min >= 90 + m.added[1]) {
          if (needsExtra(m)) { m.phase = 'et1'; m.et = true; m.min = 90; m.clock = 90; for (let s = 0; s < 2; s++) { m.sides[s].subsLeft++; m.sides[s].subWindows = Math.max(0, m.sides[s].subWindows - 1); } if (!fast) ev(m, 'whistle', -1, { text: txt('et') }); }
          else finish(m);
        }
        break;
      case 'et1':
        m.min++; m.clock = m.min; minute(m);
        if (m.min >= 105) { m.phase = 'et2'; }
        break;
      case 'et2':
        m.min++; m.clock = m.min; minute(m);
        if (m.min >= 120) {
          if (needsExtra(m)) { if (!fast) ev(m, 'whistle', -1, { text: txt('pens') }); m.phase = 'pens'; shootout(m); }
          finish(m);
        }
        break;
      default: finish(m);
    }
    return m.events.slice(from);
  };

  function aiTalk(m, si) {
    const side = m.sides[si]; const diff = side.goals - m.sides[1 - si].goals;
    side.talk = diff < 0 ? 1.012 : 1.0;
  }
  /* Kabinenansprache des Spielers (nur in der Pause) */
  M.teamTalk = function (m, si, kind) {
    const side = m.sides[si]; const diff = side.goals - m.sides[1 - si].goals;
    let f = 1, msg = '';
    if (kind === 'laut') { // Kabinenpredigt
      if (diff < 0) { f = R.chance(0.7) ? 1.035 : 0.985; msg = f > 1 ? 'Die Kabinenpredigt wirkt – die Mannschaft kommt mit Wut im Bauch zurück.' : 'Die Spieler wirken nach deiner Standpauke eher eingeschüchtert.'; }
      else { f = R.chance(0.3) ? 1.01 : 0.975; msg = f > 1 ? 'Du hältst die Spannung hoch. Niemand lehnt sich zurück.' : 'Bei einer Führung zu toben, verunsichert die Mannschaft.'; }
    } else if (kind === 'lob') {
      if (diff > 0) { f = R.chance(0.65) ? 1.02 : 0.99; msg = f > 1 ? 'Das Lob beflügelt. Breite Brust für Halbzeit zwei.' : 'Die Mannschaft wird nach dem Lob etwas zu lässig.'; }
      else if (diff === 0) { f = 1.01; msg = 'Du stärkst der Mannschaft den Rücken.'; }
      else { f = R.chance(0.35) ? 1.02 : 0.99; msg = f > 1 ? 'Dein Vertrauen gibt der Mannschaft Sicherheit zurück.' : 'Lob bei Rückstand? Die Spieler schauen sich fragend an.'; }
    } else { f = 1.005; msg = 'Du gibst ruhig die taktischen Anweisungen durch.'; }
    side.talk = f; side.dirty = true;
    return msg;
  };

  function finish(m) {
    if (m.done) return;
    m.done = true; m.phase = 'end';
    const A = m.sides[0], B = m.sides[1];
    const w = A.goals > B.goals ? 0 : B.goals > A.goals ? 1 : -1;
    for (let si = 0; si < 2; si++) {
      const side = m.sides[si]; const res = w === -1 ? 0 : w === si ? 1 : -1;
      for (const pl of side.pl) { if (pl.mi > 0) pl.pts += res * 0.3 + (m.sides[1 - si].goals === 0 && (pl.pos === 'TW' || FM.POS_W[pl.pos][0] >= 0.5) ? 0.3 : 0); }
    }
    if (!m.opts.fast) ev(m, 'whistle', -1, { text: txt('end') + ' ' + A.name + ' ' + A.goals + ':' + B.goals + ' ' + B.name + (m.pensRes ? ' (' + m.pensRes[0] + ':' + m.pensRes[1] + ' i. E.)' : m.et ? ' n. V.' : ''), end: 1 });
  }

  /* Note nach deutscher Schulnotenskala (1,0 = Weltklasse, 6,0 = Totalausfall) */
  M.grade = function (pl) {
    if (pl.mi < 15) return 0;
    const g = 3.4 - pl.pts * 0.95 + (((pl.pid * 7919) % 11) - 5) * 0.06;
    return U.clamp(Math.round(g * 2) / 2, 1, 6);
  };

  M.result = function (m) {
    const A = m.sides[0], B = m.sides[1];
    let winner = A.goals > B.goals ? 0 : B.goals > A.goals ? 1 : -1;
    if (m.opts.knockout) {
      let h = A.goals, a = B.goals; if (m.opts.agg) { h += m.opts.agg[0]; a += m.opts.agg[1]; }
      winner = h > a ? 0 : a > h ? 1 : m.pensRes ? (m.pensRes[0] > m.pensRes[1] ? 0 : 1) : -1;
    }
    const tot = (A.possT + B.possT) || 1;
    return { hg: A.goals, ag: B.goals, et: m.et, pens: m.pensRes, winner, poss: [Math.round(100 * A.possT / tot), 100 - Math.round(100 * A.possT / tot)] };
  };

  /* Manager-Eingriffe während des Spiels */
  M.substitute = function (m, si, outPid, inPid) {
    const side = m.sides[si];
    if (m.done) return 'Das Spiel ist bereits beendet.';
    if (side.subsLeft <= 0) return 'Das Wechselkontingent ist erschöpft.';
    const out = side.pl.find((x) => x.pid === outPid && (x.on || x.hurt));
    if (!out) return 'Dieser Spieler steht nicht auf dem Platz.';
    if (out.red) return 'Ein des Feldes verwiesener Spieler kann nicht ersetzt werden.';
    if (side.bench.indexOf(inPid) < 0) return 'Dieser Spieler sitzt nicht auf der Bank.';
    const ok = doSub(m, si, out, inPid);
    if (!ok) return 'Der Wechsel ist nicht möglich.';
    if (m.forced && m.forced.pid === outPid) m.forced = null;
    out.hurt = out.hurt ? 2 : 0;
    return '';
  };
  M.declineForced = function (m) { // verletzten Spieler nicht ersetzen → Unterzahl
    if (!m.forced) return; const f = m.forced; const side = m.sides[f.side];
    const pl = side.pl.find((x) => x.pid === f.pid); side.off.push(pl.pid); m.forced = null;
    if (pl.pos === 'TW') replaceKeeper(m, f.side);
    side.dirty = true;
  };
  M.swap = function (m, si, pidA, pidB) { // Positionstausch zweier Spieler auf dem Platz
    const side = m.sides[si]; const a = side.pl.find((x) => x.pid === pidA && x.on), b = side.pl.find((x) => x.pid === pidB && x.on);
    if (!a || !b) return false;
    const t = { pos: a.pos, role: a.role, x: a.x, y: a.y }; a.pos = b.pos; a.role = b.role; a.x = b.x; a.y = b.y; b.pos = t.pos; b.role = t.role; b.x = t.x; b.y = t.y; side.dirty = true; return true;
  };
  M.setTactics = function (m, si, tactics) { Object.assign(m.sides[si].tactics, tactics); m.sides[si].dirty = true; };
  M.setFormation = function (m, si, formation) {
    const side = m.sides[si]; const slots = FM.FORMATIONS[formation]; if (!slots) return false;
    const P = m.world.players; const on = onPitch(side); const gk = on.find((x) => x.pos === 'TW');
    const free = slots.map((s, i) => i).filter((i) => slots[i].pos !== 'TW');
    const field = on.filter((x) => x !== gk);
    // weniger Spieler als Plätze (Unterzahl): offensivste Plätze bleiben frei
    const use = free.slice(0, field.length);
    const rest = field.slice();
    for (const i of use) {
      let bi = 0, bv = -1;
      rest.forEach((x, k) => { const v = P[x.pid].ovr * FM.posFit(P[x.pid], slots[i].pos); if (v > bv) { bv = v; bi = k; } });
      const x = rest.splice(bi, 1)[0]; x.pos = slots[i].pos; x.role = slots[i].role; x.x = slots[i].x; x.y = slots[i].y;
    }
    side.formation = formation; side.dirty = true; return true;
  };

  /* Linienstärken einer Aufstellung (für die Anzeige im Aufstellungsbildschirm) */
  M.preview = function (world, club, lineup) {
    const xi = lineup.xi.map((id) => (world.players[id] ? id : 0));
    const side = buildSide(world, club, false, { formation: lineup.formation, xi, bench: [] }, club.tactics, false);
    const m = { world, opts: { neutral: true }, homeAdv: 1, sides: [side, { goals: 0 }] };
    calcStr(m, 0);
    return side.str;
  };

  /* Komplett durchrechnen (KI-Spiele, Sofortergebnis) */
  M.simulate = function (world, fx, opts) {
    const m = M.create(world, fx, Object.assign({ fast: true }, opts || {}));
    let guard = 0;
    while (!m.done && guard++ < 400) M.step(m);
    if (!m.done) finish(m);
    return m;
  };
  M.runToEnd = function (m) { let guard = 0; while (!m.done && guard++ < 400) M.step(m); if (!m.done) finish(m); return m; };
})(typeof globalThis !== 'undefined' ? globalThis : this);
