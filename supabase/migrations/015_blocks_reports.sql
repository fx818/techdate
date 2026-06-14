-- Blocks: blocker no longer sees / can be contacted by blocked (both directions enforced in app)
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id)
);
alter table public.blocks enable row level security;

create policy "Users manage own blocks"
  on public.blocks for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

create index if not exists blocks_blocker_idx on public.blocks(blocker_id);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);

-- Reports: abuse reports on a user, post, or comment
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('user','post','comment')),
  target_id uuid not null,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

create policy "Users can file reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users can read own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- Returns the set of user ids blocked in EITHER direction relative to the
-- caller. SECURITY DEFINER so the "they blocked me" half is visible despite RLS.
create or replace function public.get_blocked_ids()
returns table (user_id uuid)
language sql security definer set search_path = public as $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.blocks where blocked_id = auth.uid();
$$;

grant execute on function public.get_blocked_ids() to authenticated, anon;
