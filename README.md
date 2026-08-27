# News-Publisher

AI-gestütztes News-Rewriting und Publishing-Tool (Next.js 16 + Prisma 7 +
SQLite). Aggregiert Artikel aus RSS/HTML-Quellen, bewertet und schreibt sie
über ein konfigurierbares LLM (LM Studio lokal, oder OpenAI/OpenRouter/Ollama
via API-Key) neu und verwaltet Veröffentlichung + Newsletter-Versand.

## Installation via Docker (empfohlen)

Ohne Source-Checkout, nur `docker-compose.prod.yml` und eine `.env` nötig.

```bash
# Einmalig: Zugriff auf das private Image freischalten
docker login ghcr.io -u <dein-github-username>   # Passwort: Personal Access Token mit "read:packages"

# .env anlegen (siehe .env.example in diesem Repo als Vorlage)
cp .env.example .env
# ... .env ausfuellen (LMSTUDIO_BASE_URL, SMTP, API-Keys, ...) ...

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

App danach erreichbar unter http://localhost:3000. LLM-Provider (LM Studio,
OpenAI, OpenRouter, Ollama, ...) werden anschliessend unter
`/admin/einstellungen` konfiguriert - kein Rebuild noetig, um einen Provider
zu wechseln.

### Updates einspielen

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Datenbank-Migrationen werden beim Start automatisch angewendet, bestehende
Daten bleiben erhalten.

### Neues Release veröffentlichen (für Maintainer)

```bash
git tag v1.1.0
git push --tags
```

Das löst den GitHub-Actions-Workflow (`.github/workflows/docker-publish.yml`)
aus, der das Image baut und nach `ghcr.io/corderolb/news-publisher` pusht
(getaggt mit der Versionsnummer und `latest`).

## Lokale Entwicklung

```bash
npm install
cp .env.example .env
npm run dev
```

Details zu Docker-Build aus dem Source-Checkout (statt vorgefertigtem Image):
`docker-compose.yml` + `Dockerfile`.
