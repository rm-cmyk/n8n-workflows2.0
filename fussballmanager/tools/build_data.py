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
    'Borussia Dortmund': ('BVB', 'Borussia Dortmund', 'Dortmund', 'Dortmund', ['#fde100', '#000000'], 78.5, 1.3, 2),
    'Bayer 04 Leverkusen': ('B04', 'Bayer 04 Leverkusen', 'Leverkusen', 'Leverkusen', ['#e32221', '#000000'], 76.5, 1.05, 0),
    'RB Leipzig': ('RBL', 'RB Leipzig', 'Leipzig', 'Leipzig', ['#ffffff', '#dd0741'], 77.5, 0.98, 0),
    'VfB Stuttgart': ('VFB', 'VfB Stuttgart', 'Stuttgart', 'Stuttgart', ['#ffffff', '#e32219'], 77.0, 1.1, 1),
    'Eintracht Frankfurt': ('SGE', 'Eintracht Frankfurt', 'Frankfurt', 'Frankfurt am Main', ['#000000', '#e1000f'], 75.5, 1.2, 1),
    'SC Freiburg': ('SCF', 'SC Freiburg', 'Freiburg', 'Freiburg im Breisgau', ['#e2001a', '#000000'], 74.5, 1.15, 0),
    'TSG 1899 Hoffenheim': ('TSG', 'TSG 1899 Hoffenheim', 'Hoffenheim', 'Sinsheim', ['#1961b5', '#ffffff'], 76.0, 0.85, -2),
    '1. FSV Mainz 05': ('M05', '1. FSV Mainz 05', 'Mainz', 'Mainz', ['#c3141e', '#ffffff'], 73.0, 0.92, 0),
    'Borussia Mönchengladbach': ('BMG', 'Borussia Mönchengladbach', 'M\'gladbach', 'Mönchengladbach', ['#ffffff', '#000000'], 72.5, 0.98, 2),
    'SV Werder Bremen': ('SVW', 'SV Werder Bremen', 'Bremen', 'Bremen', ['#1d9053', '#ffffff'], 72.0, 1.05, 2),
    '1. FC Union Berlin': ('FCU', '1. FC Union Berlin', 'Union Berlin', 'Berlin', ['#eb1923', '#ffffff'], 72.5, 1.6, 0),
    'FC Augsburg': ('FCA', 'FC Augsburg', 'Augsburg', 'Augsburg', ['#ba3733', '#ffffff'], 73.0, 0.97, 0),
    '1. FC Köln': ('KOE', '1. FC Köln', 'Köln', 'Köln', ['#ffffff', '#ed1c24'], 72.0, 1.2, 3),
    'Hamburger SV': ('HSV', 'Hamburger SV', 'Hamburg', 'Hamburg', ['#ffffff', '#0a3a8a'], 72.0, 1.1, 4),
    'FC Schalke 04': ('S04', 'FC Schalke 04', 'Schalke', 'Gelsenkirchen', ['#004d9d', '#ffffff'], 70.5, 1.15, 5),
    'SC Paderborn 07': ('SCP', 'SC Paderborn 07', 'Paderborn', 'Paderborn', ['#005ba9', '#000000'], 69.0, 0.95, -1),
    'SV Elversberg': ('SVE', 'SV Elversberg', 'Elversberg', 'Spiesen-Elversberg', ['#000000', '#ffffff'], 69.0, 0.95, -2),
    'VfL Wolfsburg': ('WOB', 'VfL Wolfsburg', 'Wolfsburg', 'Wolfsburg', ['#65b32e', '#ffffff'], 71.0, 0.8, 0),
    '1. FC Heidenheim': ('FCH', '1. FC Heidenheim 1846', 'Heidenheim', 'Heidenheim an der Brenz', ['#e2001a', '#003b79'], 68.5, 1.0, 0),
    'FC St. Pauli': ('STP', 'FC St. Pauli', 'St. Pauli', 'Hamburg', ['#6d4c33', '#ffffff'], 69.0, 1.3, 2),
    'Hertha BSC': ('BSC', 'Hertha BSC', 'Hertha', 'Berlin', ['#005ca9', '#ffffff'], 68.0, 0.7, 3),
    'Hannover 96': ('H96', 'Hannover 96', 'Hannover', 'Hannover', ['#1c9a3c', '#000000'], 68.5, 0.78, 2),
    'VfL Bochum': ('BOC', 'VfL Bochum 1848', 'Bochum', 'Bochum', ['#005ca9', '#ffffff'], 67.0, 1.0, 1),
    '1. FC Kaiserslautern': ('FCK', '1. FC Kaiserslautern', 'K\'lautern', 'Kaiserslautern', ['#d5001c', '#ffffff'], 67.5, 0.9, 3),
    '1. FC Nürnberg': ('FCN', '1. FC Nürnberg', 'Nürnberg', 'Nürnberg', ['#ad1732', '#000000'], 67.0, 0.75, 3),
    'SV Darmstadt 98': ('D98', 'SV Darmstadt 98', 'Darmstadt', 'Darmstadt', ['#004e9e', '#ffffff'], 67.5, 0.95, 0),
    'Karlsruher SC': ('KSC', 'Karlsruher SC', 'Karlsruhe', 'Karlsruhe', ['#003d7c', '#ffffff'], 66.5, 0.85, 1),
    'Holstein Kiel': ('KSV', 'Holstein Kiel', 'Kiel', 'Kiel', ['#0057a3', '#ffffff'], 66.5, 0.95, 0),
    '1. FC Magdeburg': ('FCM', '1. FC Magdeburg', 'Magdeburg', 'Magdeburg', ['#0067b1', '#ffffff'], 66.0, 0.85, 1),
    'SpVgg Greuther Fürth': ('SGF', 'SpVgg Greuther Fürth', 'Fürth', 'Fürth', ['#009932', '#ffffff'], 65.5, 0.75, 0),
    'Arminia Bielefeld': ('DSC', 'DSC Arminia Bielefeld', 'Bielefeld', 'Bielefeld', ['#004e95', '#000000'], 66.0, 0.9, 1),
    'Dynamo Dresden': ('SGD', 'SG Dynamo Dresden', 'Dresden', 'Dresden', ['#ffdd00', '#000000'], 66.0, 0.95, 3),
    'Eintracht Braunschweig': ('EBS', 'Eintracht Braunschweig', 'Braunschweig', 'Braunschweig', ['#fdd204', '#00589b'], 65.5, 0.9, 1),
    'FC Energie Cottbus': ('FCE', 'FC Energie Cottbus', 'Cottbus', 'Cottbus', ['#e2001a', '#ffffff'], 64.5, 0.6, 1),
    'VfL Osnabrück': ('OSN', 'VfL Osnabrück', 'Osnabrück', 'Osnabrück', ['#6b2c91', '#ffffff'], 65.0, 0.98, 1),
    'Fortuna Düsseldorf': ('F95', 'Fortuna Düsseldorf', 'Düsseldorf', 'Düsseldorf', ['#e30613', '#ffffff'], 65.0, 0.62, 4),
    'SC Preußen Münster': ('SCM', 'SC Preußen Münster', 'Münster', 'Münster', ['#00693e', '#000000'], 64.0, 0.8, 1),
    'FC Hansa Rostock': ('FCR', 'F.C. Hansa Rostock', 'Rostock', 'Rostock', ['#0080c8', '#ffffff'], 63.5, 0.85, 3),
    'Rot-Weiss Essen': ('RWE', 'Rot-Weiss Essen', 'Essen', 'Essen', ['#e2001a', '#ffffff'], 63.5, 0.9, 3),
    'MSV Duisburg': ('MSV', 'MSV Duisburg', 'Duisburg', 'Duisburg', ['#004c93', '#ffffff'], 63.0, 0.62, 3),
    '1. FC Saarbrücken': ('FCS', '1. FC Saarbrücken', 'Saarbrücken', 'Saarbrücken', ['#0f4c92', '#000000'], 62.0, 0.7, 2),
    'FC Ingolstadt 04': ('FCI', 'FC Ingolstadt 04', 'Ingolstadt', 'Ingolstadt', ['#c8102e', '#000000'], 62.5, 0.4, 0),
    'SSV Jahn Regensburg': ('SSV', 'SSV Jahn Regensburg', 'Regensburg', 'Regensburg', ['#e2001a', '#ffffff'], 62.5, 0.55, 0),
    'SV Waldhof Mannheim': ('SVW07', 'SV Waldhof Mannheim', 'Mannheim', 'Mannheim', ['#0a3d7a', '#000000'], 62.5, 0.5, 2),
    'Alemannia Aachen': ('AAC', 'Alemannia Aachen', 'Aachen', 'Aachen', ['#fdd400', '#000000'], 62.5, 0.75, 3),
    'SV Wehen Wiesbaden': ('SVWW', 'SV Wehen Wiesbaden', 'Wiesbaden', 'Wiesbaden', ['#e2001a', '#000000'], 62.5, 0.3, -1),
    'FC Viktoria Köln': ('VIK', 'FC Viktoria Köln', 'Viktoria Köln', 'Köln', ['#e2001a', '#000000'], 62.0, 0.4, -1),
    'SC Verl': ('SCV', 'SC Verl', 'Verl', 'Verl', ['#000000', '#ffffff'], 62.5, 0.5, -2),
    'TSG 1899 Hoffenheim II': ('TSG2', 'TSG 1899 Hoffenheim II', 'Hoffenheim II', 'Sinsheim', ['#1961b5', '#ffffff'], 61.5, 0.2, -4),
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
    amb = set()
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
        elif 'midfielder' in t: p = generic('MF', hh); amb.add(p)
        elif 'defender' in t: p = generic('DF', hh); amb.add(p)
        elif 'forward' in t: p = generic('FW', hh); amb.add(p)
        if p and p not in out:
            out.append(p)
    if not out:
        out = [generic(squad_pos, hh)]; amb.add(out[0])
    # Plausibilität gegen die Kaderliste des Vereins (dort steht TW/Abwehr/Mittelfeld/Sturm)
    grp = {'TW': 'GK', 'IV': 'DF', 'LV': 'DF', 'RV': 'DF', 'DM': 'MF', 'ZM': 'MF', 'OM': 'MF', 'LA': 'FW', 'RA': 'FW', 'ST': 'FW'}
    if squad_pos == 'GK': return ['TW'], False
    if out[0] == 'TW': out = [generic(squad_pos, hh)]; amb.add(out[0])
    first = grp[out[0]]
    prefer = None
    if squad_pos == 'DF' and first != 'DF' and out[0] != 'DM': prefer = 'DF'
    elif squad_pos == 'FW' and out[0] in ('IV', 'LV', 'RV', 'DM', 'ZM'): prefer = 'FW'
    elif squad_pos == 'MF' and out[0] in ('IV', 'ST'): prefer = 'MF'
    if prefer:
        same = [p for p in out if grp[p] == prefer]
        if same: out = same + [p for p in out if p not in same]
        else:
            g = generic(prefer, hh); amb.add(g); out = [g] + out
    return out[:2], out[0] in amb


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
    """Abschlusstabelle der Vorsaison, berechnet aus der Ergebnismatrix im Wikitext (Module:Sports results)"""
    if not os.path.exists(path):
        return {}
    w = open(path, encoding='utf-8').read()
    names = {}
    for code, val in re.findall(r'\|\s*name_(\w+)\s*=\s*([^\n]+)', w):
        m = re.search(r'\[\[([^\]|]+)', val)
        names[code] = (m.group(1) if m else val).strip()
    st = {c: [0, 0, 0] for c in names}
    for h_, a_, hg, ag in re.findall(r'\|\s*match_(\w+?)_(\w+?)\s*=\s*(\d+)\s*[–-]\s*(\d+)', w):
        if h_ not in st or a_ not in st:
            continue
        hg = int(hg); ag = int(ag)
        st[h_][1] += hg - ag; st[a_][1] += ag - hg; st[h_][2] += hg; st[a_][2] += ag
        if hg > ag: st[h_][0] += 3
        elif hg < ag: st[a_][0] += 3
        else: st[h_][0] += 1; st[a_][0] += 1
    order = sorted(st, key=lambda c: tuple(st[c]), reverse=True)
    return {names[c]: (i + 1, st[c][0]) for i, c in enumerate(order)}


# ---------------------------------------------------------------------------------------------------------
# Europapokal: ausländische Klubs. Niveau (Stärke der ersten Elf) von Hand gesetzt, orientiert an
# UEFA-Koeffizient und Liga. Schlüssel = Name in den Wikipedia-Teilnehmerlisten.
INTL_LVL = {
    'Paris Saint-Germain': 87.0, 'Real Madrid': 87.0, 'Liverpool': 86.0, 'Inter Milan': 84.5, 'Manchester City': 86.0, 'Arsenal': 86.5, 'Barcelona': 87.0,
    'Atlético Madrid': 83.5, 'Roma': 80.5, 'Sporting CP': 80.0, 'Aston Villa': 81.5, 'Porto': 79.5, 'Manchester United': 81.5, 'Club Brugge': 77.5, 'Real Betis': 79.5,
    'PSV Eindhoven': 78.5, 'Feyenoord': 77.5, 'Lille': 78.5, 'Bodø/Glimt': 75.0, 'Napoli': 83.0, 'Villarreal': 80.5, 'Fenerbahçe': 78.5, 'Shakhtar Donetsk': 76.0,
    'Galatasaray': 79.5, 'Slavia Prague': 75.5, 'Slovan Bratislava': 71.0, 'AEK Athens': 74.5, 'LASK': 71.5, 'Como': 78.0, 'Lens': 77.5, 'Viking': 70.5, 'Sabah': 69.0,
    'Benfica': 80.5, 'Juventus': 82.5, 'Milan': 82.5, 'Lyon': 78.5, 'AZ': 75.5, 'Olympiacos': 76.5, 'Real Sociedad': 79.0, 'Marseille': 80.0, 'Ferencváros': 73.0,
    'Viktoria Plzeň': 73.0, 'Union Saint-Gilloise': 76.0, 'Dinamo Zagreb': 74.5, 'Red Bull Salzburg': 75.0, 'Celtic': 75.5, 'Sparta Prague': 74.5, 'Rennes': 77.0,
    'Anderlecht': 74.5, 'Sturm Graz': 73.0, 'Lech Poznań': 72.5, 'Crystal Palace': 79.5, 'Bournemouth': 79.5, 'Sunderland': 77.0, 'Celje': 69.5, 'Jagiellonia Białystok': 71.0,
    'Omonia': 70.0, 'Celta Vigo': 78.0, 'Beşiktaş': 77.0, 'Torreense': 68.0, "Hapoel Be'er Sheva": 70.5, 'NEC': 73.5, 'OFI': 69.5, 'Lillestrøm': 69.0, 'Levski Sofia': 70.0,
    'Ararat-Armenia': 67.0, 'Atalanta': 81.5, 'Braga': 77.0, 'Ajax': 77.5, 'Monaco': 79.5, 'Copenhagen': 75.0, 'Midtjylland': 74.5, 'Red Star Belgrade': 74.5, 'Gent': 73.5,
    'Panathinaikos': 75.0, 'Pafos': 71.5, 'Brighton & Hove Albion': 80.0, 'Lugano': 71.0, 'Getafe': 76.0, 'KuPS': 66.5, 'Twente': 75.0, 'Lincoln Red Imps': 60.0,
    'Borac Banja Luka': 66.0, 'Sint-Truiden': 71.0, 'Brann': 71.5, 'Heart of Midlothian': 71.5, 'Kairat': 68.0, 'Trabzonspor': 75.5, 'Universitatea Craiova': 70.5,
    'Riga': 67.5, 'Hajduk Split': 71.5, 'Jablonec': 70.0, 'Nordsjælland': 72.5, 'AGF': 71.5, "Inter Club d'Escaldes": 58.0, 'Thun': 69.0, 'CSKA Sofia': 69.0,
    'Kauno Žalgiris': 64.5, 'Mjällby AIF': 69.5, 'Iberia 1999': 64.0, 'Egnatia': 63.0,
}
# deutsche Schreibweisen: Listenname -> (Name, Kurzname)
INTL_NAME = {
    'Inter Milan': ('Inter Mailand', 'Inter'), 'Milan': ('AC Mailand', 'Milan'), 'Roma': ('AS Rom', 'AS Rom'), 'Napoli': ('SSC Neapel', 'Neapel'), 'Sporting CP': ('Sporting Lissabon', 'Sporting'),
    'Benfica': ('Benfica Lissabon', 'Benfica'), 'Porto': ('FC Porto', 'Porto'), 'Braga': ('Sporting Braga', 'Braga'), 'Red Star Belgrade': ('Roter Stern Belgrad', 'Roter Stern'),
    'Copenhagen': ('FC Kopenhagen', 'Kopenhagen'), 'Slavia Prague': ('Slavia Prag', 'Slavia Prag'), 'Sparta Prague': ('Sparta Prag', 'Sparta Prag'), 'Viktoria Plzeň': ('Viktoria Pilsen', 'Pilsen'),
    'AEK Athens': ('AEK Athen', 'AEK Athen'), 'Olympiacos': ('Olympiakos Piräus', 'Olympiakos'), 'Panathinaikos': ('Panathinaikos Athen', 'Panathinaikos'), 'Shakhtar Donetsk': ('Schachtar Donezk', 'Donezk'),
    'Club Brugge': ('FC Brügge', 'Brügge'), 'Lyon': ('Olympique Lyon', 'Lyon'), 'Marseille': ('Olympique Marseille', 'Marseille'), 'Monaco': ('AS Monaco', 'Monaco'), 'Lille': ('OSC Lille', 'Lille'),
    'Lens': ('RC Lens', 'Lens'), 'Rennes': ('Stade Rennes', 'Rennes'), 'Paris Saint-Germain': ('Paris Saint-Germain', 'Paris SG'), 'Atalanta': ('Atalanta Bergamo', 'Atalanta'),
    'Juventus': ('Juventus Turin', 'Juventus'), 'Barcelona': ('FC Barcelona', 'Barcelona'), 'Liverpool': ('FC Liverpool', 'Liverpool'), 'Arsenal': ('FC Arsenal', 'Arsenal'),
    'Ajax': ('Ajax Amsterdam', 'Ajax'), 'Feyenoord': ('Feyenoord Rotterdam', 'Feyenoord'), 'Twente': ('FC Twente', 'Twente'), 'Celtic': ('Celtic Glasgow', 'Celtic'),
    'Heart of Midlothian': ('Heart of Midlothian', 'Hearts'), 'Lech Poznań': ('Lech Posen', 'Lech Posen'), 'Jagiellonia Białystok': ('Jagiellonia Białystok', 'Jagiellonia'),
    'Universitatea Craiova': ('Universitatea Craiova', 'Craiova'), 'Red Bull Salzburg': ('RB Salzburg', 'Salzburg'), 'Sturm Graz': ('SK Sturm Graz', 'Sturm Graz'), 'Lugano': ('FC Lugano', 'Lugano'),
    'Thun': ('FC Thun', 'Thun'), 'Gent': ('KAA Gent', 'Gent'), 'Anderlecht': ('RSC Anderlecht', 'Anderlecht'), 'Midtjylland': ('FC Midtjylland', 'Midtjylland'), 'Nordsjælland': ('FC Nordsjælland', 'Nordsjælland'),
    'AGF': ('AGF Aarhus', 'Aarhus'), 'Brann': ('Brann Bergen', 'Brann'), 'Viking': ('Viking Stavanger', 'Viking'), 'Bodø/Glimt': ('FK Bodø/Glimt', 'Bodø/Glimt'), 'Villarreal': ('FC Villarreal', 'Villarreal'),
    'Getafe': ('FC Getafe', 'Getafe'), 'Real Betis': ('Betis Sevilla', 'Betis'), 'Real Sociedad': ('Real Sociedad San Sebastián', 'Real Sociedad'), 'Fenerbahçe': ('Fenerbahçe Istanbul', 'Fenerbahçe'),
    'Galatasaray': ('Galatasaray Istanbul', 'Galatasaray'), 'Beşiktaş': ('Beşiktaş Istanbul', 'Beşiktaş'), 'Ferencváros': ('Ferencváros Budapest', 'Ferencváros'), 'Sabah': ('Sabah Baku', 'Sabah Baku'),
    'Omonia': ('Omonia Nikosia', 'Omonia'), 'Pafos': ('Pafos FC', 'Pafos'), 'Celje': ('NK Celje', 'Celje'), 'Kairat': ('Kairat Almaty', 'Kairat'), 'Riga': ('Riga FC', 'Riga'), 'Jablonec': ('FK Jablonec', 'Jablonec'),
    'Levski Sofia': ('Lewski Sofia', 'Lewski Sofia'), 'CSKA Sofia': ('ZSKA Sofia', 'ZSKA Sofia'), 'Egnatia': ('KF Egnatia', 'Egnatia'), 'Iberia 1999': ('Iberia 1999 Tiflis', 'Iberia 1999'),
    'KuPS': ('KuPS Kuopio', 'KuPS'), 'Mjällby AIF': ('Mjällby AIF', 'Mjällby'), 'Kauno Žalgiris': ('Kauno Žalgiris', 'Kaunas'), 'Lincoln Red Imps': ('Lincoln Red Imps', 'Lincoln'),
    'Borac Banja Luka': ('Borac Banja Luka', 'Banja Luka'), 'Sint-Truiden': ('VV St. Truiden', 'St. Truiden'), 'Torreense': ('SCU Torreense', 'Torreense'), 'NEC': ('NEC Nijmegen', 'Nijmegen'),
    'OFI': ('OFI Kreta', 'OFI Kreta'), 'Lillestrøm': ('Lillestrøm SK', 'Lillestrøm'), "Hapoel Be'er Sheva": ("Hapoel Be'er Sheva", "Be'er Sheva"), 'AZ': ('AZ Alkmaar', 'Alkmaar'),
    'Brighton & Hove Albion': ('Brighton & Hove Albion', 'Brighton'), 'Bournemouth': ('AFC Bournemouth', 'Bournemouth'), 'Sunderland': ('AFC Sunderland', 'Sunderland'),
    'Manchester City': ('Manchester City', 'Man City'), 'Manchester United': ('Manchester United', 'Man United'), 'Atlético Madrid': ('Atlético Madrid', 'Atlético'), 'Como': ('Como 1907', 'Como'),
    "Inter Club d'Escaldes": ('Inter Escaldes', 'Escaldes'), 'Union Saint-Gilloise': ('Union Saint-Gilloise', 'Union SG'), 'PSV Eindhoven': ('PSV Eindhoven', 'Eindhoven'),
    'Slovan Bratislava': ('Slovan Bratislava', 'Bratislava'), 'Dinamo Zagreb': ('Dinamo Zagreb', 'Zagreb'), 'Crystal Palace': ('Crystal Palace', 'Crystal Palace'), 'Ararat-Armenia': ('Ararat-Armenia', 'Ararat'),
}
# Handjustierte Stärken internationaler Spieler (gilt unabhängig vom aktuellen Klub)
STARS_INTL = {
    'Kylian Mbappé': 92, 'Erling Haaland': 92, 'Lamine Yamal': 92, 'Vinícius Júnior': 90, 'Jude Bellingham': 90, 'Pedri': 90, 'Ousmane Dembélé': 90, 'Rodri': 89, 'Florian Wirtz': 89,
    'Vitinha': 89, 'Bukayo Saka': 89, 'Federico Valverde': 89, 'Lautaro Martínez': 89, 'Thibaut Courtois': 89, 'Raphinha': 88, 'Mohamed Salah': 87, 'Alexander Isak': 88, 'Declan Rice': 88,
    'Khvicha Kvaratskhelia': 88, 'Gianluigi Donnarumma': 88, 'Alisson Becker': 88, 'Virgil van Dijk': 87, 'William Saliba': 88, 'Julián Álvarez': 88, 'Nuno Mendes': 88, 'João Neves': 88,
    'Désiré Doué': 88, 'Achraf Hakimi': 87, 'Martin Ødegaard': 87, 'Gabriel Magalhães': 87, 'Nicolò Barella': 87, 'Alessandro Bastoni': 87, 'Frenkie de Jong': 87, 'Phil Foden': 86,
    'Alexis Mac Allister': 87, 'Bruno Fernandes': 87, 'Viktor Gyökeres': 87, 'Victor Osimhen': 87, 'Mike Maignan': 87, 'Jan Oblak': 86, 'Aurélien Tchouaméni': 86, 'Rodrygo': 86, 'Pau Cubarsí': 86,
    'Jules Koundé': 86, 'Dani Olmo': 86, 'Joško Gvardiol': 86, 'Rúben Dias': 86, 'Dominik Szoboszlai': 86, 'Ryan Gravenberch': 86, 'Emiliano Martínez': 86, 'David Raya': 86, 'Martín Zubimendi': 86,
    'Marquinhos': 86, 'Willian Pacho': 86, 'Fabián Ruiz': 86, 'Bradley Barcola': 86, 'Dean Huijsen': 86, 'Trent Alexander-Arnold': 86, 'Joan García': 86, 'Scott McTominay': 86, 'Marcus Thuram': 86,
    'Rafael Leão': 86, 'Diogo Costa': 86, 'Antonio Rüdiger': 84, 'Eduardo Camavinga': 85, 'Arda Güler': 85, 'Robert Lewandowski': 84, 'Marc-André ter Stegen': 84, 'Kevin De Bruyne': 85,
    'Bernardo Silva': 85, 'Omar Marmoush': 85, 'Tijjani Reijnders': 85, 'Rayan Cherki': 85, 'Ederson': 85, 'Ibrahima Konaté': 85, 'Hugo Ekitike': 85, 'Cody Gakpo': 85, 'Eberechi Eze': 85,
    'Hakan Çalhanoğlu': 85, 'Federico Dimarco': 85, 'Warren Zaïre-Emery': 85, 'Lucas Chevalier': 85, 'Éder Militão': 85, 'Kenan Yıldız': 85, 'Gleison Bremer': 85, 'Bremer': 85, 'Christian Pulisic': 85,
    'Ademola Lookman': 85, 'Éderson': 85, 'Jérémy Doku': 85, 'Marc Guéhi': 85, 'Gavi': 84, 'Ronald Araújo': 84, 'Fermín López': 84, 'Alejandro Balde': 84, 'Ferran Torres': 84, 'Marcus Rashford': 84,
    'Jeremie Frimpong': 84, 'Giorgi Mamardashvili': 84, 'Bryan Mbeumo': 84, 'Matheus Cunha': 84, 'Ollie Watkins': 84, 'Kai Havertz': 84, 'Jurriën Timber': 84, 'Mikel Merino': 84,
    'Paulo Dybala': 83, 'Mile Svilar': 84, 'Stanislav Lobotka': 84, 'Denzel Dumfries': 84, 'Yann Sommer': 83, 'Manuel Akanji': 84, 'Álex Baena': 84, 'Pablo Barrios': 84, 'Dávid Hancko': 84,
    'Morten Hjulmand': 84, 'Mason Greenwood': 84, 'Mikel Oyarzabal': 84, 'Antoine Semenyo': 84, 'Illia Zabarnyi': 84, 'Álvaro Carreras': 84, 'Franco Mastantuono': 84, 'Marc Cucurella': 84,
    'Antoine Griezmann': 82, 'Luka Modrić': 82, 'Adrien Rabiot': 83, 'Leroy Sané': 83, 'Romelu Lukaku': 82, 'André-Frank Zambo Anguissa': 83, 'Alessandro Buongiorno': 83, 'Marcos Llorente': 83,
    'Robin Le Normand': 83, 'José María Giménez': 83, 'Thiago Almada': 83, 'Dušan Vlahović': 83, 'Vangelis Pavlidis': 83, 'Francisco Trincão': 83, 'Pedro Gonçalves': 83, 'Charles De Ketelaere': 83,
    'Marco Carnesecchi': 83, 'Kaoru Mitoma': 83, 'Jean-Philippe Mateta': 83, 'Adam Wharton': 83, 'Takefusa Kubo': 83, 'Álex Remiro': 83, 'Matthijs de Ligt': 83, 'Lisandro Martínez': 83,
    'Amad Diallo': 83, 'Benjamin Šeško': 83, 'Morgan Rogers': 83, 'Youri Tielemans': 83, 'Ezri Konsa': 83, 'Gabriel Martinelli': 83, 'Leandro Trossard': 83, 'Riccardo Calafiori': 83,
    'Evan Ndicka': 83, 'Manu Koné': 83, 'Jonathan David': 83, 'Brahim Díaz': 83, 'Dani Carvajal': 83, 'Gonçalo Ramos': 83, 'Savinho': 83, 'Milan Škriniar': 82, 'Marco Asensio': 82,
    'Lucas Torreira': 81, 'Barış Alper Yılmaz': 81, 'Kerem Aktürkoğlu': 81, 'Maghnes Akliouche': 82, 'Denis Zakaria': 82, 'Carlos Baleba': 82, 'Ismaïla Sarr': 82, 'Dean Henderson': 82,
    'Daniel Muñoz': 82, 'Georges Mikautadze': 82, 'Samu Aghehowa': 82, 'Samu Omorodion': 82, 'Ousmane Diomande': 82, 'Gonçalo Inácio': 82, 'Anatoliy Trubin': 82, 'Pierre-Emile Højbjerg': 82,
    'Gerónimo Rulli': 82, 'Manuel Locatelli': 82, 'Francisco Conceição': 82, 'Pierre Kalulu': 82, 'Michele Di Gregorio': 82, 'Youssouf Fofana': 82, 'Christopher Nkunku': 82, 'Isco': 82,
    'Gianluca Mancini': 82, 'Amir Rrahmani': 82, 'Alex Meret': 82, 'Giovanni Di Lorenzo': 82, 'Leny Yoro': 82, 'Diogo Dalot': 82, 'Casemiro': 82, 'Boubacar Kamara': 82, 'Ethan Nwaneri': 82,
    'Noni Madueke': 82, 'Curtis Jones': 82, 'Milos Kerkez': 82, 'Andrew Robertson': 81, 'Rayan Aït-Nouri': 82, "Nico O'Reilly": 82, 'Eric García': 82, 'Marc Casadó': 82, 'Endrick': 82,
    'Alexander Sørloth': 82, 'Conor Gallagher': 81, 'Khéphren Thuram': 82, 'Andrea Cambiaso': 82, 'Rasmus Højlund': 81, 'Kobbie Mainoo': 81, 'Conor Bradley': 81, 'Myles Lewis-Skelly': 81,
    'Cristhian Mosquera': 81, 'Abdukodir Khusanov': 81, 'Senne Lammens': 80, 'Patrick Dorgu': 80, 'Mason Mount': 80, 'Manuel Ugarte': 80, 'Matty Cash': 81, 'Amadou Onana': 81, 'John McGinn': 81,
    'Bryan Cristante': 81, 'Matías Soulé': 81, 'Lorenzo Pellegrini': 80, 'Lois Openda': 81, 'Alexis Saelemaekers': 81, 'Matteo Gabbia': 81, 'Strahinja Pavlović': 81,
    'Samuele Ricci': 81, 'Fredrik Aursnes': 81, 'Nicolás Otamendi': 80, 'Leonardo Balerdi': 81, 'Corentin Tolisso': 81, 'Granit Xhaka': 81, 'Justin Kluivert': 81, 'Evanilson': 81,
    'Bart Verbruggen': 81, 'Yankuba Minteh': 80, 'Jerdy Schouten': 81, 'Guus Til': 80, 'Ayase Ueda': 80, 'Quinten Timber': 81, 'Victor Froholdt': 80, 'Rodrigo Mora': 81, 'Iago Aspas': 79,
    'Aleksandr Golovin': 81, 'Youssef En-Nesyri': 80, 'Anderson Talisca': 80, 'Mauro Icardi': 80, 'İlkay Gündoğan': 80, 'Gianluca Scamacca': 81, 'Raúl Asencio': 81, 'Marc Bernal': 81,
    'Wojciech Szczęsny': 80, 'Johnny Cardoso': 81, 'Giovanni Reyna': 77, 'Nico Paz': 84, 'Assane Diao': 80, 'Máximo Perrone': 79,
    'Julián Alvarez': 88, 'Eric Garcia': 82, 'João Cancelo': 83, 'Mateo Kovačić': 83, 'Jack Grealish': 82, 'John Stones': 83, 'Piotr Zieliński': 81, 'Fikayo Tomori': 82,
    'Tammy Abraham': 80, 'Kepa Arrizabalaga': 81, 'Ben White': 83, 'Andreas Christensen': 82, 'Dominik Livaković': 81, 'Gabriel Jesus': 82, 'Anthony Gordon': 84,
    'Lucas Hernandez': 83, 'Lucas Digne': 80, 'Matvey Safonov': 82, 'Lucas Beraldo': 81, 'João Palhinha': 83, 'Franck Kessié': 81, 'Arkadiusz Milik': 77, 'Billy Gilmour': 80,
    'Noa Lang': 81, 'Mathías Olivera': 80, "N'Golo Kanté": 80, 'Mattéo Guendouzi': 81, 'Nathan Aké': 82, 'Nélson Semedo': 79, 'Douglas Luiz': 81, 'Federico Gatti': 81,
    'Victor Lindelöf': 78, 'Ross Barkley': 78, 'Tyrone Mings': 79, 'Pau Torres': 82, 'Giacomo Raspadori': 81, 'Evan Ferguson': 79, 'Ferdi Kadıoğlu': 81, 'Folarin Balogun': 81,
    'Ansu Fati': 79, 'Emerson Palmieri': 79, 'Geoffrey Kondogbia': 79, 'Amine Gouiri': 81, 'Igor Paixão': 81, 'Angel Gomes': 80, 'Olivier Giroud': 77, 'Dani Ceballos': 81,
    'Giovanni Lo Celso': 81, 'Antony': 82, 'Nicolas Pépé': 80, 'Juan Foyth': 80, 'Pape Gueye': 81, 'André Silva': 78, 'Thorgan Hazard': 76, 'Mika Godts': 81,
}

EU_CODES = {'CL': 'Champions League', 'EL': 'Europa League', 'ECL': 'Conference League'}


def gaussish(name):
    """deterministischer, grob normalverteilter Wert aus dem Namen (für Spieler ohne Artikeldaten)"""
    hh = h(name + '|q')
    return (sum((hh >> (8 * i)) & 255 for i in range(4)) / 255.0 - 2.0) * 1.7


def lvl14_of(rows):
    top = sorted(rows, key=lambda r: -r['ovr'])[:14]
    return sum(r['ovr'] * (1 if i < 11 else 0.4) for i, r in enumerate(top)) / (11 + 1.2)


def balance(rows):
    def cnt(p): return sum(1 for r in rows if r['pos'] == p)
    def conv(frm, to, need):
        for r in sorted(rows, key=lambda r: -r['score']):
            if cnt(to) >= need: break
            if r['amb'] and r['pos'] in frm and cnt(r['pos']) > 1: r['pos'] = to; r['pos2'] = ''
    conv(('LA', 'RA'), 'ST', 3)
    conv(('IV', 'RV'), 'LV', 2); conv(('IV', 'LV'), 'RV', 2); conv(('LV', 'RV'), 'IV', 4)
    conv(('DM', 'OM', 'LA', 'RA'), 'ZM', 3); conv(('ZM', 'OM'), 'DM', 2)


def kit_colors(ib, name):
    def hexc(k):
        v = re.sub(r'[^0-9A-Fa-f]', '', ib.get(k, ''))
        return '#' + v.lower() if len(v) in (3, 6) else None
    a = hexc('body1'); b = None
    for k in ('shorts1', 'leftarm1', 'socks1', 'body2'):
        c = hexc(k)
        if c and a and c != a: b = c; break
    if not a:
        pal = ['#b3202a', '#1f4e9c', '#1c7d48', '#111111', '#e0a100', '#6a2c91', '#0e7c86', '#d25a12']
        a = pal[h(name) % len(pal)]
    return [a, b or ('#111111' if a.lower() in ('#ffffff', '#fff') else '#ffffff')]


def build_intl(raw_dir, taken_ids):
    d = os.path.join(raw_dir, 'euro')
    if not os.path.exists(os.path.join(d, 'euroteams.json')):
        return [], {}
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import fetch_wikipedia as FW
    teams = json.load(open(os.path.join(d, 'euroteams.json'), encoding='utf-8'))
    raw = json.load(gzip.open(os.path.join(d, 'clubraw.json.gz'), 'rt', encoding='utf-8'))
    pinfo = json.load(gzip.open(os.path.join(d, 'playerraw.json.gz'), 'rt', encoding='utf-8')) if os.path.exists(os.path.join(d, 'playerraw.json.gz')) else {}
    en2id = {page: v[0] for page, v in CLUBS.items()}
    ger = {k: [en2id[t['page']] for t in teams[k] if t['nat'] == 'GER' and t['page'] in en2id] for k in teams}
    out = []; ids = set(taken_ids); n_pl = 0; n_est = 0
    for key in ('CL', 'EL', 'ECL'):
        for t in teams[key]:
            if t['nat'] == 'GER':
                continue
            w = raw.get(t['page'], ''); ib = infobox(w)
            target = INTL_LVL.get(t['name'], {'CL': 77.0, 'EL': 74.0, 'ECL': 70.0}[key])
            name, short = INTL_NAME.get(t['name'], (t['name'], t['name']))
            base = re.sub(r'[^A-Z]', '', (ib.get('short name', '') or '').upper())
            if len(base) != 3: base = re.sub(r'[^A-Z]', '', ''.join(x[0] for x in re.split(r'[\s\-/]+', short.upper()) if x) + short.upper())[:3].ljust(3, 'X')
            cid = base; k2 = 2
            while cid in ids: cid = base[:2] + str(k2); k2 += 1
            ids.add(cid)
            nat = NATFIX.get(t['nat'], t['nat'])
            rows = []; seen = set()
            for sp in FW.parse_squad(w):
                nm = sp['name'].strip()
                if not nm or nm in seen: continue
                seen.add(nm)
                pg = pinfo.get(sp['page'] or '')
                pib = infobox(pg['text']) if pg and pg.get('text') else {}
                by, bm = birth(pib.get('birth_date', '')) if pib else (0, 0)
                f = features(pib, t['page'], pg['len'] if pg else 0) if pib else None
                hh = h(nm); est = 0
                if not by or SEASON - by > 41 or SEASON - by < 15:
                    est = 1; by = SEASON - (19 + ((hh % 15) + ((hh >> 5) % 15)) // 2)
                if not bm: bm = 1 + hh % 12
                pos, amb = parse_positions(pib.get('position', ''), sp['pos'] or 'MF', nm)
                pn = sp['nat'].strip().upper(); pn = NATFIX.get(pn, COUNTRY.get(sp['nat'].strip().lower(), pn))[:3] or nat
                if f:
                    natw = 1.0 if pn in TOP else 0.7 if pn in MID else 0.45
                    fame = math.log10(max(f['len'], 1500))
                    score = 0.6 * (fame - 4.0) / 0.45 + 1.1 * natw * min(1.0, math.log1p(f['caps']) / math.log(60)) + 0.5 * min(1.0, f['apps'] / 260.0) + 0.25 * min(1.0, f['ucaps'] / 25.0) + 0.3 * min(1.0, f['cur_apps'] / 60.0)
                else:
                    no = sp['no'] or 50  # ohne Artikeldaten: niedrige Rückennummern deuten auf Stammkräfte
                    score = gaussish(nm) * 0.45 - (0.5 if not sp['page'] else 0) + (0.45 if no <= 11 else 0.15 if no <= 23 else -0.45 if no >= 40 else -0.15)
                rows.append(dict(name=nm, nat=pn, pos=pos[0], pos2=pos[1] if len(pos) > 1 else '', by=by, bm=bm, age=SEASON - by, score=score, no=sp['no'] or 0,
                                 cap=1 if 'captain' in sp['other'].lower() and 'vice' not in sp['other'].lower() else 0, est=est, amb=amb, star=nm in STARS_INTL or nm in STARS,
                                 ucaps=f['ucaps'] if f else 0, caps=f['caps'] if f else 0))
            if len(rows) < 16:  # Kader in der Quelle nicht auswertbar: der Klub bekommt im Spiel einen erzeugten Kader
                rows = []
            if len(rows) > 26:
                gk = sorted([r for r in rows if r['pos'] == 'TW'], key=lambda r: -r['score'] - (9 if r['star'] else 0))[:3]
                fld = sorted([r for r in rows if r['pos'] != 'TW'], key=lambda r: -r['score'] - (9 if r['star'] else 0))[:26 - len(gk)]
                rows = [r for r in rows if r in gk or r in fld]
            if rows:
                balance(rows)
                sc = [r['score'] for r in rows]; mu = statistics.mean(sc); sd = statistics.pstdev(sc) or 1
                for r in rows:
                    z = (r['score'] - mu) / sd
                    if z > 0: z *= 0.85
                    o = (target - 3.5) + 3.3 * max(-2.2, min(2.6, z))
                    a = r['age']
                    o += -3 if a <= 18 else -2 if a == 19 else -1 if a == 20 else 0
                    o += -1 if a == 33 else -2 if a == 34 else -3 if a == 35 else -4 if a >= 36 else 0
                    r['raw'] = o
                    st = STARS_INTL.get(r['name'], STARS.get(r['name']))
                    # Schutz vor Namensvettern: Ein handgesetzter Wert weit über dem Klubniveau wird gedeckelt
                    r['ovr'] = int(round(o)) if st is None else int(min(st, round(target + 6))) if st - target > 9 else st
                for _ in range(4):  # Niveau der ersten Elf auf den Zielwert schieben (handgesetzte Spieler bleiben)
                    delta = target - lvl14_of(rows)
                    if abs(delta) < 0.15: break
                    for r in rows:
                        if not r['star']: r['raw'] += delta; r['ovr'] = int(round(max(40, min(target + 2, 85, r['raw']))))
                for r in rows:
                    a = r['age']; hp = h(r['name'] + 'pot')
                    span = {16: (8, 15), 17: (7, 14), 18: (6, 12), 19: (5, 10), 20: (4, 8), 21: (3, 7), 22: (2, 5), 23: (1, 4), 24: (0, 2), 25: (0, 1)}.get(max(16, a), (0, 1) if a < 28 else (0, 0))
                    r['pot'] = int(min(96, max(r['ovr'], r['ovr'] + span[0] + (hp % (span[1] - span[0] + 1)) + (2 if r['ucaps'] >= 10 and a <= 22 else 0) + (2 if r['caps'] >= 3 and a <= 22 else 0))))
                    n_pl += 1; n_est += r['est']
                rows.sort(key=lambda r: (['TW', 'IV', 'LV', 'RV', 'DM', 'ZM', 'OM', 'LA', 'RA', 'ST'].index(r['pos']), -r['ovr']))
            capm = re.search(r'\d[\d,.\s]*', plain(ib.get('capacity', '')))
            cap = int(re.sub(r'[^\d]', '', capm.group(0))) if capm else 0
            if cap < 1500 or cap > 110000: cap = 12000
            stadium = re.sub(r'\s*\(.*?\)', '', plain(ib.get('stadium', '') or ib.get('ground', '')).split('<')[0].split('{{')[0]).strip() or 'Stadion'
            coach = plain(ib.get('manager', '') or ib.get('coach', '')).split('<')[0].split('{{')[0].strip()
            lv = lvl14_of(rows) if rows else target
            out.append(dict(id=cid, name=name, short=short, nat=nat, stadium=stadium[:40], cap=cap, coach=coach[:40], col=kit_colors(ib, name), lvl=round(lv, 1),
                            rep=int(round(max(25, min(99, 2.36 * lv - 106)))), fanbase=int(round(cap * 0.92 / 100.0) * 100), ec0=key,
                            p=[[r['name'], r['nat'], r['pos'], r['pos2'], r['by'], r['bm'], r['ovr'], r['pot'], r['no'], r['cap']] for r in rows]))
    print('intl clubs', len(out), 'players', n_pl, 'birth estimated', n_est)
    for c in out:
        best = sorted(c['p'], key=lambda r: -r[6])[:4]
        print('%-3s %-4s %-24s %s lvl %.1f n=%2d cap %6d %s | %s' % (c['ec0'], c['id'], c['short'], c['nat'], c['lvl'], len(c['p']), c['cap'], c['col'][0], ', '.join('%s %d' % (b[0], b[6]) for b in best)))
    return out, ger



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
            if not by or SEASON - by > 41 or SEASON - by < 15:
                est = 1
                by = SEASON - (18 + hh % 6 if c['tier'] < 3 or sp['pos'] != 'GK' else 19 + hh % 8)
            if not bm:
                bm = 1 + hh % 12
            pos, amb = parse_positions(ib.get('position', ''), sp['pos'], nm)
            nat = sp['nat'].strip().upper()
            nat = NATFIX.get(nat, COUNTRY.get(sp['nat'].strip().lower(), nat))[:3]
            age = SEASON - by
            natw = 1.0 if nat in TOP else 0.7 if nat in MID else 0.45
            fame = math.log10(max(f['len'], 1500))
            score = 0.6 * (fame - 4.0) / 0.45 + 1.1 * natw * min(1.0, math.log1p(f['caps']) / math.log(60)) + 0.5 * min(1.0, f['apps'] / 260.0) + 0.25 * min(1.0, f['ucaps'] / 25.0) + 0.3 * min(1.0, f['cur_apps'] / 60.0)
            if not ib:
                score -= 0.9
            rows.append(dict(name=nm, nat=nat, pos=pos[0], pos2=pos[1] if len(pos) > 1 else '', by=by, bm=bm, age=age, score=score, no=sp['no'] or 0, cap=1 if 'captain' in sp['other'].lower() and 'vice' not in sp['other'].lower() else 0, f=f, est=est, has=bool(ib), amb=amb, sp=sp['pos']))
        if len(rows) > 31:  # übergroße Kader (mitgeführte Nachwuchsspieler) auf Profikader-Größe kürzen
            keep = sorted(rows, key=lambda r: -r['score'] - (5 if r['pos'] == 'TW' else 0))[:31]
            rows = [r for r in rows if r in keep]
        # Mannschaftsteile ausbalancieren – aber nur bei Spielern, deren genaue Position die Quelle offen lässt
        def cnt(p): return sum(1 for r in rows if r['pos'] == p)
        def conv(frm, to, need):
            for r in sorted(rows, key=lambda r: -r['score']):
                if cnt(to) >= need: break
                if r['amb'] and r['pos'] in frm and cnt(r['pos']) > 1: r['pos'] = to; r['pos2'] = ''
        conv(('LA', 'RA'), 'ST', 3)
        conv(('IV', 'RV'), 'LV', 2); conv(('IV', 'LV'), 'RV', 2); conv(('LV', 'RV'), 'IV', 4)
        conv(('DM', 'OM', 'LA', 'RA'), 'ZM', 3); conv(('ZM', 'OM'), 'DM', 2)
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
    intl, euro = build_intl(RAW, [c['id'] for c in out_clubs] + [a[0] for a in AMATEURS])
    db = dict(season=SEASON, built=os.environ.get('FLUTLICHT_BUILT', datetime.date.today().isoformat()), source='Kader, Trainer, Stadien: englischsprachige Wikipedia (CC BY-SA 4.0). Spielstärken: eigene Schätzung.',
              players=n_players, estimatedBirth=n_est, clubs=out_clubs, amateurs=am, intl=intl, euro=euro, intlPlayers=sum(len(c['p']) for c in intl))
    js = '/* FLUTLICHT · Datenbank Saison %d/%02d – automatisch erzeugt von tools/build_data.py am %s.\n   Kader/Trainer/Stadien: Wikipedia (CC BY-SA 4.0). Spielstärken sind Schätzwerte, keine offiziellen Daten. */\n' % (SEASON, (SEASON + 1) % 100, db['built'])
    js += '(function (root) { (root.FM = root.FM || {}).DB = ' + json.dumps(db, ensure_ascii=False, separators=(',', ':')) + '; })(typeof globalThis !== \'undefined\' ? globalThis : this);\n'
    open(OUT, 'w', encoding='utf-8').write(js)
    print('clubs', len(out_clubs), 'players', n_players, 'birth estimated', n_est, 'bytes', len(js.encode()))
    for c in out_clubs:
        best = sorted(c['p'], key=lambda r: -r[6])[:3]
        print('%d %-26s lvl %.1f rep %2d last %s/%s n=%2d  %s' % (c['tier'], c['short'], c['lvl'], c['rep'], c['lastTier'], c['lastPos'], len(c['p']), ', '.join('%s %d' % (b[0], b[6]) for b in best)))


if __name__ == '__main__':
    main()
