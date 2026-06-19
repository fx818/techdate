-- Founder/admin moderation triage.
--
-- Until now the reports table had no way for anyone to see the queue (RLS only
-- exposed a user's own reports) and no notion of "handled". This adds:
--   • users.is_admin  — flag the founder account(s) manually after migrating.
--   • reports.status  — 'open' | 'resolved' so triage has state.
--   • RLS policies letting admins read every report and update its status.
-- Stays within the project's anon-key + RLS model (no service-role client).

alter table public.users
  add column if not exists is_admin boolean not null default false;

alter table public.reports
  add column if not exists status text not null default 'open'
    check (status in ('open', 'resolved'));

create index if not exists reports_status_idx on public.reports(status, created_at desc);

-- Helper: is the caller an admin? SECURITY DEFINER so the reports policies can
-- consult users.is_admin without granting broad read access to the users table.
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated;

-- Admins can read the whole report queue (in addition to the existing
-- "users can read own reports" policy).
drop policy if exists "Admins can read all reports" on public.reports;
create policy "Admins can read all reports"
  on public.reports for select
  using (public.is_admin());

-- Admins can update a report (used to flip status open -> resolved).
drop policy if exists "Admins can update reports" on public.reports;
create policy "Admins can update reports"
  on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());
