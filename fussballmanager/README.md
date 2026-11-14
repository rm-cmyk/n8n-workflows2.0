# FLUTLICHT – Fußballmanager 2026/27

Ein eigenständiges Fußballmanager-Spiel im Geist der klassischen deutschen Managerspiele: Wochenrhythmus,
Textticker mit Augenzwinkern, Vorstand im Nacken – dazu Taktik, Transfers, Finanzen und Stadionausbau.
Läuft komplett im Browser, ohne Installation und ohne Server.

**Starten:** `index.html` im Browser öffnen. Mehr ist nicht nötig.

FLUTLICHT ist ein inoffizielles Fanprojekt. Es steht in keiner Verbindung zu Vereinen, Verbänden, Ligen oder
den Herstellern anderer Managerspiele und verwendet weder Logos noch lizenziertes Material.

## Was drin ist

- **56 spielbare Vereine** aus Bundesliga, 2. Bundesliga und 3. Liga mit den Kadern der Saison 2026/27
  (1.577 Spieler), dazu 14 Traditionsklubs der Regionalliga als Pokalgegner und Aufsteiger.
- **Ligen mit Auf- und Abstieg** inklusive Relegation, **DFB-Pokal** mit 64 Teilnehmern, Testspiele.
- **Live-Spiel** Minute für Minute: Ticker, Konferenz der anderen Plätze, fünf Wechsel, Taktik- und
  Formationswechsel, Positionstausch, Kabinenansprache, Verlängerung, Elfmeterschießen. Oder Sofortergebnis.
- **Aufstellung** mit neun Formationen, Ausrichtung, Pressing, Härte, Spielweise, Kapitän, Elfmeter- und
  Freistoßschütze.
- **Training** (Schwerpunkt, Intensität, Trainingslager), Frische, Form, Moral, Verletzungen, Sperren,
  Spielerentwicklung nach Alter und Talent.
- **Transfermarkt** mit Transferfenstern, Ablöseverhandlung, Vertragsgesprächen, vereinslosen Spielern,
  Auslandsmarkt, Angeboten für eigene Spieler, Transferliste, Jugendspielern.
- **Finanzen**: Zuschauer, TV-Gelder, Sponsor (drei Vertragsmodelle), Fanartikel, Gehälter, Kredit,
  Eintrittspreise, Stadionausbau, vier Ausbaulinien fürs Vereinsgelände.
- **Vorstand und Fans** mit Saisonziel und Vertrauen; bei Entlassung gibt es immer neue Jobangebote.
- **Zufallsereignisse** mit Entscheidungen (der Maulwurf im Strafraum lässt grüßen).
- **Speichern**: automatisch nach jeder Woche und jedem Spiel, zwei freie Plätze, Export/Import als Datei.

## Woher die Daten kommen – und was geschätzt ist

| Angabe | Quelle |
| --- | --- |
| Vereine, Ligazugehörigkeit, Stadien, Kapazitäten, Trainer | englischsprachige Wikipedia, Saisonartikel 2026/27 |
| Kader, Rückennummern, Nationalitäten, Kapitäne | Wikipedia-Vereinsartikel (Stand: Datum in `js/data.js`) |
| Geburtsdaten und Positionen | Wikipedia-Spielerartikel (für 1.143 von 1.577 Spielern vorhanden) |
| Vorjahresplatzierung | aus den Ergebnissen der Saison 2025/26 berechnet |
| **Spielstärke und Talent** | **eigene Schätzung** – siehe unten |
| Gehälter, Marktwerte, Vertragslaufzeiten | vom Spiel aus Stärke, Alter und Vereinsgröße abgeleitet |

Wikipedia-Inhalte stehen unter [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de).

Für Spielstärken gibt es keine freie Quelle. `tools/build_data.py` schätzt sie aus dem Niveau des Vereins
(von Hand gesetzt, an der Abschlusstabelle 2025/26 ausgerichtet) und der Rolle im Kader (Länderspiele,
Einsätze, Alter, Umfang des Artikels). Für rund 220 bekannte Spieler ist der Wert von Hand gesetzt.
Bei Spielern ohne eigenen Wikipedia-Artikel (vor allem Nachwuchs und 3. Liga) sind Alter und genaue Position
geschätzt. Wer es besser weiß: Die Tabellen `CLUBS` und `STARS` in `tools/build_data.py` sind dafür gedacht.

**Daten aktualisieren**

```sh
python3 tools/fetch_wikipedia.py tools/raw   # lädt Kader und Spielerartikel (30–60 Minuten, Wikipedia drosselt)
python3 tools/build_data.py tools/raw        # erzeugt js/data.js neu
```

## Gegen typische Managerspiel-Bugs gebaut

Die Schwachstellen, über die sich Spieler aktueller Fußballmanager am häufigsten ärgern, sind hier durch die
Bauweise ausgeschlossen oder durch Tests abgesichert:

| Ärgernis | Gegenmaßnahme |
| --- | --- |
| Tabelle passt nicht zu den Ergebnissen | Die Tabelle wird nie gespeichert, sondern immer aus dem Spielplan berechnet. |
| Kaputte oder verlorene Spielstände | Prüfsumme, Strukturprüfung beim Laden, Sicherungskopie des vorigen Autosaves, Datei-Export. Beschädigte Stände werden abgelehnt statt geladen. |
| Sackgassen (es geht nicht weiter) | Ungültige Aufstellungen werden vor dem Anpfiff gemeldet und lassen sich mit einem Klick reparieren; die Engine repariert notfalls selbst. Nach einer Entlassung gibt es immer Jobangebote. Jeder Dialog hat einen Ausweg. |
| KI-Teams mit neun Mann oder ohne Torwart | Jeder Klub kann immer elf Spieler inklusive Torwart stellen; fehlen Spieler, rücken Nachwuchskräfte auf. |
| Wechsel oder Anweisungen werden ignoriert | Jeder Eingriff im Live-Spiel wirkt ab der nächsten Minute und wird im Dialog bestätigt. |
| Absurde Ergebnisse und Statistiken | Engine kalibriert: rund 3,1 Tore pro Spiel, 43 % Heimsiege, 4,3 Gelbe Karten, Meister bei gut 80 Punkten. |
| Eine Formation schlägt alle anderen | Formationen sind rechnerisch ausbalanciert und per Test vermessen (`tests/formations.js`). |
| Verletzungsflut | Verletzungsrate fest eingestellt und über medizinische Abteilung, Trainingsintensität und Härte steuerbar. |
| Finanzen laufen aus dem Ruder (NaN, Milliarden) | Buchungen lassen nur gültige Zahlen zu; KI-Klubs gehen nicht pleite und horten nicht. Spielstärken und Konten bleiben über viele Saisons stabil. |
| Geisterspieler, doppelte Spieler | Vereinswechsel laufen durch genau eine Funktion; der Dauertest prüft nach jedem Schritt, dass jeder Spieler höchstens einem Kader angehört. |
| Träge Oberfläche | Kein Framework, kein Nachladen; eine komplette Saison aller 56 Klubs rechnet in rund einer Sekunde. |

### Tests

```sh
sh tests/run.sh
```

- `tests/invariants.js` – simuliert mehrere Saisons und prüft nach jedem Schritt Tabellen, Spielpläne
  (jeder gegen jeden, gleich viele Heimspiele), Kader, Konten, Auf-/Abstieg und den Spielstand-Roundtrip.
- `tests/calib.js` – misst Tore, Heim-/Auswärtsbilanz, Karten und Punkteverteilung.
- `tests/formations.js` – lässt alle Formationen gegeneinander antreten.
- `tests/e2e.js` – spielt im echten Browser (Playwright) durch alle Bildschirme, zwei Live-Spiele mit Wechseln,
  Speichern/Neuladen und die Handy-Ansicht.

Tests senken das Risiko, sie beweisen keine Fehlerfreiheit. Wer etwas findet: Der Spielstand-Export hilft beim
Nachstellen.

## Was (noch) fehlt

- **Europapokal** wird nicht ausgespielt. Die ersten sechs der Bundesliga erhalten pauschale Einnahmen.
- Keine Leihgeschäfte, keine Nationalmannschaften, keine Trainer- und Mitarbeiterverwaltung.
- Regionalligisten haben erzeugte Kader; spielbar sind nur die drei Profiligen.
- Einzelattribute pro Spieler (Tempo, Technik …) gibt es bewusst nicht: Sie wären ohne Datenquelle reine
  Würfelwerte. Stattdessen gibt es Stärke, Talent, Positionen und wenige spürbare Eigenschaften.

## Aufbau

```
index.html          Einstieg
css/style.css       Gestaltung (hell und dunkel)
js/core.js          Zufall, Positionen, Formationen, Taktik
js/gen.js           Spielermodell, Marktwert, Gehalt, erzeugte Spieler
js/cal.js           Kalender, Spielplan, Tabellen, Pokal
js/team.js          Aufstellung, Prüfung, Notfall-Auffüllung
js/econ.js          Einnahmen, Ausgaben, Sponsoren, Stadion, Vorstand
js/match.js         Spiel-Engine
js/transfer.js      Transfermarkt, Verträge, KI-Transfers
js/events.js        Zufallsereignisse
js/game.js          Wochenablauf, Training, Saisonwechsel
js/world.js         Neues Spiel, Speichern/Laden
js/data.js          Datenbank (erzeugt)
js/ui*.js           Oberfläche
tools/              Datenabruf und -aufbereitung
tests/              automatische Prüfungen
```
