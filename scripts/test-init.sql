-- Supabase-compatible schema stubs for test environment
-- These must exist before running migrations that reference them.

-- Extensions needed by migrations
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Auth schema (profiles FK references auth.users)
-- Includes columns needed by both tests (minimal) and dev seed (GoTrue-compatible).
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  aud text DEFAULT 'authenticated',
  role text DEFAULT 'authenticated',
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  confirmation_token text DEFAULT '',
  recovery_token text DEFAULT '',
  email_change_token_new text DEFAULT '',
  email_change text DEFAULT ''
);
CREATE TABLE IF NOT EXISTS auth.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  provider text NOT NULL DEFAULT 'email',
  identity_data jsonb DEFAULT '{}'::jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (provider_id, provider)
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  AS $$ SELECT (current_setting('request.jwt.claims', true)::json->>'sub')::uuid $$
  LANGUAGE sql STABLE;

-- Storage schema (migration 001 inserts into storage.buckets)
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now()
);

-- Publication (migration 002 adds to supabase_realtime)
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
END $$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;

-- Storage policies require an owner column — add a permissive policy stub
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON storage.objects USING (true) WITH CHECK (true);

-- Helper functions exposed via PostgREST RPC for test seeding
CREATE OR REPLACE FUNCTION public.test_create_user(user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO auth.users (id, email)
  VALUES (user_id, user_id || '@test.local')
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.test_delete_user(user_id uuid)
RETURNS void AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
