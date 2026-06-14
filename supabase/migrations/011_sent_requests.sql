-- Outgoing pending requests: people the current user has liked (right-swiped)
-- who have not yet responded and are not yet matched.
-- auth.uid() internal so a caller only sees their own sent requests.

create or replace function public.get_sent_requests()
returns table (
  id uuid,
  name text,
  photo_url text,
  city text,
  xp integer,
  bio text,
  genres text[],
  requested_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.name, u.photo_url, u.city, u.xp, u.bio, u.genres, s.created_at
  from public.swipes s
  join public.users u on u.id = s.swiped_id
  where s.swiper_id = auth.uid()
    and s.direction = 'right'
    -- they haven't responded to me yet
    and not exists (
      select 1 from public.swipes s2
      where s2.swiper_id = s.swiped_id and s2.swiped_id = auth.uid()
    )
    -- and we aren't matched
    and not exists (
      select 1 from public.matches m
      where m.user1_id = least(auth.uid(), s.swiped_id)
        and m.user2_id = greatest(auth.uid(), s.swiped_id)
    )
  order by s.created_at desc;
$$;

grant execute on function public.get_sent_requests() to authenticated, anon;
