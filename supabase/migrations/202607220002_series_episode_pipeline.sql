-- Chaplin's durable microdrama spine.
-- A character is cast into a series; a series owns ordered episodes; every
-- 60-second episode is planned as twelve five-second production shots.

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  owner_id text references public.users(id) on delete set null,
  title text not null,
  logline text not null,
  premise text not null,
  genre text not null,
  primary_language text not null default 'English',
  secondary_language text,
  episode_duration_seconds integer not null default 60 check (episode_duration_seconds in (60, 120)),
  status text not null default 'development' check (status in ('development', 'production', 'published', 'archived')),
  story_engine jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.series_cast (
  series_id uuid not null references public.series(id) on delete cascade,
  character_id text not null references public.characters(id) on delete restrict,
  role_name text not null,
  billing_order integer not null default 1,
  continuity_notes text,
  created_at timestamptz not null default now(),
  primary key (series_id, character_id),
  unique (series_id, billing_order)
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  episode_number integer not null check (episode_number > 0),
  title text not null,
  logline text not null,
  opening_hook text not null,
  episode_objective text not null,
  cliffhanger text not null,
  duration_seconds integer not null default 60 check (duration_seconds in (60, 120)),
  status text not null default 'planned' check (status in ('planned', 'generating', 'ready_to_assemble', 'assembling', 'assembled', 'published', 'failed')),
  continuity_in jsonb not null default '{}',
  continuity_out jsonb not null default '{}',
  master_video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, episode_number)
);

create table if not exists public.episode_shots (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  shot_number integer not null check (shot_number > 0),
  duration_seconds integer not null default 5 check (duration_seconds = 5),
  beat text not null,
  visual_action text not null,
  camera_direction text not null,
  lighting_direction text not null,
  dialogue text,
  audio_direction text,
  continuity_in jsonb not null default '{}',
  continuity_out jsonb not null default '{}',
  image_prompt text,
  video_prompt text,
  reference_asset_id uuid references public.media_assets(id) on delete set null,
  video_asset_id uuid references public.media_assets(id) on delete set null,
  dialogue_asset_id uuid references public.media_assets(id) on delete set null,
  sfx_asset_id uuid references public.media_assets(id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'generating', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id, shot_number)
);

create table if not exists public.episode_renders (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'assembling', 'succeeded', 'failed')),
  manifest jsonb not null default '{}',
  output_url text,
  storage_path text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.media_assets add column if not exists episode_id uuid references public.episodes(id) on delete cascade;
alter table public.media_assets add column if not exists episode_shot_id uuid references public.episode_shots(id) on delete cascade;
alter table public.media_assets drop constraint if exists media_assets_kind_check;
alter table public.media_assets add constraint media_assets_kind_check
  check (kind in ('avatar', 'banner', 'gallery', 'dialogue', 'sfx', 'theme', 'video', 'poster', 'backdrop', 'episode'));

alter table public.generation_jobs add column if not exists series_id uuid references public.series(id) on delete set null;
alter table public.generation_jobs add column if not exists episode_id uuid references public.episodes(id) on delete set null;
alter table public.generation_jobs add column if not exists episode_shot_id uuid references public.episode_shots(id) on delete set null;

create index if not exists series_owner_idx on public.series(owner_id, updated_at desc);
create index if not exists episodes_series_idx on public.episodes(series_id, episode_number);
create index if not exists episode_shots_episode_idx on public.episode_shots(episode_id, shot_number);
create index if not exists episode_renders_episode_idx on public.episode_renders(episode_id, created_at desc);

