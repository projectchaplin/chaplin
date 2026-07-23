-- Replace ambiguous writing formats with Chaplin's actual production outputs.

alter table public.story_drafts drop constraint if exists story_drafts_format_check;

update public.story_drafts set format = 'episode' where format = 'story';
update public.story_drafts set format = 'spot' where format = 'ad';
update public.story_drafts set format = 'punch' where format = 'reel';

alter table public.story_drafts
  add constraint story_drafts_format_check
  check (format in ('spark', 'punch', 'episode', 'spot'));
