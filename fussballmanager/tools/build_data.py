#!/usr/bin/env python3
"""Baut js/data.js aus den von tools/fetch_wikipedia.py geladenen Rohdaten.

Quelle der Kader, Trainer, Stadien, Geburtsdaten und Positionen: englischsprachige Wikipedia
(CC BY-SA 4.0), Saison 2026/27. Wikipedia enthält KEINE Spielstärken – die Werte "Stärke" und
"Talent" werden hier aus öffentlich sichtbaren Merkmalen GESCHÄTZT (Vereinsniveau, Länderspiele,
Einsätze, Alter, Umfang des Artikels) und für bekannte Spieler von Hand nachjustiert.

Aufruf:  python3 tools/build_data.py <rohdaten-verzeichnis>
"""
import gzip, json, math, os, re, statistics, sys, datetime, hashlib

RAW = sys.argv[1] if len(sys.argv) > 1 else 'tools/raw'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'data.js')
SEASON = 2026

# en-Wikipedia-Titel -> (id, Name, Kurzname, Stadt, Farben, Kaderniveau, Zuschauer-Nachfrage relativ zur Kapazität, Fan-Bonus)
CLUBS = {
    'FC Bayern Munich': ('FCB', 'FC Bayern München', 'Bayern', 'München', ['#dc052d', '#ffffff'], 82.0, 1.5, 0),
    'Borussia Dortmund': ('BVB', 'Borussia Dortmund', 'Dortmund', 'Dortmund', ['#fde100', '#000000'], 78.0, 1.3, 2),
    'Bayer 04 Leverkusen': ('B04', 'Bayer 04 Leverkusen', 'Leverkusen', 'Leverkusen', ['#e32221', '#000000'], 77.0, 1.05, 0),
    'RB Leipzig': ('RBL', 'RB Leipzig', 'Leipzig', 'Leipzig', ['#ffffff', '#dd0741'], 77.0, 0.98, 0),
    'VfB Stuttgart': ('VFB', 'VfB Stuttgart', 'Stuttgart', 'Stuttgart', ['#ffffff', '#e32219'], 76.5, 1.1, 1),
    'Eintracht Frankfurt': ('SGE', 'Eintracht Frankfurt', 'Frankfurt', 'Frankfurt am Main', ['#000000', '#e1000f'], 76.5, 1.2, 1),
    'SC Freiburg': ('SCF', 'SC Freiburg', 'Freiburg', 'Freiburg im Breisgau', ['#e2001a', '#000000'], 74.5, 1.15, 0),
    'TSG 1899 Hoffenheim': ('TSG', 'TSG 1899 Hoffenheim', 'Hoffenheim', 'Sinsheim', ['#1961b5', '#ffffff'], 74.5, 0.85, -2),
    '1. FSV Mainz 05': ('M05', '1. FSV Mainz 05', 'Mainz', 'Mainz', ['#c3141e', '#ffffff'], 73.5, 0.92, 0),
    'Borussia Mönchengladbach': ('BMG', 'Borussia Mönchengladbach', 'M\'gladbach', 'Mönchengladbach', ['#ffffff', '#000000'], 73.0, 0.98, 2),
    'SV Werder Bremen': ('SVW', 'SV Werder Bremen', 'Bremen', 'Bremen', ['#1d9053', '#ffffff'], 73.0, 1.05, 2),
    '1. FC Union Berlin': ('FCU', '1. FC Union Berlin', 'Union Berlin', 'Berlin', ['#eb1923', '#ffffff'], 72.0, 1.6, 0),
    'FC Augsburg': ('FCA', 'FC Augsburg', 'Augsburg', 'Augsburg', ['#ba3733', '#ffffff'], 72.0, 0.97, 0),
    '1. FC Köln': ('KOE', '1. FC Köln', 'Köln', 'Köln', ['#ffffff', '#ed1c24'], 72.0, 1.2, 3),
    'Hamburger SV': ('HSV', 'Hamburger SV', 'Hamburg', 'Hamburg', ['#ffffff', '#0a3a8a'], 71.5, 1.1, 4),
    'FC Schalke 04': ('S04', 'FC Schalke 04', 'Schalke', 'Gelsenkirchen', ['#004d9d', '#ffffff'], 70.0, 1.15, 5),
    'SC Paderborn 07': ('SCP', 'SC Paderborn 07', 'Paderborn', 'Paderborn', ['#005ba9', '#000000'], 69.0, 0.95, -1),
    'SV Elversberg': ('SVE', 'SV Elversberg', 'Elversberg', 'Spiesen-Elversberg', ['#000000', '#ffffff'], 69.0, 0.95, -2),
    'VfL Wolfsburg': ('WOB', 'VfL Wolfsburg', 'Wolfsburg', 'Wolfsburg', ['#65b32e', '#ffffff'], 71.0, 0.8, 0),
    '1. FC Heidenheim': ('FCH', '1. FC Heidenheim 1846', 'Heidenheim', 'Heidenheim an der Brenz', ['#e2001a', '#003b79'], 68.5, 1.0, 0),
    'FC St. Pauli': ('STP', 'FC St. Pauli', 'St. Pauli', 'Hamburg', ['#6d4c33', '#ffffff'], 69.0, 1.3, 2),
    'Hertha BSC': ('BSC', 'Hertha BSC', 'Hertha', 'Berlin', ['#005ca9', '#ffffff'], 68.5, 0.7, 3),
    'Hannover 96': ('H96', 'Hannover 96', 'Hannover', 'Hannover', ['#1c9a3c', '#000000'], 68.0, 0.78, 2),
    'VfL Bochum': ('BOC', 'VfL Bochum 1848', 'Bochum', 'Bochum', ['#005ca9', '#ffffff'], 67.5, 1.0, 1),
    '1. FC Kaiserslautern': ('FCK', '1. FC Kaiserslautern', 'K\'lautern', 'Kaiserslautern', ['#d5001c', '#ffffff'], 67.0, 0.9, 3),
    '1. FC Nürnberg': ('FCN', '1. FC Nürnberg', 'Nürnberg', 'Nürnberg', ['#ad1732', '#000000'], 66.5, 0.75, 3),
    'SV Darmstadt 98': ('D98', 'SV Darmstadt 98', 'Darmstadt', 'Darmstadt', ['#004e9e', '#ffffff'], 67.0, 0.95, 0),
    'Karlsruher SC': ('KSC', 'Karlsruher SC', 'Karlsruhe', 'Karlsruhe', ['#003d7c', '#ffffff'], 66.5, 0.85, 1),
    'Holstein Kiel': ('KSV', 'Holstein Kiel', 'Kiel', 'Kiel', ['#0057a3', '#ffffff'], 67.0, 0.95, 0),
    '1. FC Magdeburg': ('FCM', '1. FC Magdeburg', 'Magdeburg', 'Magdeburg', ['#0067b1', '#ffffff'], 66.0, 0.85, 1),
    'SpVgg Greuther Fürth': ('SGF', 'SpVgg Greuther Fürth', 'Fürth', 'Fürth', ['#009932', '#ffffff'], 65.5, 0.75, 0),
    'Arminia Bielefeld': ('DSC', 'DSC Arminia Bielefeld', 'Bielefeld', 'Bielefeld', ['#004e95', '#000000'], 66.0, 0.9, 1),
    'Dynamo Dresden': ('SGD', 'SG Dynamo Dresden', 'Dresden', 'Dresden', ['#ffdd00', '#000000'], 65.5, 0.95, 3),
    'Eintracht Braunschweig': ('EBS', 'Eintracht Braunschweig', 'Braunschweig', 'Braunschweig', ['#fdd204', '#00589b'], 65.0, 0.9, 1),
    'FC Energie Cottbus': ('FCE', 'FC Energie Cottbus', 'Cottbus', 'Cottbus', ['#e2001a', '#ffffff'], 64.5, 0.6, 1),
    'VfL Osnabrück': ('OSN', 'VfL Osnabrück', 'Osnabrück', 'Osnabrück', ['#6b2c91', '#ffffff'], 64.0, 0.98, 1),
    'Fortuna Düsseldorf': ('F95', 'Fortuna Düsseldorf', 'Düsseldorf', 'Düsseldorf', ['#e30613', '#ffffff'], 65.0, 0.62, 4),
    'SC Preußen Münster': ('SCM', 'SC Preußen Münster', 'Münster', 'Münster', ['#00693e', '#000000'], 64.0, 0.8, 1),
    'FC Hansa Rostock': ('FCR', 'F.C. Hansa Rostock', 'Rostock', 'Rostock', ['#0080c8', '#ffffff'], 63.5, 0.85, 3),
    'Rot-Weiss Essen': ('RWE', 'Rot-Weiss Essen', 'Essen', 'Essen', ['#e2001a', '#ffffff'], 63.5, 0.9, 3),
    'MSV Duisburg': ('MSV', 'MSV Duisburg', 'Duisburg', 'Duisburg', ['#004c93', '#ffffff'], 63.0, 0.62, 3),
    '1. FC Saarbrücken': ('FCS', '1. FC Saarbrücken', 'Saarbrücken', 'Saarbrücken', ['#0f4c92', '#000000'], 63.0, 0.7, 2),
    'FC Ingolstadt 04': ('FCI', 'FC Ingolstadt 04', 'Ingolstadt', 'Ingolstadt', ['#c8102e', '#000000'], 62.5, 0.4, 0),
    'SSV Jahn Regensburg': ('SSV', 'SSV Jahn Regensburg', 'Regensburg', 'Regensburg', ['#e2001a', '#ffffff'], 62.5, 0.55, 0),
    'SV Waldhof Mannheim': ('SVW07', 'SV Waldhof Mannheim', 'Mannheim', 'Mannheim', ['#0a3d7a', '#000000'], 62.5, 0.5, 2),
    'Alemannia Aachen': ('AAC', 'Alemannia Aachen', 'Aachen', 'Aachen', ['#fdd400', '#000000'], 62.5, 0.75, 3),
    'SV Wehen Wiesbaden': ('SVWW', 'SV Wehen Wiesbaden', 'Wiesbaden', 'Wiesbaden', ['#e2001a', '#000000'], 62.5, 0.3, -1),
    'FC Viktoria Köln': ('VIK', 'FC Viktoria Köln', 'Viktoria Köln', 'Köln', ['#e2001a', '#000000'], 62.0, 0.4, -1),
    'SC Verl': ('SCV', 'SC Verl', 'Verl', 'Verl', ['#000000', '#ffffff'], 62.0, 0.5, -2),
    'TSG 1899 Hoffenheim II': ('TSG2', 'TSG 1899 Hoffenheim II', 'Hoffenheim II', 'Sinsheim', ['#1961b5', '#ffffff'], 62.0, 0.2, -4),
    'VfB Stuttgart II': ('VFB2', 'VfB Stuttgart II', 'Stuttgart II', 'Stuttgart', ['#ffffff', '#e32219'], 61.5, 0.15, -4),
    'FC Würzburger Kickers': ('FWK', 'FC Würzburger Kickers', 'Würzburg', 'Würzburg', ['#e2001a', '#ffffff'], 61.0, 0.4, 0),
    'SV Meppen': ('SVM', 'SV Meppen', 'Meppen', 'Meppen', ['#0a4595', '#ffffff'], 61.0, 0.6, 1),
    'SC Fortuna Köln': ('FOK', 'SC Fortuna Köln', 'Fortuna Köln', 'Köln', ['#e2001a', '#ffffff'], 61.0, 0.3, 0),
    'SG Sonnenhof Großaspach': ('SGS', 'SG Sonnenhof Großaspach', 'Großaspach', 'Aspach', ['#e2001a', '#000000'], 60.0, 0.25, -2),
    'TSV Havelse': ('HAV', 'TSV Havelse', 'Havelse', 'Garbsen', ['#e2001a', '#000000'], 60.0, 0.4, -2),
}
RESERVES = {'TSG2', 'VFB2'}

# Regionalliga-Pool (Traditionsklubs unterhalb der 3. Liga) – ohne echte Kaderdaten, Spieler werden im Spiel generiert
AMATEURS = [
    ('M60', 'TSV 1860 München', '1860 München', 'München', 'Grünwalder Stadion', 15000, ['#69b3e7', '#ffffff'], 58.5, 46),
    ('ULM', 'SSV Ulm 1846', 'Ulm', 'Ulm', 'Donaustadion', 17400, ['#000000', '#ffffff'], 57.5, 42),
    ('AUE', 'FC Erzgebirge Aue', 'Aue', 'Aue-Bad Schlema', 'Erzgebirgsstadion', 16485, ['#5b2b82', '#ffffff'], 57.5, 43),
    ('OFC', 'Kickers Offenbach', 'Offenbach', 'Offenbach am Main', 'Stadion am Bieberer Berg', 20500, ['#e2001a', '#ffffff'], 56.5, 42),
    ('RWO', 'Rot-Weiß Oberhausen', 'Oberhausen', 'Oberhausen', 'Stadion Niederrhein', 17165, ['#e2001a', '#ffffff'], 55.5, 38),
    ('FCC', 'FC Carl Zeiss Jena', 'Jena', 'Jena', 'Ernst-Abbe-Sportfeld', 15100, ['#0055a4', '#fdd400'], 56.5, 40),
    ('HFC', 'Hallescher FC', 'Halle', 'Halle (Saale)', 'Leuna-Chemie-Stadion', 15057, ['#e2001a', '#ffffff'], 56.5, 40),
    ('CFC', 'Chemnitzer FC', 'Chemnitz', 'Chemnitz', 'Stadion an der Gellertstraße', 15000, ['#74b9e7', '#ffffff'], 55.5, 38),
    ('LOK', '1. FC Lokomotive Leipzig', 'Lok Leipzig', 'Leipzig', 'Bruno-Plache-Stadion', 10900, ['#0055a4', '#fdd400'], 56.5, 39),
    ('UHG', 'SpVgg Unterhaching', 'Unterhaching', 'Unterhaching', 'Sportpark Unterhaching', 15053, ['#e2001a', '#0055a4'], 56.0, 37),
    ('VFL', 'VfB Lübeck', 'Lübeck', 'Lübeck', 'Stadion an der Lohmühle', 17849, ['#00693e', '#ffffff'], 55.5, 37),
    ('SVS', 'SV Sandhausen', 'Sandhausen', 'Sandhausen', 'Hardtwaldstadion', 15414, ['#000000', '#ffffff'], 56.0, 36),
    ('S05', '1. FC Schweinfurt 05', 'Schweinfurt', 'Schweinfurt', 'Sachs-Stadion', 15060, ['#00693e', '#ffffff'], 56.0, 36),
    ('HOM', 'FC 08 Homburg', 'Homburg', 'Homburg', 'Waldstadion Homburg', 16488, ['#00693e', '#ffffff'], 55.5, 35),
]

# Handjustierte Stärken bekannter Spieler (gilt, egal bei welchem der 56 Klubs sie aktuell spielen)
STARS = {
    'Harry Kane': 91, 'Jamal Musiala': 89, 'Michael Olise': 89, 'Joshua Kimmich': 87, 'Luis Díaz': 86, 'Dayot Upamecano': 85, 'Jonathan Tah': 85,
    'Alphonso Davies': 84, 'Aleksandar Pavlović': 85, 'Manuel Neuer': 83, 'Serge Gnabry': 82, 'Leon Goretzka': 81, 'Konrad Laimer': 82, 'Kim Min-jae': 82,
    'Josip Stanišić': 80, 'Lennart Karl': 80, 'Tom Bischof': 79, 'Jonas Urbig': 79, 'Nicolas Jackson': 82, 'Raphaël Guerreiro': 79, 'Hiroki Ito': 79,
    'Gregor Kobel': 86, 'Nico Schlotterbeck': 86, 'Serhou Guirassy': 86, 'Karim Adeyemi': 82, 'Julian Brandt': 81, 'Felix Nmecha': 83, 'Marcel Sabitzer': 79,
    'Emre Can': 78, 'Waldemar Anton': 81, 'Julian Ryerson': 80, 'Maximilian Beier': 80, 'Jobe Bellingham': 80, 'Daniel Svensson': 79, 'Ramy Bensebaini': 79,
    'Pascal Groß': 78, 'Niklas Süle': 77, 'Carney Chukwuemeka': 78, 'Fábio Silva': 79,
    'Álex Grimaldo': 85, 'Alejandro Grimaldo': 85, 'Edmond Tapsoba': 83, 'Patrik Schick': 83, 'Robert Andrich': 79, 'Mark Flekken': 80, 'Malik Tillman': 81, 'Jarell Quansah': 81,
    'Exequiel Palacios': 82, 'Ibrahim Maza': 80, 'Nathan Tella': 78, 'Aleix García': 80, 'Jonas Hofmann': 76, 'Piero Hincapié': 83, 'Christian Kofane': 78, 'Loïc Badé': 80,
    'David Raum': 83, 'Willi Orbán': 81, 'Péter Gulácsi': 80, 'Christoph Baumgartner': 80, 'Castello Lukeba': 82, 'Nicolas Seiwald': 79, 'Xaver Schlager': 80,
    'Antonio Nusa': 80, 'Yan Diomande': 81, 'Assan Ouédraogo': 78, 'Ridle Baku': 78, 'Rômulo': 79, 'Johan Bakayoko': 79, 'Conrad Harder': 77, 'El Chadaille Bitshiabu': 77,
    'Deniz Undav': 83, 'Alexander Nübel': 82, 'Angelo Stiller': 85, 'Maximilian Mittelstädt': 81, 'Chris Führich': 79, 'Jamie Leweling': 81, 'Julian Chabot': 79, 'Jeff Chabot': 79,
    'Atakan Karazor': 79, 'Ermedin Demirović': 80, 'Bilal El Khannouss': 80, 'Finn Jeltsch': 78, 'Badredine Bouanani': 77, 'Tiago Tomás': 77,
    'Robin Koch': 81, 'Arthur Theate': 81, 'Mario Götze': 78, 'Jonathan Burkardt': 82, 'Can Uzun': 81, 'Hugo Larsson': 81, 'Nathaniel Brown': 81, 'Nnamdi Collins': 79,
    'Kauã Santos': 80, 'Ansgar Knauff': 79, 'Ritsu Dōan': 80, 'Ritsu Doan': 80, 'Michael Zetterer': 78, 'Rasmus Kristensen': 79, 'Farès Chaïbi': 79, 'Jean-Mattéo Bahoya': 78, 'Elye Wahi': 77,
    'Noah Atubolu': 81, 'Matthias Ginter': 80, 'Vincenzo Grifo': 79, 'Maximilian Eggestein': 78, 'Philipp Lienhart': 79, 'Johan Manzambi': 79, 'Yuito Suzuki': 78, 'Igor Matanović': 77,
    'Tim Kleindienst': 80, 'Nico Elvedi': 78, 'Franck Honorat': 78, 'Rocco Reitz': 79, 'Moritz Nicolas': 78, 'Haris Tabaković': 77, 'Robin Hack': 77, 'Joe Scally': 77,
    'Oliver Baumann': 82, 'Andrej Kramarić': 78, 'Fisnik Asllani': 79, 'Tim Lemperle': 78, 'Bazoumana Touré': 78, 'Wouter Burger': 78, 'Leon Avdullahu': 78, 'Vladimír Coufal': 76,
    'Nadiem Amiri': 81, 'Robin Zentner': 79, 'Lee Jae-sung': 78, 'Paul Nebel': 79, 'Dominik Kohr': 77, 'Kaishu Sano': 79, 'Phillipp Mwene': 77, 'Stefan Bell': 74, 'Nelson Weiper': 77,
    'Romano Schmid': 80, 'Marco Friedl': 78, 'Jens Stage': 79, 'Mitchell Weiser': 78, 'Mio Backhaus': 77, 'Senne Lynen': 77, 'Karim Coulibaly': 77, 'Victor Boniface': 79,
    'Frederik Rønnow': 79, 'Danilho Doekhi': 79, 'Christopher Trimmel': 72, 'Rani Khedira': 76, 'Diogo Leite': 78, 'Leopold Querfeld': 77, 'Ilyas Ansah': 77, 'Oliver Burke': 76, 'Andrej Ilić': 77,
    'Finn Dahmen': 78, 'Jeffrey Gouweleeuw': 75, 'Chrislain Matsima': 78, 'Alexis Claude-Maurice': 77, 'Fabian Rieder': 77, 'Kristijan Jakić': 76, 'Elvis Rexhbeçaj': 75, 'Phillip Tietz': 75,
    'Marvin Schwäbe': 78, 'Said El Mala': 81, 'Eric Martel': 77, 'Jakub Kamiński': 78, 'Ragnar Ache': 77, 'Marius Bülter': 76, 'Isak Jóhannesson': 76, 'Luca Waldschmidt': 75, 'Timo Hübers': 76,
    'Daniel Heuer Fernandes': 76, 'Luka Vušković': 80, 'Nicolai Remberg': 76, 'Fábio Vieira': 78, 'Rayan Philippe': 76, 'Albert Sambi Lokonga': 77, 'Jean-Luc Dompé': 76, 'Robert Glatzel': 75, 'Ransford Königsdörffer': 76, 'Miro Muheim': 76, 'Nicolás Capaldo': 77,
    'Kenan Karaman': 76, 'Loris Karius': 74, 'Moussa Sylla': 76, 'Soufiane El-Faouzi': 74, 'Timo Becker': 73, 'Nikola Katić': 74, 'Ron Schallenberg': 73,
    'Maximilian Arnold': 77, 'Kamil Grabara': 79, 'Mohamed Amoura': 80, 'Jonas Wind': 78, 'Lovro Majer': 78, 'Patrick Wimmer': 78, 'Konstantinos Koulierakis': 78, 'Denis Vavro': 77, 'Christian Eriksen': 77,
    'Joakim Mæhle': 77, 'Kilian Fischer': 76, 'Mattias Svanberg': 77, 'Vinícius Souza': 78, 'Dženan Pejčinović': 76, 'Adam Daghim': 76,
    'Patrick Mainka': 74, 'Marvin Pieringer': 74, 'Diant Ramaj': 76, 'Budu Zivzivadze': 74, 'Arijon Ibrahimović': 75, 'Niklas Dorsch': 74,
    'Nikola Vasilj': 76, 'Eric Smith': 76, 'Jackson Irvine': 75, 'Hauke Wahl': 75, 'Danel Sinani': 74, 'Andréas Hountondji': 75, 'Joel Chima Fujita': 75,
    'Fabian Reese': 76, 'Tjark Ernst': 74, 'Michaël Cuisance': 74, 'Paul Seguin': 73, 'Kennet Eichhorn': 76,
}

TOP = set('GER FRA ESP ENG POR NED BEL ITA BRA ARG CRO URU'.split())
MID = set('AUT SUI DEN SWE NOR POL CZE SRB TUR USA JPN KOR MAR SEN COL UKR HUN SCO WAL MEX ECU NGA CIV ALG EGY GHA CMR AUS CAN SVK SVN ROU GRE IRL BIH MLI TUN'.split())
NATFIX = {'NGR': 'NGA', 'KVX': 'KOS', 'DRC': 'COD', 'CGO': 'CGO', 'ROM': 'ROU', 'SLO': 'SVN', 'HOL': 'NED', 'CTA': 'CTA'}
COUNTRY = {'germany': 'GER', 'austria': 'AUT', 'switzerland': 'SUI', 'france': 'FRA', 'england': 'ENG', 'spain': 'ESP', 'italy': 'ITA', 'netherlands': 'NED', 'belgium': 'BEL', 'portugal': 'POR',
           'denmark': 'DEN', 'sweden': 'SWE', 'norway': 'NOR', 'poland': 'POL', 'croatia': 'CRO', 'serbia': 'SRB', 'turkey': 'TUR', 'türkiye': 'TUR', 'japan': 'JPN', 'united states': 'USA', 'usa': 'USA',
           'kosovo': 'KOS', 'bosnia and herzegovina': 'BIH', 'ghana': 'GHA', 'nigeria': 'NGA', 'morocco': 'MAR', 'south korea': 'KOR', 'korea republic': 'KOR', 'brazil': 'BRA', 'luxembourg': 'LUX', 'finland': 'FIN'}


def h(s):
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


def strip_markup(v):
    v = re.sub(r'<ref[^>]*/>', '', v)
    v = re.sub(r'<ref.*?</ref>', '', v, flags=re.S)
    v = re.sub(r'<!--.*?-->', '', v, flags=re.S)
    return v.strip()


def infobox(text):
    """liefert dict der Infobox-Felder (erste Ebene)"""
    i = text.find('{{Infobox')
    if i < 0:
        i = text.lower().find('{{infobox')
    if i < 0:
        return {}
    depth = 0; j = i; fields = []; cur = ''
    while j < len(text):
        two = text[j:j + 2]
        if two == '{{' or two == '[[':
            depth += 1; cur += two; j += 2; continue
        if two == '}}' or two == ']]':
            depth -= 1
            if depth == 0:
                fields.append(cur); break
            cur += two; j += 2; continue
        if text[j] == '|' and depth == 1:
            fields.append(cur); cur = ''
        else:
            cur += text[j]
        j += 1
    out = {}
    for f in fields[1:]:
        if '=' in f:
            k, v = f.split('=', 1)
            out[k.strip().lower()] = strip_markup(v)
    return out


def plain(v):
    v = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', v)
    v = re.sub(r"'''?", '', v)
    return v


def parse_positions(v, squad_pos, name):
    v = plain(v).lower()
    v = re.sub(r'\{\{\s*(hlist|flatlist|plainlist|ubl|unbulleted list)\s*\|?', '', v).replace('}}', '').replace('*', ',')
    toks = [t.strip() for t in re.split(r'[,/|\n]|\band\b|\bor\b', v) if t.strip()]
    out = []
    hh = h(name)
    for t in toks:
        p = None
        if 'goalkeeper' in t or 'keeper' in t: p = 'TW'
        elif 'wing-back' in t or 'wing back' in t or 'wingback' in t: p = 'LV' if 'left' in t else 'RV' if 'right' in t else ('LV' if hh % 2 else 'RV')
        elif 'left-back' in t or 'left back' in t or 'left-sided defender' in t: p = 'LV'
        elif 'right-back' in t or 'right back' in t: p = 'RV'
        elif 'full-back' in t or 'full back' in t or 'fullback' in t: p = 'LV' if hh % 2 else 'RV'
        elif 'centre-back' in t or 'center-back' in t or 'centre back' in t or 'center back' in t or 'central defender' in t or 'sweeper' in t: p = 'IV'
        elif 'defensive mid' in t or 'holding' in t: p = 'DM'
        elif 'attacking mid' in t or 'playmaker' in t or 'number 10' in t: p = 'OM'
        elif 'left wing' in t or 'left mid' in t or 'left forward' in t: p = 'LA'
        elif 'right wing' in t or 'right mid' in t or 'right forward' in t: p = 'RA'
        elif 'winger' in t or 'wide mid' in t or 'wing' == t: p = 'LA' if hh % 2 else 'RA'
        elif 'central mid' in t or 'centre mid' in t or 'box-to-box' in t: p = 'ZM'
        elif 'striker' in t or 'centre-forward' in t or 'center-forward' in t or 'centre forward' in t or 'center forward' in t: p = 'ST'
        elif 'midfielder' in t: p = generic('MF', hh)
        elif 'defender' in t: p = generic('DF', hh)
        elif 'forward' in t: p = generic('FW', hh)
        if p and p not in out:
            out.append(p)
    if not out:
        out = [generic(squad_pos, hh)]
    # Plausibilität gegen die Kaderliste des Vereins (dort steht TW/Abwehr/Mittelfeld/Sturm)
    grp = {'TW': 'GK', 'IV': 'DF', 'LV': 'DF', 'RV': 'DF', 'DM': 'MF', 'ZM': 'MF', 'OM': 'MF', 'LA': 'FW', 'RA': 'FW', 'ST': 'FW'}
    if squad_pos == 'GK': return ['TW']
    if out[0] == 'TW' and squad_pos != 'GK': out = [generic(squad_pos, hh)]
    if squad_pos in ('DF', 'MF', 'FW') and grp[out[0]] != squad_pos:
        same = [p for p in out if grp[p] == squad_pos]
        if same:
            out = same + [p for p in out if p not in same]
        elif not (squad_pos == 'MF' and out[0] in ('LA', 'RA')) and not (squad_pos == 'FW' and out[0] == 'OM') and not (squad_pos == 'DF' and out[0] == 'DM') and not (squad_pos == 'MF' and out[0] in ('LV', 'RV')):
            out = [generic(squad_pos, hh)] + out
    return out[:2]


def generic(sp, hh):
    r = hh % 100
    if sp == 'GK': return 'TW'
    if sp == 'DF': return 'IV' if r < 56 else 'LV' if r < 78 else 'RV'
    if sp == 'MF': return 'DM' if r < 24 else 'ZM' if r < 66 else 'OM' if r < 86 else 'LA' if r < 93 else 'RA'
    return 'ST' if r < 62 else 'LA' if r < 81 else 'RA'


def birth(v):
    m = re.search(r'\{\{\s*birth[ _-]?date[^|]*\|([^}]*)\}\}', v, flags=re.I)
    if m:
        nums = [x for x in re.split(r'\|', m.group(1)) if re.fullmatch(r'\s*\d+\s*', x)]
        if len(nums) >= 2:
            return int(nums[0]), int(nums[1])
        if len(nums) == 1:
            return int(nums[0]), 0
    m = re.search(r'(19[6-9]\d|20[01]\d)', v)
    return (int(m.group(1)), 0) if m else (0, 0)


def num(v):
    m = re.search(r'\d+', re.sub(r'\(.*?\)', '', v or ''))
    return int(m.group(0)) if m else 0


def features(ib, club_page, raw_len):
    f = {'apps': 0, 'cur_apps': 0, 'goals': 0, 'caps': 0, 'ucaps': 0, 'natw': 0.5, 'len': raw_len}
    for i in range(1, 30):
        c = ib.get('clubs%d' % i)
        if c is None:
            continue
        caps = num(ib.get('caps%d' % i, '')); goals = num(ib.get('goals%d' % i, ''))
        if re.search(r'\bII\b|\bB\b| U\d\d|Amateure|reserve', c):
            caps *= 0.35; goals *= 0.3
        f['apps'] += caps; f['goals'] += goals
        if 'loan' not in c.lower() and plain(c).strip() and plain(c).split('|')[0].strip() in club_page or club_page.split(' (')[0] in c:
            f['cur_apps'] = max(f['cur_apps'], caps)
    for i in range(1, 15):
        t = ib.get('national_team%d' % i) or ib.get('nationalteam%d' % i)
        if not t:
            continue
        caps = num(ib.get('national_caps%d' % i, '') or ib.get('nationalcaps%d' % i, ''))
        if re.search(r'under|U-?\d\d|olympic|youth| B\b', t, flags=re.I):
            lvl = re.search(r'(\d\d)', t)
            f['ucaps'] += caps * (1.0 if lvl and int(lvl.group(1)) >= 20 else 0.5)
        else:
            f['caps'] += caps
    return f


def prev_table(path):
    """Abschlusstabelle der Vorsaison aus dem Wikitext (Module:Sports table)"""
    if not os.path.exists(path):
        return {}
    w = open(path, encoding='utf-8').read()
    names = dict(re.findall(r'\|\s*name_([A-Za-z0-9]+)\s*=\s*\[\[([^\]|]+)', w))
    order = re.search(r'\|\s*team_order\s*=\s*([^\n|]+)', w)
    res = {}
    codes = [c.strip() for c in order.group(1).split(',')] if order else []
    stats = {}
    for code in names:
        g = lambda k: int((re.search(r'\|\s*%s_%s\s*=\s*(-?\d+)' % (k, re.escape(code)), w) or [0, 0])[1])
        wn, d, l, gf, ga = g('win'), g('draw'), g('loss'), g('gf'), g('ga')
        stats[code] = (wn * 3 + d, gf - ga, gf)
    if not codes or len(codes) < len(stats):
        codes = sorted(stats, key=lambda c: stats[c], reverse=True)
    for i, c in enumerate(codes):
        if c in names:
            res[names[c].strip()] = (i + 1, stats.get(c, (0, 0, 0))[0])
    return res


def main():
    clubs = json.load(open(os.path.join(RAW, 'clubs.json'), encoding='utf-8'))
    squads = json.load(open(os.path.join(RAW, 'squads.json'), encoding='utf-8'))
    info = json.load(gzip.open(os.path.join(RAW, 'playerraw.json.gz'), 'rt', encoding='utf-8'))
    prev = {1: prev_table(os.path.join(RAW, 'prev_2025–26_Bundesliga.txt')), 2: prev_table(os.path.join(RAW, 'prev_2025–26_2._Bundesliga.txt')), 3: prev_table(os.path.join(RAW, 'prev_2025–26_3._Liga.txt'))}
    out_clubs = []
    n_players = 0; n_est = 0
    for c in clubs:
        meta = CLUBS[c['page']]
        cid, name, short, city, col, lvl, demand, fanbonus = meta
        rows = []
        seen = set()
        for sp in squads[c['page']]:
            nm = sp['name'].strip()
            if not nm or nm in seen:
                continue
            seen.add(nm)
            pg = info.get(sp['page'] or '', None)
            ib = infobox(pg['text']) if pg and pg.get('text') else {}
            by, bm = birth(ib.get('birth_date', '')) if ib else (0, 0)
            f = features(ib, c['page'], pg['len'] if pg else 0) if ib else {'apps': 0, 'cur_apps': 0, 'goals': 0, 'caps': 0, 'ucaps': 0, 'len': 0}
            hh = h(nm)
            est = 0
            if not by:
                est = 1
                by = SEASON - (18 + hh % 6 if c['tier'] < 3 or sp['pos'] != 'GK' else 19 + hh % 8)
            if not bm:
                bm = 1 + hh % 12
            pos = parse_positions(ib.get('position', ''), sp['pos'], nm)
            nat = sp['nat'].strip().upper()
            nat = NATFIX.get(nat, COUNTRY.get(sp['nat'].strip().lower(), nat))[:3]
            age = SEASON - by
            natw = 1.0 if nat in TOP else 0.7 if nat in MID else 0.45
            fame = math.log10(max(f['len'], 1500))
            score = 0.6 * (fame - 4.0) / 0.45 + 1.1 * natw * min(1.0, math.log1p(f['caps']) / math.log(60)) + 0.5 * min(1.0, f['apps'] / 260.0) + 0.25 * min(1.0, f['ucaps'] / 25.0) + 0.3 * min(1.0, f['cur_apps'] / 60.0)
            if not ib:
                score -= 0.9
            rows.append(dict(name=nm, nat=nat, pos=pos[0], pos2=pos[1] if len(pos) > 1 else '', by=by, bm=bm, age=age, score=score, no=sp['no'] or 0, cap=1 if 'captain' in sp['other'].lower() and 'vice' not in sp['other'].lower() else 0, f=f, est=est, has=bool(ib)))
        if len(rows) > 31:  # übergroße Kader (mitgeführte Nachwuchsspieler) auf Profikader-Größe kürzen
            keep = sorted(rows, key=lambda r: -r['score'] - (5 if r['pos'] == 'TW' else 0))[:31]
            rows = [r for r in rows if r in keep]
        sc = [r['score'] for r in rows]
        mu = statistics.mean(sc); sd = statistics.pstdev(sc) or 1
        for r in rows:
            z = (r['score'] - mu) / sd
            if z > 0 and r['name'] not in STARS: z *= 0.85
            ovr = lvl + 3.3 * max(-2.2, min(2.6, z))
            a = r['age']
            ovr += -3 if a <= 18 else -2 if a == 19 else -1 if a == 20 else 0
            ovr += -1 if a == 33 else -2 if a == 34 else -3 if a == 35 else -4 if a >= 36 else 0
            if r['pos'] == 'TW' and a >= 33: ovr += 1.5
            if r['name'] in STARS: ovr = STARS[r['name']]
            ovr = int(round(max(40, min(93, ovr))))
            hh = h(r['name'] + 'pot')
            span = {16: (8, 15), 17: (7, 14), 18: (6, 12), 19: (5, 10), 20: (4, 8), 21: (3, 7), 22: (2, 5), 23: (1, 4), 24: (0, 2), 25: (0, 1)}.get(max(16, a), (0, 1) if a < 28 else (0, 0))
            pot = ovr + span[0] + (hh % (span[1] - span[0] + 1)) + (2 if r['f']['ucaps'] >= 10 and a <= 22 else 0) + (2 if r['f']['caps'] >= 3 and a <= 22 else 0)
            pot = int(min(95, max(ovr, pot)))
            r['ovr'] = ovr; r['pot'] = pot
            n_players += 1; n_est += r['est']
        # Torwart-Hierarchie absichern: genau eine klare Nummer 1
        rows.sort(key=lambda r: (['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'].index(r['pos']), -r['ovr']))
        top = sorted(rows, key=lambda r: -r['ovr'])[:14]
        lvl14 = sum(r['ovr'] * (1 if i < 11 else 0.4) for i, r in enumerate(top)) / (11 + 1.2)
        tier = c['tier']
        rep = int(round(max(25, min(99, 2.36 * lvl14 - 106 + {1: 0, 2: -2, 3: -4}[tier] + fanbonus))))
        lp = None; lt = tier
        for t in (1, 2, 3):
            if c['page'] in prev[t]:
                lp = prev[t][c['page']][0]; lt = t
        cap = c['cap']
        fanbase = 1500 if cid in RESERVES else int(round(cap * demand / 100.0) * 100)
        stadium = c['stadium']
        out_clubs.append(dict(id=cid, name=name, short=short, city=city, stadium=stadium, cap=cap, tier=tier, coach=c.get('coach') or '', col=col, rep=rep, fanbase=fanbase,
                              lastPos=lp or (16 if tier == 1 else 9), lastTier=lt, reserve=1 if cid in RESERVES else 0, lvl=round(lvl14, 1), rb=fanbonus,
                              p=[[r['name'], r['nat'], r['pos'], r['pos2'], r['by'], r['bm'], r['ovr'], r['pot'], r['no'], r['cap']] for r in rows]))
    am = [dict(id=a[0], name=a[1], short=a[2], city=a[3], stadium=a[4], cap=a[5], col=a[6], lvl=a[7], rep=a[8], fanbase=int(a[5] * 0.25)) for a in AMATEURS]
    db = dict(season=SEASON, built=datetime.date.today().isoformat(), source='Kader, Trainer, Stadien: englischsprachige Wikipedia (CC BY-SA 4.0). Spielstärken: eigene Schätzung.',
              players=n_players, estimatedBirth=n_est, clubs=out_clubs, amateurs=am)
    js = '/* FLUTLICHT · Datenbank Saison %d/%02d – automatisch erzeugt von tools/build_data.py am %s.\n   Kader/Trainer/Stadien: Wikipedia (CC BY-SA 4.0). Spielstärken sind Schätzwerte, keine offiziellen Daten. */\n' % (SEASON, (SEASON + 1) % 100, db['built'])
    js += '(function (root) { (root.FM = root.FM || {}).DB = ' + json.dumps(db, ensure_ascii=False, separators=(',', ':')) + '; })(typeof globalThis !== \'undefined\' ? globalThis : this);\n'
    open(OUT, 'w', encoding='utf-8').write(js)
    print('clubs', len(out_clubs), 'players', n_players, 'birth estimated', n_est, 'bytes', len(js.encode()))
    for c in out_clubs:
        best = sorted(c['p'], key=lambda r: -r[6])[:3]
        print('%d %-26s lvl %.1f rep %2d last %s/%s n=%2d  %s' % (c['tier'], c['short'], c['lvl'], c['rep'], c['lastTier'], c['lastPos'], len(c['p']), ', '.join('%s %d' % (b[0], b[6]) for b in best)))


if __name__ == '__main__':
    main()
