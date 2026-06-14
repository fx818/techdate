-- Pure request/accept model.
-- A right-swipe is a pending REQUEST. No match is auto-created.
-- The recipient sees incoming requests and explicitly accepts (creates the
-- match) or declines. This function returns the profiles of people who have
-- requested the current user and are still awaiting a response.
-- Uses auth.uid() internally so a caller can only ever see THEIR OWN requests.

create or replace function public.get_incoming_requests()
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
  join public.users u on u.id = s.swiper_id
  where s.swiped_id = auth.uid()
    and s.direction = 'right'
    -- I haven't responded to them yet
    and not exists (
      select 1 from public.swipes s2
      where s2.swiper_id = auth.uid() and s2.swiped_id = s.swiper_id
    )
    -- and we aren't already matched
    and not exists (
      select 1 from public.matches m
      where m.user1_id = least(auth.uid(), s.swiper_id)
        and m.user2_id = greatest(auth.uid(), s.swiper_id)
    )
  order by s.created_at desc;
$$;

grant execute on function public.get_incoming_requests() to authenticated, anon;
