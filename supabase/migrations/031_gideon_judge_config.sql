-- Gideon LLM-judge configuration.
--
-- A singleton row (id = 1) holding the connection + behavior of the quality
-- gate Gideon applies before inserting seeded posts. Stored in DB (not env) so
-- the founder can retune it live from /admin/gideon. The raw api_key never
-- leaves the server: the _get RPC returns only key_set + key_last4, and _save
-- keeps the existing key when handed a blank one. Gideon reads this table with
-- the service-role client, which bypasses RLS.

create table if not exists public.gideon_judge_config (
  id             int primary key default 1 check (id = 1),
  enabled        boolean not null default false,
  api_key        text,
  base_url       text not null default 'https://generativelanguage.googleapis.com/v1beta/openai/',
  model          text not null default 'gemini-2.5-flash',
  criteria       text not null default
    'You are a content curator for Await, a community for verified techies (developers, engineers, security researchers, data/AI practitioners). Decide whether a candidate link is worth posting to the feed. Favor: substantive technical content, notable tool/library releases, in-depth writeups, credible research. Reject: clickbait, low-effort listicles, marketing or PR fluff, generic news rehashes, off-topic or non-technical items, and anything unsafe or NSFW.',
  pass_threshold int not null default 6 check (pass_threshold between 0 and 10),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.users(id)
);

-- Seed the single row (idempotent).
insert into public.gideon_judge_config (id) values (1) on conflict (id) do nothing;

alter table public.gideon_judge_config enable row level security;

drop policy if exists "Admins can read judge config" on public.gideon_judge_config;
create policy "Admins can read judge config"
  on public.gideon_judge_config for select
  using (public.is_admin());

drop policy if exists "Admins can update judge config" on public.gideon_judge_config;
create policy "Admins can update judge config"
  on public.gideon_judge_config for update
  using (public.is_admin()) with check (public.is_admin());

-- Read masked config (never the raw key). Admin-gated; null to everyone else.
create or replace function public.gideon_judge_config_get()
returns json
language sql security definer set search_path = public stable as $$
  select case when not public.is_admin() then null else (
    select json_build_object(
      'enabled', enabled,
      'base_url', base_url,
      'model', model,
      'criteria', criteria,
      'pass_threshold', pass_threshold,
      'key_set', (api_key is not null and length(api_key) > 0),
      'key_last4', case when api_key is not null and length(api_key) >= 4
                        then right(api_key, 4) else null end,
      'updated_at', updated_at
    ) from public.gideon_judge_config where id = 1
  ) end;
$$;

grant execute on function public.gideon_judge_config_get() to authenticated;

-- Save config. Blank p_api_key keeps the existing key; threshold clamped 0-10.
create or replace function public.gideon_judge_config_save(
  p_enabled   boolean,
  p_base_url  text,
  p_model     text,
  p_criteria  text,
  p_threshold int,
  p_api_key   text
) returns json
language plpgsql security definer set search_path = public volatile as $$
begin
  if not public.is_admin() then
    return null;
  end if;
  update public.gideon_judge_config set
    enabled        = coalesce(p_enabled, enabled),
    base_url       = coalesce(nullif(p_base_url, ''), base_url),
    model          = coalesce(nullif(p_model, ''), model),
    criteria       = coalesce(p_criteria, criteria),
    pass_threshold = greatest(0, least(10, coalesce(p_threshold, pass_threshold))),
    api_key        = case when p_api_key is null or p_api_key = '' then api_key else p_api_key end,
    updated_at     = now(),
    updated_by     = auth.uid()
  where id = 1;
  return public.gideon_judge_config_get();
end;
$$;

grant execute on function public.gideon_judge_config_save(boolean, text, text, text, int, text) to authenticated;
