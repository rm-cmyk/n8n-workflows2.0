# n8n-workflows2.0

Projekt-Setup fuer das Arbeiten an n8n-Workflows mit Claude Code und dem
[n8n-mcp](https://github.com/czlonkowski/n8n-mcp) Server sowie den
[n8n-skills](https://github.com/czlonkowski/n8n-skills).

## Voraussetzungen

- [Node.js](https://nodejs.org/) (fuer `npx`)
- [Claude Code](https://claude.com/claude-code) CLI oder Claude Desktop
- Optional: Eine laufende n8n-Instanz + API-Key (nur noetig fuer Workflow-Management via API)

## 1. n8n-mcp Server einrichten

Die Konfiguration liegt bereits im Repo unter [`.mcp.json`](./.mcp.json).
Sie verweist auf den offiziellen `n8n-mcp` via `npx`, sodass keine manuelle
Installation noetig ist – Claude Code startet den Server automatisch.

### Environment-Variablen setzen

```bash
cp .env.example .env
# dann .env oeffnen und N8N_API_URL / N8N_API_KEY eintragen
```

`N8N_API_URL` und `N8N_API_KEY` sind optional. Ohne diese Werte kannst du den
n8n-Knotenkatalog, Validierung, Doku etc. nutzen. Fuer das Erstellen,
Aktualisieren und Ausfuehren von Workflows via API werden sie benoetigt.

### MCP-Server in Claude Code aktivieren

Im Projektverzeichnis:

```bash
claude mcp add n8n-mcp --scope project
```

Alternativ (global, ohne `.mcp.json`):

```bash
claude mcp add n8n-mcp \
  -e MCP_MODE=stdio \
  -e LOG_LEVEL=error \
  -e DISABLE_CONSOLE_OUTPUT=true \
  -e N8N_API_URL=https://your-n8n-instance.com \
  -e N8N_API_KEY=your-api-key \
  -- npx n8n-mcp
```

### Alternative: Docker-Variante

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "--init",
        "-e", "MCP_MODE=stdio",
        "-e", "LOG_LEVEL=error",
        "-e", "DISABLE_CONSOLE_OUTPUT=true",
        "-e", "N8N_API_URL=https://your-n8n-instance.com",
        "-e", "N8N_API_KEY=your-api-key",
        "ghcr.io/czlonkowski/n8n-mcp:latest"
      ]
    }
  }
}
```

Fuer eine lokale n8n-Instanz `http://host.docker.internal:5678` als URL verwenden.

## 2. n8n-skills installieren

Die [n8n-skills](https://github.com/czlonkowski/n8n-skills) erweitern Claude
um sieben spezialisierte Skills fuer n8n (Expressions, Node-Konfiguration,
Validierung, Workflow-Patterns, Code-Nodes JS/Python, MCP-Tool-Nutzung).

### Variante A – Plugin (empfohlen)

In Claude Code:

```
/plugin install czlonkowski/n8n-skills
```

Oder ueber das Marketplace:

```
/plugin marketplace add czlonkowski/n8n-skills
/plugin install
```

### Variante B – Manuell

```bash
git clone https://github.com/czlonkowski/n8n-skills.git /tmp/n8n-skills
mkdir -p ~/.claude/skills
cp -r /tmp/n8n-skills/skills/* ~/.claude/skills/
```

Die Skills aktivieren sich anschliessend automatisch, sobald die
Frage/Aufgabe dazu passt.

## 3. Funktion pruefen

Nach Neustart von Claude Code:

```
/mcp
```

sollte `n8n-mcp` als verbunden anzeigen. Ein schneller Test:

> Liste mir die verfuegbaren n8n-Nodes fuer Webhooks auf.

## Workflows

### `workflows/email-classifier.json`

Klassifiziert eingehende Mails aus einer Outlook-Shared-Mailbox (Posteingang,
Polling alle 5 Min) per OpenAI `gpt-4o-mini` in 5 Kategorien + `other`:

| Kategorie | Aktionen |
|---|---|
| **Kundenanfragen** | Trello-Karte (Board *Privatkunden*) + PDF/JPEG-Anhaenge hochladen -> SeaTable-Zeile anlegen -> Template-Antwortmail -> Move -> `Kundenanfragen` + Mark Read |
| **Lieferantenanfragen** | Move -> `Lieferantenanfragen` + Mark Read |
| **Bewerbungen** | Trello-Karte (Board *Recruiting & Onboarding*) + alle Anhaenge -> Move -> `Bewerbungen` + Mark Read |
| **SpamWerbung** | Move -> `SpamWerbung` |
| **Rechnungen** | Forward an Platzhalter-Mail per Microsoft Graph API |
| **other** | keine Aktion |

**Vor dem Aktivieren ersetzen (Search & Replace im JSON):**

| Platzhalter | Bedeutung |
|---|---|
| `REPLACE_ME_OUTLOOK_CRED` | ID der Outlook-OAuth2-Credential in n8n |
| `REPLACE_ME_OPENAI_CRED` | ID der OpenAI-Credential |
| `REPLACE_ME_TRELLO_CRED` | ID der Trello-Credential |
| `REPLACE_ME_SEATABLE_CRED` | ID der SeaTable-Credential |
| `LIST_ID_PRIVATKUNDEN` | Trello-List-ID fuer Kundenanfragen (Board *Privatkunden*) |
| `LIST_ID_RECRUITING` | Trello-List-ID fuer Bewerbungen (Board *Recruiting & Onboarding*) |
| `SEATABLE_TABLE_NAME` | SeaTable-Tabellenname |
| `FOLDER_ID_KUNDENANFRAGEN` | Outlook-Ordner-ID unter Inbox |
| `FOLDER_ID_LIEFERANTENANFRAGEN` | dto. |
| `FOLDER_ID_BEWERBUNGEN` | dto. |
| `FOLDER_ID_SPAMWERBUNG` | dto. |
| `SHARED_MAILBOX_UPN` | UPN der Shared Mailbox (z. B. `info@firma.de`) – in der Forward-URL |
| `RECHNUNGEN_ZIEL_MAIL` | Zieladresse fuer weitergeleitete Rechnungen |

**IDs finden:**
- Outlook-Folder-IDs: `https://developer.microsoft.com/graph/graph-explorer` -> `GET /users/{upn}/mailFolders/inbox/childFolders`
- Trello-List-IDs: Board-URL + `.json` anhaengen oder `GET https://api.trello.com/1/boards/{id}/lists`

**Import in n8n:**
1. In n8n: *Workflows* -> *Import from File* -> `workflows/email-classifier.json`
2. Platzhalter ersetzen (Credentials + IDs)
3. SeaTable-Tabelle mit Spalten `Datum, Absender_Name, Absender_Mail, Betreff, Body_Preview, Kategorie, Anhaenge_Anzahl, Outlook_MessageId, Trello_Card_Url` anlegen
4. Outlook-Unterordner `Kundenanfragen`, `Lieferantenanfragen`, `Bewerbungen`, `SpamWerbung` unter Posteingang anlegen
5. Workflow aktivieren

**Validierung:** Das JSON wurde gegen die n8n-Node-Schemas via `n8n-mcp validate_workflow` geprueft – 0 Errors (5 informationelle Warnings bzgl. Error-Handling-Empfehlungen, HTTP-Request-Nodes haben `retryOnFail: true`).

### `workflows/whatsapp-offer-bot.json` (+ 2 Sub-Workflows)

WhatsApp-Bot fuer interne Mitarbeiter, der per Sprach- oder Textnachricht eine
Kundenanfrage entgegennimmt und mit Hilfe eines AI Agent (gpt-4o + Memory)
schrittweise ein Angebot erstellt, als PDF zurueck in den Chat sendet und
optional per Mail an den Kunden weiterleitet.

**Drei Workflows (in n8n alle drei importieren):**

| Datei | Zweck |
|---|---|
| `workflows/whatsapp-offer-bot.json` | Main: WhatsApp-Trigger, Whitelist, Whisper, AI Agent |
| `workflows/whatsapp-offer-bot.sub-send-pdf.json` | Sub: HTML -> PDFShift -> WhatsApp Document |
| `workflows/whatsapp-offer-bot.sub-send-email.json` | Sub: HTML -> PDFShift -> Outlook Mail mit PDF-Anhang |

**Conversation-Flow:**
1. Mitarbeiter schickt Sprachnachricht (oder Text) mit Anfrage
2. Bot transkribiert via OpenAI Whisper
3. AI Agent fragt nach (Maße/Mengen/Material), nutzt `lookup_material` + `get_verrechnungssaetze` aus dem ERP
4. Agent praesentiert Angebotsentwurf inkl. Summen + USt -> fragt **explizit** nach Bestaetigung
5. Bei "ja": Agent ruft `send_offer_to_whatsapp` -> PDF wird erzeugt + ins Chat geschickt
6. Agent fragt: "Soll ich das Angebot zusaetzlich an eine Kunden-Mailadresse senden?"
7. Mitarbeiter nennt Adresse + Kundenname -> Agent ruft `send_offer_email` -> Mail mit PDF und Template "Lieber Kunde, hier ist Ihr Angebot..."

**Vor Aktivierung setzen:**

| Platzhalter | Bedeutung |
|---|---|
| `REPLACE_ME_WA_TRIGGER_CRED` | WhatsApp-Trigger-Credential (Verify Token) |
| `REPLACE_ME_WA_CRED` | WhatsApp Business Cloud Credential (Access Token) |
| `REPLACE_ME_PHONE_NUMBER_ID` | Phone Number ID aus Meta Developer Portal |
| `WA_PHONE_NUMBER_ID` | gleicher Wert wie oben (in den Sub-Workflows in URLs) |
| `REPLACE_ME_OPENAI_CRED` | OpenAI-Credential |
| `REPLACE_ME_ERP_CRED` | ERP-API (Header Auth) |
| `ERP_BASE_URL` | Basis-URL des ERP, z. B. `https://erp.firma.de/api` |
| `REPLACE_ME_PDFSHIFT_CRED` | PDFShift Header `X-API-Key` |
| `REPLACE_ME_OUTLOOK_OFFER_CRED` | Outlook-Credential des **Angebots-Postfachs** (anderes als beim Email-Classifier) |
| `REPLACE_ME_SUBWF_WHATSAPP_ID` | Workflow-ID des `Sub: Send Offer WhatsApp` (nach Import in n8n setzen) |
| `REPLACE_ME_SUBWF_EMAIL_ID` | Workflow-ID des `Sub: Send Offer Email` (nach Import in n8n setzen) |
| Whitelist-Telefonnummern | im Code-Node `Whitelist + Normalize` (Array `WHITELIST`) |
| Brand-Daten | im Code-Node `Build HTML` der beiden Sub-Workflows (`COMPANY_NAME`, `COMPANY_ADDRESS`, `COMPANY_TAX_ID`, `COMPANY_LOGO_URL`, `COMPANY_COLOR_HEX`, `COMPANY_CONTACT_EMAIL`, `COMPANY_CONTACT_PHONE`, `COMPANY_WEBSITE`) |

**ERP-API erwartete Endpunkte (Default):**
- `GET /materials?q=<query>&limit=10` -> Liste `{name, einheit, einzelpreis_eur, kategorie, sku}`
- `GET /verrechnungssaetze` -> Liste `{position, stundensatz}`

**Meta-Setup (WhatsApp Business Cloud):**
1. Meta Developer App + WhatsApp-Produkt -> Phone Number ID + Permanent Access Token
2. Webhook-URL aus n8n Trigger in Meta-Portal als Webhook eintragen
3. Verify Token muss zu n8n-Trigger-Credential passen
4. App ggf. fuer den Produktivbetrieb verifizieren lassen

**Import-Reihenfolge in n8n:**
1. Beide Sub-Workflows zuerst importieren -> n8n vergibt IDs
2. Main-Workflow importieren
3. In Main: Beide Tool-Workflow-Nodes oeffnen und die echten Sub-Workflow-IDs auswaehlen (oder im JSON `REPLACE_ME_SUBWF_*_ID` ersetzen)
4. Credentials zuweisen, Platzhalter ersetzen, **Sub-Workflows aktivieren**, dann Main aktivieren

**Validierung:** Alle drei Workflows wurden via `n8n-mcp validate_workflow` geprueft -> 0 echte Errors. Die einzigen 2 "Errors" in der Main-Validierung waren False Positives (im Validierungs-Stub fehlten Credentials, in der echten Datei sind sie als `REPLACE_ME_*` belegt). Warnings betreffen Error-Handling-Empfehlungen und sind durch `retryOnFail` adressiert.

## Dateien in diesem Repo

- [`.mcp.json`](./.mcp.json) – Claude Code MCP-Server-Konfiguration
- [`.env.example`](./.env.example) – Vorlage fuer Environment-Variablen
- [`.gitignore`](./.gitignore) – schliesst `.env` und lokale Artefakte aus
- [`workflows/email-classifier.json`](./workflows/email-classifier.json) – Outlook Mail Classifier Workflow
- [`workflows/whatsapp-offer-bot.json`](./workflows/whatsapp-offer-bot.json) – WhatsApp Offer Bot (Main)
- [`workflows/whatsapp-offer-bot.sub-send-pdf.json`](./workflows/whatsapp-offer-bot.sub-send-pdf.json) – Sub: PDF + WhatsApp Send
- [`workflows/whatsapp-offer-bot.sub-send-email.json`](./workflows/whatsapp-offer-bot.sub-send-email.json) – Sub: PDF + Outlook Send

## Links

- n8n-mcp: https://github.com/czlonkowski/n8n-mcp
- n8n-skills: https://github.com/czlonkowski/n8n-skills
- Hosted Dashboard: https://dashboard.n8n-mcp.com
