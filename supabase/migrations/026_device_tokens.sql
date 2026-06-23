create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
alter table device_tokens enable row level security;
create policy device_tokens_own on device_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index device_tokens_user_idx on device_tokens(user_id);
