/* FLUTLICHT · Oberfläche – Grundgerüst, Navigation, Start, Büro, Postfach, System */
(function (root) {
  'use strict';
  const FM = root.FM; const U = FM.U; const Cal = FM.Cal; const E = FM.Econ; const Team = FM.Team; const G = FM.Game;
  const UI = (FM.UI = { world: null, view: 'start', p: {}, modalHtml: '', toastT: 0, V: {}, A: {}, C: {}, live: null });
  const h = (UI.h = U.esc);
  const $ = (sel) => document.querySelector(sel);

  /* ---------- kleine Darstellungshelfer ---------- */
  UI.crest = function (c, cls) { return '<span class="crest ' + (cls || '') + '" style="--a:' + h(c.col[0]) + ';--b:' + h(c.col[1]) + '" aria-hidden="true">' + h(c.id.replace(/\d/g, '').slice(0, 3)) + '</span>'; };
  UI.pos = function (pos) { return '<span class="pos ' + FM.POS_GROUP[pos] + '" title="' + h(FM.POS_NAME[pos]) + '">' + pos + '</span>'; };
  UI.ovr = function (v) { return '<span class="ovr">' + v + '</span>'; };
  UI.starsN = function (pot) { return pot >= 86 ? 5 : pot >= 79 ? 4 : pot >= 72 ? 3 : pot >= 64 ? 2 : 1; };
  UI.stars = function (pot) { const n = UI.starsN(pot); return '<span class="stars" title="Talent: ' + n + ' von 5">' + '★'.repeat(n) + '<i>' + '★'.repeat(5 - n) + '</i></span>'; };
  UI.bar = function (v, wide) { v = Math.round(U.clamp(v, 0, 100)); return '<span class="bar ' + (v < 45 ? 'low' : v < 62 ? 'mid' : '') + (wide ? ' wide' : '') + '" title="' + v + ' %"><i style="width:' + v + '%"></i></span>'; };
  UI.formTxt = function (f) { return f >= 70 ? '<span class="good" title="Form: stark">▲▲</span>' : f >= 57 ? '<span class="good" title="Form: gut">▲</span>' : f >= 43 ? '<span class="muted" title="Form: normal">●</span>' : f >= 30 ? '<span class="bad" title="Form: schwach">▼</span>' : '<span class="bad" title="Form: Krise">▼▼</span>'; };
  UI.nat = function (n) { return '<abbr title="' + h(FM.NAT_NAME[n] || n) + '" style="text-decoration:none">' + h(n) + '</abbr>'; };
  UI.status = function (p) {
    let s = '';
    if (p.inj > 0) s += '<span class="chip bad" title="' + h(p.injT) + '">verletzt ' + p.inj + ' Wo.</span> ';
    if (p.sus > 0) s += '<span class="chip warn">gesperrt ' + p.sus + '</span> ';
    if (p.listed) s += '<span class="chip info">Transferliste</span> ';
    return s;
  };
  UI.clubName = function (cid, short) { const c = UI.world.clubs[cid]; return c ? h(short ? c.short : c.name) : h(cid || '–'); };
  UI.pips = function (n, max) { let s = '<span class="pips" title="Stufe ' + n + ' von ' + max + '">'; for (let i = 1; i <= max; i++) s += '<i class="' + (i <= n ? 'on' : '') + '"></i>'; return s + '</span>'; };
  UI.note = function (st) { return st.rn ? (st.ra / st.rn).toFixed(2).replace('.', ',') : '–'; };
  UI.fxScore = function (f) { return f.p ? f.hg + ':' + f.ag + (f.pens ? ' i. E.' : f.et ? ' n. V.' : '') : '–:–'; };
  UI.opt = function (list, cur) { return list.map((o) => '<option value="' + h(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + h(o[1]) + '</option>').join(''); };
  UI.tabs = function (key, list, cur) { return '<div class="tabs" role="tablist">' + list.map((t) => '<button role="tab" aria-selected="' + (t[0] === cur) + '" data-a="tab" data-k="' + key + '" data-v="' + t[0] + '">' + h(t[1]) + '</button>').join('') + '</div>'; };

  /* ---------- Navigation & Rendering ---------- */
  const NAV = [['office', 'Büro'], ['squad', 'Kader'], ['lineup', 'Aufstellung'], ['training', 'Training'], ['transfers', 'Transfers'], ['finance', 'Finanzen'], ['club', 'Verein'], ['comp', 'Wettbewerbe'], ['inbox', 'Postfach'], ['system', 'Speichern']];
  UI.go = function (view, params) { UI.view = view; UI.p = Object.assign({}, params || {}); UI.scrollTop = 0; UI.render(); const m = $('.main'); if (m) m.scrollTop = 0; };
  UI.user = function () { return UI.world.clubs[UI.world.user]; };

  function nextLabel(w) {
    if (w.sacked) return 'Jobangebote';
    const st = G.nextStep(w);
    if (st.kind === 'slot') {
      if (st.userItem) return st.userItem.kind === 'friendly' ? 'Zum Testspiel' : st.userItem.kind === 'cup' ? 'Zum Pokalspiel' : st.userItem.kind === 'rel' ? 'Zur Relegation' : 'Zum Spieltag';
      return st.def.t === 'cup' ? 'Pokalrunde' : st.def.t === 'rel' ? 'Relegation' : 'Spieltag';
    }
    return st.kind === 'seasonEnd' ? 'Saison abschließen' : 'Woche beenden';
  }

  function shell(inner) {
    const w = UI.world; const c = UI.user(); const wk = Cal.week(w);
    const pos = c.tier <= 3 ? Cal.posOf(w, c.id) : 0;
    const unread = w.news.filter((n) => !n.r).length; const offers = w.offers.length;
    const probs = Team.hardProblems(w, c, wk.we && wk.we.t === 'friendly').length;
    const badge = { inbox: unread, transfers: offers, lineup: probs ? '!' : 0, squad: (w.youthOffer || []).length };
    return '<div class="shell" style="--club-a:' + h(c.col[0]) + ';--club-b:' + h(c.col[1]) + '">' +
      '<header class="top"><div class="top-in">' +
      '<div class="brand">FLUTLICHT<small>Fußballmanager</small></div>' +
      '<div class="top-club">' + UI.crest(c) + '<b>' + h(c.name) + '</b></div>' +
      '<div class="top-facts">' +
      '<div class="fact"><span>' + h(Cal.LEAGUE_NAME[c.tier]) + '</span><b>' + (pos ? pos + '. Platz' : '–') + '</b></div>' +
      '<div class="fact"><span>Saison ' + Cal.seasonLabel(w.season) + ' · Woche ' + w.week + '</span><b>' + h(wk.label || 'Spielfrei') + ' · ' + Cal.fmt(Cal.date(w), true) + '</b></div>' +
      '<div class="fact"><span>Kontostand</span><b class="' + (c.money < 0 ? 'bad' : '') + '">' + U.money(c.money) + '</b></div>' +
      '<button class="btn go" data-a="next">' + h(nextLabel(w)) + ' ▸</button>' +
      '</div></div></header>' +
      '<nav class="nav" aria-label="Hauptmenü">' + NAV.map((n, i) => (i === 7 || i === 8 ? '<hr>' : '') + '<button data-a="nav" data-v="' + n[0] + '"' + (UI.view === n[0] ? ' aria-current="page"' : '') + '>' + n[1] + (badge[n[0]] ? '<span class="badge">' + badge[n[0]] + '</span>' : '') + '</button>').join('') + '</nav>' +
      '<main class="main" id="main"><div class="main-in">' + inner + '</div></main></div>';
  }

  UI.render = function () {
    const app = $('#app'); const main = $('.main'); if (main) UI.scrollTop = main.scrollTop;
    let html;
    const fn = UI.V[UI.view] || UI.V.start;
    if (!UI.world || UI.view === 'start' || UI.view === 'new') html = fn();
    else if (fn.bare) html = fn();
    else html = shell(fn());
    app.innerHTML = html;
    const m2 = $('.main'); if (m2 && UI.scrollTop) m2.scrollTop = UI.scrollTop;
    $('#modal').innerHTML = UI.modalHtml ? '<div class="modal-bg" data-a="modalBg">' + UI.modalHtml + '</div>' : '';
  };
  UI.modal = function (title, body, opts) {
    const o = opts || {};
    UI.modalLocked = !!o.locked;
    UI.modalHtml = '<div class="modal ' + (o.wide ? 'wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + h(title) + '"><h2><span>' + h(title) + '</span>' + (o.locked ? '' : '<button class="x" data-a="closeModal" aria-label="Schließen">×</button>') + '</h2>' + body + '</div>';
    UI.render();
    const f = document.querySelector('.modal button:not(.x), .modal input, .modal select'); if (f && o.focus !== false) f.focus();
  };
  UI.closeModal = function () { UI.modalHtml = ''; UI.modalLocked = false; UI.render(); };
  UI.toast = function (msg) { const t = $('#toast'); t.textContent = msg; clearTimeout(UI.toastT); UI.toastT = setTimeout(() => { t.textContent = ''; }, 3200); };
  UI.confirm = function (title, text, yes, action, data) {
    UI.modal(title, '<p>' + text + '</p><div class="row" style="justify-content:flex-end"><button class="btn" data-a="closeModal">Abbrechen</button><button class="btn pri" data-a="' + action + '" ' + Object.keys(data || {}).map((k) => 'data-' + k + '="' + h(data[k]) + '"').join(' ') + '>' + h(yes) + '</button></div>');
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]'); if (!el) return;
    const a = el.dataset.a;
    if (a === 'modalBg') { if (e.target === el && !UI.modalLocked) UI.closeModal(); return; }
    if (el.disabled) return;
    const fn = UI.A[a]; if (fn) { try { fn(el.dataset, el, e); } catch (err) { console.error(err); UI.toast('Da ist etwas schiefgegangen: ' + err.message); } }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-c]'); if (!el) return;
    const fn = UI.C[el.dataset.c]; if (fn) { try { fn(el.value, el.dataset, el); } catch (err) { console.error(err); UI.toast('Da ist etwas schiefgegangen: ' + err.message); } }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && UI.modalHtml && !UI.modalLocked) UI.closeModal(); });
  document.addEventListener('submit', (e) => e.preventDefault());

  UI.A.nav = (d) => UI.go(d.v);
  UI.A.tab = (d) => { UI.p[d.k] = d.v; UI.render(); };
  UI.A.closeModal = () => UI.closeModal();
  UI.A.go = (d) => UI.go(d.v, d.k ? { [d.k]: d.kv } : null);

  /* ---------- Speichern ---------- */
  UI.autosave = function () {
    if (!UI.world) return;
    const r = FM.Save.save(UI.world, 'auto');
    if (!r.ok && r.err) UI.toast(r.err);
  };

  /* ---------- Start & neues Spiel ---------- */
  UI.V.start = function () {
    const DB = FM.DB; const auto = FM.Save.info('auto');
    const slots = FM.Save.SLOTS.map((s) => ({ s, i: FM.Save.info(s) })).filter((x) => x.i);
    return '<div class="start"><div class="start-in">' +
      '<div><h1 class="title">Flutlicht<span>Fußballmanager ' + Cal.seasonLabel(DB.season) + '</span></h1></div><div class="pitchline"></div>' +
      '<p style="max-width:62ch;font-size:17px">Übernimm einen von ' + DB.clubs.length + ' Vereinen aus Bundesliga, 2. Bundesliga und 3. Liga. Stell auf, verhandle, bau das Stadion aus – und erkläre dem Vorstand, warum es wieder nur ein 0:0 in Sandhausen wurde.</p>' +
      '<div class="row">' + (auto ? '<button class="btn go" data-a="loadSlot" data-s="auto">Weiterspielen ▸</button>' : '') + '<button class="btn ' + (auto ? '' : 'go') + '" data-a="go" data-v="new">Neues Spiel</button>' +
      '<label class="btn" style="cursor:pointer">Spielstand-Datei laden<input type="file" accept=".flutlicht,.json,.txt" data-c="importFile" class="sr"></label></div>' +
      (slots.length ? '<div class="card"><h3>Gespeicherte Spielstände</h3>' + slots.map((x) => '<div class="row between"><span><b>' + (x.s === 'auto' ? 'Automatisch' : 'Platz ' + x.s) + '</b> · ' + h(x.i.meta.club) + ' · Saison ' + Cal.seasonLabel(x.i.meta.season) + ', Woche ' + x.i.meta.week + ' <span class="muted">· ' + new Date(x.i.ts).toLocaleString('de-DE') + '</span></span><button class="btn sm" data-a="loadSlot" data-s="' + x.s + '">Laden</button></div>').join('') + '</div>' : '') +
      (FM.Save.persistent() ? '' : '<p class="msg warn">Dieser Browser erlaubt hier kein dauerhaftes Speichern. Sichere deinen Spielstand über „Speichern → Als Datei exportieren“.</p>') +
      '<p class="muted" style="font-size:13px;max-width:80ch">Datenstand ' + h(DB.built.split('-').reverse().join('.')) + ': ' + DB.players + ' Spieler, Kader, Trainer und Stadien der Saison ' + Cal.seasonLabel(DB.season) + ' aus der Wikipedia (CC BY-SA 4.0). Spielstärken und Talente sind eigene Schätzwerte. Inoffizielles Fanprojekt ohne Verbindung zu Vereinen, Verbänden oder Ligen; keine Logos, keine Lizenzen.</p>' +
      '</div></div>';
  };
  UI.V.new = function () {
    const DB = FM.DB; const tier = +(UI.p.tier || 1); const sel = UI.p.club || '';
    const clubs = DB.clubs.filter((c) => c.tier === tier && !c.reserve).sort((a, b) => b.lvl - a.lvl);
    const diff = (c) => { const r = clubs.indexOf(c) / (clubs.length - 1); return r < 0.2 ? 'Titelkandidat' : r < 0.5 ? 'Oberes Mittelfeld' : r < 0.8 ? 'Unteres Mittelfeld' : 'Abstiegskampf'; };
    return '<div class="start"><div class="start-in">' +
      '<div class="head"><div><h1>Neues Spiel</h1><p>Wähle deinen Verein. Je weiter unten in der Liste, desto dünner die Luft.</p></div><button class="btn" data-a="go" data-v="start">Zurück</button></div>' +
      '<div class="row"><label class="f">Dein Name<input type="text" id="mgr-name" maxlength="30" value="' + h(UI.p.name || '') + '" placeholder="z. B. Alex Trainer" data-c="mgrName"></label></div>' +
      UI.tabs('tier', [['1', 'Bundesliga'], ['2', '2. Bundesliga'], ['3', '3. Liga']], String(tier)) +
      '<div class="clubpick">' + clubs.map((c) => '<button class="clubcard" data-a="pickClub" data-v="' + c.id + '" aria-pressed="' + (sel === c.id) + '">' + UI.crest(c) + '<div><b>' + h(c.name) + '</b><small>Stärke ' + Math.round(c.lvl) + ' · ' + diff(c) + '</small></div></button>').join('') + '</div>' +
      '<div class="row"><button class="btn go" data-a="startGame"' + (sel ? '' : ' disabled') + '>Anpfiff ▸</button><span class="muted">' + (sel ? h(DB.clubs.find((c) => c.id === sel).name) + ' · ' + h(DB.clubs.find((c) => c.id === sel).stadium) + ' (' + U.num(DB.clubs.find((c) => c.id === sel).cap) + ' Plätze)' : 'Noch kein Verein gewählt.') + '</span></div>' +
      '</div></div>';
  };
  UI.C.mgrName = (v) => { UI.p.name = v; };
  UI.A.pickClub = (d) => { const n = $('#mgr-name'); if (n) UI.p.name = n.value; UI.p.club = d.v; UI.render(); };
  UI.A.startGame = () => {
    const n = $('#mgr-name'); const name = ((n && n.value) || UI.p.name || '').trim() || 'Trainer';
    UI.world = FM.World.create({ clubId: UI.p.club, manager: name });
    FM.R.use(UI.world); UI.autosave(); UI.go('office');
  };
  UI.A.loadSlot = (d) => {
    const r = FM.Save.load(d.s);
    if (r.err) { UI.toast(r.err); return; }
    UI.world = r.world; FM.R.use(UI.world);
    UI.go(UI.world.sacked ? 'sacked' : 'office');
    UI.toast(r.restored ? 'Der letzte Stand war beschädigt – die Sicherungskopie wurde geladen.' : 'Spielstand geladen.');
  };
  UI.C.importFile = (v, d, el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { const r = FM.Save.parse(String(rd.result)); if (r.err) { UI.toast(r.err); return; } UI.world = r.world; FM.R.use(UI.world); UI.autosave(); UI.go(UI.world.sacked ? 'sacked' : 'office'); UI.toast('Spielstand importiert.'); };
    rd.onerror = () => UI.toast('Die Datei konnte nicht gelesen werden.');
    rd.readAsText(f);
  };

  /* ---------- Büro ---------- */
  function nextFixture(w, c) {
    const list = Cal.clubFixtures(w, c.id).filter((x) => !x.f.p && (x.w > w.week || (x.w === w.week && ((x.where === 'mid' && w.stage < 1) || (x.where === 'we' && w.stage < 2)))));
    return list[0] || null;
  }
  UI.todos = function () {
    const w = UI.world; const c = UI.user(); const out = [];
    const wk = Cal.week(w); const fr = !!(wk.we && wk.we.t === 'friendly');
    const pr = Team.hardProblems(w, c, fr);
    if (pr.length) out.push({ bad: 1, t: 'Die Aufstellung ist nicht spielbereit: ' + h(pr[0].text) + (pr.length > 1 ? ' (+' + (pr.length - 1) + ' weitere)' : ''), a: 'nav', v: 'lineup', l: 'Zur Aufstellung' });
    if (!c.sponsor && w.sponsorOffers) out.push({ t: 'Der Verein hat noch keinen Trikotsponsor. Drei Angebote liegen vor.', a: 'sponsorPick', l: 'Angebote ansehen' });
    if (w.offers.length) out.push({ t: w.offers.length + (w.offers.length === 1 ? ' Transferangebot wartet' : ' Transferangebote warten') + ' auf deine Antwort.', a: 'go', v: 'transfers', k: 'tab', kv: 'offers', l: 'Ansehen' });
    if ((w.youthOffer || []).length) out.push({ t: w.youthOffer.length + ' Talente aus der Jugend warten bis Woche 3 auf einen Profivertrag.', a: 'go', v: 'squad', k: 'tab', kv: 'youth', l: 'Talente sichten' });
    if (w.pendingEvent) out.push({ t: 'Eine Entscheidung steht an: ' + h(w.pendingEvent.title), a: 'event', l: 'Entscheiden' });
    if (G.campAllowed(w) && !(c.campDone && Math.floor(c.campDone / 100) === w.season && ((c.campDone % 100 <= 3) === (w.week <= 3)))) out.push({ t: 'Jetzt ist Zeit für ein Trainingslager.', a: 'nav', v: 'training', l: 'Planen' });
    const exp = Team.squad(w, c).filter((p) => p.until <= w.season + 1);
    if (exp.length && w.week >= 20) out.push({ t: exp.length + ' Verträge laufen im Sommer aus.', a: 'nav', v: 'squad', l: 'Zum Kader' });
    if (c.money < 0) out.push({ bad: 1, t: 'Das Konto ist im Minus. Überzieht es den Kreditrahmen von ' + U.money(E.creditLine(w, c)) + ', greift der Vorstand ein.', a: 'nav', v: 'finance', l: 'Finanzen' });
    return out;
  };
  UI.fixtureLine = function (x, cid) {
    const w = UI.world; const home = x.f.h === cid; const opp = w.clubs[home ? x.f.a : x.f.h];
    return '<div class="row" style="gap:12px">' + UI.crest(opp, 'lg') + '<div><div class="label">' + h(x.comp) + ' · ' + h(x.label) + ' · ' + Cal.fmt(Cal.dateOf(w.season, x.w, x.where === 'mid' ? 2 : 5)) + '</div><div style="font:800 26px var(--display);text-transform:uppercase">' + (x.f.n ? 'Finale gegen ' : home ? 'Heim gegen ' : 'Auswärts bei ') + h(opp.name) + '</div><div class="muted">' + h(Cal.LEAGUE_NAME[opp.tier]) + (opp.tier <= 3 ? ' · Platz ' + Cal.posOf(w, opp.id) : '') + ' · Stärke ' + Math.round(Team.level(w, opp)) + (opp.coach ? ' · Trainer: ' + h(opp.coach) : '') + '</div></div></div>';
  };
  UI.miniTable = function (tier, around) {
    const w = UI.world; const tab = Cal.table(w, tier); const me = tab.findIndex((r) => r.cid === w.user);
    let from = 0, to = tab.length;
    if (around && me >= 0) { from = U.clamp(me - 3, 0, tab.length - 7); to = from + 7; }
    return '<div class="tw"><table class="t"><thead><tr><th></th><th>#</th><th>Verein</th><th class="r">Sp</th><th class="r">Tore</th><th class="r">Diff</th><th class="r">Pkt</th></tr></thead><tbody>' +
      tab.slice(from, to).map((r) => '<tr class="' + (r.cid === w.user ? 'me' : '') + '"><td class="zone ' + UI.zone(tier, r.pos, tab.length) + '"></td><td class="num">' + r.pos + '</td><td class="name">' + UI.clubName(r.cid, 1) + '</td><td class="r">' + r.sp + '</td><td class="r">' + r.tf + ':' + r.ta + '</td><td class="r">' + (r.tf - r.ta > 0 ? '+' : '') + (r.tf - r.ta) + '</td><td class="r"><b>' + r.pts + '</b></td></tr>').join('') + '</tbody></table></div>';
  };
  UI.zone = function (tier, pos, n) {
    if (tier === 1) return pos <= 4 ? 'z-eu' : pos <= 6 ? 'z-up' : pos === 16 ? 'z-rel' : pos >= 17 ? 'z-down' : '';
    if (tier === 2) return pos <= 2 ? 'z-up' : pos === 3 || pos === 16 ? 'z-rel' : pos >= 17 ? 'z-down' : '';
    return pos <= 2 ? 'z-up' : pos === 3 ? 'z-rel' : pos > n - 4 ? 'z-down' : '';
  };

  UI.V.office = function () {
    const w = UI.world; const c = UI.user(); const nf = nextFixture(w, c); const todos = UI.todos();
    const last = Cal.clubFixtures(w, c.id).filter((x) => x.f.p).slice(-5).reverse();
    const sq = Team.squad(w, c); const inj = sq.filter((p) => p.inj > 0), sus = sq.filter((p) => p.sus > 0);
    return '<div class="head"><div><h1>Büro</h1><p>Guten Tag, ' + h(w.manager) + '. ' + (Cal.week(w).win ? 'Das Transferfenster ist geöffnet.' : 'Das Transferfenster ist geschlossen.') + '</p></div></div>' +
      (todos.length ? '<div class="stack">' + todos.map((t) => '<div class="todo ' + (t.bad ? 'bad' : '') + '"><span>' + t.t + '</span><button class="btn sm" data-a="' + t.a + '"' + (t.v ? ' data-v="' + t.v + '"' : '') + (t.k ? ' data-k="' + t.k + '" data-kv="' + t.kv + '"' : '') + '>' + t.l + '</button></div>').join('') + '</div>' : '') +
      '<div class="split"><div class="stack" style="gap:16px">' +
      '<div class="card"><h3>Nächstes Spiel</h3>' + (nf ? UI.fixtureLine(nf, c.id) : '<p class="muted">In dieser Saison steht kein Pflichtspiel mehr an.</p>') + '</div>' +
      '<div class="card"><h3>Vorstand &amp; Fans <small>Ziel: ' + h(c.board.goal) + '</small></h3><div class="kv"><dt>Vertrauen des Vorstands</dt><dd>' + Math.round(c.board.trust) + ' %</dd></div>' + UI.bar(c.board.trust, 1) + '<div class="kv"><dt>Stimmung der Fans</dt><dd>' + Math.round(c.fans) + ' %</dd></div>' + UI.bar(c.fans, 1) + '</div>' +
      '<div class="card"><h3>Lazarett &amp; Sperren</h3>' + (inj.length + sus.length ? inj.concat(sus).map((p) => '<div class="row between"><span>' + UI.pos(p.pos) + ' ' + h(p.name) + '</span><span>' + UI.status(p) + (p.inj > 0 ? '<span class="muted">' + h(p.injT) + '</span>' : '') + '</span></div>').join('') : '<p class="muted">Alle Mann an Bord.</p>') + '</div>' +
      '</div><div class="stack" style="gap:16px">' +
      (c.tier <= 3 ? '<div class="card flat"><h3>' + h(Cal.LEAGUE_NAME[c.tier]) + ' <small><button class="btn sm" data-a="nav" data-v="comp">Ganze Tabelle</button></small></h3>' + UI.miniTable(c.tier, true) + '</div>' : '') +
      '<div class="card"><h3>Letzte Ergebnisse</h3>' + (last.length ? last.map((x) => { const home = x.f.h === c.id; const my = home ? x.f.hg : x.f.ag, th = home ? x.f.ag : x.f.hg; const won = x.f.w ? x.f.w === c.id : my > th; const res = x.f.w ? (won ? 'S' : 'N') : my > th ? 'S' : my < th ? 'N' : 'U'; return '<div class="row between"><span><span class="form5"><i class="' + res + '">' + res + '</i></span> ' + (home ? 'H' : 'A') + ' · ' + UI.clubName(home ? x.f.a : x.f.h, 1) + ' <span class="muted">' + h(x.comp) + '</span></span><b class="num">' + UI.fxScore(x.f) + '</b></div>'; }).join('') : '<p class="muted">Noch kein Spiel absolviert.</p>') + '</div>' +
      '<div class="card"><h3>Postfach <small><button class="btn sm" data-a="nav" data-v="inbox">Alle Nachrichten</button></small></h3>' + w.news.slice(0, 4).map((n) => '<div class="news ' + (n.r ? '' : 'unread') + '"><b>' + h(n.t) + '</b><span>' + h(n.x) + '</span></div>').join('') + '</div>' +
      '</div></div>';
  };

  /* ---------- Postfach ---------- */
  UI.V.inbox = function () {
    const w = UI.world; const list = w.news.slice(0, 80);
    const html = '<div class="head"><div><h1>Postfach</h1><p>Nachrichten aus Vorstand, Kabine und Geschäftsstelle.</p></div></div><div class="card">' +
      (list.length ? list.map((n) => '<div class="news ' + (n.r ? '' : 'unread') + '"><b>' + h(n.t) + '</b><span>' + h(n.x) + '</span><small>Saison ' + Cal.seasonLabel(n.s) + ' · Woche ' + n.w + '</small></div>').join('') : '<p class="muted">Keine Nachrichten.</p>') + '</div>';
    w.news.forEach((n) => { n.r = 1; });
    return html;
  };

  /* ---------- Ereignis- und Sponsor-Dialoge ---------- */
  UI.A.event = () => {
    const ev = UI.world.pendingEvent; if (!ev) return;
    UI.modal(ev.title, '<p>' + h(ev.text) + '</p><div class="stack">' + FM.Events.options(ev).map((l, i) => '<button class="btn" data-a="eventPick" data-i="' + i + '">' + h(l) + '</button>').join('') + '</div>', { locked: true });
  };
  UI.A.eventPick = (d) => {
    const res = FM.Events.resolve(UI.world, +d.i);
    UI.modal('Entscheidung', '<p class="msg">' + h(res) + '</p><div class="row" style="justify-content:flex-end"><button class="btn pri" data-a="closeModal">Weiter</button></div>');
  };
  UI.A.sponsorPick = () => {
    const w = UI.world; const offers = w.sponsorOffers || [];
    UI.modal('Trikotsponsor wählen', '<p class="muted">Ohne Entscheidung bis Woche 4 wählt der Vorstand das erste Angebot.</p><div class="stack">' + offers.map((o, i) => '<div class="card"><h3>' + h(o.name) + ' <small>' + (o.years > 1 ? o.years + ' Jahre' : '1 Jahr') + '</small></h3><p>' + h(o.text) + '</p><div class="kv"><dt>Grundsumme pro Jahr</dt><dd>' + U.money(o.base) + '</dd>' + (o.win ? '<dt>Prämie je Pflichtspielsieg</dt><dd>' + U.money(o.win) + '</dd>' : '') + '</div><div><button class="btn pri" data-a="sponsorSign" data-i="' + i + '">Unterschreiben</button></div></div>').join('') + '</div>');
  };
  UI.A.sponsorSign = (d) => {
    const w = UI.world; const o = (w.sponsorOffers || [])[+d.i]; if (!o) return;
    UI.user().sponsor = { name: o.name, base: o.base, win: o.win, until: w.season + o.years - 1 }; w.sponsorOffers = null;
    G.news(w, 'Neuer Trikotsponsor', o.name + ' ziert ab sofort die Brust (' + U.money(o.base) + ' pro Jahr' + (o.win ? ', plus ' + U.money(o.win) + ' je Sieg' : '') + ').', 'fin');
    UI.closeModal(); UI.toast('Vertrag mit ' + o.name + ' unterschrieben.');
  };

  /* ---------- System: Speichern, Laden, Export ---------- */
  UI.V.system = function () {
    const w = UI.world;
    return '<div class="head"><div><h1>Speichern</h1><p>Nach jeder Woche wird automatisch gespeichert – inklusive Sicherungskopie des vorherigen Stands. Jeder Spielstand trägt eine Prüfsumme; beschädigte Stände werden erkannt statt geladen.</p></div></div>' +
      (FM.Save.persistent() ? '' : '<p class="msg warn">Dieser Browser erlaubt hier kein dauerhaftes Speichern. Der Spielstand bleibt nur, solange diese Seite offen ist – exportiere ihn als Datei.</p>') +
      '<div class="grid g3">' + FM.Save.SLOTS.map((s) => { const i = FM.Save.info(s); return '<div class="card"><h3>' + (s === 'auto' ? 'Automatisch' : 'Platz ' + s) + '</h3>' + (i ? '<p>' + h(i.meta.club) + '<br><span class="muted">Saison ' + Cal.seasonLabel(i.meta.season) + ', Woche ' + i.meta.week + ' · ' + new Date(i.ts).toLocaleString('de-DE') + '</span></p>' : '<p class="muted">Leer</p>') + '<div class="row">' + (s === 'auto' ? '' : '<button class="btn pri" data-a="saveSlot" data-s="' + s + '">Hier speichern</button>') + (i ? '<button class="btn" data-a="askLoad" data-s="' + s + '">Laden</button>' : '') + (i && s !== 'auto' ? '<button class="btn danger" data-a="delSlot" data-s="' + s + '">Löschen</button>' : '') + '</div></div>'; }).join('') + '</div>' +
      '<div class="card"><h3>Datei</h3><p class="muted">Ein exportierter Spielstand lässt sich auf jedem Gerät wieder einlesen.</p><div class="row"><button class="btn" data-a="exportSave">Als Datei exportieren</button><button class="btn" data-a="copySave">In die Zwischenablage kopieren</button><label class="btn" style="cursor:pointer">Datei einlesen<input type="file" accept=".flutlicht,.json,.txt" data-c="importFile" class="sr"></label></div></div>' +
      '<div class="card"><h3>Spiel</h3><div class="row"><button class="btn danger" data-a="askQuit">Zum Hauptmenü</button></div><p class="muted" style="font-size:13px">FLUTLICHT ' + FM.VERSION + ' · Datenstand ' + h(FM.DB.built) + ' · ' + Object.keys(w.players).length + ' Spieler in der Spielwelt. Kader, Trainer und Stadien: Wikipedia (CC BY-SA 4.0). Spielstärken sind Schätzwerte. Der Europapokal wird nicht ausgespielt, qualifizierte Klubs erhalten pauschale Einnahmen.</p></div>';
  };
  UI.A.saveSlot = (d) => { const r = FM.Save.save(UI.world, d.s); UI.toast(r.ok ? 'Gespeichert auf Platz ' + d.s + '.' : r.err); UI.render(); };
  UI.A.askLoad = (d) => UI.confirm('Spielstand laden?', 'Der aktuelle Fortschritt seit dem letzten Speichern geht verloren.', 'Laden', 'loadSlotNow', { s: d.s });
  UI.A.loadSlotNow = (d) => { UI.modalHtml = ''; UI.A.loadSlot(d); };
  UI.A.delSlot = (d) => { FM.Save.remove(d.s); UI.render(); };
  UI.A.askQuit = () => UI.confirm('Zum Hauptmenü?', 'Der Spielstand wird vorher automatisch gesichert.', 'Zum Hauptmenü', 'quit');
  UI.A.quit = () => { UI.autosave(); UI.modalHtml = ''; UI.world = null; UI.go('start'); };
  UI.A.exportSave = async () => {
    const text = FM.Save.serialize(UI.world); const c = UI.user();
    const name = 'flutlicht-' + c.id.toLowerCase() + '-' + UI.world.season + '-w' + UI.world.week + '.flutlicht';
    try {
      const dl = root.claude && root.claude.use ? await root.claude.use('downloads') : null;
      if (dl) { await dl.save({ filename: name, data: text }); UI.toast('Spielstand exportiert.'); return; }
    } catch (e) { /* weiter mit dem klassischen Weg */ }
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000); UI.toast('Download gestartet. Falls nichts passiert: „In die Zwischenablage kopieren“ nutzen.');
    } catch (e) { UI.toast('Der Download ist hier nicht möglich – bitte die Zwischenablage nutzen.'); }
  };
  /* ---------- Start der Anwendung ---------- */
  UI.boot = function (snap) {
    if (snap && snap.save) { const r = FM.Save.parse(snap.save); if (!r.err) { UI.world = r.world; FM.R.use(UI.world); UI.view = UI.world.sacked ? 'sacked' : (snap.view && UI.V[snap.view] && !UI.V[snap.view].bare && snap.view !== 'start' && snap.view !== 'new' ? snap.view : 'office'); } }
    UI.render();
  };
  UI.snapshot = function () { return UI.world ? { save: FM.Save.serialize(UI.world), view: UI.view } : {}; };

  UI.A.copySave = async () => {
    const text = FM.Save.serialize(UI.world);
    try { await navigator.clipboard.writeText(text); UI.toast('Spielstand kopiert. In eine Textdatei einfügen und aufbewahren.'); }
    catch (e) { UI.modal('Spielstand kopieren', '<p>Markiere den Text und kopiere ihn in eine Datei.</p><textarea rows="8" style="width:100%" readonly>' + h(text) + '</textarea>'); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
