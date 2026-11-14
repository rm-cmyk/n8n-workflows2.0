/* FLUTLICHT · Oberfläche – Kader, Spieler-Dialog, Aufstellung, Training, Transfers */
(function (root) {
  'use strict';
  const FM = root.FM; const U = FM.U; const Cal = FM.Cal; const E = FM.Econ; const Team = FM.Team; const G = FM.Game; const X = FM.Transfer;
  const UI = FM.UI; const h = UI.h;
  const $ = (sel) => document.querySelector(sel);
  const tsd = (v) => Math.round(v / 1000);

  /* ---------- Kader ---------- */
  const SORTS = {
    pos: (p) => FM.POS_ORDER[p.pos] * 100 - p.ovr, name: (p) => p.name, age: (p, w) => FM.age(w, p), ovr: (p) => -p.ovr, pot: (p) => -p.pot, fit: (p) => -p.fit, form: (p) => -p.form, mor: (p) => -p.mor,
    ap: (p) => -p.st.ap, go: (p) => -p.st.go, note: (p) => (p.st.rn ? p.st.ra / p.st.rn : 9), wage: (p) => -p.wage, until: (p) => p.until, val: (p) => -p.val,
  };
  function sorted(list, key, w) {
    const fn = SORTS[key] || SORTS.pos;
    return list.slice().sort((a, b) => { const x = fn(a, w), y = fn(b, w); return typeof x === 'string' ? x.localeCompare(y, 'de') : x - y; });
  }
  function th(key, label, cls) { return '<th class="' + (cls || '') + '" data-a="sort" data-v="' + key + '">' + label + (UI.p.sort === key ? ' ▾' : '') + '</th>'; }
  UI.A.sort = (d) => { UI.p.sort = d.v; UI.render(); };

  UI.V.squad = function () {
    const w = UI.world; const c = UI.user(); const tab = UI.p.tab || 'pros';
    const sq = Team.squad(w, c); const bill = Team.wageBill(w, c);
    let body;
    if (tab === 'youth') {
      const ys = (w.youthOffer || []).map((id) => w.players[id]).filter(Boolean);
      body = '<div class="card"><h3>Talente aus dem Nachwuchsleistungszentrum <small>Stufe ' + c.infra.youth + ' von 5</small></h3>' +
        (ys.length ? '<p class="muted">Jeder Jahrgang bringt neue Talente hervor. Wer bis Woche 3 keinen Profivertrag bekommt, wechselt zu einem anderen Verein. Vertrag: 3 Jahre.</p><div class="tw"><table class="t"><thead><tr><th>Pos</th><th>Name</th><th class="r">Alter</th><th>Nat</th><th class="c">Stärke</th><th>Talent</th><th class="r">Gehalt/Jahr</th><th></th></tr></thead><tbody>' +
          ys.map((p) => '<tr><td>' + UI.pos(p.pos) + '</td><td class="name">' + h(p.name) + '</td><td class="r">' + FM.age(w, p) + '</td><td>' + UI.nat(p.nat) + '</td><td class="c">' + UI.ovr(p.ovr) + '</td><td>' + UI.stars(p.pot) + '</td><td class="r">' + U.money(p.wage) + '</td><td class="r"><button class="btn sm pri" data-a="signYouth" data-id="' + p.id + '">Profivertrag</button></td></tr>').join('') + '</tbody></table></div>'
          : '<p class="muted">Derzeit steht kein Talent zur Übernahme bereit. Die nächsten Jahrgänge kommen im Sommer. Ein besseres Nachwuchsleistungszentrum (Menü „Verein“) bringt mehr und bessere Talente.</p>') + '</div>';
    } else {
      const list = sorted(sq, UI.p.sort || 'pos', w);
      body = '<div class="card flat"><div class="tw"><table class="t"><thead><tr>' + th('pos', 'Pos') + th('name', 'Name') + th('age', 'Alter', 'r') + '<th>Nat</th>' + th('ovr', 'Stärke', 'c') + th('pot', 'Talent') + th('fit', 'Frische') + th('form', 'Form', 'c') + th('mor', 'Moral') + th('ap', 'Sp', 'r') + th('go', 'Tore', 'r') + th('note', 'Note', 'r') + th('wage', 'Gehalt/Jahr', 'r') + th('until', 'Vertrag', 'r') + th('val', 'Marktwert', 'r') + '<th>Status</th></tr></thead><tbody>' +
        list.map((p) => '<tr class="click" data-a="player" data-id="' + p.id + '"><td>' + UI.pos(p.pos) + '</td><td class="name">' + h(p.name) + '</td><td class="r">' + FM.age(w, p) + '</td><td>' + UI.nat(p.nat) + '</td><td class="c">' + UI.ovr(p.ovr) + '</td><td>' + UI.stars(p.pot) + '</td><td>' + UI.bar(p.fit) + '</td><td class="c">' + UI.formTxt(p.form) + '</td><td>' + UI.bar(p.mor) + '</td><td class="r">' + p.st.ap + '</td><td class="r">' + p.st.go + '</td><td class="r">' + UI.note(p.st) + '</td><td class="r">' + U.money(p.wage) + '</td><td class="r ' + (p.until <= w.season + 1 ? 'warn' : '') + '">06/' + p.until + '</td><td class="r">' + U.money(p.val) + '</td><td>' + UI.status(p) + '</td></tr>').join('') + '</tbody></table></div></div>';
    }
    return '<div class="head"><div><h1>Kader</h1><p>' + sq.length + ' Spieler · Durchschnittsalter ' + U.avg(sq, (p) => FM.age(w, p)).toFixed(1).replace('.', ',') + ' · Gehälter ' + U.money(bill) + ' pro Jahr. Klick auf einen Spieler für Vertrag, Transferliste und Details.</p></div></div>' +
      UI.tabs('tab', [['pros', 'Profis'], ['youth', 'Jugend' + ((w.youthOffer || []).length ? ' (' + w.youthOffer.length + ')' : '')]], tab) + body;
  };
  UI.A.signYouth = (d) => { const err = X.signYouth(UI.world, +d.id); UI.toast(err || 'Willkommen bei den Profis!'); UI.render(); };

  /* ---------- Spieler-Dialog ---------- */
  function playerHead(p) {
    const w = UI.world; const c = p.club ? w.clubs[p.club] : null;
    return '<div class="row" style="gap:14px;align-items:flex-start"><div class="big">' + p.ovr + '</div><div class="stack" style="gap:3px;flex:1;min-width:200px"><div>' + UI.pos(p.pos) + (p.pos2 ? ' ' + UI.pos(p.pos2) : '') + ' · ' + FM.age(w, p) + ' Jahre · ' + h(FM.NAT_NAME[p.nat] || p.nat) + (p.gen ? ' <span class="chip" title="Dieser Spieler wurde vom Spiel erzeugt">fiktiv</span>' : '') + '</div>' +
      '<div class="muted">' + (c ? UI.crest(c, 'sm') + ' ' + h(c.name) : p.ab ? 'Ausland (' + h(p.ab) + ')' : p.yo ? 'Eigene Jugend' : 'vereinslos') + '</div><div>Talent ' + UI.stars(p.pot) + '</div></div></div>' +
      '<div class="grid g3"><div><div class="label">Frische</div>' + UI.bar(p.fit, 1) + '</div><div><div class="label">Form</div>' + UI.bar(p.form, 1) + '</div><div><div class="label">Moral</div>' + UI.bar(p.mor, 1) + '</div></div>' +
      (p.tr.length ? '<div class="stack" style="gap:4px">' + p.tr.map((t) => '<div><span class="chip ' + (FM.TRAITS[t].good ? 'good' : 'bad') + '">' + h(FM.TRAITS[t].n) + '</span> <span class="muted">' + h(FM.TRAITS[t].d) + '</span></div>').join('') + '</div>' : '') +
      '<dl class="kv"><dt>Marktwert</dt><dd>' + U.money(p.val) + '</dd>' + (p.club ? '<dt>Gehalt pro Jahr</dt><dd>' + U.money(p.wage) + '</dd><dt>Vertrag bis</dt><dd>06/' + p.until + '</dd>' : '') +
      '<dt>Saison: Spiele / Tore / Vorlagen</dt><dd>' + p.st.ap + ' / ' + p.st.go + ' / ' + p.st.as + '</dd><dt>Notenschnitt · Gelb / Rot</dt><dd>' + UI.note(p.st) + ' · ' + p.st.ye + ' / ' + p.st.re + '</dd><dt>Im Spiel gesamt: Spiele / Tore</dt><dd>' + p.car.ap + ' / ' + p.car.go + '</dd></dl>' +
      (UI.status(p) ? '<div>' + UI.status(p) + (p.inj > 0 ? ' <span class="muted">' + h(p.injT) + '</span>' : '') + '</div>' : '');
  }
  UI.A.player = (d) => { UI.neg = { pid: +d.id, stage: '', msg: '', cls: '' }; UI.playerModal(); };
  UI.playerModal = function () {
    const w = UI.world; const n = UI.neg; const p = w.players[n.pid];
    if (!p) { UI.closeModal(); UI.toast('Der Spieler ist nicht mehr verfügbar.'); return; }
    const c = UI.user(); const mine = p.club === c.id; let act = '';
    const msg = n.msg ? '<p class="msg ' + n.cls + '">' + h(n.msg) + '</p>' : '';
    if (mine) {
      if (n.stage === 'renew') {
        const dem = X.renewDemand(w, p);
        act = '<div class="card"><h3>Vertrag verlängern</h3><p class="muted">Aktuell ' + U.money(p.wage) + ' pro Jahr bis 06/' + p.until + '. Die Verlängerung gilt ab dem Ende der laufenden Saison.</p><div class="row"><label class="f">Gehalt pro Jahr (Tsd. €)<input type="number" id="neg-wage" min="10" step="10" value="' + tsd(n.wage || dem) + '"></label><label class="f">Laufzeit<select id="neg-years">' + UI.opt([[1, '1 Jahr'], [2, '2 Jahre'], [3, '3 Jahre'], [4, '4 Jahre'], [5, '5 Jahre']], n.years || 2) + '</select></label><button class="btn pri" data-a="renewDo">Anbieten</button></div></div>';
      } else {
        act = '<div class="row"><button class="btn pri" data-a="negStage" data-v="renew">Vertrag verlängern</button><button class="btn" data-a="toggleList">' + (p.listed ? 'Von der Transferliste nehmen' : 'Auf die Transferliste') + '</button><button class="btn danger" data-a="askRelease">Vertrag auflösen</button></div>';
      }
    } else if (p.yo) {
      act = '<div class="row"><button class="btn pri" data-a="signYouth" data-id="' + p.id + '">Profivertrag geben</button></div>';
    } else {
      const free = !p.club && !p.ab; const it = X.interest(w, p, c); const cd = X.canDeal(w, p);
      if (n.stage === 'contract') {
        const dem = X.wageDemand(w, p, c);
        act = '<div class="card"><h3>Vertragsgespräch</h3><p class="muted">' + (n.fee ? 'Ablöse vereinbart: ' + U.money(n.fee) + '. ' : free ? 'Ablösefrei – es wird ein Handgeld von rund ' + U.money(U.roundMoney(dem * 0.15)) + ' fällig. ' : '') + 'Der Berater signalisiert eine Vorstellung von etwa ' + U.money(dem) + ' pro Jahr.</p><div class="row"><label class="f">Gehalt pro Jahr (Tsd. €)<input type="number" id="neg-wage" min="10" step="10" value="' + tsd(n.wage || dem) + '"></label><label class="f">Laufzeit<select id="neg-years">' + UI.opt([[1, '1 Jahr'], [2, '2 Jahre'], [3, '3 Jahre'], [4, '4 Jahre'], [5, '5 Jahre']], n.years || 3) + '</select></label><button class="btn pri" data-a="signDo">Vertrag anbieten</button></div></div>';
      } else if (!it.ok) act = '<p class="msg warn">' + h(it.why) + '</p>';
      else if (!cd.ok) act = '<p class="msg warn">' + h(cd.why) + '</p>';
      else if (free) act = '<div class="row"><button class="btn pri" data-a="negStage" data-v="contract">Vertragsgespräch beginnen</button></div>';
      else act = '<div class="card"><h3>Ablöse bieten</h3><p class="muted">Marktwert ' + U.money(p.val) + (p.listed ? ' · steht auf der Transferliste' : '') + '. Dein Konto: ' + U.money(c.money) + '.</p><div class="row"><label class="f">Angebot (Tsd. €)<input type="number" id="neg-fee" min="0" step="50" value="' + tsd(n.bid || p.val) + '"></label><button class="btn pri" data-a="bidDo">Angebot abgeben</button></div></div>';
    }
    UI.modal(p.name, playerHead(p) + msg + act, { focus: false });
  };
  UI.A.negStage = (d) => { UI.neg.stage = d.v; UI.neg.msg = ''; UI.playerModal(); };
  UI.A.toggleList = () => { const p = UI.world.players[UI.neg.pid]; p.listed = p.listed ? 0 : 1; if (p.listed) p.mor = U.clamp(p.mor - 6, 5, 99); UI.neg.msg = p.listed ? p.name + ' steht jetzt auf der Transferliste. Im Transferfenster melden sich Interessenten schneller.' : p.name + ' ist nicht mehr auf der Transferliste.'; UI.neg.cls = ''; UI.playerModal(); };
  UI.A.askRelease = () => { const p = UI.world.players[UI.neg.pid]; UI.confirm('Vertrag auflösen?', h(p.name) + ' verlässt den Verein sofort. Die Abfindung beträgt ' + U.money(X.releaseCost(UI.world, p)) + '.', 'Auflösen', 'releaseDo'); };
  UI.A.releaseDo = () => { const err = X.release(UI.world, UI.neg.pid); UI.modalHtml = ''; UI.toast(err || 'Der Vertrag wurde aufgelöst.'); UI.render(); };
  function readNeg() { const wEl = $('#neg-wage'), yEl = $('#neg-years'); if (wEl) UI.neg.wage = Math.max(0, +wEl.value || 0) * 1000; if (yEl) UI.neg.years = +yEl.value; }
  UI.A.renewDo = () => {
    readNeg(); const r = X.renew(UI.world, UI.neg.pid, UI.neg.wage, UI.neg.years);
    UI.neg.msg = r.msg; UI.neg.cls = r.ok ? 'good' : 'bad'; if (r.ok) UI.neg.stage = ''; UI.playerModal();
  };
  UI.A.bidDo = () => {
    const el = $('#neg-fee'); const fee = Math.max(0, +el.value || 0) * 1000; UI.neg.bid = fee;
    const r = X.bid(UI.world, UI.neg.pid, fee);
    UI.neg.msg = r.msg; UI.neg.cls = r.status === 'accept' ? 'good' : r.status === 'counter' ? 'warn' : 'bad';
    if (r.status === 'accept') { UI.neg.fee = r.fee; UI.neg.stage = 'contract'; }
    if (r.status === 'counter') UI.neg.bid = r.ask;
    UI.playerModal();
  };
  UI.A.signDo = () => {
    readNeg(); const w = UI.world; const p = w.players[UI.neg.pid];
    // Ablöse erneut prüfen: zwischen Zusage und Unterschrift darf sich nichts verschoben haben
    if (p && (p.club || p.ab)) { const again = X.bid(w, p.id, UI.neg.fee || 0); if (again.status !== 'accept') { UI.neg.stage = ''; UI.neg.msg = again.msg; UI.neg.cls = 'bad'; UI.playerModal(); return; } }
    const r = X.sign(w, UI.neg.pid, UI.neg.fee || 0, UI.neg.wage, UI.neg.years);
    if (r.ok) { UI.modalHtml = ''; UI.toast(r.msg); UI.render(); return; }
    UI.neg.msg = r.msg; UI.neg.cls = 'bad'; if (r.broke) UI.neg.stage = ''; UI.playerModal();
  };

  /* ---------- Aufstellung ---------- */
  function lineupOf(c) { const w = UI.world; if (!c.lineup) Team.repair(w, c); return c.lineup; }
  UI.V.lineup = function () {
    const w = UI.world; const c = UI.user(); const L = lineupOf(c); const P = w.players; const slots = FM.FORMATIONS[L.formation];
    const wk = Cal.week(w); const fr = !!(wk.we && wk.we.t === 'friendly' && w.stage < 2);
    const pick = UI.p.pick || null; const probs = Team.validate(w, c, fr);
    const str = FM.Match.preview(w, c, L);
    const slotHtml = slots.map((s, i) => {
      const p = P[L.xi[i]]; const bad = p && (p.inj > 0 || (p.sus > 0 && !fr)); const fit = p ? FM.posFit(p, s.pos) : 1;
      return '<button class="slot ' + (pick && pick.t === 'xi' && pick.i === i ? 'sel ' : '') + (bad ? 'bad ' : '') + (!p ? 'off ' : '') + (p && fit < 0.9 ? 'misfit' : '') + '" style="left:' + s.x + '%;bottom:' + (s.y * 0.92 + 1) + '%" data-a="slot" data-i="' + i + '" aria-label="' + s.pos + ': ' + (p ? h(p.name) : 'frei') + '"><span class="dot">' + (p ? p.ovr : '?') + '</span><span class="nm">' + (p ? h(p.name.split(' ').slice(-1)[0]) : 'frei') + '</span><span class="ps">' + s.pos + (p && fit < 0.9 ? ' · ' + Math.round(fit * 100) + ' %' : '') + '</span></button>';
    }).join('');
    const benchHtml = Array.from({ length: 9 }, (x, j) => { const p = P[L.bench[j]]; return '<button class="bslot ' + (p ? 'full ' : '') + (pick && pick.t === 'bench' && pick.i === j ? 'sel' : '') + '" data-a="bslot" data-i="' + j + '">' + (p ? UI.pos(p.pos) + '<span><b>' + p.ovr + '</b> ' + h(p.name.split(' ').slice(-1)[0]) + '</span>' : '<span class="muted">Bankplatz ' + (j + 1) + '</span>') + '</button>'; }).join('');
    const sq = Team.squad(w, c).slice().sort((a, b) => FM.POS_ORDER[a.pos] - FM.POS_ORDER[b.pos] || b.ovr - a.ovr);
    const where = (id) => { const i = L.xi.indexOf(id); if (i >= 0) return '<span class="chip good">' + slots[i].pos + '</span>'; return L.bench.indexOf(id) >= 0 ? '<span class="chip">Bank</span>' : '<span class="muted">–</span>'; };
    const xiPl = L.xi.map((id) => P[id]).filter(Boolean);
    const roleSel = (key, label) => '<label class="f">' + label + '<select data-c="role" data-k="' + key + '">' + UI.opt([[0, '– automatisch –']].concat(xiPl.filter((p) => key === 'cap' || p.pos !== 'TW').map((p) => [p.id, p.name])), L[key] || 0) + '</select></label>';
    const tSel = (key) => { const t = FM.TACTICS[key]; return '<label class="f">' + t.label + '<select data-c="tactic" data-k="' + key + '">' + UI.opt(t.opts, c.tactics[key]) + '</select></label>'; };
    return '<div class="head"><div><h1>Aufstellung</h1><p>Erst einen Platz oder Spieler anklicken, dann das Ziel – so tauschst du Startelf, Bank und Tribüne. Gelb markierte Positionen sind fremdbesetzt.</p></div><div class="row"><button class="btn" data-a="autoXI">Beste Elf aufstellen</button></div></div>' +
      (probs.length ? '<div class="stack">' + probs.slice(0, 4).map((x) => '<div class="todo ' + (x.warn ? '' : 'bad') + '"><span>' + h(x.text) + '</span></div>').join('') + '</div>' : '') +
      '<div class="split"><div class="stack" style="gap:14px">' +
      '<div class="card"><div class="row"><label class="f">Formation<select data-c="formation">' + UI.opt(FM.FORMATION_NAMES.map((f) => [f, f]), L.formation) + '</select></label>' + tSel('stance') + tSel('press') + tSel('hard') + tSel('style') + '</div>' +
      '<div class="pitch"><div class="box t"></div><div class="box b"></div>' + slotHtml + '</div>' +
      '<div class="grid g3"><div><div class="label">Abwehr ' + Math.round(str.d) + '</div>' + UI.bar(str.d, 1) + '</div><div><div class="label">Mittelfeld ' + Math.round(str.m) + '</div>' + UI.bar(str.m, 1) + '</div><div><div class="label">Angriff ' + Math.round(str.a) + '</div>' + UI.bar(str.a, 1) + '</div></div></div>' +
      '<div class="card"><h3>Bank <small>' + L.bench.length + ' von 9 · fünf Wechsel pro Spiel</small></h3><div class="bench">' + benchHtml + '</div>' + (pick ? '<div><button class="btn sm" data-a="toStand">Ausgewählten Spieler auf die Tribüne setzen</button> <button class="btn sm" data-a="unpick">Auswahl aufheben</button></div>' : '') + '</div>' +
      '<div class="card"><h3>Rollen</h3><div class="row">' + roleSel('cap', 'Kapitän') + roleSel('pen', 'Elfmeter') + roleSel('fk', 'Freistöße') + '</div></div>' +
      '</div><div class="card flat"><div class="tw" style="max-height:900px;overflow-y:auto"><table class="t"><thead><tr><th>Pos</th><th>Name</th><th class="c">Stärke</th><th>Frische</th><th class="c">Form</th><th>Einsatz</th><th>Status</th></tr></thead><tbody>' +
      sq.map((p) => '<tr class="click ' + (pick && pick.t === 'pl' && pick.id === p.id ? 'picked' : '') + '" data-a="plRow" data-id="' + p.id + '"><td>' + UI.pos(p.pos) + (p.pos2 ? ' <span class="muted" style="font-size:11px">' + p.pos2 + '</span>' : '') + '</td><td class="name">' + h(p.name) + '</td><td class="c">' + UI.ovr(p.ovr) + '</td><td>' + UI.bar(p.fit) + '</td><td class="c">' + UI.formTxt(p.form) + '</td><td>' + where(p.id) + '</td><td>' + UI.status(p) + '</td></tr>').join('') + '</tbody></table></div></div></div>';
  };
  function occupant(L, t) { return t.t === 'xi' ? L.xi[t.i] || 0 : t.t === 'bench' ? L.bench[t.i] || 0 : t.id; }
  function clickTarget(t) {
    const w = UI.world; const c = UI.user(); const L = lineupOf(c); const pick = UI.p.pick;
    if (!pick) { UI.p.pick = t; UI.render(); return; }
    if (pick.t === t.t && (pick.i === t.i) && (pick.id === t.id)) { UI.p.pick = null; UI.render(); return; }
    if (t.t === 'pl') {
      if (pick.t === 'pl') { UI.p.pick = t; UI.render(); return; }
      Team.place(w, c, t.id, pick);
    } else {
      const pid = occupant(L, pick);
      if (pid) Team.place(w, c, pid, t);
      else { const other = occupant(L, t); if (other) Team.place(w, c, other, pick); else { UI.p.pick = t; UI.render(); return; } }
    }
    UI.p.pick = null; UI.render();
  }
  UI.A.slot = (d) => clickTarget({ t: 'xi', i: +d.i });
  UI.A.bslot = (d) => clickTarget({ t: 'bench', i: +d.i });
  UI.A.plRow = (d) => clickTarget({ t: 'pl', id: +d.id });
  UI.A.unpick = () => { UI.p.pick = null; UI.render(); };
  UI.A.toStand = () => { const c = UI.user(); const pid = occupant(lineupOf(c), UI.p.pick); if (pid) Team.place(UI.world, c, pid, { t: 'out' }); UI.p.pick = null; UI.render(); };
  UI.A.autoXI = () => { const w = UI.world; const c = UI.user(); const wk = Cal.week(w); c.lineup = Team.autoLineup(w, c, c.lineup ? c.lineup.formation : c.formation, !!(wk.we && wk.we.t === 'friendly' && w.stage < 2)); UI.p.pick = null; UI.toast('Der Co-Trainer hat die formstärkste Elf aufgestellt.'); UI.render(); };
  UI.C.formation = (v) => { Team.reformat(UI.world, UI.user(), v); UI.p.pick = null; UI.render(); };
  UI.C.tactic = (v, d) => { const c = UI.user(); c.tactics[d.k] = d.k === 'style' ? v : +v; UI.render(); };
  UI.C.role = (v, d) => { lineupOf(UI.user())[d.k] = +v; UI.render(); };

  /* ---------- Training ---------- */
  UI.V.training = function () {
    const w = UI.world; const c = UI.user(); const tr = c.training; const sq = Team.squad(w, c);
    const campOk = G.campAllowed(w); const campUsed = c.campDone && Math.floor(c.campDone / 100) === w.season && ((c.campDone % 100 <= 3) === (w.week <= 3));
    return '<div class="head"><div><h1>Training</h1><p>Der Wochenplan wirkt bei jedem Wochenwechsel. Hartes Training bringt mehr Entwicklung, kostet aber Frische und erhöht das Verletzungsrisiko.</p></div></div>' +
      '<div class="grid g2"><div class="card"><h3>Schwerpunkt</h3><div class="stack">' + Object.keys(G.TRAIN).map((k) => '<button class="btn ' + (tr.focus === k ? 'on' : '') + '" style="justify-content:flex-start;white-space:normal;text-align:left" data-a="trainFocus" data-v="' + k + '"><b style="min-width:110px">' + G.TRAIN[k].n + '</b><span style="font-weight:400">' + G.TRAIN[k].d + '</span></button>').join('') + '</div></div>' +
      '<div class="stack" style="gap:16px"><div class="card"><h3>Intensität</h3><div class="row">' + G.INTENS.map((n, i) => '<button class="btn ' + (tr.intens === i ? 'on' : '') + '" data-a="trainInt" data-v="' + i + '">' + n + '</button>').join('') + '</div>' +
      '<dl class="kv"><dt>Konditioneller Zustand</dt><dd>' + UI.pips(Math.round((c.cond || 0) / 2), 5) + '</dd><dt>Taktische Abstimmung</dt><dd>' + UI.pips(Math.round((c.tac || 0) / 2), 5) + '</dd><dt>Durchschnittliche Frische</dt><dd>' + Math.round(U.avg(sq, (p) => p.fit)) + ' %</dd><dt>Verletzte</dt><dd>' + sq.filter((p) => p.inj > 0).length + '</dd></dl></div>' +
      '<div class="card"><h3>Trainingslager <small>Vorbereitung &amp; Winterpause</small></h3>' + (campUsed ? '<p class="msg good">Das Trainingslager für diesen Abschnitt ist gebucht. Die Wirkung zeigt sich zum Wochenwechsel.</p>' : !campOk ? '<p class="muted">Ein Trainingslager ist nur in den Wochen 1–3 und in der Winterpause (Wochen 22–23) möglich.</p>' : '<div class="stack">' + G.CAMPS.map((k, i) => '<div class="row between"><span><b>' + h(k.n) + '</b><br><span class="muted">' + h(k.d) + '</span></span><button class="btn sm pri" data-a="camp" data-i="' + i + '">' + U.money(G.campCost(c, i)) + '</button></div>').join('') + '</div>') + '</div></div></div>';
  };
  UI.A.trainFocus = (d) => { UI.user().training.focus = d.v; UI.render(); };
  UI.A.trainInt = (d) => { UI.user().training.intens = +d.v; UI.render(); };
  UI.A.camp = (d) => { const err = G.bookCamp(UI.world, +d.i); UI.toast(err || 'Trainingslager gebucht – die Koffer sind gepackt.'); UI.render(); };

  /* ---------- Transfers ---------- */
  UI.V.transfers = function () {
    const w = UI.world; const c = UI.user(); const tab = UI.p.tab || 'search'; const open = X.windowOpen(w);
    let body = '';
    if (tab === 'offers') {
      body = '<div class="card"><h3>Angebote für deine Spieler</h3>' + (w.offers.length ? '<div class="tw"><table class="t"><thead><tr><th>Spieler</th><th>Pos</th><th class="c">Stärke</th><th>Interessent</th><th class="r">Marktwert</th><th class="r">Angebot</th><th class="r">gilt bis</th><th></th></tr></thead><tbody>' +
        w.offers.map((o) => { const p = w.players[o.pid]; if (!p) return ''; return '<tr><td class="name">' + h(p.name) + '</td><td>' + UI.pos(p.pos) + '</td><td class="c">' + UI.ovr(p.ovr) + '</td><td>' + h(o.fromName) + '</td><td class="r">' + U.money(p.val) + '</td><td class="r"><b>' + U.money(o.fee) + '</b></td><td class="r">Woche ' + o.exp + '</td><td class="r"><button class="btn sm pri" data-a="offerYes" data-id="' + o.id + '">Annehmen</button> <button class="btn sm" data-a="offerNo" data-id="' + o.id + '">Ablehnen</button></td></tr>'; }).join('') + '</tbody></table></div>'
        : '<p class="muted">Derzeit liegen keine Angebote vor. Spieler auf der Transferliste ziehen im Transferfenster deutlich mehr Interessenten an.</p>') + '</div>';
    } else if (tab === 'ticker') {
      body = '<div class="card flat"><div class="tw"><table class="t"><thead><tr><th>Woche</th><th>Spieler</th><th>Pos</th><th class="c">Stärke</th><th>von</th><th>zu</th><th class="r">Ablöse</th></tr></thead><tbody>' + (w.ticker.length ? w.ticker.slice(0, 60).map((t) => '<tr><td>' + Cal.seasonLabel(t.s) + ' · ' + t.w + '</td><td class="name">' + h(t.name) + '</td><td>' + UI.pos(t.pos) + '</td><td class="c">' + t.ovr + '</td><td>' + h(t.from) + '</td><td>' + h(t.to) + '</td><td class="r">' + (t.fee ? U.money(t.fee) : 'ablösefrei') + '</td></tr>').join('') : '<tr><td colspan="7" class="muted">Noch keine Transfers in dieser Spielwelt.</td></tr>') + '</tbody></table></div></div>';
    } else {
      const f = UI.p; const src = f.src || 'all'; const pos = f.fpos || ''; const maxAge = +(f.maxAge || 40); const minOvr = +(f.minOvr || 0); const maxVal = +(f.maxVal || 0); const name = (f.fname || '').toLowerCase();
      let list = [];
      for (const id in w.players) {
        const p = w.players[id]; if (p.club === c.id || p.yo) continue;
        const st = X.status(p);
        if (src === 'free' && st !== 'free') continue; if (src === 'abroad' && st !== 'abroad') continue; if (src === 'listed' && !p.listed) continue; if (src === 'club' && st !== 'club') continue;
        if (pos && p.pos !== pos && !(pos.length === 1 && FM.POS_GROUP[p.pos] === pos)) continue;
        if (p.ovr < minOvr) continue; if (maxVal && p.val > maxVal) continue; if (FM.age(w, p) > maxAge) continue;
        if (name && p.name.toLowerCase().indexOf(name) < 0) continue;
        list.push(p);
      }
      const total = list.length; list = sorted(list, f.sort || 'ovr', w).slice(0, 80);
      body = '<div class="card"><div class="row">' +
        '<label class="f">Herkunft<select data-c="flt" data-k="src">' + UI.opt([['all', 'Alle'], ['club', 'Unter Vertrag'], ['listed', 'Transferliste'], ['free', 'Vereinslos'], ['abroad', 'Ausland']], src) + '</select></label>' +
        '<label class="f">Position<select data-c="flt" data-k="fpos">' + UI.opt([['', 'Alle'], ['T', 'Tor'], ['A', 'Abwehr'], ['M', 'Mittelfeld'], ['S', 'Angriff']].concat(FM.POS.map((x) => [x, x])), pos) + '</select></label>' +
        '<label class="f">Mindeststärke<select data-c="flt" data-k="minOvr">' + UI.opt([[0, 'egal'], [55, '55'], [60, '60'], [65, '65'], [70, '70'], [75, '75'], [80, '80'], [85, '85']], minOvr) + '</select></label>' +
        '<label class="f">Höchstalter<select data-c="flt" data-k="maxAge">' + UI.opt([[40, 'egal'], [19, '19'], [21, '21'], [23, '23'], [26, '26'], [29, '29']], maxAge) + '</select></label>' +
        '<label class="f">Marktwert bis<select data-c="flt" data-k="maxVal">' + UI.opt([[0, 'egal'], [250e3, '250 Tsd. €'], [1e6, '1 Mio. €'], [3e6, '3 Mio. €'], [10e6, '10 Mio. €'], [25e6, '25 Mio. €'], [50e6, '50 Mio. €']], maxVal) + '</select></label>' +
        '<label class="f">Name<input type="text" data-c="flt" data-k="fname" value="' + h(f.fname || '') + '" placeholder="Name enthält …"></label></div></div>' +
        '<div class="card flat"><div class="tw"><table class="t"><thead><tr>' + th('pos', 'Pos') + th('name', 'Name') + th('age', 'Alter', 'r') + '<th>Nat</th>' + th('ovr', 'Stärke', 'c') + th('pot', 'Talent') + '<th>Verein</th>' + th('until', 'Vertrag', 'r') + th('val', 'Marktwert', 'r') + '<th></th></tr></thead><tbody>' +
        (list.length ? list.map((p) => '<tr class="click" data-a="player" data-id="' + p.id + '"><td>' + UI.pos(p.pos) + '</td><td class="name">' + h(p.name) + '</td><td class="r">' + FM.age(w, p) + '</td><td>' + UI.nat(p.nat) + '</td><td class="c">' + UI.ovr(p.ovr) + '</td><td>' + UI.stars(p.pot) + '</td><td>' + (p.club ? UI.clubName(p.club, 1) : p.ab ? '<span class="chip info">' + h(p.ab) + '</span>' : '<span class="chip good">vereinslos</span>') + '</td><td class="r">' + (p.club ? '06/' + p.until : '–') + '</td><td class="r">' + U.money(p.val) + '</td><td>' + (p.listed ? '<span class="chip info">Transferliste</span>' : '') + '</td></tr>').join('') : '<tr><td colspan="10" class="muted">Kein Spieler passt zu diesen Filtern.</td></tr>') +
        '</tbody></table></div></div><p class="muted">' + (total > 80 ? 'Angezeigt werden die ersten 80 von ' + total + ' Treffern – Filter verfeinern für mehr.' : total + ' Treffer.') + '</p>';
    }
    return '<div class="head"><div><h1>Transfers</h1><p>' + (open ? 'Das Transferfenster ist geöffnet.' : 'Das Transferfenster ist geschlossen – vereinslose Spieler kannst du trotzdem jederzeit verpflichten.') + ' Konto: ' + U.money(c.money) + ' · Kader: ' + c.squad.length + ' von maximal ' + X.MAX_SQUAD + '.</p></div></div>' +
      UI.tabs('tab', [['search', 'Spielersuche'], ['offers', 'Angebote' + (w.offers.length ? ' (' + w.offers.length + ')' : '')], ['ticker', 'Transferticker']], tab) + body;
  };
  UI.C.flt = (v, d) => { UI.p[d.k] = v; UI.render(); };
  UI.A.offerYes = (d) => { const err = X.acceptOffer(UI.world, +d.id); UI.toast(err || 'Der Transfer ist perfekt.'); UI.render(); };
  UI.A.offerNo = (d) => { X.rejectOffer(UI.world, +d.id); UI.render(); };
})(typeof globalThis !== 'undefined' ? globalThis : this);
