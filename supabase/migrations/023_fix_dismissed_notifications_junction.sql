-- Migration 022 created dismissed_notifications with FKs to BOTH posts and users
-- and a composite PK (user_id, post_id). That is the classic junction-table
-- signature, so PostgREST auto-inferred a posts <-> users many-to-many
-- relationship. This made the direct `posts.author_id -> users` embed ambiguous,
-- causing every `posts.select('*, users(...)')` query to error and return null —
-- which showed up as an empty feed and missing notifications across the app.
--
-- Fix: drop the FK from user_id to users so the table is no longer a posts<->users
-- junction. Integrity is still guaranteed by the RLS insert check
-- (auth.uid() = user_id), and the post_id FK + ON DELETE CASCADE is kept.
alter table public.dismissed_notifications
  drop constraint if exists dismissed_notifications_user_id_fkey;

-- Nudge PostgREST to reload its schema cache immediately.
notify pgrst, 'reload schema';
