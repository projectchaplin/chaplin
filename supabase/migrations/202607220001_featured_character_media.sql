alter table public.characters
  add column if not exists featured_voice_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists featured_theme_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists featured_video_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists featured_cover_asset_id uuid references public.media_assets(id) on delete set null;

