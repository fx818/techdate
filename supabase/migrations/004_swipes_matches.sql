create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid not null references public.users(id) on delete cascade,
  swiped_id uuid not null references public.users(id) on delete cascade,
  direction text not null check (direction in ('left', 'right')),
  created_at timestamptz not null default now(),
  unique(swiper_id, swiped_id)
);

alter table public.swipes enable row level security;

create policy "Users can insert own swipes"
  on public.swipes for insert with check (auth.uid() = swiper_id);

create policy "Users can read own swipes"
  on public.swipes for select using (auth.uid() = swiper_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references public.users(id) on delete cascade,
  user2_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user1_id, user2_id)
);

alter table public.matches enable row level security;

create policy "Users can read own matches"
  on public.matches for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);
