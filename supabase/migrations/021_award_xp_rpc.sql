-- Atomic XP award: collapses the old 3-round-trip read-modify-write
-- (insert event → select xp → update xp) into a single DB call.
-- Uses auth.uid() so it always acts on the calling user.
create or replace function public.award_xp(p_action text, p_xp int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_xp int;
begin
  if uid is null then
    return null;
  end if;

  insert into public.xp_events (user_id, action, xp_awarded)
    values (uid, p_action, p_xp);

  update public.users
    set xp = xp + p_xp,
        -- dating_unlocked is vestigial but kept in sync for analytics parity.
        dating_unlocked = dating_unlocked or (xp + p_xp >= 100)
    where id = uid
    returning xp into new_xp;

  return new_xp;
end;
$$;

grant execute on function public.award_xp(text, int) to authenticated;
