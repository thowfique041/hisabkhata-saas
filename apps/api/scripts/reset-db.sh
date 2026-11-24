#!/usr/bin/env bash
# Drops and recreates the local development schema, applies migrations and seeds demo data.
# Refuses to run against anything that is not localhost.
set -euo pipefail
cd "$(dirname "$0")/.."
source .env 2>/dev/null || true
case "${DATABASE_URL:-}" in
  *localhost*|*127.0.0.1*|*@postgres:*) ;;
  *) echo "Refusing to reset a non-local database"; exit 1 ;;
esac
psql "${DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -q -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
if ! npx prisma migrate deploy 2>/dev/null; then node scripts/prisma-wasm.mjs deploy; fi
pnpm seed
