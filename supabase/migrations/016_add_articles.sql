-- Marketing articles table for SEO blog content
CREATE TABLE public.marketing_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  content text NOT NULL,
  author text NOT NULL DEFAULT 'Post Imp Team',
  tags text[] DEFAULT '{}',
  published boolean DEFAULT false,
  published_at timestamptz,

  -- SEO / OG fields
  og_title text,
  og_description text,
  og_image_url text,
  canonical_url text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_articles ENABLE ROW LEVEL SECURITY;

-- Public read access for published articles (no auth needed)
CREATE POLICY "Anyone can view published marketing articles"
  ON public.marketing_articles FOR SELECT
  USING (published = true);

-- No insert/update/delete policies — managed via service role only

CREATE TRIGGER marketing_articles_updated_at
  BEFORE UPDATE ON public.marketing_articles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_marketing_articles_slug ON public.marketing_articles(slug);
CREATE INDEX idx_marketing_articles_published_at ON public.marketing_articles(published_at DESC) WHERE published = true;

-- ============================================================
-- Slack thread state for article generation conversations
-- ============================================================
CREATE TABLE public.marketing_article_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.marketing_articles(id) ON DELETE CASCADE,
  slack_channel_id text NOT NULL,
  slack_thread_ts text NOT NULL,
  openai_response_id text,
  created_by_slack_user text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.marketing_article_threads ENABLE ROW LEVEL SECURITY;
-- No RLS policies — managed via service role only

CREATE TRIGGER marketing_article_threads_updated_at
  BEFORE UPDATE ON public.marketing_article_threads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE UNIQUE INDEX idx_article_threads_slack
  ON public.marketing_article_threads(slack_channel_id, slack_thread_ts);
