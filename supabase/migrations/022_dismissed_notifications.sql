-- Per-user dismissed notifications.
-- Notifications are derived live from peers' posts (no notifications table), so
-- "deleting" a notification = recording that this user dismissed a given post's
-- notification. getNotifications() filters these out. Dismissals are cross-device.

create table if not exists public.dismissed_notifications (
  user_id      uuid not null references public.users(id) on delete cascade,
  post_id      uuid not null references public.posts(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists dismissed_notifications_user_idx
  on public.dismissed_notifications (user_id);

alter table public.dismissed_notifications enable row level security;

-- Each user manages only their own dismissals.
create policy "dismissed_select_own" on public.dismissed_notifications
  for select using (auth.uid() = user_id);

create policy "dismissed_insert_own" on public.dismissed_notifications
  for insert with check (auth.uid() = user_id);

create policy "dismissed_delete_own" on public.dismissed_notifications
  for delete using (auth.uid() = user_id);
