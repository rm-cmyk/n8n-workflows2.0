/* FLUTLICHT · Zufallsereignisse mit Entscheidungen – der Alltag eines Managers */
(function (root) {
  'use strict';
  const FM = root.FM; const R = FM.R; const U = FM.U; const E = FM.Econ; const Team = FM.Team;
  const V = (FM.Events = {});

  function scale(club, v) { return U.roundMoney(v * { 1: 1, 2: 0.4, 3: 0.15, 4: 0.08 }[club.tier]); }
  function rndPlayer(world, club, fn) { const sq = Team.squad(world, club).filter(fn || (() => true)); return sq.length ? R.pick(sq) : null; }
  function allMor(world, club, d) { Team.squad(world, club).forEach((p) => { p.mor = U.clamp(p.mor + d, 5, 99); }); }
  function allFit(world, club, d) { Team.squad(world, club).forEach((p) => { p.fit = U.clamp(p.fit + d, 30, 100); }); }
  const pay = (world, club, cat, v) => E.add(world, club, cat, v);

  V.LIST = {
    waschmaschine: {
      make: (w, c) => ({ title: 'Malheur in der Waschküche', text: 'Dein Zeugwart hat die Auswärtstrikots bei 90 Grad gewaschen. Sie passen jetzt hervorragend – der E-Jugend. Ein neuer Satz kostet ' + U.money(scale(c, 40000)) + '.', cost: scale(c, 40000) }),
      opts: [{ label: 'Neuen Trikotsatz bestellen', run: (w, c, d) => { pay(w, c, 'misc', -d.cost); return 'Die neuen Trikots sind bestellt. Der Zeugwart bekommt einen Waschkurs.'; } }],
    },
    disco: {
      cond: (w, c) => !!rndPlayer(w, c, (p) => p.inj <= 0),
      make: (w, c) => { const p = rndPlayer(w, c, (x) => x.inj <= 0); return { title: 'Nachtschwärmer', text: p.name + ' wurde zwei Tage vor dem Spiel um 3:40 Uhr in einer Diskothek gesichtet. Laut Türsteher „in bester Verfassung“. Wie reagierst du?', pid: p.id }; },
      opts: [
        { label: 'Saftige Geldstrafe', run: (w, c, d) => { const p = w.players[d.pid]; if (!p) return 'Der Fall hat sich erledigt.'; const fine = U.roundMoney(p.wage / 47); pay(w, c, 'other', fine); p.mor = U.clamp(p.mor - 10, 5, 99); allMor(w, c, 1); return p.name + ' zahlt ' + U.money(fine) + ' in die Mannschaftskasse. Er schmollt, die Kollegen grinsen.'; } },
        { label: 'Ein Auge zudrücken', run: (w, c, d) => { const p = w.players[d.pid]; if (!p) return 'Der Fall hat sich erledigt.'; p.fit = U.clamp(p.fit - 12, 30, 100); p.mor = U.clamp(p.mor + 5, 5, 99); return p.name + ' bedankt sich für dein Verständnis. Etwas müde wirkt er trotzdem.'; } },
        { label: 'Öffentlich zusammenfalten', run: (w, c, d) => { const p = w.players[d.pid]; if (!p) return 'Der Fall hat sich erledigt.'; p.mor = U.clamp(p.mor - 18, 5, 99); p.form = U.clamp(p.form + (R.chance(0.5) ? 10 : -8), 5, 99); c.fans = U.clamp(c.fans + 2, 0, 100); return 'Die Schlagzeile sitzt. Die Fans feiern deine klare Kante, ' + p.name + ' eher nicht.'; } },
      ],
    },
    maulwurf: {
      make: (w, c) => ({ title: 'Untermieter im Strafraum', text: 'Ein Maulwurf hat sich im Rasen von ' + c.stadium + ' häuslich eingerichtet. Der Greenkeeper spricht von „Sabotage“.', cost: scale(c, 60000) }),
      opts: [
        { label: 'Rasen fachgerecht sanieren (' + 'teuer)', run: (w, c, d) => { pay(w, c, 'upkeep', -d.cost); return 'Der Rasen ist wieder ein Teppich. Der Maulwurf wurde umgesiedelt. Kosten: ' + U.money(d.cost) + '.'; } },
        { label: 'Hügel plattklopfen und hoffen', run: (w, c) => { if (R.chance(0.4)) { const p = rndPlayer(w, c, (x) => x.inj <= 0); if (p) { FM.Game.injure(w, p, c); return p.name + ' knickt im Training in einem Maulwurfsloch um: ' + p.injT + ', ' + p.inj + ' Woche(n) Pause.'; } } return 'Glück gehabt – der Maulwurf zieht von selbst weiter.'; } },
      ],
    },
    grillfest: {
      make: (w, c) => ({ title: 'Einladung zum Grillfest', text: 'Dein Hauptsponsor lädt die komplette Mannschaft zum Sommerfest ein. Es gibt Bratwurst, Blasmusik und ein Elfmeterschießen gegen die Geschäftsführung.', gain: scale(c, 150000) }),
      opts: [
        { label: 'Hingehen und Hände schütteln', run: (w, c, d) => { pay(w, c, 'sponsor', d.gain); allFit(w, c, -6); allMor(w, c, 3); return 'Ein gelungener Abend. Der Sponsor legt ' + U.money(d.gain) + ' Prämie drauf, die Mannschaft ist am nächsten Morgen etwas schwer.'; } },
        { label: 'Absagen – wir müssen trainieren', run: (w, c) => { c.board.trust = U.clamp(c.board.trust - 2, 0, 100); return 'Der Sponsor ist leicht verschnupft, der Vorstand auch. Dafür sitzt die Viererkette.'; } },
      ],
    },
    bus: {
      make: (w, c) => ({ title: 'Panne auf der Autobahn', text: 'Der Mannschaftsbus ist auf der Rückfahrt mit einem Getriebeschaden liegen geblieben. Die Spieler mussten vier Stunden an einer Raststätte ausharren.', cost: scale(c, 35000) }),
      opts: [{ label: 'Reparatur bezahlen', run: (w, c, d) => { pay(w, c, 'misc', -d.cost); allFit(w, c, -4); return 'Der Bus rollt wieder (' + U.money(d.cost) + '). Die Currywurst-Vorräte der Raststätte sind allerdings erschöpft.'; } }],
    },
    fanclub: {
      make: (w, c) => ({ title: 'Jubiläum beim Fanclub', text: 'Der Fanclub „Kurvenkinder“ feiert Jubiläum und wünscht sich einen Besuch mit Autogrammstunde.' }),
      opts: [
        { label: 'Mit drei Spielern vorbeischauen', run: (w, c) => { c.fans = U.clamp(c.fans + 4, 0, 100); allFit(w, c, -1); return 'Volles Haus, glänzende Kinderaugen, 300 Autogramme. Die Fans lieben euch.'; } },
        { label: 'Signierte Trikots schicken', run: (w, c) => { c.fans = U.clamp(c.fans + 1, 0, 100); return 'Die Trikots kommen gut an. Persönlich wäre natürlich schöner gewesen.'; } },
      ],
    },
    tvdoku: {
      cond: (w, c) => c.tier <= 2,
      make: (w, c) => ({ title: 'Kameras in der Kabine?', text: 'Ein Streamingdienst möchte eine Doku über ' + c.short + ' drehen – inklusive Kabinenzugang.', gain: scale(c, 900000) }),
      opts: [
        { label: 'Zusagen', run: (w, c, d) => { pay(w, c, 'other', d.gain); allMor(w, c, -3); c.fans = U.clamp(c.fans + 3, 0, 100); return U.money(d.gain) + ' fließen in die Kasse. Einige Spieler fühlen sich allerdings beobachtet.'; } },
        { label: 'Die Kabine bleibt heilig', run: (w, c) => { allMor(w, c, 2); return 'Die Mannschaft rechnet dir das hoch an.'; } },
      ],
    },
    erbschaft: {
      make: (w, c) => ({ title: 'Ein Vermächtnis', text: 'Eine treue Dauerkarteninhaberin hat dem Verein in ihrem Testament eine stattliche Summe hinterlassen – verbunden mit dem Wunsch, „endlich mal wieder einen anständigen Linksaußen“ zu kaufen.', gain: scale(c, 400000) }),
      opts: [{ label: 'In Ehren annehmen', run: (w, c, d) => { pay(w, c, 'other', d.gain); return U.money(d.gain) + ' für die Vereinskasse. Ihr Stammplatz bekommt eine Plakette.'; } }],
    },
    grippe: {
      make: (w, c) => ({ title: 'Die Grippe geht um', text: 'In der Kabine wird mehr gehustet als gesprochen. Der Mannschaftsarzt rät zu einer ruhigeren Woche.' }),
      opts: [
        { label: 'Zwei Tage trainingsfrei', run: (w, c) => { allFit(w, c, 4); c.tac = Math.max(0, (c.tac || 0) - 1); return 'Die Mannschaft kuriert sich aus. Die taktische Feinabstimmung leidet etwas.'; } },
        { label: 'Durchziehen – wir sind nicht aus Zucker', run: (w, c) => { allFit(w, c, -9); const p = rndPlayer(w, c, (x) => x.inj <= 0); if (p) { p.inj = 1; p.injT = 'Grippaler Infekt'; return 'Die halbe Mannschaft schleppt sich durch die Woche. ' + p.name + ' liegt endgültig flach.'; } return 'Die halbe Mannschaft schleppt sich durch die Woche.'; } },
      ],
    },
    investor: {
      cond: (w, c) => c.money < 0,
      make: (w, c) => ({ title: 'Ein Gönner meldet sich', text: 'Ein örtlicher Unternehmer bietet an, die klamme Vereinskasse aufzubessern. Er möchte dafür „nur“ gelegentlich bei der Aufstellung mitreden.', gain: scale(c, 2500000) }),
      opts: [
        { label: 'Geld nehmen, Ohren auf Durchzug', run: (w, c, d) => { pay(w, c, 'other', d.gain); c.board.trust = U.clamp(c.board.trust - 4, 0, 100); return U.money(d.gain) + ' sind auf dem Konto. Der Gönner ruft jetzt jeden Freitag an.'; } },
        { label: 'Dankend ablehnen', run: (w, c) => { c.fans = U.clamp(c.fans + 3, 0, 100); return 'Die Fans feiern die Unabhängigkeit des Vereins. Das Konto bleibt, wie es ist.'; } },
      ],
    },
    lama: {
      cond: (w, c) => !!rndPlayer(w, c),
      make: (w, c) => { const p = rndPlayer(w, c); return { title: 'Tierischer Neuzugang', text: p.name + ' hat sich ein Lama gekauft und bringt es zum Training mit. Das Tier heißt „Libero“ und spuckt den Co-Trainer an.', pid: p.id }; },
      opts: [
        { label: 'Lama wird Maskottchen', run: (w, c) => { c.fans = U.clamp(c.fans + 3, 0, 100); allMor(w, c, 2); return '„Libero“ läuft ab sofort vor jedem Heimspiel eine Ehrenrunde. Die Kinder sind begeistert.'; } },
        { label: 'Tiere bleiben draußen', run: (w, c, d) => { const p = w.players[d.pid]; if (p) p.mor = U.clamp(p.mor - 6, 5, 99); return 'Ordnung muss sein. ' + (p ? p.name : 'Der Besitzer') + ' findet dich humorlos.'; } },
      ],
    },
    physio: {
      make: (w, c) => ({ title: 'Wunderheiler im Angebot', text: 'Ein renommierter Physiotherapeut bietet für vier Wochen seine Dienste an.', cost: scale(c, 120000) }),
      opts: [
        { label: 'Engagieren', run: (w, c, d) => { pay(w, c, 'staff', -d.cost); let n = 0; Team.squad(w, c).forEach((p) => { if (p.inj > 1) { p.inj = Math.max(1, p.inj - 2); n++; } p.fit = U.clamp(p.fit + 5, 30, 100); }); return 'Goldene Hände! ' + (n ? n + ' Verletzte kommen früher zurück.' : 'Die Mannschaft fühlt sich frischer.') + ' Kosten: ' + U.money(d.cost) + '.'; } },
        { label: 'Zu teuer', run: () => 'Die Mannschaft massiert sich weiter gegenseitig.' },
      ],
    },
    flutlicht: {
      make: (w, c) => ({ title: 'Flutlicht-Ausfall', text: 'Beim Abschlusstraining fällt ein Flutlichtmast aus. Der Elektriker murmelt etwas von „Marder“ und „mindestens die ganze Verteilung“.', cost: scale(c, 90000) }),
      opts: [{ label: 'Reparieren lassen', run: (w, c, d) => { pay(w, c, 'upkeep', -d.cost); return 'Es werde Licht. Rechnung: ' + U.money(d.cost) + '. Der Marder bleibt unauffindbar.'; } }],
    },
    presse: {
      make: () => ({ title: 'Provokation vom Gegner', text: 'Der Trainer des nächsten Gegners erklärt in der Pressekonferenz, deine Mannschaft sei „spielerisch limitiert“. Die Journalisten wollen eine Reaktion.' }),
      opts: [
        { label: 'Souverän weglächeln', run: (w, c) => { allMor(w, c, 1); return '„Die Antwort geben wir auf dem Platz.“ Solide.'; } },
        { label: 'Verbal zurückschießen', run: (w, c) => { if (R.chance(0.55)) { allMor(w, c, 5); return 'Deine Spieler hängen den Zeitungsausschnitt in die Kabine. Die Mannschaft ist heiß.'; } allMor(w, c, -3); return 'Das ging nach hinten los – die Schlagzeile macht aus dir den Verlierer des Tages.'; } },
      ],
    },
    talent: {
      cond: (w, c) => c.squad.length < FM.Transfer.MAX_SQUAD - 1,
      make: (w, c) => ({ title: 'Tipp vom Platzwart', text: 'Dein Platzwart schwört, sein Neffe sei „der beste Kicker im ganzen Landkreis“. Der Junge würde für ein Taschengeld unterschreiben.' }),
      opts: [
        { label: 'Probetraining und Vertrag', run: (w, c) => { const lvl = Team.level(w, c); const good = R.chance(0.3); const p = FM.Gen.genPlayer(w, { age: 17, mean: lvl - (good ? 12 : 24), sd: 2, nat: 'GER', club: c.id, until: w.season + 3 }); if (good) p.pot = U.clamp(p.ovr + R.int(12, 20), p.ovr, 94); c.squad.push(p.id); return good ? p.name + ' (' + p.pos + ') überzeugt alle. Da könnte etwas heranwachsen.' : p.name + ' (' + p.pos + ') ist … bemüht. Aber der Platzwart ist glücklich.'; } },
        { label: 'Höflich ablehnen', run: () => 'Der Rasen wird diese Woche auffallend schlecht gemäht.' },
      ],
    },
    tombola: {
      make: (w, c) => ({ title: 'Vereinsfest', text: 'Das alljährliche Vereinsfest steht an. Die Tombola (Hauptpreis: ein Jahr Freibier) bringt traditionell gutes Geld.', gain: scale(c, 80000) }),
      opts: [{ label: 'Fassanstich!', run: (w, c, d) => { pay(w, c, 'merch', d.gain); c.fans = U.clamp(c.fans + 1, 0, 100); return 'O\'zapft is! Die Vereinskasse freut sich über ' + U.money(d.gain) + '.'; } }],
    },
  };

  V.roll = function (world) {
    const club = FM.Game.user(world); const keys = Object.keys(V.LIST).filter((k) => { const e = V.LIST[k]; return !e.cond || e.cond(world, club); });
    if (!keys.length) return null;
    const recent = world.evHist || (world.evHist = []);
    const fresh = keys.filter((k) => recent.indexOf(k) < 0);
    const id = R.pick(fresh.length ? fresh : keys);
    recent.push(id); if (recent.length > 8) recent.shift();
    const d = V.LIST[id].make(world, club);
    return Object.assign({ id }, d);
  };
  V.options = function (ev) { return V.LIST[ev.id] ? V.LIST[ev.id].opts.map((o) => o.label) : []; };
  V.resolve = function (world, idx) {
    const ev = world.pendingEvent; if (!ev) return '';
    const def = V.LIST[ev.id]; world.pendingEvent = null;
    if (!def) return '';
    const opt = def.opts[U.clamp(idx, 0, def.opts.length - 1)];
    const res = opt.run(world, FM.Game.user(world), ev) || '';
    FM.Game.news(world, ev.title, ev.text + ' → ' + res, 'event');
    return res;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
