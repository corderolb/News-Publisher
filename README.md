# News-Publisher

AI-gestütztes News-Rewriting und Publishing-Tool (Next.js 16 + Prisma 7 +
SQLite). Aggregiert Artikel aus RSS/HTML-Quellen, bewertet und schreibt sie
über ein konfigurierbares LLM (LM Studio lokal, oder OpenAI/OpenRouter/Ollama
via API-Key) neu und verwaltet Veröffentlichung + Newsletter-Versand.

## Installation via Docker (empfohlen)

Ohne Source-Checkout, nur `docker-compose.prod.yml` und eine `.env` nötig.
Das Image ist öffentlich (kein Login nötig) - das Repo selbst bleibt privat.

```bash
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

### ZimaOS / CasaOS

Immer per SSH mit dem obigen `docker compose`-Befehl installieren, **nicht**
über die "Custom Install" / "Install via Docker Compose"-GUI. Die GUI hat
einen bekannten Bug ([CasaOS#1595](https://github.com/IceWhaleTech/CasaOS/issues/1595)):
sie wandelt das named volume `news-publisher-data` beim Import still in einen
Bind-Mount nach `/tmp/casaos-compose-app-<uuid>/...` um. `/tmp` wird bei
Reboots (z.B. nach einem ZimaOS-Update) geleert - die SQLite-Datenbank geht
dabei verloren, ohne dass es beim Deploy auffaellt.

Per SSH umgeht `docker compose -f docker-compose.prod.yml up -d` diesen Bug,
weil dann Docker selbst (nicht CasaOS' Importer) das named volume anlegt und
es landet wie erwartet in einem echten Docker-Volume unter
`/var/lib/docker/volumes/`.

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
