-- Extend the kill-test dashboard with engagement depth + feed composition.
--
-- The original admin_metrics() (025) tracked signups/posters/pings/matches and the
-- two launch gates. For a stickiness read we also want: how many people came back
-- TODAY (rolling 24h), and whether matched users actually talk / posts get engaged
-- with (messages, comments, likes). Plus the Gideon-vs-community post split so
-- "community posts: 6" isn't misread next to ~1.3k seeded rows.
--
-- create-or-replace + same is_admin() gate + same grant. All existing keys are
-- preserved; only new keys are added (the page reads keys by name, so additive).

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
    'gideon_posts_total', (select count(*) from posts where is_gideon = true),
    'posters_total',
      (select count(distinct author_id) from posts
        where is_gideon = false and author_id is not null),
    'repeat_posters',
      (select count(*) from (
        select author_id from posts
          where is_gideon = false and author_id is not null
          group by author_id having count(*) >= 2) t),
    'active_today',
      (select count(distinct user_id) from xp_events where created_at > now() - interval '1 day'),
    'active_7d',
      (select count(distinct user_id) from xp_events where created_at > now() - interval '7 days'),
    'messages_total', (select count(*) from messages),
    'messages_7d', (select count(*) from messages where created_at > now() - interval '7 days'),
    'comments_total', (select count(*) from comments),
    'comments_7d', (select count(*) from comments where created_at > now() - interval '7 days'),
    'likes_total', (select count(*) from likes),
    'likes_7d', (select count(*) from likes where created_at > now() - interval '7 days'),
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
