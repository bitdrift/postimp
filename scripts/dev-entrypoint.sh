#!/usr/bin/env bash
set -euo pipefail

JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"

# JWTs signed with the secret above
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InRlc3QiLCJpYXQiOjE3NzI2NzcxMjEsImV4cCI6MjA4ODAzNzEyMX0.T_xhqWx3_n9TCCf4r_zsn4EKTDweMHZ-HOahs9qJiEw"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoidGVzdCIsImlhdCI6MTc3MjY3NzEyMSwiZXhwIjoyMDg4MDM3MTIxfQ.2OKwB_fc6OYTm1bl54bPDVAbcgKQBQeyjZtzMpefafI"

echo "==> Starting Postgres..."
pg_ctlcluster 17 main start

# Step 1: Create roles, extensions, storage schema (no auth tables — GoTrue handles those)
echo "==> Setting up roles and extensions..."
psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Storage schema
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text, owner uuid, created_at timestamptz DEFAULT now()
);

-- Publication for Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- PostgREST roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'postgres';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN BYPASSRLS CREATEROLE;
  END IF;
END $$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all' AND tablename = 'objects') THEN
    CREATE POLICY "allow_all" ON storage.objects USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Auth schema — GoTrue will create tables and auth.uid() via its own migrations
CREATE SCHEMA IF NOT EXISTS auth;
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
SQL

# Step 2: Start GoTrue — it creates the full auth schema with its own migrations
echo "==> Starting GoTrue (auth)..."
export GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:postgres@localhost:5432/postgres?sslmode=disable&search_path=auth"
export GOTRUE_DB_DRIVER="postgres"
export GOTRUE_DB_NAMESPACE="auth"
export GOTRUE_API_HOST="0.0.0.0"
export GOTRUE_API_PORT="9999"
export GOTRUE_SITE_URL="http://localhost:3456"
export GOTRUE_URI_ALLOW_LIST="http://localhost:3456"
export GOTRUE_JWT_SECRET="${JWT_SECRET}"
export GOTRUE_JWT_EXP="3600"
export GOTRUE_JWT_AUD="authenticated"
export GOTRUE_JWT_DEFAULT_GROUP_NAME="authenticated"
export GOTRUE_EXTERNAL_EMAIL_ENABLED="true"
export GOTRUE_MAILER_AUTOCONFIRM="true"
export GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED="false"
export GOTRUE_DISABLE_SIGNUP="false"
export GOTRUE_MAILER_URLPATHS_CONFIRMATION="/auth/v1/verify"
export GOTRUE_MAILER_URLPATHS_INVITE="/auth/v1/verify"
export GOTRUE_MAILER_URLPATHS_RECOVERY="/auth/v1/verify"
export GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE="/auth/v1/verify"
export API_EXTERNAL_URL="http://localhost:54399"
auth &
AUTH_PID=$!

# Wait for GoTrue to be ready (it runs migrations on startup)
echo "    Waiting for GoTrue to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:9999/health > /dev/null 2>&1; then
    echo "    GoTrue is ready."
    break
  fi
  if ! kill -0 $AUTH_PID 2>/dev/null; then
    echo "    ERROR: GoTrue exited unexpectedly. Check logs above."
    exit 1
  fi
  sleep 1
done

# Step 3: Run app migrations (auth.users now exists from GoTrue)
# Track applied migrations so container restarts don't re-run them
psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public._dev_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz DEFAULT now()
);
SQL

echo "==> Running migrations..."
for f in /app/supabase/migrations/*.sql; do
  fname="$(basename "$f")"
  already=$(psql -U postgres -tAc "SELECT 1 FROM public._dev_migrations WHERE name = '${fname}'" 2>/dev/null || true)
  if [ "$already" = "1" ]; then
    echo "  -> ${fname} (already applied, skipping)"
    continue
  fi
  echo "  -> ${fname}"
  psql -U postgres -v ON_ERROR_STOP=1 -f "$f"
  psql -U postgres -c "INSERT INTO public._dev_migrations (name) VALUES ('${fname}')"
done

echo "==> Granting permissions..."
psql -U postgres <<'SQL'
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO service_role;
GRANT USAGE ON SCHEMA auth TO service_role;
SQL

echo "==> Creating auth users via GoTrue API..."
ANON_HDR="apikey: ${ANON_KEY}"

# Create evrhet user (or verify exists)
EVRHET_RESP=$(curl -sf -X POST "http://127.0.0.1:9999/admin/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -d '{
    "id": "aaaaaaaa-0000-0000-0000-000000000001",
    "email": "evrhet@postimp.com",
    "password": "password123",
    "email_confirm": true,
    "app_metadata": {"provider":"email","providers":["email"]}
  }' 2>&1) || echo "  (evrhet user may already exist)"
echo "  evrhet@postimp.com: done"

# Create ryan user (or verify exists)
RYAN_RESP=$(curl -sf -X POST "http://127.0.0.1:9999/admin/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -d '{
    "id": "bbbbbbbb-0000-0000-0000-000000000002",
    "email": "ryan@postimp.com",
    "password": "password123",
    "email_confirm": true,
    "app_metadata": {"provider":"email","providers":["email"]}
  }' 2>&1) || echo "  (ryan user may already exist)"
echo "  ryan@postimp.com: done"

echo "==> Seeding app data..."
psql -U postgres -v ON_ERROR_STOP=1 -f /app/supabase/seed.sql

echo "==> Starting PostgREST..."
cat > /tmp/postgrest.conf <<CONF
db-uri = "postgres://authenticator:postgres@localhost:5432/postgres"
db-schemas = "public"
db-anon-role = "anon"
server-port = 3001
jwt-secret = "${JWT_SECRET}"
CONF
postgrest /tmp/postgrest.conf &
sleep 2

echo "==> Starting dev proxy..."
node /app/scripts/dev-proxy.mjs &
sleep 1

echo ""
echo "  ================================================"
echo "  Dev environment ready!"
echo "  ================================================"
echo ""
echo "  App:     http://localhost:3456"
echo "  API:     http://localhost:54399"
echo ""
echo "  Accounts:"
echo "    evrhet@postimp.com / password123"
echo "    ryan@postimp.com   / password123"
echo ""
echo "  Both users belong to D&D Labs + Pizza Planet"
echo "  ================================================"
echo ""

echo "==> Starting Next.js dev server..."
cd /app
# Browser uses host-mapped port; server-side uses SUPABASE_URL override (internal)
export NEXT_PUBLIC_SUPABASE_URL="http://localhost:54399"
export SUPABASE_URL="http://localhost:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${ANON_KEY}"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"
export NEXT_PUBLIC_BASE_URL="http://localhost:3456"
export OPENAI_API_KEY="fake-key-dev-only"
export INSTAGRAM_APP_ID="fake-id"
export INSTAGRAM_APP_SECRET="fake-secret"
export FACEBOOK_APP_ID="fake-id"
export FACEBOOK_APP_SECRET="fake-secret"
export TWILIO_ACCOUNT_SID="ACfake"
export TWILIO_AUTH_TOKEN="fake-token"
export TWILIO_PHONE_NUMBER="+15551234567"
export CRON_SECRET="dev-cron-secret"

node_modules/.bin/next dev --hostname 0.0.0.0 &
NEXT_PID=$!
# Keep container alive — wait on Next.js and restart if it exits
while true; do
  wait $NEXT_PID || true
  echo "==> Next.js exited (code $?), restarting in 2s..."
  sleep 2
  node_modules/.bin/next dev --hostname 0.0.0.0 &
  NEXT_PID=$!
done
