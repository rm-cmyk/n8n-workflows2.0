# KI-Kompass · Handwerk & GaLaBau

Ein digitales Produkt für Inhaber und Betriebsleiter in Handwerks- und GaLaBau-Unternehmen: ein Praxis-Leitfaden zum Einsatz von KI im Betriebsalltag, ergänzt um fünf startklare n8n-Automatisierungs-Vorlagen.

## Inhalt

```
produkt/
├── index.html                                    # Der Leitfaden (als Web-Seite, druckfähig)
└── n8n-vorlagen/
    ├── 01_ki-anfragen-vorqualifizierung.json      # Anfragen automatisch strukturieren & priorisieren
    ├── 02_ki-angebotserstellung.json              # Sprachnotiz → Angebotsentwurf
    ├── 03_ki-bautagebuch.json                     # Sprachnotiz → strukturierter Tagesbericht
    ├── 04_ki-terminerinnerung.json                # Automatische WhatsApp-Terminerinnerung
    └── 05_ki-bewertungsmanagement.json            # Bewertungsanfrage + Antwortentwurf
```

## Der Leitfaden

`produkt/index.html` behandelt:

- **Lagebild** – warum Verwaltung, nicht die Baustelle, der eigentliche Engpass ist
- **10 konkrete KI-Einsatzfelder** – von der Anfrage bis zur Rechnung
- **Ein Rechenbeispiel** – realistische Modellrechnung für einen GaLaBau-Betrieb
- **30-60-90-Tage-Fahrplan** – Einführung ohne Überforderung
- **Werkzeugkasten** – fünf Tool-Kategorien, keine Überfrachtung
- **Fünf häufige Fehler** beim Einstieg
- **Sofort-Checkliste** für die erste Woche

Datei im Browser öffnen, um die formatierte Ansicht zu sehen.

## Die n8n-Vorlagen

Jede JSON-Datei ist ein importierbarer n8n-Workflow (Menü *Import from File* in n8n). Alle Vorlagen sind bewusst einfach gehalten und nutzen generische HTTP-Request-Knoten für die KI-Anbindung, damit sie unabhängig vom gewählten Anbieter (Anthropic, OpenAI, o. Ä.) funktionieren. Nach dem Import müssen jeweils eigene Zugangsdaten (API-Keys, E-Mail-/Kalender-/Tabellenverbindung) hinterlegt werden — Hinweise dazu stehen als Notizen an den jeweiligen Knoten.

Workflows mit Kundenkontakt (Angebot, Bewertungsantwort) sind bewusst so gebaut, dass ein Mensch vor dem Versand freigibt — keine vollautomatische Kommunikation ohne Kontrolle.
