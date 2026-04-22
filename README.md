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

## Dateien in diesem Repo

- [`.mcp.json`](./.mcp.json) – Claude Code MCP-Server-Konfiguration
- [`.env.example`](./.env.example) – Vorlage fuer Environment-Variablen
- [`.gitignore`](./.gitignore) – schliesst `.env` und lokale Artefakte aus

## Links

- n8n-mcp: https://github.com/czlonkowski/n8n-mcp
- n8n-skills: https://github.com/czlonkowski/n8n-skills
- Hosted Dashboard: https://dashboard.n8n-mcp.com
