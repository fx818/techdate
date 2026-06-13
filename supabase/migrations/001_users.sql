create extension if not exists "uuid-ossp";

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  name text not null,
  bio text,
  city text not null,
  gender text not null check (gender in ('male', 'female', 'non_binary')),
  preference text not null check (preference in ('male', 'female', 'everyone')),
  photo_url text,
  genres text[] not null default '{}',
  xp integer not null default 0,
  dating_unlocked boolean not null default false,
  interest_vector jsonb not null default '{}',
  is_premium boolean not null default false,
  last_active timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read all profiles"
  on public.users for select using (true);

create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert with check (auth.uid() = id);
