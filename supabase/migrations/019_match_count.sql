-- Public match count for any user. matches RLS only lets a user read their OWN
-- matches, so a SECURITY DEFINER function is needed to expose another user's
-- total match count on their public profile. Returns only an integer count —
-- never who they matched with (that stays private).
create or replace function public.match_count(p_user uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.matches
  where user1_id = p_user or user2_id = p_user;
$$;

grant execute on function public.match_count(uuid) to authenticated, anon;
