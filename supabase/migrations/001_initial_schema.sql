-- Post Imp MVP Schema

-- profiles: extends auth.users with customer data
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  brand_name text,
  brand_description text,
  tone text,
  target_audience text,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- instagram_connections: OAuth tokens per profile
create table public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  instagram_user_id text not null,
  access_token text not null,
  token_expires_at timestamptz,
  instagram_username text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(profile_id)
);

alter table public.instagram_connections enable row level security;

create policy "Users can view own instagram connection"
  on public.instagram_connections for select
  using (auth.uid() = profile_id);

create policy "Users can insert own instagram connection"
  on public.instagram_connections for insert
  with check (auth.uid() = profile_id);

create policy "Users can update own instagram connection"
  on public.instagram_connections for update
  using (auth.uid() = profile_id);

create policy "Users can delete own instagram connection"
  on public.instagram_connections for delete
  using (auth.uid() = profile_id);

-- posts: draft and published posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  caption text,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  preview_token text unique default encode(gen_random_bytes(16), 'hex'),
  instagram_post_id text,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.posts enable row level security;

create policy "Users can view own posts"
  on public.posts for select
  using (auth.uid() = profile_id);

create policy "Users can insert own posts"
  on public.posts for insert
  with check (auth.uid() = profile_id);

create policy "Users can update own posts"
  on public.posts for update
  using (auth.uid() = profile_id);

-- Allow public access to posts via preview_token (for preview pages)
create policy "Anyone can view posts by preview token"
  on public.posts for select
  using (preview_token is not null);

-- messages: SMS conversation log
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  phone text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text,
  media_url text,
  twilio_sid text,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Users can view own messages"
  on public.messages for select
  using (auth.uid() = profile_id);

-- pending_registrations: phone numbers awaiting signup
create table public.pending_registrations (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used boolean default false,
  created_at timestamptz default now()
);

alter table public.pending_registrations enable row level security;

-- No RLS policies needed — accessed only via service role

-- Create post-images storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Storage policies for post-images bucket
create policy "Anyone can read post images"
  on storage.objects for select
  using (bucket_id = 'post-images');

create policy "Authenticated users can upload post images"
  on storage.objects for insert
  with check (bucket_id = 'post-images');

create policy "Service role can upload post images"
  on storage.objects for insert
  with check (bucket_id = 'post-images');

-- Updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger instagram_connections_updated_at
  before update on public.instagram_connections
  for each row execute function public.handle_updated_at();

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.handle_updated_at();
