-- Durable, provider-neutral orchestration for Chaplin media outputs.

alter table public.media_assets drop constraint if exists media_assets_kind_check;
alter table public.media_assets add constraint media_assets_kind_check check (
  kind in (
    'avatar', 'banner', 'gallery', 'dialogue', 'sfx', 'theme', 'video',
    'poster', 'backdrop', 'episode', 'reference', 'room_tone', 'mixed_audio',
    'shot', 'captions', 'manifest', 'trailer', 'spark', 'punch', 'spot'
  )
);

alter table public.episode_shots
  add column if not exists cast_character_ids text[] not null default '{}',
  add column if not exists aspect_ratio text not null default '9:16'
    check (aspect_ratio in ('9:16', '16:9', '1:1')),
  add column if not exists room_tone_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists mixed_audio_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists final_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists approval_status text not null default 'draft'
    check (approval_status in ('draft', 'in_review', 'approved', 'rejected')),
  add column if not exists selected_take_number integer,
  add column if not exists last_error text;

create table if not exists public.media_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('actor', 'shot', 'episode', 'spot')),
  scope_id text not null,
  output_type text not null check (
    output_type in (
      'identity_still', 'gallery_still', 'poster', 'spark', 'punch',
      'shot', 'episode', 'spot', 'trailer', 'delivery_package'
    )
  ),
  status text not null default 'draft' check (
    status in (
      'draft', 'queued', 'running', 'needs_review', 'approved',
      'assembling', 'succeeded', 'failed', 'cancelled'
    )
  ),
  current_step text,
  spec jsonb not null default '{}',
  manifest jsonb not null default '{}',
  idempotency_key text not null unique,
  created_by text references public.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_pipeline_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.media_pipeline_runs(id) on delete cascade,
  step_key text not null,
  position integer not null check (position > 0),
  executor text not null,
  status text not null default 'blocked' check (
    status in (
      'blocked', 'ready', 'queued', 'running', 'needs_review',
      'approved', 'succeeded', 'failed', 'skipped', 'cancelled'
    )
  ),
  requires_review boolean not null default false,
  attempt integer not null default 1 check (attempt > 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  input jsonb not null default '{}',
  output jsonb not null default '{}',
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  output_asset_id uuid references public.media_assets(id) on delete set null,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, step_key)
);

create table if not exists public.episode_shot_takes (
  id uuid primary key default gen_random_uuid(),
  episode_shot_id uuid not null references public.episode_shots(id) on delete cascade,
  pipeline_run_id uuid not null references public.media_pipeline_runs(id) on delete cascade,
  take_number integer not null check (take_number > 0),
  status text not null default 'draft' check (
    status in ('draft', 'generating', 'in_review', 'approved', 'rejected', 'failed')
  ),
  reference_asset_id uuid references public.media_assets(id) on delete set null,
  video_asset_id uuid references public.media_assets(id) on delete set null,
  dialogue_asset_id uuid references public.media_assets(id) on delete set null,
  sfx_asset_id uuid references public.media_assets(id) on delete set null,
  room_tone_asset_id uuid references public.media_assets(id) on delete set null,
  mixed_audio_asset_id uuid references public.media_assets(id) on delete set null,
  final_asset_id uuid references public.media_assets(id) on delete set null,
  image_prompt text,
  video_prompt text,
  qc_report jsonb not null default '{}',
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_shot_id, take_number)
);

create index if not exists media_pipeline_scope_idx
  on public.media_pipeline_runs(scope_type, scope_id, created_at desc);
create index if not exists media_pipeline_steps_run_idx
  on public.media_pipeline_steps(run_id, position);
create index if not exists episode_shot_takes_shot_idx
  on public.episode_shot_takes(episode_shot_id, take_number desc);

alter table public.media_pipeline_runs enable row level security;
alter table public.media_pipeline_steps enable row level security;
alter table public.episode_shot_takes enable row level security;
