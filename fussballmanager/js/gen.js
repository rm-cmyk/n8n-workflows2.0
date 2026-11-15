/* FLUTLICHT · Spieler-Modell: Erzeugung, Marktwert, Gehalt, Alter, fiktive Nachwuchsspieler */
(function (root) {
  'use strict';
  const FM = root.FM; const R = FM.R; const U = FM.U;
  const G = (FM.Gen = {});

  /* Namenspools für generierte (fiktive) Spieler – Jugend, Auslandsmarkt, Amateure */
  const NAMES = {
    GER: {
      f: ['Lukas', 'Jonas', 'Finn', 'Leon', 'Paul', 'Elias', 'Noah', 'Ben', 'Felix', 'Maximilian', 'Tim', 'Niklas', 'Jannik', 'Moritz', 'Julian', 'David', 'Luca', 'Tom', 'Erik', 'Simon', 'Fabian', 'Philipp', 'Jan', 'Nico', 'Marvin', 'Kevin', 'Dennis', 'Tobias', 'Florian', 'Sebastian', 'Marcel', 'Robin', 'Lennart', 'Malte', 'Henrik', 'Ole', 'Mats', 'Jakob', 'Anton', 'Emil', 'Theo', 'Hannes', 'Kilian', 'Bastian', 'Dominik', 'Yannick', 'Aaron', 'Linus', 'Till', 'Justus', 'Kaan', 'Emre', 'Deniz', 'Can', 'Bilal', 'Malik', 'Jamal', 'Karim', 'Leroy', 'Noel'],
      l: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hofmann', 'Hartmann', 'Lange', 'Werner', 'Krause', 'Lehmann', 'Köhler', 'Herrmann', 'König', 'Walter', 'Peters', 'Kaiser', 'Fuchs', 'Lang', 'Scholz', 'Möller', 'Weiß', 'Jung', 'Hahn', 'Vogel', 'Friedrich', 'Keller', 'Günther', 'Frank', 'Berger', 'Winkler', 'Roth', 'Beck', 'Lorenz', 'Baumann', 'Albrecht', 'Ludwig', 'Winter', 'Simon', 'Kraus', 'Böhm', 'Schuster', 'Vogt', 'Seidel', 'Brandt', 'Haas', 'Sommer', 'Graf', 'Heinrich', 'Schubert', 'Kühn', 'Pohl', 'Engel', 'Horn', 'Busch', 'Bergmann', 'Voigt', 'Sauer', 'Arnold', 'Pfeiffer', 'Yılmaz', 'Demir', 'Kaya', 'Öztürk', 'Aydın', 'Amiri', 'Osei', 'Mensah', 'Nowak', 'Kowalski', 'Petrović', 'Jovanović'],
    },
    TUR: { f: ['Emre', 'Burak', 'Kerem', 'Arda', 'Yusuf', 'Oğuz', 'Cenk', 'Hakan', 'Mert', 'Enes', 'Berkay', 'Ozan'], l: ['Yıldız', 'Çelik', 'Şahin', 'Kılıç', 'Aslan', 'Doğan', 'Arslan', 'Koç', 'Kurt', 'Özdemir', 'Polat', 'Güneş'] },
    POL: { f: ['Jakub', 'Kacper', 'Mateusz', 'Piotr', 'Bartosz', 'Kamil', 'Szymon', 'Filip', 'Adam', 'Oskar'], l: ['Nowak', 'Kowalczyk', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Lewandowicz', 'Zieliński', 'Szymański', 'Dąbrowski', 'Jankowski'] },
    FRA: { f: ['Lucas', 'Hugo', 'Théo', 'Mathis', 'Enzo', 'Kylian', 'Ibrahima', 'Moussa', 'Yanis', 'Rayan', 'Antoine', 'Julien'], l: ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Girard', 'Diallo', 'Traoré', 'Camara', 'Fofana', 'Lefèvre', 'Mercier'] },
    ESP: { f: ['Pablo', 'Álvaro', 'Sergio', 'Javier', 'Diego', 'Iker', 'Marcos', 'Adrián', 'Hugo', 'Unai'], l: ['García', 'Martínez', 'López', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Ortega', 'Molina', 'Castro'] },
    ENG: { f: ['Jack', 'Harry', 'Oliver', 'George', 'Callum', 'Mason', 'Declan', 'Reece', 'Tyler', 'Jordan'], l: ['Smith', 'Taylor', 'Brown', 'Wilson', 'Walker', 'Wright', 'Hughes', 'Cooper', 'Bailey', 'Barnes'] },
    NED: { f: ['Daan', 'Sem', 'Luuk', 'Thijs', 'Jesse', 'Stijn', 'Ruben', 'Bram', 'Jurriën', 'Sven'], l: ['de Jong', 'Jansen', 'de Vries', 'van Dijk', 'Bakker', 'Visser', 'Smit', 'Mulder', 'Bos', 'Vos'] },
    CRO: { f: ['Luka', 'Ivan', 'Marko', 'Josip', 'Ante', 'Mateo', 'Nikola', 'Dario', 'Borna', 'Filip'], l: ['Horvat', 'Kovačević', 'Babić', 'Marić', 'Jurić', 'Novak', 'Knežević', 'Vuković', 'Matić', 'Pavlović'] },
    DEN: { f: ['Magnus', 'Oliver', 'Mikkel', 'Rasmus', 'Frederik', 'Mads', 'Jonas', 'Emil', 'Victor', 'Oscar'], l: ['Jensen', 'Nielsen', 'Hansen', 'Pedersen', 'Andersen', 'Christensen', 'Larsen', 'Sørensen', 'Rasmussen', 'Poulsen'] },
    JPN: { f: ['Haruto', 'Yuto', 'Sota', 'Ren', 'Kaito', 'Daichi', 'Takumi', 'Ryo', 'Shota', 'Koki'], l: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi', 'Yoshida', 'Yamada'] },
    BRA: { f: ['Gabriel', 'Lucas', 'Matheus', 'Rafael', 'Thiago', 'Bruno', 'Vinícius', 'Caio', 'Igor', 'Wesley'], l: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Ferreira', 'Almeida', 'Ribeiro', 'Carvalho'] },
    USA: { f: ['Tyler', 'Brandon', 'Ethan', 'Josh', 'Caleb', 'Gio', 'Ricardo', 'Cole', 'Aidan', 'Malik'], l: ['Johnson', 'Miller', 'Davis', 'Anderson', 'Thompson', 'Reyes', 'Morgan', 'Bennett', 'Carter', 'Sullivan'] },
    ITA: { f: ['Lorenzo', 'Matteo', 'Alessandro', 'Federico', 'Davide', 'Luca', 'Simone', 'Andrea', 'Giacomo', 'Nicolò', 'Riccardo', 'Tommaso'], l: ['Rossi', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Conti', 'De Luca', 'Mancini', 'Galli', 'Ferrara'] },
    POR: { f: ['João', 'Diogo', 'Rúben', 'Tiago', 'Gonçalo', 'André', 'Miguel', 'Rafael', 'Nuno', 'Bruno'], l: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Costa', 'Carvalho', 'Almeida', 'Gomes', 'Lopes', 'Teixeira'] },
    GHA: { f: ['Kwame', 'Kofi', 'Yaw', 'Emmanuel', 'Daniel', 'Samuel', 'Ibrahim', 'Abdul', 'Ernest', 'Felix'], l: ['Mensah', 'Owusu', 'Boateng', 'Asante', 'Appiah', 'Osei', 'Amoah', 'Addo', 'Agyemang', 'Frimpong'] },
  };
  const NAT_POOL = [['GER', 62], ['TUR', 4], ['POL', 4], ['FRA', 5], ['ESP', 2], ['ENG', 2], ['NED', 4], ['CRO', 4], ['DEN', 4], ['JPN', 3], ['BRA', 2], ['USA', 2], ['GHA', 2]];
  const FOREIGN_POOL = NAT_POOL.filter((n) => n[0] !== 'GER');
  const ALIAS = { AUT: 'GER', SUI: 'GER', LUX: 'GER', BEL: 'NED', SCO: 'ENG', WAL: 'ENG', IRL: 'ENG', NIR: 'ENG', GIB: 'ENG', NOR: 'DEN', SWE: 'DEN', FIN: 'DEN', ISL: 'DEN',
    SRB: 'CRO', BIH: 'CRO', SVN: 'CRO', MNE: 'CRO', MKD: 'CRO', CZE: 'POL', SVK: 'POL', UKR: 'POL', LTU: 'POL', LAT: 'POL', LVA: 'POL', AND: 'ESP', ARG: 'ESP', URU: 'ESP', COL: 'ESP', MEX: 'ESP',
    GRE: 'ITA', CYP: 'ITA', ALB: 'ITA', ROU: 'ITA', ROM: 'ITA', BUL: 'CRO', HUN: 'POL', AZE: 'TUR', KAZ: 'TUR', GEO: 'TUR', ARM: 'TUR', ISR: 'TUR', NGA: 'GHA', CIV: 'GHA', SEN: 'GHA', KOR: 'JPN', CAN: 'USA' };

  G.randomName = function (nat) {
    const pool = NAMES[nat] || NAMES[ALIAS[nat]] || NAMES.GER;
    return R.pick(pool.f) + ' ' + R.pick(pool.l);
  };
  G.randomNat = function (foreignOnly) {
    return R.weighted(foreignOnly ? FOREIGN_POOL : NAT_POOL, (n) => n[1])[0];
  };

  /* ---------- Formeln ---------- */
  G.wageFor = function (ovr, age) {
    let w = 22000 * Math.exp((ovr - 50) * 0.158);
    w *= age < 20 ? 0.55 : age < 22 ? 0.75 : age < 24 ? 0.9 : age > 32 ? 0.9 : 1;
    return U.roundMoney(Math.max(18000, w));
  };
  const AGEF = { 15: 0.7, 16: 0.8, 17: 0.9, 18: 1.0, 19: 1.12, 20: 1.2, 21: 1.2, 22: 1.16, 23: 1.1, 24: 1.05, 25: 1.0, 26: 0.97, 27: 0.9, 28: 0.8, 29: 0.68, 30: 0.55, 31: 0.43, 32: 0.32, 33: 0.22, 34: 0.15, 35: 0.1 };
  G.valueFor = function (p, age, season) {
    let v = 30000 * Math.exp((p.ovr - 50) * 0.205);
    v *= AGEF[U.clamp(age, 15, 35)] || 0.06;
    if (age >= 36) v *= 0.6;
    const gap = Math.max(0, p.pot - p.ovr);
    v *= 1 + gap * (age <= 21 ? 0.07 : age <= 24 ? 0.035 : 0.01);
    if (p.pos === 'TW') v *= 0.75;
    if (season != null && p.until != null && p.until <= season + 1) v *= 0.72; // Vertrag läuft aus
    return U.roundMoney(Math.max(10000, v));
  };

  G.blankStats = function () { return { ap: 0, go: 0, as: 0, ra: 0, rn: 0, ye: 0, re: 0, mi: 0 }; };

  const TRAIT_KEYS = Object.keys(FM.TRAITS);
  G.traitsFor = function (name, pos, age, isCaptain) {
    // deterministisch aus dem Namen: gleiche Spieler haben in jedem neuen Spiel dieselben Eigenschaften
    const h = FM.hash(name + '|traits');
    const out = [];
    if (isCaptain) out.push('fuehrung');
    const n = (h % 100) < 38 ? 1 : (h % 100) < 46 ? 2 : 0;
    let x = h >>> 7;
    for (let i = 0; i < n; i++) {
      let key = TRAIT_KEYS[x % TRAIT_KEYS.length]; x = Math.imul(x, 2654435761) >>> 3;
      if (key === 'elferkiller' && pos !== 'TW') key = 'nerven';
      if (pos === 'TW' && (key === 'kopfball' || key === 'freistoss' || key === 'elfer' || key === 'joker' || key === 'dauerlaeufer')) key = 'elferkiller';
      if (key === 'fuehrung' && age < 26) key = 'musterprofi';
      if (key === 'trainingsmuffel' && out.indexOf('musterprofi') >= 0) continue;
      if (key === 'musterprofi' && out.indexOf('trainingsmuffel') >= 0) continue;
      if (out.indexOf(key) < 0) out.push(key);
    }
    return out;
  };

  /* Spieler-Objekt anlegen (für echte wie generierte Spieler) */
  G.makePlayer = function (world, d) {
    const id = world.nextPid++;
    const p = {
      id, name: d.name, nat: d.nat || 'GER', pos: d.pos, pos2: d.pos2 || '', by: d.by, bm: d.bm || 1 + (FM.hash(d.name) % 12),
      ovr: U.clamp(Math.round(d.ovr), 30, 99), pot: U.clamp(Math.round(Math.max(d.pot || d.ovr, d.ovr)), 30, 99), xp: 0,
      fit: 100, form: 50, mor: 68, inj: 0, injT: '', sus: 0, yel: 0,
      club: d.club || null, wage: 0, until: 0, val: 0, tr: d.tr || [], no: d.no || 0, gen: d.gen ? 1 : 0,
      st: G.blankStats(), car: { ap: 0, go: 0 }, listed: 0, joined: world.season, bench: 0,
    };
    const age = FM.age(world, p);
    p.wage = d.wage || G.wageFor(p.ovr, age);
    p.until = d.until || world.season + R.int(1, 4);
    p.val = G.valueFor(p, age, world.season);
    world.players[id] = p;
    return p;
  };

  /* Fiktiver Spieler: Nachwuchs, Auslandsmarkt, Amateurklub */
  G.genPlayer = function (world, opts) {
    const o = opts || {};
    const pos = o.pos || R.weighted(FM.POS, (x) => ({ TW: 9, IV: 17, LV: 8, RV: 8, DM: 9, ZM: 13, OM: 8, LA: 8, RA: 8, ST: 12 }[x]));
    const age = o.age != null ? o.age : R.int(o.minAge || 18, o.maxAge || 31);
    const ovr = U.clamp(Math.round(o.ovr != null ? o.ovr : (o.mean || 60) + R.gauss() * (o.sd || 4)), 32, 95);
    let pot = ovr;
    if (age <= 23) pot = ovr + Math.max(0, Math.round((24 - age) * R.range(0.3, 2.1) + R.gauss() * 2));
    else if (age <= 27) pot = ovr + R.int(0, 2);
    if (o.pot != null) pot = o.pot;
    const nat = o.nat || G.randomNat(o.foreign);
    let name; let tries = 0;
    do { name = G.randomName(nat); tries++; } while (world.nameSet && world.nameSet[name] && tries < 20);
    if (world.nameSet) world.nameSet[name] = 1;
    const bm = R.int(1, 12);
    const near = { TW: '', IV: 'DM', LV: 'RV', RV: 'LV', DM: 'ZM', ZM: 'OM', OM: 'ZM', LA: 'RA', RA: 'LA', ST: 'OM' };
    const p = G.makePlayer(world, {
      name, nat, pos, pos2: R.chance(0.45) ? near[pos] : '', by: FM.Cal.year(world) - age - (bm > FM.Cal.month(world) ? 1 : 0), bm,
      ovr, pot: Math.min(pot, 97), club: o.club || null, gen: 1, tr: G.traitsFor(name, pos, age, false), until: o.until, wage: o.wage,
    });
    return p;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
