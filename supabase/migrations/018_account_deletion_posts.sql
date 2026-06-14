-- Fix: posts.author_id is ON DELETE SET NULL, so deleting the auth user would
-- orphan the user's posts (left visible as anonymous content) instead of
-- removing them. Explicitly delete the caller's posts first (their comments,
-- likes, and bookmarks on those posts cascade away), then delete the auth user
-- (which cascades public.users and the rest).
create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from public.posts where author_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
