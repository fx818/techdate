-- Gideon reject queue + tombstones.
--
-- When the LLM judge (migration 031) DROPs a candidate, Gideon records it here
-- so the founder can review it at /admin/gideon/rejections and either Approve
-- (promote into posts) or Delete (permanent — tombstone the URL so it never
-- re-surfaces). Un-actioned rejects auto-expire after 14 days (purge runs in
-- the cron). Gideon reads/writes via the service-role client (bypasses RLS).

create table if not exists public.gideon_rejections (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  url        text not null unique,
  content    text,
  image_url  text,
  genre      text not null,
  source     text not null,
  score      int  not null,
  reason     text,
  created_at timestamptz not null default now()
);

create index if not exists gideon_rejections_created_idx
  on public.gideon_rejections(created_at desc);

create table if not exists public.gideon_dismissed_urls (
  url        text primary key,
  created_at timestamptz not null default now()
);

alter table public.gideon_rejections enable row level security;
alter table public.gideon_dismissed_urls enable row level security;

-- Admins read the queue directly (no secrets in a reject row). Mutations go
-- through the SECURITY DEFINER RPCs below, so no insert/update/delete policy.
drop policy if exists "Admins read rejections" on public.gideon_rejections;
create policy "Admins read rejections"
  on public.gideon_rejections for select
  using (public.is_admin());

drop policy if exists "Admins read dismissed" on public.gideon_dismissed_urls;
create policy "Admins read dismissed"
  on public.gideon_dismissed_urls for select
  using (public.is_admin());

-- Approve: move a reject into the feed. Generates a unique slug the same way
-- gideon/fetch.py does (lowercase, non-alphanumerics -> '-', trim, cap 60;
-- random 6-char suffix on collision). Returns the new post id; null if not admin.
create or replace function public.gideon_approve_rejection(p_id uuid)
returns uuid
language plpgsql security definer set search_path = public volatile as $$
declare
  r      public.gideon_rejections%rowtype;
  v_slug text;
  v_id   uuid;
begin
  if not public.is_admin() then
    return null;
  end if;

  select * into r from public.gideon_rejections where id = p_id;
  if not found then
    return null;
  end if;

  v_slug := nullif(
    trim(both '-' from substr(regexp_replace(lower(coalesce(r.title, '')), '[^a-z0-9]+', '-', 'g'), 1, 60)),
    ''
  );
  v_slug := coalesce(v_slug, 'post');
  if exists (select 1 from public.posts where slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end if;

  insert into public.posts (is_gideon, title, slug, url, content, image_url, genre, source, author_id)
  values (true, r.title, v_slug, r.url, r.content, r.image_url, r.genre, r.source, null)
  returning id into v_id;

  delete from public.gideon_rejections where id = p_id;
  return v_id;
end;
$$;

grant execute on function public.gideon_approve_rejection(uuid) to authenticated;

-- Dismiss: permanently kill a reject. Tombstones the URL and removes the row.
create or replace function public.gideon_dismiss_rejection(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public volatile as $$
declare
  v_url text;
begin
  if not public.is_admin() then
    return null;
  end if;

  select url into v_url from public.gideon_rejections where id = p_id;
  if not found then
    return false;
  end if;

  insert into public.gideon_dismissed_urls (url) values (v_url) on conflict (url) do nothing;
  delete from public.gideon_rejections where id = p_id;
  return true;
end;
$$;

grant execute on function public.gideon_dismiss_rejection(uuid) to authenticated;
