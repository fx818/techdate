-- Allow authenticated users to insert matches they are a party to
create policy "Users can insert own matches"
  on public.matches for insert
  with check (auth.uid() = user1_id or auth.uid() = user2_id);
