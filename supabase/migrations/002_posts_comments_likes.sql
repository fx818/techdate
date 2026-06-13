create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.users(id) on delete set null,
  is_gideon boolean not null default false,
  title text not null,
  content text,
  url text,
  genre text not null,
  source text not null check (source in ('hackernews', 'devto', 'xcom', 'user')),
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index posts_genre_idx on public.posts(genre);
create index posts_created_at_idx on public.posts(created_at desc);

alter table public.posts enable row level security;

create policy "Anyone can read posts"
  on public.posts for select using (true);

create policy "Authenticated users can insert posts"
  on public.posts for insert with check (auth.uid() = author_id or is_gideon = true);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index comments_post_id_idx on public.comments(post_id);

alter table public.comments enable row level security;

create policy "Anyone can read comments"
  on public.comments for select using (true);

create policy "Authenticated users can insert comments"
  on public.comments for insert with check (auth.uid() = author_id);

create table public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, post_id)
);

alter table public.likes enable row level security;

create policy "Users can manage own likes"
  on public.likes for all using (auth.uid() = user_id);

create policy "Anyone can read likes"
  on public.likes for select using (true);

create or replace function increment_likes_count()
returns trigger language plpgsql as $$
begin
  update public.posts set likes_count = likes_count + 1 where id = NEW.post_id;
  return NEW;
end;
$$;

create trigger on_like_insert
  after insert on public.likes
  for each row execute procedure increment_likes_count();

create or replace function decrement_likes_count()
returns trigger language plpgsql as $$
begin
  update public.posts set likes_count = likes_count - 1 where id = OLD.post_id;
  return OLD;
end;
$$;

create trigger on_like_delete
  after delete on public.likes
  for each row execute procedure decrement_likes_count();

create or replace function increment_comments_count()
returns trigger language plpgsql as $$
begin
  update public.posts set comments_count = comments_count + 1 where id = NEW.post_id;
  return NEW;
end;
$$;

create trigger on_comment_insert
  after insert on public.comments
  for each row execute procedure increment_comments_count();
