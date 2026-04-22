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

## Dateien in diesem Repo

- [`.mcp.json`](./.mcp.json) – Claude Code MCP-Server-Konfiguration
- [`.env.example`](./.env.example) – Vorlage fuer Environment-Variablen
- [`.gitignore`](./.gitignore) – schliesst `.env` und lokale Artefakte aus
- [`workflows/email-classifier.json`](./workflows/email-classifier.json) – Outlook Mail Classifier Workflow

## Links

- n8n-mcp: https://github.com/czlonkowski/n8n-mcp
- n8n-skills: https://github.com/czlonkowski/n8n-skills
- Hosted Dashboard: https://dashboard.n8n-mcp.com
