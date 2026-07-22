-- Email-authenticated Chaplin accounts and an additive video-feed bootstrap.
-- Existing feed rows, reactions, replies, and reposts are never deleted.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  account_role text not null default 'creator' check (account_role in ('creator', 'brand', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
revoke update on public.user_profiles from authenticated;
grant update (display_name) on public.user_profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
  on public.user_profiles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own non-role profile fields" on public.user_profiles;
create policy "Users can update their own non-role profile fields"
  on public.user_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_chaplin_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  profile_name text;
  profile_handle text;
  role_badges text[];
begin
  requested_role := case
    when new.raw_user_meta_data->>'account_role' in ('creator', 'brand')
      then new.raw_user_meta_data->>'account_role'
    else 'creator'
  end;
  profile_name := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1), 'Chaplin Creator');
  profile_handle := '@' || lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]+', '', 'g')) || '_' || left(new.id::text, 4);
  role_badges := case when requested_role = 'brand' then array['brand']::text[] else array['maker', 'caster']::text[] end;

  insert into public.user_profiles (user_id, email, display_name, account_role)
  values (new.id, new.email, profile_name, requested_role)
  on conflict (user_id) do update set email = excluded.email, display_name = excluded.display_name, updated_at = now();

  insert into public.users (id, name, handle, role_badges, avatar_initial, avatar_hue)
  values (new.id::text, profile_name, profile_handle, role_badges, upper(left(profile_name, 1)), 165)
  on conflict (id) do update set name = excluded.name, handle = excluded.handle, updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_chaplin on auth.users;
create trigger on_auth_user_created_chaplin
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute procedure public.handle_new_chaplin_user();

alter table public.feed_posts
  add column if not exists source_asset_id uuid references public.media_assets(id) on delete set null;

create unique index if not exists feed_posts_source_asset_idx
  on public.feed_posts(source_asset_id)
  where source_asset_id is not null;

insert into public.feed_posts (author_id, body, media_kind, media_url, source_asset_id, created_at)
select
  coalesce(character.maker_id, 'u-admin'),
  character.name || ' — a new five-second performance test. The identity stays locked; this is the latest movement, lighting, and camera pass.',
  'video',
  asset.url,
  asset.id,
  asset.created_at
from public.media_assets asset
join public.characters character on character.id = asset.character_id
where asset.kind = 'video'
  and not exists (select 1 from public.feed_posts existing where existing.source_asset_id = asset.id)
order by asset.created_at desc
limit 24;

-- Give the bootstrapped performances a small, stable social starting state.
insert into public.feed_reactions (post_id, user_id, kind)
select post.id, seed_user.id, 'like'
from public.feed_posts post
cross join (values ('u-arjun'), ('u-priya')) as seed_user(id)
where post.source_asset_id is not null
  and exists (select 1 from public.users existing_user where existing_user.id = seed_user.id)
on conflict do nothing;
