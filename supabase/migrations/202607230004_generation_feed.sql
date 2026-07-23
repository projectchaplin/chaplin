-- Turn the creator feed into a cross-account production activity stream.
-- Every saved generated asset can become exactly one feed post, including
-- playable dialogue, SFX, and theme audio.

alter table public.feed_posts
  drop constraint if exists feed_posts_media_kind_check;

alter table public.feed_posts
  add constraint feed_posts_media_kind_check
  check (media_kind in ('image', 'video', 'audio'));

alter table public.feed_posts
  add column if not exists source_asset_id uuid references public.media_assets(id) on delete set null;

create unique index if not exists feed_posts_source_asset_unique
  on public.feed_posts(source_asset_id)
  where source_asset_id is not null;

-- Connect any earlier feed post that already used the exact generated URL.
with matched as (
  select distinct on (asset.id) post.id as post_id, asset.id as asset_id
  from public.media_assets asset
  join public.feed_posts post on post.media_url = asset.url
  where post.source_asset_id is null
  order by asset.id, post.created_at asc
)
update public.feed_posts post
set source_asset_id = matched.asset_id
from matched
where post.id = matched.post_id;

-- Backfill every existing generated asset from every creator account.
insert into public.feed_posts (
  author_id,
  body,
  media_kind,
  media_url,
  source_asset_id,
  created_at
)
select
  character.maker_id,
  case asset.kind
    when 'dialogue' then 'New dialogue take for ' || character.name || case when asset.prompt is not null then E'.\n“' || left(asset.prompt, 320) || '”' else '.' end
    when 'sfx' then 'New sound effect for ' || character.name || case when asset.prompt is not null then '. ' || left(asset.prompt, 320) else '.' end
    when 'theme' then 'New theme for ' || character.name || case when asset.prompt is not null then '. ' || left(asset.prompt, 320) else '.' end
    when 'video' then character.name || ' has a new scene in motion.'
    when 'gallery' then 'New scene frame for ' || character.name || '.'
    when 'avatar' then character.name || ' has a new identity portrait.'
    when 'banner' then character.name || ' has a new hero cover.'
    else 'New production output for ' || character.name || '.'
  end,
  case
    when asset.kind in ('dialogue', 'sfx', 'theme') then 'audio'
    when asset.kind = 'video' then 'video'
    else 'image'
  end,
  asset.url,
  asset.id,
  asset.created_at
from public.media_assets asset
join public.characters character on character.id = asset.character_id
join public.users creator on creator.id = character.maker_id
where asset.kind in ('avatar', 'banner', 'gallery', 'dialogue', 'sfx', 'theme', 'video')
  and asset.url is not null
  and not exists (
    select 1
    from public.feed_posts post
    where post.source_asset_id = asset.id
  )
on conflict do nothing;
