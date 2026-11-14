/* FLUTLICHT – Fußballmanager · Kern: Namespace, Zufall, Hilfsfunktionen, Konstanten */
(function (root) {
  'use strict';
  const FM = (root.FM = root.FM || {});

  FM.VERSION = '1.0.0';
  FM.SAVE_VERSION = 1;

  /* ---------- Zufall: seedbar, Zustand liegt im Spielstand (reproduzierbar, testbar) ---------- */
  const R = (FM.R = {
    s: { a: 123456789 },
    use(stateHolder) { R.s = stateHolder; },
    f() {
      // mulberry32
      let t = (R.s.a = (R.s.a + 0x6d2b79f5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(a, b) { return a + Math.floor(R.f() * (b - a + 1)); },
    range(a, b) { return a + R.f() * (b - a); },
    chance(p) { return R.f() < p; },
    pick(arr) { return arr[Math.floor(R.f() * arr.length)]; },
    gauss() { // ~N(0,1)
      let u = 0; for (let i = 0; i < 6; i++) u += R.f();
      return (u - 3) / 0.7071;
    },
    weighted(items, weightFn) {
      let sum = 0; const w = items.map((it, i) => { const x = Math.max(0, weightFn(it, i)); sum += x; return x; });
      if (sum <= 0) return items.length ? items[Math.floor(R.f() * items.length)] : undefined;
      let r = R.f() * sum;
      for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
      return items[items.length - 1];
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R.f() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    },
  });

  FM.hash = function (str) { // stabiler String-Hash (für deterministische Ableitungen aus Namen)
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  /* ---------- Hilfsfunktionen ---------- */
  const U = (FM.U = {
    clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
    round(v, d) { const p = Math.pow(10, d || 0); return Math.round(v * p) / p; },
    sum(arr, fn) { let s = 0; for (let i = 0; i < arr.length; i++) s += fn ? fn(arr[i], i) : arr[i]; return s; },
    avg(arr, fn) { return arr.length ? U.sum(arr, fn) / arr.length : 0; },
    sortBy(arr, fn, desc) { return arr.slice().sort((x, y) => (desc ? fn(y) - fn(x) : fn(x) - fn(y))); },
    money(v) {
      if (!isFinite(v)) v = 0;
      const neg = v < 0; const a = Math.abs(v);
      let s;
      if (a >= 1e6) s = (a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2).replace('.', ',') + ' Mio. €';
      else if (a >= 1e3) s = Math.round(a / 1e3).toLocaleString('de-DE') + ' Tsd. €';
      else s = Math.round(a) + ' €';
      return (neg ? '−' : '') + s;
    },
    num(v) { return Math.round(v).toLocaleString('de-DE'); },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    roundMoney(v) { // "krumme" Beträge vermeiden
      const a = Math.abs(v); const step = a >= 2e7 ? 5e5 : a >= 2e6 ? 1e5 : a >= 2e5 ? 1e4 : a >= 2e4 ? 1e3 : 100;
      return Math.round(v / step) * step;
    },
    isNum(v) { return typeof v === 'number' && isFinite(v); },
  });

  /* ---------- Positionen ---------- */
  FM.POS = ['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'];
  FM.POS_NAME = { TW: 'Torwart', IV: 'Innenverteidiger', LV: 'Linksverteidiger', RV: 'Rechtsverteidiger', DM: 'Defensives Mittelfeld', ZM: 'Zentrales Mittelfeld', OM: 'Offensives Mittelfeld', LA: 'Linksaußen', RA: 'Rechtsaußen', ST: 'Stürmer' };
  FM.POS_GROUP = { TW: 'T', IV: 'A', LV: 'A', RV: 'A', DM: 'M', ZM: 'M', OM: 'M', LA: 'S', RA: 'S', ST: 'S' };
  FM.GROUP_NAME = { T: 'Tor', A: 'Abwehr', M: 'Mittelfeld', S: 'Angriff' };
  FM.POS_ORDER = { TW: 0, IV: 1, LV: 2, RV: 3, DM: 4, ZM: 5, OM: 6, LA: 7, RA: 8, ST: 9 };
  // Beitrag einer Position zu Abwehr / Mittelfeld / Angriff
  FM.POS_W = {
    TW: [0, 0, 0], IV: [1.0, 0.1, 0.0], LV: [0.8, 0.25, 0.1], RV: [0.8, 0.25, 0.1],
    DM: [0.5, 0.7, 0.05], ZM: [0.25, 0.9, 0.25], OM: [0.05, 0.7, 0.6],
    LA: [0.1, 0.4, 0.75], RA: [0.1, 0.4, 0.75], ST: [0.0, 0.1, 1.0],
    WB: [0.6, 0.4, 0.25],  // Schienenspieler in Systemen mit Dreierkette
    WM: [0.25, 0.7, 0.45], // äußerer Mittelfeldspieler (z. B. im 4-4-2)
  };
  FM.LINE_NORM = [4.85, 4.0, 3.3];

  // Wie gut passt ein Spieler (Stammposition) auf einen Aufstellungsplatz?
  const FIT = {};
  (function buildFit() {
    const P = FM.POS;
    P.forEach((a) => { FIT[a] = {}; P.forEach((b) => { FIT[a][b] = a === b ? 1 : (a === 'TW' || b === 'TW') ? 0.3 : 0.7; }); });
    const sym = (a, b, v) => { FIT[a][b] = v; FIT[b][a] = v; };
    sym('LV', 'RV', 0.92); sym('LA', 'RA', 0.95); sym('IV', 'DM', 0.88); sym('IV', 'LV', 0.85); sym('IV', 'RV', 0.85);
    sym('DM', 'ZM', 0.93); sym('ZM', 'OM', 0.92); sym('OM', 'LA', 0.9); sym('OM', 'RA', 0.9);
    sym('LA', 'ST', 0.87); sym('RA', 'ST', 0.87); sym('OM', 'ST', 0.86); sym('LV', 'LA', 0.86); sym('RV', 'RA', 0.86);
    sym('LV', 'RA', 0.78); sym('RV', 'LA', 0.78); sym('DM', 'OM', 0.82); sym('ZM', 'LA', 0.84); sym('ZM', 'RA', 0.84);
    sym('LV', 'DM', 0.82); sym('RV', 'DM', 0.82); sym('LV', 'ZM', 0.8); sym('RV', 'ZM', 0.8);
    sym('IV', 'ST', 0.6); sym('IV', 'OM', 0.62); sym('IV', 'LA', 0.6); sym('IV', 'RA', 0.6); sym('IV', 'ZM', 0.78);
    sym('DM', 'ST', 0.65); sym('ZM', 'ST', 0.74);
  })();
  FM.FIT = FIT;
  FM.posFit = function (player, slotPos) {
    let f = FIT[player.pos][slotPos];
    if (player.pos2 && player.pos2 !== player.pos) f = Math.max(f, FIT[player.pos2][slotPos] * 0.97);
    return f;
  };

  /* ---------- Formationen (x: links→rechts, y: eigenes Tor→gegnerisches Tor) ---------- */
  function F(list) { return list.map((s) => ({ pos: s[0], x: s[1], y: s[2], role: s[3] || s[0] })); }
  FM.FORMATIONS = {
    '4-4-2': F([['TW', 50, 5], ['LV', 14, 26], ['IV', 37, 22], ['IV', 63, 22], ['RV', 86, 26], ['LA', 14, 56, 'WM'], ['ZM', 38, 50], ['ZM', 62, 50], ['RA', 86, 56, 'WM'], ['ST', 38, 82], ['ST', 62, 82]]),
    '4-2-3-1': F([['TW', 50, 5], ['LV', 14, 26], ['IV', 37, 22], ['IV', 63, 22], ['RV', 86, 26], ['DM', 38, 42], ['DM', 62, 42], ['LA', 16, 66], ['OM', 50, 64], ['RA', 84, 66], ['ST', 50, 86]]),
    '4-3-3': F([['TW', 50, 5], ['LV', 14, 26], ['IV', 37, 22], ['IV', 63, 22], ['RV', 86, 26], ['DM', 50, 40], ['ZM', 30, 54], ['ZM', 70, 54], ['LA', 16, 78], ['ST', 50, 86], ['RA', 84, 78]]),
    '4-1-4-1': F([['TW', 50, 5], ['LV', 14, 26], ['IV', 37, 22], ['IV', 63, 22], ['RV', 86, 26], ['DM', 50, 38], ['LA', 14, 60, 'WM'], ['ZM', 38, 56], ['ZM', 62, 56], ['RA', 86, 60, 'WM'], ['ST', 50, 86]]),
    '4-4-2 Raute': F([['TW', 50, 5], ['LV', 14, 28], ['IV', 37, 22], ['IV', 63, 22], ['RV', 86, 28], ['DM', 50, 38], ['ZM', 28, 52], ['ZM', 72, 52], ['OM', 50, 66], ['ST', 38, 84], ['ST', 62, 84]]),
    '3-5-2': F([['TW', 50, 5], ['IV', 26, 22], ['IV', 50, 20], ['IV', 74, 22], ['LV', 10, 50, 'WB'], ['RV', 90, 50, 'WB'], ['DM', 50, 40], ['ZM', 32, 54], ['OM', 62, 62], ['ST', 38, 84], ['ST', 62, 84]]),
    '3-4-3': F([['TW', 50, 5], ['IV', 26, 22], ['IV', 50, 20], ['IV', 74, 22], ['LV', 10, 48, 'WB'], ['ZM', 38, 48], ['ZM', 62, 48], ['RV', 90, 48, 'WB'], ['LA', 18, 78], ['ST', 50, 86], ['RA', 82, 78]]),
    '5-3-2': F([['TW', 50, 5], ['LV', 8, 32], ['IV', 28, 22], ['IV', 50, 20], ['IV', 72, 22], ['RV', 92, 32], ['ZM', 28, 54], ['DM', 50, 46], ['ZM', 72, 54], ['ST', 38, 82], ['ST', 62, 82]]),
    '5-4-1': F([['TW', 50, 5], ['LV', 8, 30], ['IV', 28, 22], ['IV', 50, 20], ['IV', 72, 22], ['RV', 92, 30], ['LA', 14, 58, 'WM'], ['ZM', 38, 52], ['ZM', 62, 52], ['RA', 86, 58, 'WM'], ['ST', 50, 84]]),
  };
  FM.FORMATION_NAMES = Object.keys(FM.FORMATIONS);
  // Ausgleichsfaktor: Jede Formation ist bei gleich guten Spielern gleich viel wert – sie verschiebt nur
  // das Gewicht zwischen Abwehr, Mittelfeld und Angriff. So gibt es keine heimliche "Siegerformation".
  FM.FORM_G = {};
  (function () {
    const N = FM.LINE_NORM, K = 0.92; const ref = N[0] * Math.pow(N[1], K) * N[2];
    for (const f of FM.FORMATION_NAMES) {
      const t = [0, 0, 0]; for (const sl of FM.FORMATIONS[f]) { const w = FM.POS_W[sl.role]; t[0] += w[0]; t[1] += w[1]; t[2] += w[2]; }
      FM.FORM_G[f] = Math.pow(ref / (t[0] * Math.pow(t[1], K) * t[2]), 1 / (2 + K));
    }
  })();

  /* ---------- Taktik-Optionen ---------- */
  FM.TACTICS = {
    stance: { label: 'Ausrichtung', opts: [[-2, 'Mauern'], [-1, 'Defensiv'], [0, 'Ausgewogen'], [1, 'Offensiv'], [2, 'Brechstange']] },
    press: { label: 'Pressing', opts: [[0, 'Abwartend'], [1, 'Normal'], [2, 'Hohes Pressing']] },
    hard: { label: 'Zweikampfhärte', opts: [[0, 'Fair'], [1, 'Normal'], [2, 'Rustikal']] },
    style: { label: 'Spielweise', opts: [['kurz', 'Kurzpassspiel'], ['konter', 'Konter'], ['fluegel', 'Flügelspiel'], ['lang', 'Lange Bälle']] },
  };
  FM.defaultTactics = function () { return { stance: 0, press: 1, hard: 1, style: 'kurz' }; };

  /* ---------- Eigenschaften (Anstoß-typisch: wenige, dafür spürbar) ---------- */
  FM.TRAITS = {
    fuehrung: { n: 'Führungsspieler', d: 'Stabilisiert die Mannschaft, vor allem bei Rückstand.', good: 1 },
    kopfball: { n: 'Kopfballstark', d: 'Gefährlich bei Ecken und Flanken.', good: 1 },
    freistoss: { n: 'Freistoßspezialist', d: 'Direkte Freistöße sind echte Torchancen.', good: 1 },
    elfer: { n: 'Elfmeterschütze', d: 'Verwandelt Strafstöße sicherer.', good: 1 },
    elferkiller: { n: 'Elfmetertöter', d: 'Hält überdurchschnittlich viele Strafstöße.', good: 1 },
    dauerlaeufer: { n: 'Dauerläufer', d: 'Ermüdet langsamer.', good: 1 },
    joker: { n: 'Joker', d: 'Trifft häufiger nach Einwechslung.', good: 1 },
    liebling: { n: 'Publikumsliebling', d: 'Hebt die Stimmung im Stadion.', good: 1 },
    musterprofi: { n: 'Musterprofi', d: 'Entwickelt sich im Training schneller, hält die Form.', good: 1 },
    nerven: { n: 'Nervenstark', d: 'In engen Schlussphasen besonders wertvoll.', good: 1 },
    heisssporn: { n: 'Heißsporn', d: 'Sammelt Karten wie andere Briefmarken.', good: 0 },
    verletzlich: { n: 'Verletzungsanfällig', d: 'Fällt öfter und länger aus.', good: 0 },
    launisch: { n: 'Launisch', d: 'Formkurve wie eine Achterbahn.', good: 0 },
    trainingsmuffel: { n: 'Trainingsmuffel', d: 'Entwickelt sich langsamer.', good: 0 },
  };

  FM.NAT_NAME = {
    GER: 'Deutschland', AUT: 'Österreich', SUI: 'Schweiz', FRA: 'Frankreich', ENG: 'England', ESP: 'Spanien', ITA: 'Italien', NED: 'Niederlande', BEL: 'Belgien', POR: 'Portugal',
    DEN: 'Dänemark', SWE: 'Schweden', NOR: 'Norwegen', FIN: 'Finnland', ISL: 'Island', POL: 'Polen', CZE: 'Tschechien', SVK: 'Slowakei', HUN: 'Ungarn', CRO: 'Kroatien', SRB: 'Serbien',
    BIH: 'Bosnien-Herzegowina', SVN: 'Slowenien', MNE: 'Montenegro', MKD: 'Nordmazedonien', ALB: 'Albanien', KOS: 'Kosovo', KVX: 'Kosovo', GRE: 'Griechenland', TUR: 'Türkei', ROU: 'Rumänien', BUL: 'Bulgarien',
    UKR: 'Ukraine', RUS: 'Russland', GEO: 'Georgien', ARM: 'Armenien', SCO: 'Schottland', WAL: 'Wales', IRL: 'Irland', NIR: 'Nordirland', LUX: 'Luxemburg', USA: 'USA', CAN: 'Kanada', MEX: 'Mexiko',
    BRA: 'Brasilien', ARG: 'Argentinien', URU: 'Uruguay', COL: 'Kolumbien', CHI: 'Chile', ECU: 'Ecuador', PAR: 'Paraguay', PER: 'Peru', VEN: 'Venezuela', JPN: 'Japan', KOR: 'Südkorea', AUS: 'Australien',
    CHN: 'China', IRN: 'Iran', ISR: 'Israel', MAR: 'Marokko', ALG: 'Algerien', TUN: 'Tunesien', EGY: 'Ägypten', SEN: 'Senegal', CIV: 'Elfenbeinküste', GHA: 'Ghana', NGA: 'Nigeria', CMR: 'Kamerun',
    MLI: 'Mali', GUI: 'Guinea', BFA: 'Burkina Faso', COD: 'DR Kongo', CGO: 'Kongo', GAB: 'Gabun', TOG: 'Togo', BEN: 'Benin', GAM: 'Gambia', ANG: 'Angola', CPV: 'Kap Verde', RSA: 'Südafrika', ZAM: 'Sambia',
    JAM: 'Jamaika', NZL: 'Neuseeland', LTU: 'Litauen', LVA: 'Lettland', EST: 'Estland', CYP: 'Zypern', MLT: 'Malta', SUR: 'Suriname', CUW: 'Curaçao', HAI: 'Haiti', PHI: 'Philippinen', IDN: 'Indonesien',
    SYR: 'Syrien', IRQ: 'Irak', LBN: 'Libanon', PLE: 'Palästina', AZE: 'Aserbaidschan', KAZ: 'Kasachstan', UZB: 'Usbekistan', MDA: 'Moldau', BLR: 'Belarus', SLE: 'Sierra Leone', LBR: 'Liberia',
    GNB: 'Guinea-Bissau', EQG: 'Äquatorialguinea', UGA: 'Uganda', KEN: 'Kenia', TAN: 'Tansania', ZIM: 'Simbabwe', MOZ: 'Mosambik', LIE: 'Liechtenstein', FRO: 'Färöer', CRC: 'Costa Rica', PAN: 'Panama',
    HON: 'Honduras', TRI: 'Trinidad und Tobago', BOL: 'Bolivien', DOM: 'Dominikanische Republik', THA: 'Thailand', VIE: 'Vietnam', IND: 'Indien', KSA: 'Saudi-Arabien', LBY: 'Libyen', MTN: 'Mauretanien',
    NIG: 'Niger', CTA: 'Zentralafrikanische Republik', BDI: 'Burundi', RWA: 'Ruanda', ETH: 'Äthiopien', ERI: 'Eritrea', SOM: 'Somalia', SDN: 'Sudan', MAD: 'Madagaskar', COM: 'Komoren', AFG: 'Afghanistan',
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
