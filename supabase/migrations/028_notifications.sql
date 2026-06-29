-- Stored, event-sourced notification center.
-- Replaces the post-derivation model: every push-worthy event inserts a row here
-- so the in-app bell and phone push share one source of truth.

create table if not exists notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,   -- recipient
  type         text not null,        -- 'ping' | 'ping_accepted' | 'message' | 'peer_post' | 'gideon_post'
  title        text not null,
  body         text,
  route        text,                 -- deep-link target (same routes push uses)
  actor_id     uuid references users(id) on delete cascade,   -- who triggered (null for gideon)
  post_id      uuid references posts(id) on delete cascade,   -- for post/gideon (null otherwise)
  dismissed_at timestamptz,          -- null = visible
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;

-- Recipient owns their rows. NO insert policy: rows are written for other users
-- via the service-role admin client (RLS bypassed).
create policy notifications_select_own on notifications
  for select using (user_id = auth.uid());
create policy notifications_update_own on notifications
  for update using (user_id = auth.uid());
create policy notifications_delete_own on notifications
  for delete using (user_id = auth.uid());

-- Obsolete: notifications are no longer derived from posts, so the post-keyed
-- dismissal table is gone. Dismissal now sets notifications.dismissed_at.
drop table if exists dismissed_notifications;
