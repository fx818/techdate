-- Track when the user last opened their notifications, so we can compute
-- the unread count for "someone you matched with posted something".
-- Defaults to now() so existing users aren't flooded with historical posts.
alter table public.users
  add column if not exists last_notifications_seen timestamptz not null default now();
