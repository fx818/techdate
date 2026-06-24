-- The Lobsters source was added to Gideon (2026-06-19) but posts_source_check was
-- never updated to allow 'lobsters', so inserting any Lobsters post fails with
-- check-constraint 23514 and crashes the Gideon run. Add 'lobsters' to the allowed set.
alter table posts drop constraint if exists posts_source_check;
alter table posts add constraint posts_source_check
  check (source = any (array['hackernews', 'devto', 'xcom', 'user', 'lobsters']));
