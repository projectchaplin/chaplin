-- Account-owned creative drafts. Draft bodies remain flexible JSON so the
-- writing workflow can evolve without losing in-progress work.

create table if not exists public.story_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  format text not null default 'story' check (format in ('story', 'ad', 'reel')),
  title text not null default '',
  logline text not null default '',
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists story_drafts_owner_updated_idx
  on public.story_drafts(owner_id, updated_at desc);

alter table public.story_drafts enable row level security;

drop policy if exists "Creators can read their own drafts" on public.story_drafts;
create policy "Creators can read their own drafts"
  on public.story_drafts for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Creators can create their own drafts" on public.story_drafts;
create policy "Creators can create their own drafts"
  on public.story_drafts for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Creators can update their own drafts" on public.story_drafts;
create policy "Creators can update their own drafts"
  on public.story_drafts for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Creators can delete their own drafts" on public.story_drafts;
create policy "Creators can delete their own drafts"
  on public.story_drafts for delete
  to authenticated
  using (auth.uid() = owner_id);
