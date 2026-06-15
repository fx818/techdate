-- Human-readable URL slugs: usernames for users, slugs for posts.
-- Adds the columns, backfills existing rows uniquely, then locks in
-- NOT NULL + unique + format constraints.

-- ---------------------------------------------------------------------------
-- USERS.username  →  /users/<username>
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists username text;

-- Seed from name: lowercase, strip non-alphanumerics. Fallback to 'user'.
update public.users
  set username = nullif(regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g'), '')
  where username is null;
update public.users set username = 'user' where username is null or username = '';

-- Normalise length (2..20) before de-duping.
update public.users set username = left(username, 20);
update public.users
  set username = username || substr(replace(id::text, '-', ''), 1, 4)
  where length(username) < 2;

-- De-dupe: keep the earliest as-is, suffix the rest with an incrementing number.
do $$
declare
  r record;
  base text;
  cand text;
  n int;
begin
  for r in select id, username from public.users order by created_at, id loop
    base := r.username;
    cand := base;
    n := 1;
    while exists (select 1 from public.users u where u.username = cand and u.id <> r.id) loop
      n := n + 1;
      cand := left(base, 20) || n::text;
    end loop;
    if cand <> r.username then
      update public.users set username = cand where id = r.id;
    end if;
  end loop;
end $$;

alter table public.users alter column username set not null;
alter table public.users
  add constraint users_username_format check (username ~ '^[a-z0-9_]{2,30}$');
create unique index if not exists users_username_key on public.users (username);

-- ---------------------------------------------------------------------------
-- POSTS.slug  →  /posts/<slug>
-- ---------------------------------------------------------------------------
alter table public.posts add column if not exists slug text;

-- Seed from title: lowercase, non-alphanumerics → hyphen, trim hyphens, cap 60.
update public.posts
  set slug = nullif(trim(both '-' from regexp_replace(lower(coalesce(title, '')), '[^a-z0-9]+', '-', 'g')), '')
  where slug is null;
update public.posts set slug = 'post' where slug is null or slug = '';
update public.posts set slug = left(slug, 60);

-- De-dupe in stable order.
do $$
declare
  r record;
  base text;
  cand text;
  n int;
begin
  for r in select id, slug from public.posts order by created_at, id loop
    base := r.slug;
    cand := base;
    n := 1;
    while exists (select 1 from public.posts p where p.slug = cand and p.id <> r.id) loop
      n := n + 1;
      cand := left(base, 60) || '-' || n::text;
    end loop;
    if cand <> r.slug then
      update public.posts set slug = cand where id = r.id;
    end if;
  end loop;
end $$;

alter table public.posts alter column slug set not null;
create unique index if not exists posts_slug_key on public.posts (slug);
