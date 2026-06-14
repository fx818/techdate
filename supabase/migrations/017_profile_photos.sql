-- Multiple profile photos. photo_url stays as the primary/avatar (header, lists);
-- photos[0] mirrors it.
alter table public.users add column if not exists photos text[] not null default '{}';

-- Backfill: seed the array with the existing single photo where present
update public.users set photos = array[photo_url] where photo_url is not null and photos = '{}';
