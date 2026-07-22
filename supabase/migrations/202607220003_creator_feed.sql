-- One shared creator feed. Every post has at most one image or video, can be
-- replied to as a thread, reacted to, and reposted into the same feed.

create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null references public.users(id) on delete cascade,
  body text not null default '' check (length(body) <= 2000),
  media_kind text check (media_kind in ('image', 'video')),
  media_url text,
  shared_post_id uuid references public.feed_posts(id) on delete set null,
  series_id uuid references public.series(id) on delete set null,
  episode_id uuid references public.episodes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((media_kind is null and media_url is null) or (media_kind is not null and media_url is not null)),
  check (length(trim(body)) > 0 or media_url is not null or shared_post_id is not null)
);

create table if not exists public.feed_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  author_id text not null references public.users(id) on delete cascade,
  parent_reply_id uuid references public.feed_replies(id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feed_reactions (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  kind text not null default 'like' check (kind = 'like'),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);

create index if not exists feed_posts_created_idx on public.feed_posts(created_at desc);
create index if not exists feed_posts_author_idx on public.feed_posts(author_id, created_at desc);
create index if not exists feed_posts_shared_idx on public.feed_posts(shared_post_id) where shared_post_id is not null;
create index if not exists feed_replies_post_idx on public.feed_replies(post_id, created_at asc);

alter table public.feed_posts enable row level security;
alter table public.feed_replies enable row level security;
alter table public.feed_reactions enable row level security;

-- A small social starting state; these are creator updates, not a catalogue.
insert into public.feed_posts (id, author_id, body, media_kind, media_url, created_at)
values
  ('10000000-0000-4000-8000-000000000001', 'u-priya', 'Meher finally has a locked voice and a cleaner entrance. I cut every line that explained who she was and let the performance do the work.', 'image', '/characters/c-selene-banner.webp', now() - interval '3 hours'),
  ('10000000-0000-4000-8000-000000000002', 'u-arjun', 'The first episode of The Last Signal now has twelve actual five-second beats. The cliffhanger is doing more work than the dialogue.', 'image', '/characters/c-bramble-banner.webp', now() - interval '90 minutes'),
  ('10000000-0000-4000-8000-000000000003', 'u-meera', 'Question for everyone building horror: what makes you stay for episode two—the face, the sound, or the rule the story just broke?', null, null, now() - interval '25 minutes')
on conflict (id) do nothing;

insert into public.feed_replies (id, post_id, author_id, body, created_at)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'u-kabir', 'The silence before the line. That is the part I would cast.', now() - interval '2 hours'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'u-priya', 'The rule. A good face gets attention; a broken rule creates the next tap.', now() - interval '12 minutes')
on conflict (id) do nothing;

insert into public.feed_reactions (post_id, user_id)
values
  ('10000000-0000-4000-8000-000000000001', 'u-arjun'),
  ('10000000-0000-4000-8000-000000000001', 'u-kabir'),
  ('10000000-0000-4000-8000-000000000002', 'u-priya'),
  ('10000000-0000-4000-8000-000000000003', 'u-meera')
on conflict do nothing;

