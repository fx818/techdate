create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('like','comment','reply','post','profile_complete','login_streak')),
  xp_awarded integer not null,
  created_at timestamptz not null default now()
);

create index xp_events_user_id_idx on public.xp_events(user_id);

alter table public.xp_events enable row level security;

create policy "Users can read own XP events"
  on public.xp_events for select using (auth.uid() = user_id);
