#!/usr/bin/env python3
"""Lädt die Rohdaten für tools/build_data.py aus der englischsprachigen Wikipedia.

  python3 tools/fetch_wikipedia.py <zielverzeichnis>     # z. B. tools/raw
  python3 tools/build_data.py <zielverzeichnis>          # erzeugt js/data.js

Geladen werden: Vereinslisten der drei Profiligen (Stadion, Kapazität, Trainer), die Kader aus den
Vereinsartikeln, die Artikel der Spieler (Geburtsdatum, Position, Einsätze, Länderspiele) und die
Ergebnisse der Vorsaison. Wikipedia drosselt anonyme Zugriffe stark – das Skript wartet bei HTTP 429
und setzt beim nächsten Start dort fort, wo es aufgehört hat. Ein vollständiger Lauf dauert 30–60 Minuten.
Bitte sparsam verwenden und einen aussagekräftigen User-Agent mit Kontaktadresse eintragen.
"""
import gzip, json, os, re, sys, time, urllib.parse, urllib.request, urllib.error

OUT = sys.argv[1] if len(sys.argv) > 1 else 'tools/raw'
SEASON = '2026–27'
PREV = '2025–26'
UA = 'FlutlichtDataFetch/1.0 (bitte Kontaktadresse eintragen)'
os.makedirs(OUT, exist_ok=True)


def raw(title):
    url = 'https://en.wikipedia.org/w/index.php?' + urllib.parse.urlencode({'title': title.replace(' ', '_'), 'action': 'raw'})
    for a in range(8):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40).read().decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            print('  warte (HTTP %d)' % e.code, flush=True); time.sleep(30 * (a + 1))
        except Exception as e:
            print('  warte (%r)' % e, flush=True); time.sleep(10 * (a + 1))
    return None


def page(title):
    w = raw(title); time.sleep(0.8)
    m = re.match(r'\s*#REDIRECT\s*\[\[([^\]#|]+)', w or '', flags=re.I)
    if m:
        w = raw(m.group(1).strip()); time.sleep(0.8)
    return w


def clean(s):
    s = re.sub(r'<ref[^>]*/>', '', s); s = re.sub(r'<ref.*?</ref>', '', s, flags=re.S); s = re.sub(r'<ref.*', '', s, flags=re.S)
    return s.strip()


def link(s):
    m = re.search(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', s)
    return (m.group(1).strip(), (m.group(2) or m.group(1)).strip()) if m else (None, re.sub(r'.*\|', '', s).replace('}}', '').strip())


def cells(r):
    return [clean(l.strip()[1:]) for l in r.strip().split('\n') if l.strip().startswith('|') and not l.strip().startswith('|}')]


def league(title, tier):
    w = page(title)
    i = w.find('tadiums and locations'); j = w.find('\n|}', i)
    clubs = []
    for r in w[i:j].split('\n|-')[1:]:
        c = cells(r)
        if len(c) < 4:
            continue
        t = link(c[0]); st = link(c[2].split('<br>')[0]); cap = int(re.sub(r'[^\d]', '', re.sub(r'<br>.*', '', c[3])) or 0)
        clubs.append(dict(page=t[0], short=t[1], city=link(c[1])[1], stadium=st[1], cap=cap, tier=tier))
    k = w.find('ersonnel', j); k2 = w.find('\n|}', k); pers = {}
    for r in w[k:k2].split('\n|-')[1:]:
        c = cells(r)
        if len(c) >= 3:
            name = link(c[0])[1] if '[[' in c[0] else re.sub(r'.*\|', '', c[0]).strip()
            pers[name] = (link(c[1])[1], link(c[2])[1])
    for cl in clubs:
        p = pers.get(cl['short']) or pers.get(cl['page'])
        cl['coach'] = p[0] if p else None; cl['captain'] = p[1] if p else None
    return clubs


def parse_squad(w):
    m = re.search(r'\n==+\s*(Current squad|First[- ]team squad|Current first[- ]team squad|First team|Squad)\s*==+', w, flags=re.I)
    if m:
        seg = w[m.end():]; heads = list(re.finditer(r'\n==+[^=\n]+==+', seg)); main = seg[:heads[0].start()] if heads else seg
        if 'player' not in main.lower() and heads:  # Überschrift direkt gefolgt von einer Unterüberschrift ("First-team squad")
            main = seg[heads[0].end():heads[1].start()] if len(heads) > 1 else seg[heads[0].end():]
    else:
        m = re.search(r'==+\s*Players\s*==+', w); seg = w[m.start() if m else 0:]
        stop = re.search(r'==+\s*(Out on loan|Players out on loan|On loan|Retired numbers|Reserve|Youth|Notable|Former|.* II[^=]*|Second team)[^=]*==+', seg)
        main = seg[:stop.start()] if stop else seg
    players = []
    for t in re.finditer(r'\{\{\s*(?:fs player|football squad player|fs player2)\s*\|(.*?)\}\}\s*(?=\n|$|\{\{)', main, flags=re.I | re.S):
        body = t.group(1); parts = []; depth = 0; cur = ''; i = 0
        while i < len(body):
            two = body[i:i + 2]
            if two in ('[[', '{{'): depth += 1; cur += two; i += 2; continue
            if two in (']]', '}}'): depth -= 1; cur += two; i += 2; continue
            if body[i] == '|' and depth == 0: parts.append(cur); cur = ''
            else: cur += body[i]
            i += 1
        parts.append(cur)
        d = {}
        for p in parts:
            if '=' in p:
                k, v = p.split('=', 1); d[k.strip().lower()] = v.strip()
        name = d.get('name', '')
        lm = re.search(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', name)
        if lm: pg, disp = lm.group(1).strip(), (lm.group(2) or lm.group(1)).strip()
        else: pg, disp = None, re.sub(r"'''?|\{\{.*?\}\}", '', name).strip()
        disp = re.sub(r'\s*\(.*?\)$', '', disp)
        if not disp:
            continue
        no = re.sub(r'[^\d]', '', d.get('no', '') or '')
        players.append(dict(no=int(no) if no else None, nat=d.get('nat', ''), pos=d.get('pos', '').upper(), name=disp, page=pg, other=re.sub(r'<ref.*', '', d.get('other', ''), flags=re.S)))
    return players


def main():
    cj = os.path.join(OUT, 'clubs.json'); sj = os.path.join(OUT, 'squads.json'); pj = os.path.join(OUT, 'playerraw.json.gz')
    if os.path.exists(cj):
        clubs = json.load(open(cj, encoding='utf-8'))
    else:
        clubs = league(SEASON + ' Bundesliga', 1) + league(SEASON + ' 2. Bundesliga', 2) + league(SEASON + ' 3. Liga', 3)
        json.dump(clubs, open(cj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('Vereine:', len(clubs), flush=True)
    if os.path.exists(sj):
        squads = json.load(open(sj, encoding='utf-8'))
    else:
        squads = {}
        for c in clubs:
            squads[c['page']] = parse_squad(page(c['page']) or ''); print(c['page'], len(squads[c['page']]), flush=True)
        json.dump(squads, open(sj, 'w', encoding='utf-8'), ensure_ascii=False)
    titles = sorted({p['page'] for ps in squads.values() for p in ps if p['page']})
    info = json.load(gzip.open(pj, 'rt', encoding='utf-8')) if os.path.exists(pj) else {}
    n = 0
    for t in titles:
        if t in info:
            continue
        w = page(t); info[t] = {'len': len(w or ''), 'text': (w or '')[:14000]}; n += 1
        if n % 50 == 0:
            print(len(info), '/', len(titles), flush=True); json.dump(info, gzip.open(pj, 'wt', encoding='utf-8'), ensure_ascii=False)
    json.dump(info, gzip.open(pj, 'wt', encoding='utf-8'), ensure_ascii=False)
    for lg in ('Bundesliga', '2. Bundesliga', '3. Liga'):
        fn = os.path.join(OUT, 'prev_%s_%s.txt' % (PREV, lg.replace(' ', '_')))
        if not os.path.exists(fn):
            open(fn, 'w', encoding='utf-8').write(page(PREV + ' ' + lg) or '')
    print('Fertig:', len(info), 'Spielerartikel', flush=True)
    euro()


def euro():
    """Teilnehmer der drei Europapokal-Ligaphasen, ihre Kader und (nur Champions League) die Spielerartikel"""
    d = os.path.join(OUT, 'euro'); os.makedirs(d, exist_ok=True)
    tj = os.path.join(d, 'euroteams.json'); cj = os.path.join(d, 'clubraw.json.gz'); pj = os.path.join(d, 'playerraw.json.gz')
    if os.path.exists(tj):
        teams = json.load(open(tj, encoding='utf-8'))
    else:
        teams = {}
        for key, comp in (('CL', 'Champions League'), ('EL', 'Europa League'), ('ECL', 'Conference League')):
            w = page('%s UEFA %s league phase' % (SEASON, comp)) or ''
            a = w.find('==Teams and seeding=='); b = w.find('==Draw==')
            teams[key] = [dict(nat=m.group(1), page=m.group(2).strip(), name=(m.group(3) or m.group(2)).strip(), coef=float(m.group(4)))
                          for m in re.finditer(r'fbaicon\|(\w+)\}\}\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\][^\n]*\n\|\s*([\d.]+)', w[a:b])]
        json.dump(teams, open(tj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    raw = json.load(gzip.open(cj, 'rt', encoding='utf-8')) if os.path.exists(cj) else {}
    for key in ('CL', 'EL', 'ECL'):
        for t in teams[key]:
            if t['nat'] != 'GER' and not raw.get(t['page']):
                raw[t['page']] = page(t['page']) or ''; print(t['page'], len(raw[t['page']]), flush=True)
    json.dump(raw, gzip.open(cj, 'wt', encoding='utf-8'), ensure_ascii=False)
    info = json.load(gzip.open(pj, 'rt', encoding='utf-8')) if os.path.exists(pj) else {}
    titles = sorted({p['page'] for t in teams['CL'] if t['nat'] != 'GER' for p in parse_squad(raw.get(t['page'], ''))[:30] if p['page']})
    n = 0
    for t in titles:
        if t in info:
            continue
        w = page(t); info[t] = {'len': len(w or ''), 'text': (w or '')[:9000]}; n += 1
        if n % 50 == 0:
            print(len(info), '/', len(titles), flush=True); json.dump(info, gzip.open(pj, 'wt', encoding='utf-8'), ensure_ascii=False)
    json.dump(info, gzip.open(pj, 'wt', encoding='utf-8'), ensure_ascii=False)
    print('Europapokal fertig:', len(raw), 'Klubs,', len(info), 'Spielerartikel', flush=True)


if __name__ == '__main__':
    main()
