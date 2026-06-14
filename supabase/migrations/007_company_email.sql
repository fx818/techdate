alter table public.users
  add column if not exists company_email text,
  add column if not exists company_email_verified boolean not null default false;
