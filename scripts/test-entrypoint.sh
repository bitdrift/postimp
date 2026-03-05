#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting Postgres..."
pg_ctlcluster 17 main start

echo "==> Running test-init.sql..."
psql -U postgres -v ON_ERROR_STOP=1 -f /app/scripts/test-init.sql

echo "==> Running migrations..."
for f in /app/supabase/migrations/*.sql; do
  echo "  -> $(basename "$f")"
  psql -U postgres -v ON_ERROR_STOP=1 -f "$f"
done

echo "==> Granting permissions on public tables..."
psql -U postgres <<'SQL'
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticator;
SQL

echo "==> Starting PostgREST..."
cat > /tmp/postgrest.conf <<CONF
db-uri = "postgres://authenticator:postgres@localhost:5432/postgres"
db-schemas = "public"
db-anon-role = "anon"
server-port = 3001
jwt-secret = "super-secret-jwt-token-with-at-least-32-characters-long"
CONF
postgrest /tmp/postgrest.conf &
sleep 2

echo "==> Starting test proxy..."
node /app/scripts/test-proxy.mjs &
sleep 1

echo "==> Running tests..."
cd /app
export POSTIMP_TEST_CONTAINER=1
exec npx vitest run --reporter=verbose "$@"
