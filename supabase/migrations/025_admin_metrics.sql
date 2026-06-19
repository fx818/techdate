-- Kill-test instrumentation.
--
-- The 6–8 week launch kill-test (≥20 humans posting unprompted >once; ≥30% of a
-- week-1 cohort still posting in week 4) is computable entirely from existing
-- tables (users, posts, xp_events, swipes, matches) — no new events table needed.
-- This RPC rolls those numbers up in one admin-only call so the founder can read
-- go/no-go at a glance. Cohort is a rolling proxy: "week 1" = users who signed up
-- 21–28 days ago; "week 4" = whether they posted in the last 7 days.

create or replace function public.admin_metrics()
returns json
language sql security definer set search_path = public stable as $$
  select case when not public.is_admin() then null else json_build_object(
    'generated_at', now(),
    'signups_total', (select count(*) from users),
    'signups_7d', (select count(*) from users where created_at > now() - interval '7 days'),
    'community_posts_total',
      (select count(*) from posts where is_gideon = false and author_id is not null),
    'community_posts_7d',
      (select count(*) from posts
        where is_gideon = false and author_id is not null
          and created_at > now() - interval '7 days'),
    'posters_total',
      (select count(distinct author_id) from posts
        where is_gideon = false and author_id is not null),
    'repeat_posters',
      (select count(*) from (
        select author_id from posts
          where is_gideon = false and author_id is not null
          group by author_id having count(*) >= 2) t),
    'active_7d',
      (select count(distinct user_id) from xp_events where created_at > now() - interval '7 days'),
    'pings_total', (select count(*) from swipes where direction = 'right'),
    'matches_total', (select count(*) from matches),
    'cohort_eligible',
      (select count(*) from users
        where created_at between now() - interval '28 days' and now() - interval '21 days'),
    'cohort_retained',
      (select count(*) from users u
        where u.created_at between now() - interval '28 days' and now() - interval '21 days'
          and exists (
            select 1 from posts p
              where p.author_id = u.id and p.is_gideon = false
                and p.created_at > now() - interval '7 days'))
  ) end;
$$;

grant execute on function public.admin_metrics() to authenticated;
