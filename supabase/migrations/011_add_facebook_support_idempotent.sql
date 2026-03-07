-- Idempotent re-application of 007_add_facebook_support for deployments that missed it.

-- Temporary token storage for OAuth callback → page selection
CREATE TABLE IF NOT EXISTS public.pending_facebook_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  facebook_user_id text NOT NULL,
  user_access_token text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id)
);

-- Facebook page connections
CREATE TABLE IF NOT EXISTS public.facebook_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  facebook_user_id text NOT NULL,
  facebook_page_id text NOT NULL,
  page_name text,
  page_access_token text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id)
);

-- RLS for facebook_connections
ALTER TABLE public.facebook_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'facebook_connections' AND policyname = 'Users can view own facebook connection'
  ) THEN
    CREATE POLICY "Users can view own facebook connection"
      ON public.facebook_connections FOR SELECT USING (auth.uid() = profile_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'facebook_connections' AND policyname = 'Users can insert own facebook connection'
  ) THEN
    CREATE POLICY "Users can insert own facebook connection"
      ON public.facebook_connections FOR INSERT WITH CHECK (auth.uid() = profile_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'facebook_connections' AND policyname = 'Users can update own facebook connection'
  ) THEN
    CREATE POLICY "Users can update own facebook connection"
      ON public.facebook_connections FOR UPDATE USING (auth.uid() = profile_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'facebook_connections' AND policyname = 'Users can delete own facebook connection'
  ) THEN
    CREATE POLICY "Users can delete own facebook connection"
      ON public.facebook_connections FOR DELETE USING (auth.uid() = profile_id);
  END IF;
END $$;

-- Updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'facebook_connections_updated_at'
  ) THEN
    CREATE TRIGGER facebook_connections_updated_at
      BEFORE UPDATE ON public.facebook_connections
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- RLS for pending tokens (service role only — no public policies)
ALTER TABLE public.pending_facebook_tokens ENABLE ROW LEVEL SECURITY;

-- Platform tracking on posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'facebook_post_id'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN facebook_post_id text;
  END IF;
END $$;

-- Sticky publish preferences on profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'publish_platforms'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN publish_platforms text[] DEFAULT array['instagram'];
  END IF;
END $$;
