-- ============================================================
-- FIX 1: like/comment counters never updated.
-- The counter triggers ran as SECURITY INVOKER, so their UPDATE on
-- public.posts was silently blocked by RLS (posts has no UPDATE policy).
-- Recreate them as SECURITY DEFINER so they bypass RLS for the count update.
-- ============================================================

create or replace function increment_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts set likes_count = likes_count + 1 where id = NEW.post_id;
  return NEW;
end;
$$;

create or replace function decrement_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts set likes_count = greatest(0, likes_count - 1) where id = OLD.post_id;
  return OLD;
end;
$$;

create or replace function increment_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts set comments_count = comments_count + 1 where id = NEW.post_id;
  return NEW;
end;
$$;

-- Backfill counts that were stuck at 0 while the triggers were broken
update public.posts p set
  likes_count = (select count(*) from public.likes l where l.post_id = p.id),
  comments_count = (select count(*) from public.comments c where c.post_id = p.id);

-- ============================================================
-- FIX 2: matches were never created.
-- The match-detection query in /api/swipes reads a swipe where the OTHER
-- user is the swiper, but the swipes SELECT RLS only allows reading rows
-- where auth.uid() = swiper_id — so the reciprocal swipe is invisible and
-- no match is ever detected. This SECURITY DEFINER function answers the
-- single yes/no reciprocal question without exposing swipe data broadly.
-- ============================================================

create or replace function public.has_right_swipe(p_swiper uuid, p_swiped uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.swipes
    where swiper_id = p_swiper
      and swiped_id = p_swiped
      and direction = 'right'
  );
$$;

grant execute on function public.has_right_swipe(uuid, uuid) to authenticated, anon;
