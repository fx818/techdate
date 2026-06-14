-- Let authors edit/delete their own posts
create policy "Authors can update own posts"
  on public.posts for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "Authors can delete own posts"
  on public.posts for delete using (auth.uid() = author_id);

-- Let authors delete their own comments
create policy "Authors can delete own comments"
  on public.comments for delete using (auth.uid() = author_id);

-- Let users delete a match they belong to (used by unmatch + block)
create policy "Users can delete own matches"
  on public.matches for delete using (auth.uid() = user1_id or auth.uid() = user2_id);

-- Self-service account deletion. Deletes the auth user; public.users cascades
-- via its FK (on delete cascade), which cascades to posts/comments/likes/etc.
create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
