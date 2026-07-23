-- Versioned generation controls editable only through the protected Super Admin API.

create table if not exists public.pipeline_settings (
  id text primary key check (id = 'active'),
  config jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.pipeline_setting_versions (
  id uuid primary key default gen_random_uuid(),
  revision integer not null,
  config jsonb not null,
  changed_by text,
  created_at timestamptz not null default now()
);

alter table public.pipeline_settings enable row level security;
alter table public.pipeline_setting_versions enable row level security;

revoke all on public.pipeline_settings from anon, authenticated;
revoke all on public.pipeline_setting_versions from anon, authenticated;

insert into public.pipeline_settings (id, config, revision)
values ('active', '{}'::jsonb, 1)
on conflict (id) do nothing;
