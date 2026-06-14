-- Allow a user to withdraw (delete) a swipe they made — needed to cancel a
-- sent like/request. swipes previously had only INSERT + SELECT policies.
create policy "Users can delete own swipes"
  on public.swipes for delete
  using (auth.uid() = swiper_id);
