/* FLUTLICHT · Oberfläche – Spieltag: Vorbericht, Live-Spiel, Spielbericht, Saisonabschluss, Jobangebote */
(function (root) {
  'use strict';
  const FM = root.FM; const U = FM.U; const Cal = FM.Cal; const Team = FM.Team; const G = FM.Game; const M = FM.Match;
  const UI = FM.UI; const h = UI.h;
  const $ = (sel) => document.querySelector(sel);
  const SPEED = { 1: 750, 2: 260, 3: 55 };

  /* ---------- „Weiter“ ---------- */
  UI.A.next = () => {
    const w = UI.world;
    if (w.sacked) { UI.go('sacked'); return; }
    if (w.pendingEvent) { UI.A.event(); return; }
    const st = G.nextStep(w);
    if (st.kind === 'slot') {
      if (st.userItem) { UI.go('prematch', { slot: st.slot }); return; }
      const ctx = G.runSlot(w, st.slot);
      // Europapokal ohne eigene Beteiligung: nur die Spiele der deutschen Klubs zeigen, der Rest steht unter „Wettbewerbe“
      const list = st.def.t === 'euro' ? ctx.others.filter((o) => w.clubs[o.h].tier !== 9 || w.clubs[o.a].tier !== 9) : ctx.others;
      UI.view = 'office'; UI.resultsModal(list, st.def);
    } else if (st.kind === 'endWeek') {
      G.endWeek(w); UI.autosave();
      if (w.sacked) { UI.go('sacked'); return; }
      UI.go('office');
      if (w.pendingEvent) UI.A.event();
    } else if (st.kind === 'seasonEnd') {
      G.seasonEnd(w); UI.autosave(); UI.go('seasonend');
    }
  };
  UI.resultsModal = function (others, def) {
    const w = UI.world; const groups = {};
    for (const o of others) (groups[o.comp] = groups[o.comp] || []).push(o);
    const keys = Object.keys(groups);
    const body = keys.length ? keys.map((k) => '<div class="stack"><h3>' + h(k) + '</h3><div class="conf" style="font-size:14px">' + groups[k].map((o) => '<span class="h">' + UI.clubName(o.h, 1) + '</span><span class="s">' + o.hg + ':' + o.ag + '</span><span class="a">' + UI.clubName(o.a, 1) + '</span>').join('') + '</div></div>').join('') : '<p class="muted">Keine Partien.</p>';
    UI.modal(def && def.t === 'cup' ? 'Pokal: Ergebnisse' : def && def.t === 'euro' ? 'Europapokal: die deutschen Klubs' : 'Ergebnisse', '<p class="muted">' + (def && def.t === 'euro' ? 'Alle Ergebnisse und Tabellen findest du unter „Wettbewerbe“.' : 'Deine Mannschaft hatte spielfrei.') + '</p>' + body + '<div class="row" style="justify-content:flex-end"><button class="btn pri" data-a="closeModal">Weiter</button></div>', { wide: keys.length > 1 });
    void w;
  };

  /* ---------- Vorbericht ---------- */
  UI.V.prematch = function () {
    const w = UI.world; const c = UI.user(); const st = G.nextStep(w);
    if (st.kind !== 'slot' || !st.userItem) return '<div class="card"><p>Es steht kein Spiel an.</p><button class="btn" data-a="nav" data-v="office">Zum Büro</button></div>';
    const it = st.userItem; const f = it.f; const home = f.h === c.id; const opp = w.clubs[home ? f.a : f.h];
    const fr = !!it.friendly; const probs = Team.validate(w, c, fr); const hard = probs.filter((x) => !x.warn);
    const L = c.lineup; const slots = L ? FM.FORMATIONS[L.formation] : [];
    const oppL = Team.autoLineup(w, opp, opp.formation, fr); const oSlots = FM.FORMATIONS[oppL.formation];
    const list = (LL, sl) => '<div class="tw"><table class="t"><tbody>' + LL.xi.map((id, i) => { const p = w.players[id]; return '<tr><td>' + UI.pos(sl[i].pos) + '</td><td class="name">' + (p ? h(p.name) : '<span class="bad">nicht besetzt</span>') + '</td><td class="c">' + (p ? UI.ovr(p.ovr) : '') + '</td><td>' + (p ? UI.bar(p.fit) : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    const tab = c.tier <= 3 && opp.tier <= 3;
    return '<div class="head"><div><h1>' + h(it.comp) + '</h1><p>' + (it.kind === 'league' ? it.md + '. Spieltag' : it.kind === 'euro' ? it.label : it.kind === 'cup' ? Cal.CUP_ROUND[it.r] : it.kind === 'rel' ? (it.leg ? 'Rückspiel' : 'Hinspiel') : 'Testspiel – ohne Wertung, Sperren zählen nicht') + ' · ' + Cal.fmt(Cal.date(w, st.slot === 'mid' ? 2 : 5)) + ' · ' + (it.neutral ? (it.kind === 'euro' ? 'Finalstadion, neutraler Platz' : 'Olympiastadion Berlin') : h(w.clubs[f.h].stadium)) + '</p></div></div>' +
      '<div class="score"><div class="side">' + UI.crest(w.clubs[f.h], 'lg') + '<b>' + h(w.clubs[f.h].short) + '</b></div><div class="mid"><div class="res">–:–</div><div class="clock">' + (tab ? Cal.posOf(w, f.h) + '. gegen ' + Cal.posOf(w, f.a) + '.' : 'Anstoß') + '</div></div><div class="side a">' + UI.crest(w.clubs[f.a], 'lg') + '<b>' + h(w.clubs[f.a].short) + '</b></div></div>' +
      (it.agg ? '<p class="msg">Hinspiel: ' + UI.clubName((it.rl || it.tie).legs[0].h, 1) + ' ' + (it.rl || it.tie).legs[0].hg + ':' + (it.rl || it.tie).legs[0].ag + ' ' + UI.clubName((it.rl || it.tie).legs[0].a, 1) + '. Bei Gleichstand nach beiden Spielen folgen Verlängerung und Elfmeterschießen.</p>' : '') +
      (probs.length ? '<div class="stack">' + probs.map((x) => '<div class="todo ' + (x.warn ? '' : 'bad') + '"><span>' + h(x.text) + '</span></div>').join('') + '<div class="row"><button class="btn pri" data-a="fixLineup">Aufstellung automatisch korrigieren</button><button class="btn" data-a="nav" data-v="lineup">Selbst umstellen</button></div></div>' : '') +
      '<div class="row"><button class="btn go" data-a="kickoff"' + (hard.length ? ' disabled' : '') + '>Anpfiff ▸</button><button class="btn" data-a="instant"' + (hard.length ? ' disabled' : '') + '>Sofortergebnis</button><button class="btn" data-a="nav" data-v="lineup">Aufstellung &amp; Taktik</button></div>' +
      '<div class="grid g2"><div class="card flat"><h3>' + h(c.short) + ' <small>' + (L ? L.formation : '') + '</small></h3>' + (L ? list(L, slots) : '') + '</div><div class="card flat"><h3>' + h(opp.short) + ' <small>voraussichtlich ' + oppL.formation + (opp.coach ? ' · Trainer ' + h(opp.coach) : '') + '</small></h3>' + list(oppL, oSlots) + '</div></div>';
  };
  UI.A.fixLineup = () => { const w = UI.world; const st = G.nextStep(w); Team.repair(w, UI.user(), !!(st.userItem && st.userItem.friendly)); UI.toast('Der Co-Trainer hat die Lücken geschlossen.'); UI.render(); };

  function openLive(instant) {
    const w = UI.world; const st = G.nextStep(w); if (st.kind !== 'slot' || !st.userItem) { UI.go('office'); return; }
    const ctx = G.openSlot(w, st.slot); const m = ctx.match;
    const us = m.sides[0].cid === w.user ? 0 : 1;
    UI.live = { ctx, m, us, speed: 1, run: !instant, timer: 0, log: [], half: false, sel: {}, msg: '', item: st.userItem };
    if (instant) { M.runToEnd(m); finishLive(); return; }
    UI.view = 'match'; UI.p = {}; UI.render(); loop();
  }
  UI.A.kickoff = () => openLive(false);
  UI.A.instant = () => openLive(true);

  /* ---------- Live-Spiel ---------- */
  function loop() {
    const lv = UI.live; if (!lv) return;
    clearTimeout(lv.timer);
    if (!lv.run || lv.m.done) return;
    lv.timer = setTimeout(tick, SPEED[lv.speed]);
  }
  function tick() {
    const lv = UI.live; if (!lv || UI.view !== 'match') return;
    if (!lv.run || UI.modalHtml) { loop(); return; }
    const m = lv.m; const evs = M.step(m);
    for (const e of evs) if (e.text) lv.log.unshift(e);
    if (lv.log.length > 140) lv.log.length = 140;
    if (m.phase === 'ht' && !lv.half) { lv.half = true; lv.run = false; }
    if (m.forced && m.forced.side === lv.us) { lv.run = false; UI.render(); subModal(true); return; }
    UI.render(); loop();
  }
  function confScore(o, clock) { let hg = 0, ag = 0, fresh = false; for (const g of o.goals) if (g[0] <= clock) { if (g[1] === 0) hg++; else ag++; if (g[0] === clock) fresh = true; } return { hg, ag, fresh }; }

  UI.V.match = function () {
    const lv = UI.live; const w = UI.world; if (!lv) return '<div class="start"><button class="btn" data-a="nav" data-v="office">Zum Büro</button></div>';
    const m = lv.m; const A = m.sides[0], B = m.sides[1]; const me = m.sides[lv.us]; const P = w.players;
    const tot = (A.possT + B.possT) || 1; const pa = Math.round(100 * A.possT / tot);
    const duel = (l, a, b) => { const s = a + b || 1; return '<div class="label c">' + l + '</div><div class="duel"><span>' + a + '</span><span class="track"><i style="width:' + Math.round(100 * a / s) + '%"></i><b></b></span><span>' + b + '</span></div>'; };
    const clock = m.done ? 'Abpfiff' : m.phase === 'pre' ? 'Gleich geht\'s los' : m.phase === 'ht' ? 'Halbzeit' : M.minLabel(m) + '. Minute';
    const league = lv.item.kind === 'league';
    const others = lv.ctx.others.filter((o) => (league ? o.tier === lv.item.tier : lv.item.ec ? o.ec === lv.item.ec : true)).slice(0, lv.item.ec ? 17 : 12);
    const cl = m.done ? 200 : m.clock || 0;
    const ctrl = m.done
      ? '<button class="btn go" data-a="toReport">Zum Spielbericht ▸</button>'
      : '<button class="btn ' + (lv.run ? '' : 'pri') + '" data-a="livePause">' + (lv.run ? 'Pause' : m.phase === 'pre' ? 'Anpfiff' : 'Weiter') + '</button>' + [1, 2, 3].map((s) => '<button class="btn ' + (lv.speed === s ? 'on' : '') + '" data-a="liveSpeed" data-v="' + s + '">' + ['', 'Normal', 'Schnell', 'Zeitraffer'][s] + '</button>').join('') + '<button class="btn" data-a="liveSubs">Wechsel &amp; Taktik (' + me.subsLeft + ')</button><button class="btn" data-a="liveSkip">Bis zum Abpfiff vorspulen</button>';
    const talk = m.phase === 'ht' && !m.done ? '<div class="card"><h3>Kabinenansprache <small>Halbzeitstand ' + A.goals + ':' + B.goals + '</small></h3>' + (lv.msg ? '<p class="msg">' + h(lv.msg) + '</p>' : '<div class="row"><button class="btn" data-a="talk" data-v="ruhig">Sachlich bleiben</button><button class="btn" data-a="talk" data-v="lob">Loben und aufbauen</button><button class="btn" data-a="talk" data-v="laut">Laut werden</button></div>') + '</div>' : '';
    const dots = me.pl.filter((x) => x.on).map((x) => { const p = P[x.pid]; return '<span class="slot ' + (x.sta < 55 ? 'bad' : '') + '" style="left:' + x.x + '%;bottom:' + (x.y * 0.92 + 1) + '%;cursor:default"><span class="dot">' + Math.round(x.sta) + '</span><span class="nm">' + h(p.name.split(' ').slice(-1)[0]) + (x.yel ? ' ▮' : '') + '</span></span>'; }).join('');
    return '<div class="main" style="height:100%;--club-a:' + h(w.clubs[me.cid].col[0]) + '"><div class="main-in">' +
      '<div class="score"><div class="side">' + UI.crest(w.clubs[A.cid], 'lg') + '<b>' + h(A.name) + '</b></div><div class="mid"><div class="res">' + A.goals + ':' + B.goals + '</div><div class="clock">' + h(clock) + (m.pensRes ? ' · ' + m.pensRes[0] + ':' + m.pensRes[1] + ' i. E.' : '') + '</div></div><div class="side a">' + UI.crest(w.clubs[B.cid], 'lg') + '<b>' + h(B.name) + '</b></div></div>' +
      '<div class="row between"><div class="row">' + ctrl + '</div><span class="muted">' + h(lv.item.comp) + ' · ' + U.num(m.att) + ' Zuschauer</span></div>' + talk +
      '<div class="split"><div class="card flat"><h3 style="padding-bottom:8px">Liveticker</h3><div class="ticker" aria-live="polite">' + (lv.log.length ? lv.log.map((e) => '<div class="tick ' + e.type + '"><span class="m">' + h(e.label || '') + '\'</span><p>' + h(e.text) + (e.type === 'goal' ? ' <b>' + e.score[0] + ':' + e.score[1] + '</b>' : '') + '</p></div>').join('') : '<p class="muted" style="padding:12px 16px">Die Mannschaften stehen im Spielertunnel.</p>') + '</div></div>' +
      '<div class="stack" style="gap:16px"><div class="card"><h3>Spieldaten</h3>' + duel('Ballbesitz %', pa, 100 - pa) + duel('Torschüsse', A.shots, B.shots) + duel('aufs Tor', A.onT, B.onT) + duel('Ecken', A.corners, B.corners) + duel('Fouls', A.fouls, B.fouls) + duel('Gelb', A.yel, B.yel) + '</div>' +
      '<div class="card"><h3>' + h(me.name) + ' <small>' + h(me.formation) + ' · Zahl = Frische</small></h3><div class="pitch" style="max-width:340px"><div class="box t"></div><div class="box b"></div>' + dots + '</div></div>' +
      (others.length ? '<div class="card"><h3>Konferenz</h3><div class="conf">' + others.map((o) => { const s = confScore(o, cl); return '<span class="h">' + UI.clubName(o.h, 1) + '</span><span class="s ' + (s.fresh && !m.done ? 'new' : '') + '">' + s.hg + ':' + s.ag + '</span><span class="a">' + UI.clubName(o.a, 1) + '</span>'; }).join('') + '</div></div>' : '') +
      '</div></div></div></div>';
  };
  UI.V.match.bare = true;

  UI.A.livePause = () => { const lv = UI.live; lv.run = !lv.run; UI.render(); loop(); };
  UI.A.liveSpeed = (d) => { const lv = UI.live; lv.speed = +d.v; UI.render(); loop(); };
  UI.A.liveSkip = () => { const lv = UI.live; clearTimeout(lv.timer); const m = lv.m; let guard = 0; while (!m.done && guard++ < 400) { for (const e of M.step(m)) if (e.text) lv.log.unshift(e); } lv.run = false; UI.render(); };
  UI.A.talk = (d) => { const lv = UI.live; lv.msg = M.teamTalk(lv.m, lv.us, d.v); UI.render(); };
  UI.A.liveSubs = () => { UI.live.run = false; subModal(false); };

  function subModal(forced) {
    const lv = UI.live; const w = UI.world; const m = lv.m; const me = m.sides[lv.us]; const P = w.players;
    const on = me.pl.filter((x) => x.on); const hurt = m.forced && m.forced.side === lv.us ? me.pl.find((x) => x.pid === m.forced.pid) : null;
    const outList = (hurt ? [hurt] : on).map((x) => [x.pid, x.pos + ' · ' + P[x.pid].name + ' (Stärke ' + P[x.pid].ovr + ', Frische ' + Math.round(x.sta) + (x.yel ? ', Gelb' : '') + ')' + (hurt ? ' – verletzt' : '')]);
    const inList = me.bench.map((id) => [id, P[id].pos + ' · ' + P[id].name + ' (Stärke ' + P[id].ovr + ', Frische ' + Math.round(P[id].fit) + ')']);
    if (!hurt && !(lv.sel.out && on.some((x) => x.pid === lv.sel.out))) { const tired = U.sortBy(on.filter((x) => x.pos !== 'TW'), (x) => x.sta)[0]; lv.sel.out = tired ? tired.pid : 0; }
    if (!(lv.sel.in && me.bench.indexOf(lv.sel.in) >= 0)) { const outPl = hurt || on.find((x) => x.pid === lv.sel.out); const best = outPl ? U.sortBy(me.bench.filter((id) => (outPl.pos === 'TW') === (P[id].pos === 'TW')), (id) => P[id].ovr * FM.posFit(P[id], outPl.pos), true)[0] : 0; lv.sel.in = best || me.bench[0] || 0; }
    const tSel = (key) => { const t = FM.TACTICS[key]; return '<label class="f">' + t.label + '<select data-c="liveTactic" data-k="' + key + '">' + UI.opt(t.opts, me.tactics[key]) + '</select></label>'; };
    const body = (lv.subMsg ? '<p class="msg ' + (lv.subCls || '') + '">' + h(lv.subMsg) + '</p>' : '') +
      (hurt ? '<p class="msg warn">' + h(P[hurt.pid].name) + ' kann nicht weiterspielen. Wechsle jemanden ein – oder spiele in Unterzahl weiter.</p>' : '') +
      '<div class="card"><h3>Wechsel <small>noch ' + me.subsLeft + ' möglich</small></h3>' + (me.subsLeft > 0 && inList.length ? '<div class="row"><label class="f">Raus<select id="sub-out">' + UI.opt(outList, lv.sel.out) + '</select></label><label class="f">Rein<select id="sub-in">' + UI.opt(inList, lv.sel.in) + '</select></label><button class="btn pri" data-a="subDo">Wechseln</button></div>' : '<p class="muted">' + (me.subsLeft > 0 ? 'Die Bank ist leer.' : 'Das Wechselkontingent ist erschöpft.') + '</p>') + (hurt ? '<div><button class="btn" data-a="subDecline">In Unterzahl weiterspielen</button></div>' : '') + '</div>' +
      (hurt ? '' : '<div class="card"><h3>Taktik</h3><div class="row"><label class="f">Formation<select data-c="liveFormation">' + UI.opt(FM.FORMATION_NAMES.map((f) => [f, f]), me.formation) + '</select></label>' + tSel('stance') + tSel('press') + tSel('hard') + tSel('style') + '</div></div>' +
      '<div class="card"><h3>Positionen tauschen</h3><div class="row"><label class="f">Spieler A<select id="swap-a">' + UI.opt(on.map((x) => [x.pid, x.pos + ' · ' + P[x.pid].name]), lv.sel.a) + '</select></label><label class="f">Spieler B<select id="swap-b">' + UI.opt(on.map((x) => [x.pid, x.pos + ' · ' + P[x.pid].name]), lv.sel.b || (on[1] && on[1].pid)) + '</select></label><button class="btn" data-a="swapDo">Tauschen</button></div></div>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn pri" data-a="subClose">Zurück zum Spiel</button></div>');
    UI.modal(hurt ? 'Verletzung' : 'Wechsel & Taktik', body, { locked: !!hurt, wide: true, focus: false });
    void forced;
  }
  UI.A.subDo = () => {
    const lv = UI.live; const o = $('#sub-out'), i = $('#sub-in'); if (!o || !i) return;
    const wasForced = !!(lv.m.forced && lv.m.forced.side === lv.us);
    const err = M.substitute(lv.m, lv.us, +o.value, +i.value);
    lv.subMsg = err || 'Wechsel vollzogen.'; lv.subCls = err ? 'bad' : 'good'; if (!err) lv.sel = {};
    const last = lv.m.events[lv.m.events.length - 1]; if (!err && last && last.type === 'sub' && last.text) lv.log.unshift(last);
    if (!err && wasForced) { lv.subMsg = ''; UI.modalHtml = ''; UI.modalLocked = false; lv.run = true; UI.render(); loop(); return; }
    subModal(false);
  };
  UI.A.subDecline = () => { const lv = UI.live; M.declineForced(lv.m); lv.subMsg = ''; UI.modalHtml = ''; UI.modalLocked = false; lv.run = true; UI.render(); loop(); };
  UI.A.swapDo = () => { const lv = UI.live; const a = +$('#swap-a').value, b = +$('#swap-b').value; if (a === b) { lv.subMsg = 'Wähle zwei verschiedene Spieler.'; lv.subCls = 'bad'; } else { M.swap(lv.m, lv.us, a, b); lv.subMsg = 'Positionen getauscht.'; lv.subCls = 'good'; } subModal(false); };
  UI.C.liveTactic = (v, d) => { const lv = UI.live; M.setTactics(lv.m, lv.us, { [d.k]: d.k === 'style' ? v : +v }); lv.subMsg = 'Taktik angepasst.'; lv.subCls = 'good'; subModal(false); };
  UI.C.liveFormation = (v) => { const lv = UI.live; M.setFormation(lv.m, lv.us, v); lv.subMsg = 'Formation umgestellt auf ' + v + '.'; lv.subCls = 'good'; subModal(false); };
  UI.A.subClose = () => { const lv = UI.live; lv.subMsg = ''; UI.modalHtml = ''; UI.render(); };

  function finishLive() {
    const lv = UI.live; if (!lv) return; clearTimeout(lv.timer);
    // Einstellungen aus dem Spiel bleiben nicht hängen: Die gespeicherte Aufstellung und Taktik des Vereins gelten weiter
    G.closeSlot(UI.world, lv.ctx); UI.live = null; UI.modalHtml = ''; UI.modalLocked = false;
    UI.autosave(); // Ergebnis sofort sichern: kein Fortschrittsverlust, kein Neuladen-Trick
    UI.go('report');
  }
  UI.A.toReport = () => finishLive();

  /* ---------- Spielbericht ---------- */
  UI.V.report = function () {
    const w = UI.world; const r = w.lastMatch; if (!r) return '<div class="card"><p class="muted">Noch kein Spiel absolviert.</p></div>';
    const P = w.players; const hc = w.clubs[r.h], ac = w.clubs[r.a];
    const side = (s) => '<div class="card flat"><h3>' + UI.clubName(s.cid, 1) + ' <small>' + h(s.formation) + '</small></h3><div class="tw"><table class="t"><thead><tr><th>Pos</th><th>Spieler</th><th class="r">Min</th><th class="r">Tore</th><th class="r">Vorl.</th><th class="c">Karten</th><th class="r">Note</th></tr></thead><tbody>' +
      s.rows.filter((x) => x.mi > 0 || x.hurt).map((x) => { const p = P[x.pid]; return '<tr><td>' + UI.pos(x.pos) + '</td><td class="name">' + (p ? h(p.name) : '–') + (x.start ? '' : ' <span class="muted">(eingew.)</span>') + (x.hurt ? ' <span class="chip bad">verletzt</span>' : '') + '</td><td class="r">' + x.mi + '</td><td class="r">' + (x.go || '') + '</td><td class="r">' + (x.as || '') + '</td><td class="c">' + (x.red ? '<span class="bad">Rot</span>' : x.yel ? '<span class="warn">Gelb</span>' : '') + '</td><td class="r"><b>' + (x.grade ? x.grade.toFixed(1).replace('.', ',') : '–') + '</b></td></tr>'; }).join('') + '</tbody></table></div></div>';
    const key = (r.events || []).filter((e) => e.type === 'goal' || e.type === 'red' || e.type === 'yellowred' || e.type === 'pengoal' || e.type === 'penmiss');
    const oth = (w.lastOthers || []).filter((o) => o.comp === r.comp);
    const duel = (l, a, b) => { const s = a + b || 1; return '<div class="label c">' + l + '</div><div class="duel"><span>' + a + '</span><span class="track"><i style="width:' + Math.round(100 * a / s) + '%"></i><b></b></span><span>' + b + '</span></div>'; };
    const st = G.nextStep(w);
    return '<div class="head"><div><h1>Spielbericht</h1><p>' + h(r.comp) + ' · ' + U.num(r.att) + ' Zuschauer</p></div><button class="btn go" data-a="next">' + (st.kind === 'endWeek' ? 'Woche beenden' : st.kind === 'seasonEnd' ? 'Saison abschließen' : 'Weiter') + ' ▸</button></div>' +
      '<div class="score"><div class="side">' + UI.crest(hc, 'lg') + '<b>' + h(hc.short) + '</b></div><div class="mid"><div class="res">' + r.hg + ':' + r.ag + '</div><div class="clock">' + (r.pens ? r.pens[0] + ':' + r.pens[1] + ' im Elfmeterschießen' : r.et ? 'nach Verlängerung' : 'Endstand') + '</div></div><div class="side a">' + UI.crest(ac, 'lg') + '<b>' + h(ac.short) + '</b></div></div>' +
      '<div class="grid g2"><div class="card"><h3>Spielverlauf</h3>' + (key.length ? key.map((e) => '<div class="tick ' + e.type + '"><span class="m">' + h(e.label) + '\'</span><p>' + h(e.text) + '</p></div>').join('') : '<p class="muted">Keine Tore, keine Platzverweise. Ein Spiel für Taktikliebhaber.</p>') + '</div>' +
      '<div class="stack" style="gap:16px"><div class="card"><h3>Spieldaten</h3>' + duel('Ballbesitz %', r.poss[0], r.poss[1]) + duel('Torschüsse', r.sides[0].shots, r.sides[1].shots) + duel('aufs Tor', r.sides[0].onT, r.sides[1].onT) + duel('Ecken', r.sides[0].corners, r.sides[1].corners) + duel('Fouls', r.sides[0].fouls, r.sides[1].fouls) + '</div>' +
      (oth.length ? '<div class="card"><h3>Die anderen Plätze</h3><div class="conf">' + oth.map((o) => '<span class="h">' + UI.clubName(o.h, 1) + '</span><span class="s">' + o.hg + ':' + o.ag + '</span><span class="a">' + UI.clubName(o.a, 1) + '</span>').join('') + '</div></div>' : '') + '</div></div>' +
      '<div class="grid g2">' + side(r.sides[0]) + side(r.sides[1]) + '</div>';
  };

  /* ---------- Saisonabschluss ---------- */
  UI.V.seasonend = function () {
    const w = UI.world; const s = w.lastSeason; if (!s) return '<div class="start"><button class="btn" data-a="nav" data-v="office">Zum Büro</button></div>';
    const u = s.user; const mv = (list, word) => list.map((x) => '<div class="row between"><span>' + UI.clubName(x.cid) + '</span><span class="chip ' + (word === 'up' ? 'good' : 'bad') + '">' + (word === 'up' ? '▲ ' : '▼ ') + h(Cal.LEAGUE_NAME[x.to]) + '</span></div>').join('');
    return '<div class="start"><div class="start-in">' +
      '<div><h1 class="title" style="font-size:clamp(44px,9vw,92px)">Saison ' + Cal.seasonLabel(s.season) + '<span>Abpfiff</span></h1></div><div class="pitchline"></div>' +
      (u ? '<div class="card"><h3>' + UI.clubName(u.cid) + ' <small>' + h(Cal.LEAGUE_NAME[u.tier]) + '</small></h3><div class="row" style="gap:22px"><div><div class="label">Platz</div><div class="big">' + u.pos + '.</div></div><div><div class="label">Punkte</div><div class="big">' + u.pts + '</div></div><div style="flex:1;min-width:220px"><div class="label">Ziel: ' + h(u.goal) + '</div><p>' + h(u.verdict) + '</p>' + (u.moved ? '<p class="' + (u.moved < u.tier ? 'good' : 'bad') + '"><b>' + (u.moved < u.tier ? 'Aufstieg in die ' : 'Abstieg in die ') + h(Cal.LEAGUE_NAME[u.moved]) + '!</b></p>' : '') + '</div></div></div>' : '') +
      '<div class="grid g3"><div class="card"><h3>Titel</h3><dl class="kv"><dt>Deutscher Meister</dt><dd>' + UI.clubName(s.champs[1], 1) + '</dd><dt>Pokalsieger</dt><dd>' + UI.clubName(s.cup, 1) + '</dd><dt>Meister 2. Bundesliga</dt><dd>' + UI.clubName(s.champs[2], 1) + '</dd><dt>Meister 3. Liga</dt><dd>' + UI.clubName(s.champs[3], 1) + '</dd>' + (s.euro && s.euro.CL ? '<dt>Champions League</dt><dd>' + UI.clubName(s.euro.CL, 1) + '</dd><dt>Europa League</dt><dd>' + UI.clubName(s.euro.EL, 1) + '</dd><dt>Conference League</dt><dd>' + UI.clubName(s.euro.ECL, 1) + '</dd>' : '') + '</dl></div>' +
      '<div class="card"><h3>Torjägerkanonen</h3>' + s.scorers.map((x) => '<div class="row between"><span>' + h(x.name) + ' <span class="muted">' + UI.clubName(x.club, 1) + '</span></span><b>' + x.go + '</b></div>').join('') + '</div>' +
      '<div class="card"><h3>Auf- und Absteiger</h3>' + mv(s.up, 'up') + mv(s.down, 'down') + '</div></div>' +
      (s.euroQual ? '<div class="card"><h3>Europapokal ' + Cal.seasonLabel(w.season) + ' <small>deutsche Teilnehmer</small></h3><dl class="kv">' + FM.Euro.ORDER.map((k) => '<dt>' + FM.Euro.COMPS[k].n + '</dt><dd>' + (s.euroQual[k] || []).map((c) => UI.clubName(c, 1)).join(', ') + '</dd>').join('') + '</dl></div>' : '') +
      '<div class="row"><button class="btn go" data-a="newSeason">Auf in die Saison ' + Cal.seasonLabel(w.season) + ' ▸</button></div>' +
      '</div></div>';
  };
  UI.V.seasonend.bare = true;
  UI.A.newSeason = () => { const w = UI.world; if (w.sacked) UI.go('sacked'); else UI.go('office'); };

  /* ---------- Entlassung & Jobangebote ---------- */
  UI.V.sacked = function () {
    const w = UI.world; const s = w.sacked; if (!s) return '<div class="start"><button class="btn" data-a="nav" data-v="office">Zum Büro</button></div>';
    return '<div class="start"><div class="start-in"><div><h1 class="title" style="font-size:clamp(44px,9vw,92px)">Freigestellt<span>' + UI.clubName(s.from) + '</span></h1></div><div class="pitchline"></div>' +
      '<p style="font-size:17px;max-width:62ch">' + h(s.reason) + ' Dein Telefon klingelt trotzdem – diese Vereine wollen dich:</p>' +
      '<div class="clubpick">' + s.offers.map((cid) => { const c = w.clubs[cid]; return '<button class="clubcard" data-a="takeJob" data-v="' + cid + '">' + UI.crest(c) + '<div><b>' + h(c.name) + '</b><small>' + h(Cal.LEAGUE_NAME[c.tier]) + (c.tier <= 3 ? ' · Platz ' + Cal.posOf(w, cid) : '') + ' · Stärke ' + Math.round(Team.level(w, c)) + ' · ' + U.money(c.money) + '</small></div></button>'; }).join('') + '</div>' +
      '<div class="row"><button class="btn" data-a="askQuit">Karriere unterbrechen (Hauptmenü)</button></div></div></div>';
  };
  UI.V.sacked.bare = true;
  UI.A.takeJob = (d) => { G.takeJob(UI.world, d.v); UI.autosave(); UI.go('office'); UI.toast('Vertrag unterschrieben. Auf ein Neues!'); };
})(typeof globalThis !== 'undefined' ? globalThis : this);
