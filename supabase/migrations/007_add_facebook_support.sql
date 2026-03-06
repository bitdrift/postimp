-- Temporary token storage for OAuth callback → page selection
create table public.pending_facebook_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  facebook_user_id text not null,
  user_access_token text not null,
  created_at timestamptz default now(),
  unique(profile_id)
);

-- Facebook page connections
create table public.facebook_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  facebook_user_id text not null,
  facebook_page_id text not null,
  page_name text,
  page_access_token text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(profile_id)
);

-- RLS for facebook_connections (same pattern as instagram_connections)
alter table public.facebook_connections enable row level security;
create policy "Users can view own facebook connection"
  on public.facebook_connections for select using (auth.uid() = profile_id);
create policy "Users can insert own facebook connection"
  on public.facebook_connections for insert with check (auth.uid() = profile_id);
create policy "Users can update own facebook connection"
  on public.facebook_connections for update using (auth.uid() = profile_id);
create policy "Users can delete own facebook connection"
  on public.facebook_connections for delete using (auth.uid() = profile_id);
create trigger facebook_connections_updated_at
  before update on public.facebook_connections
  for each row execute function public.handle_updated_at();

-- RLS for pending tokens (service role only — no public policies)
alter table public.pending_facebook_tokens enable row level security;

-- Platform tracking on posts
alter table public.posts add column facebook_post_id text;

-- Sticky publish preferences on profiles (default: ["instagram"])
alter table public.profiles add column publish_platforms text[] default array['instagram'];
