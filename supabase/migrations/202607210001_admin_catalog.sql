create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  name text not null,
  handle text not null,
  role_badges text[] not null default '{}',
  avatar_initial text not null,
  avatar_hue integer not null default 0,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.characters (
  id text primary key,
  maker_id text references public.users(id) on delete set null,
  name text not null,
  archetype text not null,
  tagline text not null,
  personality text not null,
  voice_gender text not null default 'androgynous' check (voice_gender in ('feminine', 'masculine', 'androgynous')),
  voice_description text not null,
  sfx_description text not null,
  theme_description text not null,
  production_bible jsonb,
  avatar_hue integer not null default 0,
  image_url text,
  banner_url text,
  license_type text not null check (license_type in ('open', 'paid', 'approval')),
  royalty_rate numeric(12,2) not null default 0,
  castings_count integer not null default 0,
  fans_count integer not null default 0,
  earnings_total numeric(14,2) not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.characters
  add column if not exists voice_gender text not null default 'androgynous'
  check (voice_gender in ('feminine', 'masculine', 'androgynous'));

alter table public.characters
  add column if not exists production_bible jsonb;

create table if not exists public.character_voices (
  id uuid primary key default gen_random_uuid(),
  character_id text not null references public.characters(id) on delete cascade,
  provider text not null default 'elevenlabs',
  provider_voice_id text not null,
  description text not null,
  preview_url text,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(character_id, provider)
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  character_id text references public.characters(id) on delete cascade,
  story_id text,
  kind text not null check (kind in ('avatar', 'banner', 'gallery', 'dialogue', 'sfx', 'theme', 'video', 'poster', 'backdrop')),
  provider text not null,
  provider_asset_id text,
  url text not null,
  storage_path text,
  prompt text,
  duration_seconds numeric(8,2),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  character_id text references public.characters(id) on delete cascade,
  kind text not null,
  provider text not null,
  model text not null,
  prompt text,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  provider_request_id text,
  output_asset_id uuid references public.media_assets(id) on delete set null,
  error_message text,
  usage jsonb not null default '{}',
  provider_credits numeric(16,4),
  normalized_tokens numeric(16,4),
  cost_usd numeric(16,8),
  usd_to_inr_rate numeric(16,6),
  cost_inr numeric(16,4),
  cost_method text,
  pricing_note text,
  metadata jsonb not null default '{}',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.generation_jobs add column if not exists usage jsonb not null default '{}';
alter table public.generation_jobs add column if not exists provider_credits numeric(16,4);
alter table public.generation_jobs add column if not exists normalized_tokens numeric(16,4);
alter table public.generation_jobs add column if not exists cost_usd numeric(16,8);
alter table public.generation_jobs add column if not exists usd_to_inr_rate numeric(16,6);
alter table public.generation_jobs add column if not exists cost_inr numeric(16,4);
alter table public.generation_jobs add column if not exists cost_method text;
alter table public.generation_jobs add column if not exists pricing_note text;

-- Backfill the local test history so the admin ledger is useful immediately.
-- Provider-native credits cannot be reconstructed for old responses, so these
-- rows are explicitly labeled as historical rate-card estimates.
update public.generation_jobs
set
  usage = case
    when kind = 'dialogue' then jsonb_build_object('inputCharacters', length(coalesce(prompt, '')))
    when kind = 'sfx' then jsonb_build_object('durationSeconds', 5, 'inputCharacters', length(coalesce(prompt, '')))
    when kind = 'voice-design' then jsonb_build_object(
      'inputCharacters', length(coalesce(prompt, '')) * coalesce((metadata->>'previewCount')::integer, 3),
      'previewCount', coalesce((metadata->>'previewCount')::integer, 3)
    )
    else '{}'::jsonb
  end,
  cost_usd = case
    when kind = 'dialogue' then round((length(coalesce(prompt, ''))::numeric / 1000) * 0.10, 8)
    when kind = 'sfx' then round((5::numeric / 60) * 0.12, 8)
    when kind = 'voice-design' then round(((length(coalesce(prompt, '')) * coalesce((metadata->>'previewCount')::integer, 3))::numeric / 1000) * 0.10, 8)
    when kind = 'voice-lock' then 0
    else 0
  end,
  normalized_tokens = case
    when kind = 'dialogue' then ceil(((length(coalesce(prompt, ''))::numeric / 1000) * 0.10) * 1000)
    when kind = 'sfx' then ceil(((5::numeric / 60) * 0.12) * 1000)
    when kind = 'voice-design' then ceil((((length(coalesce(prompt, '')) * coalesce((metadata->>'previewCount')::integer, 3))::numeric / 1000) * 0.10) * 1000)
    else 0
  end,
  usd_to_inr_rate = 96.45,
  cost_inr = case
    when kind = 'dialogue' then round(((length(coalesce(prompt, ''))::numeric / 1000) * 0.10) * 96.45, 4)
    when kind = 'sfx' then round(((5::numeric / 60) * 0.12) * 96.45, 4)
    when kind = 'voice-design' then round((((length(coalesce(prompt, '')) * coalesce((metadata->>'previewCount')::integer, 3))::numeric / 1000) * 0.10) * 96.45, 4)
    else 0
  end,
  cost_method = 'historical-rate-card-estimate',
  pricing_note = 'Historical estimate reconstructed after generation; provider credits and exact request billing were not captured.'
where status = 'succeeded' and cost_usd is null;

-- ElevenLabs exposes the actual billed-character count in character-cost.
-- Prefer that unit over raw input length whenever the header was captured.
update public.generation_jobs
set
  cost_usd = round((provider_credits / 1000) * 0.10, 8),
  normalized_tokens = ceil(((provider_credits / 1000) * 0.10) * 1000),
  cost_inr = round(((provider_credits / 1000) * 0.10) * coalesce(usd_to_inr_rate, 96.45), 4),
  pricing_note = 'ElevenLabs v3 at $0.10/1K billable characters using the provider character-cost header. Chaplin token normalization: 1000 tokens per USD.'
where kind = 'dialogue' and provider_credits is not null;

create table if not exists public.stories (
  id text primary key,
  author_id text references public.users(id) on delete set null,
  title text not null,
  logline text not null,
  cover_hue integer not null default 0,
  backdrop_url text,
  poster_url text,
  views integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.media_assets
  drop constraint if exists media_assets_story_id_fkey;
alter table public.media_assets
  add constraint media_assets_story_id_fkey foreign key (story_id) references public.stories(id) on delete cascade;

create table if not exists public.scenes (
  id text primary key,
  story_id text not null references public.stories(id) on delete cascade,
  setting text not null,
  position integer not null,
  unique(story_id, position)
);

create table if not exists public.scene_lines (
  id text primary key,
  scene_id text not null references public.scenes(id) on delete cascade,
  character_id text not null references public.characters(id) on delete cascade,
  text text not null,
  position integer not null,
  duration_seconds numeric(8,2),
  waveform_seed integer,
  audio_asset_id uuid references public.media_assets(id) on delete set null,
  unique(scene_id, position)
);

create table if not exists public.castings (
  id text primary key,
  character_id text not null references public.characters(id) on delete cascade,
  story_id text not null references public.stories(id) on delete cascade,
  caster_id text references public.users(id) on delete set null,
  fee numeric(12,2) not null default 0,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null
);

create table if not exists public.ledger_entries (
  id text primary key,
  casting_id text references public.castings(id) on delete set null,
  character_id text not null references public.characters(id) on delete cascade,
  story_id text not null references public.stories(id) on delete cascade,
  maker_id text references public.users(id) on delete set null,
  amount numeric(12,2) not null,
  type text not null check (type in ('royalty', 'tip')),
  created_at timestamptz not null
);

create table if not exists public.home_slots (
  id uuid primary key default gen_random_uuid(),
  character_id text not null unique references public.characters(id) on delete cascade,
  position integer not null,
  status text not null default 'draft' check (status in ('draft', 'ready', 'published')),
  editorial_note text,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists media_assets_character_kind_idx on public.media_assets(character_id, kind, created_at desc);
create index if not exists generation_jobs_character_idx on public.generation_jobs(character_id, created_at desc);
create index if not exists home_slots_status_position_idx on public.home_slots(status, position);
create index if not exists castings_story_idx on public.castings(story_id);
create index if not exists ledger_maker_idx on public.ledger_entries(maker_id, created_at desc);

alter table public.users enable row level security;
alter table public.characters enable row level security;
alter table public.character_voices enable row level security;
alter table public.media_assets enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.stories enable row level security;
alter table public.scenes enable row level security;
alter table public.scene_lines enable row level security;
alter table public.castings enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.home_slots enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'character-media',
  'character-media',
  true,
  104857600,
  array['image/png', 'image/jpeg', 'image/webp', 'audio/mpeg', 'audio/wav', 'video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
