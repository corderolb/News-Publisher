#!/bin/sh
set -e

# Applies any migration not yet recorded against the DB at DATABASE_URL.
# Safe to run on every start: no-ops if already up to date, and unlike
# `db push` never drops columns/tables to reconcile drift - this is what
# makes "ship a new image, restart the container" a safe update path.
npx prisma migrate deploy

exec npx next start -p "${PORT:-3000}"
