-- Post images
alter table public.posts add column if not exists image_url text;

-- Storage bucket for post images (public read, owner-scoped write)
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

create policy "Post images are publicly readable"
  on storage.objects for select using (bucket_id = 'post-images');

create policy "Users can upload their own post images"
  on storage.objects for insert
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Bookmarks (save a post for later)
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, post_id)
);

alter table public.bookmarks enable row level security;

create policy "Users manage own bookmarks"
  on public.bookmarks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists bookmarks_user_idx on public.bookmarks(user_id);
