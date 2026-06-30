-- Gideon gained three new sources on 2026-06-30 (Reddit, arXiv, GitHub), but
-- posts_source_check still only allowed the old set, so inserting any reddit/arxiv/
-- github post fails with check-constraint 23514 and crashes the Gideon run (same
-- class of bug as 027 for lobsters). Add the three new sources to the allowed set.
alter table posts drop constraint if exists posts_source_check;
alter table posts add constraint posts_source_check
  check (source = any (array['hackernews', 'devto', 'xcom', 'user', 'lobsters', 'reddit', 'arxiv', 'github']));
