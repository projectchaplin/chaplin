-- Replace technical asset-log captions with creator-facing production updates.

update public.feed_posts post
set body = case
  when asset.prompt ~* 'first production frame[[:space:]]+for[[:space:]]+["“][^"”]+["”]'
    then 'Building a new scene for “'
      || substring(asset.prompt from '(?i)first production frame[[:space:]]+for[[:space:]]+["“]([^"”]+)["”]')
      || '” with ' || character.name || '. First look.'
  else 'A new scene with ' || character.name || ' is taking shape. First look.'
end
from public.media_assets asset
join public.characters character on character.id = asset.character_id
where post.source_asset_id = asset.id
  and asset.kind = 'gallery'
  and post.body like 'New scene frame for %';

update public.feed_posts post
set body = 'A new scene with ' || character.name || ' is coming alive.'
from public.media_assets asset
join public.characters character on character.id = asset.character_id
where post.source_asset_id = asset.id
  and asset.kind = 'video'
  and post.body like '% has a new scene in motion.';

update public.feed_posts post
set body = 'Meet ' || character.name || '. A new actor is taking shape.'
from public.media_assets asset
join public.characters character on character.id = asset.character_id
where post.source_asset_id = asset.id
  and asset.kind = 'avatar'
  and post.body like '% has a new identity portrait.';

update public.feed_posts post
set body = character.name || '’s world is taking shape.'
from public.media_assets asset
join public.characters character on character.id = asset.character_id
where post.source_asset_id = asset.id
  and asset.kind = 'banner'
  and post.body like '% has a new hero cover.';
