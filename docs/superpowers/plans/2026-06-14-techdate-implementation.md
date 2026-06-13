# TechDate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hybrid tech-discussion + dating platform for Indian tech professionals with an XP-gated swipe deck, Gideon AI content agent, and interest-vector-based matching.

**Architecture:** Next.js 14 (App Router) frontend on Vercel, Supabase for DB/Auth/Realtime/Storage, Upstash Redis for swipe counters, Python Gideon agent on GitHub Actions cron, cosine-similarity matching with hard filters.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth + Realtime + Storage), Upstash Redis, Python 3.11 (Gideon), Vitest, GitHub Actions

---

## File Structure

```
techDate/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx            # phone OTP login
│   │   └── onboarding/page.tsx       # genre selection + profile setup
│   ├── (app)/
│   │   ├── layout.tsx                # navbar + auth guard
│   │   ├── feed/page.tsx             # main discussion feed
│   │   ├── discover/page.tsx         # dating swipe deck (XP-gated)
│   │   ├── matches/page.tsx          # list of mutual matches
│   │   ├── messages/[matchId]/page.tsx  # chat with a match
│   │   └── profile/page.tsx          # own profile + XP display
│   ├── api/
│   │   ├── posts/route.ts            # GET feed, POST new post
│   │   ├── posts/[id]/like/route.ts  # POST like/unlike
│   │   ├── posts/[id]/comments/route.ts  # GET/POST comments
│   │   ├── xp/route.ts               # POST award XP
│   │   ├── swipes/route.ts           # POST record swipe, check match
│   │   ├── candidates/route.ts       # GET ranked dating candidates
│   │   └── messages/route.ts         # POST send message
│   ├── layout.tsx                    # root layout, fonts
│   └── page.tsx                      # landing / redirect
├── components/
│   ├── feed/
│   │   ├── PostCard.tsx              # single post (Gideon or user)
│   │   ├── CreatePost.tsx            # post creation form
│   │   └── CommentSection.tsx        # comments + replies
│   ├── dating/
│   │   ├── SwipeDeck.tsx             # swipeable profile stack
│   │   ├── ProfileCard.tsx           # one dating profile card
│   │   └── MatchModal.tsx            # "It's a match!" overlay
│   └── ui/
│       ├── PaywallModal.tsx          # upgrade prompt
│       ├── XpBadge.tsx               # XP tier chip
│       └── GideonBadge.tsx           # "G" label on Gideon posts
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # browser Supabase client
│   │   ├── server.ts                 # server Supabase client (cookies)
│   │   └── types.ts                  # generated DB types (hand-written for now)
│   ├── xp/
│   │   ├── weights.ts                # XP_WEIGHTS constant + DATING_UNLOCK_THRESHOLD
│   │   └── award.ts                  # awardXp() server function
│   ├── matching/
│   │   ├── vector.ts                 # seedVector, updateVector, normalizeVector
│   │   ├── similarity.ts             # cosineSimilarity
│   │   └── candidates.ts             # scoreCandidate, rankCandidates
│   └── redis/
│       └── client.ts                 # Upstash Redis client
├── gideon/
│   ├── fetch.py                      # main entry point, orchestrates all sources
│   ├── sources/
│   │   ├── hackernews.py             # HN Algolia API fetcher
│   │   └── devto.py                  # dev.to API fetcher
│   ├── genres.json                   # genre → keywords/tags map
│   └── requirements.txt              # httpx, supabase-py
├── supabase/
│   └── migrations/
│       ├── 001_users.sql
│       ├── 002_posts_comments_likes.sql
│       ├── 003_xp_events.sql
│       ├── 004_swipes_matches.sql
│       └── 005_messages.sql
├── .github/
│   └── workflows/
│       └── gideon.yml                # cron: every 4 hours
├── tests/
│   ├── lib/
│   │   ├── xp/award.test.ts
│   │   └── matching/
│   │       ├── vector.test.ts
│   │       └── candidates.test.ts
│   └── api/
│       ├── posts.test.ts
│       └── swipes.test.ts
├── .env.local                        # gitignored
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

## Phase A: Foundation

---

### Task 1: Project Setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `.env.example`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd "C:\Users\Imart\Desktop\ideas\techDate"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*"
```

Expected: Next.js project created in current directory.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @upstash/redis lucide-react clsx
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Create `.env.example`**

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

Copy to `.env.local` and fill in real values from Supabase dashboard + Upstash dashboard.

- [ ] **Step 4: Create `.gitignore` entry**

Add to `.gitignore`:
```
.env.local
```

- [ ] **Step 5: Configure Vitest**

Replace content of `vitest.config.ts` (create if missing):

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 6: Create test setup file**

Create `tests/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Add test script to package.json**

In `package.json`, add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 8: Commit**

```bash
git init
git add package.json tsconfig.json tailwind.config.ts next.config.ts .env.example .gitignore vitest.config.ts tests/setup.ts
git commit -m "chore: scaffold Next.js project with Vitest"
```

---

### Task 2: Supabase Client Configuration

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/types.ts`, `middleware.ts`

- [ ] **Step 1: Create browser Supabase client**

Create `lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server Supabase client**

Create `lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create database types**

Create `lib/supabase/types.ts`:
```ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type InterestVector = Record<string, number>

export type XpAction = 'like' | 'comment' | 'reply' | 'post' | 'profile_complete' | 'login_streak'

export type Gender = 'male' | 'female' | 'non_binary'

export type Preference = 'male' | 'female' | 'everyone'

export type SwipeDirection = 'left' | 'right'

export type PostSource = 'hackernews' | 'devto' | 'xcom' | 'user'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          phone: string | null
          name: string
          bio: string | null
          city: string
          gender: Gender
          preference: Preference
          photo_url: string | null
          genres: string[]
          xp: number
          dating_unlocked: boolean
          interest_vector: InterestVector
          is_premium: boolean
          last_active: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'xp' | 'dating_unlocked' | 'is_premium'>
        Update: Partial<Database['public']['Tables']['users']['Row']>
      }
      posts: {
        Row: {
          id: string
          author_id: string | null
          is_gideon: boolean
          title: string
          content: string | null
          url: string | null
          genre: string
          source: PostSource
          likes_count: number
          comments_count: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['posts']['Row'], 'id' | 'created_at' | 'likes_count' | 'comments_count'>
        Update: Partial<Database['public']['Tables']['posts']['Row']>
      }
      comments: {
        Row: {
          id: string
          post_id: string
          author_id: string
          parent_id: string | null
          content: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['comments']['Row']>
      }
      likes: {
        Row: { id: string; user_id: string; post_id: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['likes']['Row'], 'id' | 'created_at'>
        Update: never
      }
      xp_events: {
        Row: { id: string; user_id: string; action: XpAction; xp_awarded: number; created_at: string }
        Insert: Omit<Database['public']['Tables']['xp_events']['Row'], 'id' | 'created_at'>
        Update: never
      }
      swipes: {
        Row: { id: string; swiper_id: string; swiped_id: string; direction: SwipeDirection; created_at: string }
        Insert: Omit<Database['public']['Tables']['swipes']['Row'], 'id' | 'created_at'>
        Update: never
      }
      matches: {
        Row: { id: string; user1_id: string; user2_id: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'id' | 'created_at'>
        Update: never
      }
      messages: {
        Row: { id: string; match_id: string; sender_id: string; content: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>
        Update: never
      }
    }
  }
}
```

- [ ] **Step 4: Create auth middleware**

Create `middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/onboarding')

  if (!user && !isAuthRoute && request.nextUrl.pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/feed', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: add Supabase client config and auth middleware"
```

---

### Task 3: Database Schema

**Files:**
- Create: `supabase/migrations/001_users.sql`, `002_posts_comments_likes.sql`, `003_xp_events.sql`, `004_swipes_matches.sql`, `005_messages.sql`

- [ ] **Step 1: Create users migration**

Create `supabase/migrations/001_users.sql`:
```sql
create extension if not exists "uuid-ossp";

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  name text not null,
  bio text,
  city text not null,
  gender text not null check (gender in ('male', 'female', 'non_binary')),
  preference text not null check (preference in ('male', 'female', 'everyone')),
  photo_url text,
  genres text[] not null default '{}',
  xp integer not null default 0,
  dating_unlocked boolean not null default false,
  interest_vector jsonb not null default '{}',
  is_premium boolean not null default false,
  last_active timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read all profiles"
  on public.users for select using (true);

create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert with check (auth.uid() = id);
```

- [ ] **Step 2: Create posts/comments/likes migration**

Create `supabase/migrations/002_posts_comments_likes.sql`:
```sql
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

-- Comments
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

-- Likes
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

-- Trigger: keep likes_count in sync
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

-- Trigger: keep comments_count in sync
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
```

- [ ] **Step 3: Create XP events migration**

Create `supabase/migrations/003_xp_events.sql`:
```sql
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('like','comment','reply','post','profile_complete','login_streak')),
  xp_awarded integer not null,
  created_at timestamptz not null default now()
);

create index xp_events_user_id_idx on public.xp_events(user_id);

alter table public.xp_events enable row level security;

create policy "Users can read own XP events"
  on public.xp_events for select using (auth.uid() = user_id);
```

- [ ] **Step 4: Create swipes and matches migration**

Create `supabase/migrations/004_swipes_matches.sql`:
```sql
create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid not null references public.users(id) on delete cascade,
  swiped_id uuid not null references public.users(id) on delete cascade,
  direction text not null check (direction in ('left', 'right')),
  created_at timestamptz not null default now(),
  unique(swiper_id, swiped_id)
);

alter table public.swipes enable row level security;

create policy "Users can insert own swipes"
  on public.swipes for insert with check (auth.uid() = swiper_id);

create policy "Users can read own swipes"
  on public.swipes for select using (auth.uid() = swiper_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references public.users(id) on delete cascade,
  user2_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user1_id, user2_id)
);

alter table public.matches enable row level security;

create policy "Users can read own matches"
  on public.matches for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);
```

- [ ] **Step 5: Create messages migration**

Create `supabase/migrations/005_messages.sql`:
```sql
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index messages_match_id_idx on public.messages(match_id, created_at);

alter table public.messages enable row level security;

create policy "Match participants can read messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
      and (m.user1_id = auth.uid() or m.user2_id = auth.uid())
    )
  );

create policy "Match participants can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.matches m
      where m.id = match_id
      and (m.user1_id = auth.uid() or m.user2_id = auth.uid())
    )
  );
```

- [ ] **Step 6: Apply migrations via Supabase dashboard**

Go to your Supabase project → SQL Editor → run each migration file in order (001 → 005). Verify each table appears in Table Editor.

- [ ] **Step 7: Commit**

```bash
git add supabase/
git commit -m "feat: add full database schema with RLS policies"
```

---

## Phase B: Auth & Onboarding

---

### Task 4: Phone OTP Login Page

**Files:**
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Create login page**

Create `app/(auth)/login/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function sendOtp() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+91${phone}`,
    })
    if (error) setError(error.message)
    else setStep('otp')
    setLoading(false)
  }

  async function verifyOtp() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`,
      token: otp,
      type: 'sms',
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    // Check if user has completed onboarding
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('id', data.user!.id)
      .single()

    if (!profile) router.push('/onboarding')
    else router.push('/feed')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">TechDate</h1>
          <p className="text-gray-400 text-sm mt-1">For people who build things.</p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div className="flex">
              <span className="bg-gray-800 text-gray-400 px-3 py-2 rounded-l-md border border-r-0 border-gray-700">+91</span>
              <input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-r-md border border-gray-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={sendOtp}
              disabled={loading || phone.length < 10}
              className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Enter the 6-digit code sent to +91{phone}</p>
            <input
              type="text"
              placeholder="000000"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              maxLength={6}
              className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:border-indigo-500 text-center text-2xl tracking-widest"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={verifyOtp}
              disabled={loading || otp.length < 6}
              className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full text-gray-400 text-sm"
            >
              Change number
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/login/
git commit -m "feat: add phone OTP login page"
```

---

### Task 5: Onboarding — Profile Setup & Genre Selection

**Files:**
- Create: `app/(auth)/onboarding/page.tsx`, `lib/matching/vector.ts`

- [ ] **Step 1: Write failing test for seedVector**

Create `tests/lib/matching/vector.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { seedVector, updateVector, normalizeVector } from '@/lib/matching/vector'

describe('seedVector', () => {
  it('distributes equal weight across genres', () => {
    const v = seedVector(['AI', 'DevOps'])
    expect(v['AI']).toBeCloseTo(0.5)
    expect(v['DevOps']).toBeCloseTo(0.5)
  })

  it('weights sum to 1', () => {
    const v = seedVector(['AI', 'DevOps', 'WebDev'])
    const sum = Object.values(v).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })
})

describe('updateVector', () => {
  it('increments genre weight and re-normalizes', () => {
    const v = seedVector(['AI', 'DevOps'])
    const updated = updateVector(v, 'AI', 0.2)
    const sum = Object.values(updated).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
    expect(updated['AI']).toBeGreaterThan(v['AI'])
  })

  it('adds new genre if not present', () => {
    const v = seedVector(['AI'])
    const updated = updateVector(v, 'WebDev', 0.1)
    expect(updated['WebDev']).toBeDefined()
  })
})

describe('normalizeVector', () => {
  it('returns empty object unchanged', () => {
    expect(normalizeVector({})).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/matching/vector.test.ts
```

Expected: FAIL — `seedVector` not found.

- [ ] **Step 3: Implement vector operations**

Create `lib/matching/vector.ts`:
```ts
export type InterestVector = Record<string, number>

export function seedVector(genres: string[]): InterestVector {
  if (genres.length === 0) return {}
  const weight = 1 / genres.length
  return Object.fromEntries(genres.map(g => [g, weight]))
}

export function updateVector(
  vector: InterestVector,
  genre: string,
  increment: number = 0.1
): InterestVector {
  const updated = { ...vector, [genre]: (vector[genre] ?? 0) + increment }
  return normalizeVector(updated)
}

export function normalizeVector(vector: InterestVector): InterestVector {
  const total = Object.values(vector).reduce((sum, v) => sum + v, 0)
  if (total === 0) return vector
  return Object.fromEntries(
    Object.entries(vector).map(([k, v]) => [k, v / total])
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/matching/vector.test.ts
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Create genres constant**

Create `lib/genres.ts`:
```ts
export const GENRES = [
  { id: 'ai', label: 'AI / ML' },
  { id: 'llms', label: 'LLMs' },
  { id: 'webdev', label: 'Web Dev' },
  { id: 'devops', label: 'DevOps' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'cybersecurity', label: 'Cybersecurity' },
  { id: 'opensource', label: 'Open Source' },
  { id: 'startups', label: 'Startups' },
  { id: 'databases', label: 'Databases' },
]
```

- [ ] **Step 6: Create onboarding page**

Create `app/(auth)/onboarding/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { seedVector } from '@/lib/matching/vector'
import { GENRES } from '@/lib/genres'
import type { Gender, Preference } from '@/lib/supabase/types'

const CITIES = ['Bangalore', 'Delhi', 'Noida', 'Gurgaon', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai']

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [preference, setPreference] = useState<Preference>('everyone')
  const [bio, setBio] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function toggleGenre(id: string) {
    setSelectedGenres(prev =>
      prev.includes(id)
        ? prev.filter(g => g !== id)
        : prev.length < 5 ? [...prev, id] : prev
    )
  }

  async function submit() {
    if (selectedGenres.length < 3) {
      setError('Pick at least 3 genres')
      return
    }
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const vector = seedVector(selectedGenres)

    const { error } = await supabase.from('users').insert({
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      name,
      bio,
      city,
      gender,
      preference,
      genres: selectedGenres,
      interest_vector: vector,
      last_active: new Date().toISOString(),
    })

    if (error) { setError(error.message); setLoading(false); return }

    // Award profile_complete XP via API
    await fetch('/api/xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'profile_complete' }),
    })

    router.push('/feed')
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex gap-2">
          {[1, 2].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-indigo-500' : 'bg-gray-700'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Your profile</h2>
            <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700" />
            <select value={city} onChange={e => setCity(e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700">
              <option value="">Select city</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-3">
              {(['male', 'female', 'non_binary'] as Gender[]).map(g => (
                <button key={g} onClick={() => setGender(g)}
                  className={`flex-1 py-2 rounded-md text-sm capitalize ${gender === g ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {g.replace('_', ' ')}
                </button>
              ))}
            </div>
            <textarea placeholder="Short bio (optional)" value={bio} onChange={e => setBio(e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700 h-24 resize-none" />
            <button onClick={() => { if (name && city) setStep(2) }}
              disabled={!name || !city}
              className="w-full bg-indigo-600 text-white py-2 rounded-md disabled:opacity-50">
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Pick your interests</h2>
            <p className="text-gray-400 text-sm">Choose 3–5 topics you care about</p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => (
                <button key={g.id} onClick={() => toggleGenre(g.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${selectedGenres.includes(g.id)
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
                  {g.label}
                </button>
              ))}
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={submit} disabled={loading || selectedGenres.length < 3}
              className="w-full bg-indigo-600 text-white py-2 rounded-md disabled:opacity-50">
              {loading ? 'Setting up...' : "Let's go"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add app/\(auth\)/onboarding/ lib/matching/vector.ts lib/genres.ts tests/lib/matching/vector.test.ts
git commit -m "feat: add onboarding flow with genre selection and vector seeding"
```

---

## Phase C: XP System

---

### Task 6: XP Weights & Award Function

**Files:**
- Create: `lib/xp/weights.ts`, `lib/xp/award.ts`, `app/api/xp/route.ts`
- Test: `tests/lib/xp/award.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/xp/award.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { XP_WEIGHTS, DATING_UNLOCK_THRESHOLD } from '@/lib/xp/weights'

describe('XP_WEIGHTS', () => {
  it('has correct value for like', () => {
    expect(XP_WEIGHTS.like).toBe(2)
  })
  it('has correct value for post', () => {
    expect(XP_WEIGHTS.post).toBe(25)
  })
  it('has correct value for comment', () => {
    expect(XP_WEIGHTS.comment).toBe(10)
  })
  it('has correct value for reply', () => {
    expect(XP_WEIGHTS.reply).toBe(5)
  })
  it('has correct value for profile_complete', () => {
    expect(XP_WEIGHTS.profile_complete).toBe(20)
  })
  it('has correct value for login_streak', () => {
    expect(XP_WEIGHTS.login_streak).toBe(3)
  })
  it('DATING_UNLOCK_THRESHOLD is 100', () => {
    expect(DATING_UNLOCK_THRESHOLD).toBe(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/xp/award.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create XP weights**

Create `lib/xp/weights.ts`:
```ts
import type { XpAction } from '@/lib/supabase/types'

export const XP_WEIGHTS: Record<XpAction, number> = {
  like: 2,
  comment: 10,
  reply: 5,
  post: 25,
  profile_complete: 20,
  login_streak: 3,
}

export const DATING_UNLOCK_THRESHOLD = 100
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/xp/award.test.ts
```

Expected: PASS.

- [ ] **Step 5: Create award function**

Create `lib/xp/award.ts`:
```ts
import { createClient } from '@/lib/supabase/server'
import { XP_WEIGHTS, DATING_UNLOCK_THRESHOLD } from './weights'
import type { XpAction } from '@/lib/supabase/types'

export async function awardXp(userId: string, action: XpAction) {
  const supabase = await createClient()
  const xpAmount = XP_WEIGHTS[action]

  // Insert XP event
  await supabase.from('xp_events').insert({
    user_id: userId,
    action,
    xp_awarded: xpAmount,
  })

  // Increment user XP and check unlock
  const { data: user } = await supabase
    .from('users')
    .select('xp, dating_unlocked')
    .eq('id', userId)
    .single()

  if (!user) return

  const newXp = user.xp + xpAmount
  const shouldUnlock = !user.dating_unlocked && newXp >= DATING_UNLOCK_THRESHOLD

  await supabase
    .from('users')
    .update({
      xp: newXp,
      ...(shouldUnlock ? { dating_unlocked: true } : {}),
    })
    .eq('id', userId)

  return { newXp, unlocked: shouldUnlock }
}
```

- [ ] **Step 6: Create XP API route**

Create `app/api/xp/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXp } from '@/lib/xp/award'
import type { XpAction } from '@/lib/supabase/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const action = body.action as XpAction

  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  const result = await awardXp(user.id, action)
  return NextResponse.json(result)
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/xp/ app/api/xp/ tests/lib/xp/
git commit -m "feat: add XP system with award function and unlock logic"
```

---

## Phase D: Feed

---

### Task 7: Posts API

**Files:**
- Create: `app/api/posts/route.ts`, `app/api/posts/[id]/like/route.ts`, `app/api/posts/[id]/comments/route.ts`

- [ ] **Step 1: Create posts GET/POST route**

Create `app/api/posts/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXp } from '@/lib/xp/award'
import { updateVector } from '@/lib/matching/vector'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const genres = searchParams.get('genres')?.split(',') ?? []
  const cursor = searchParams.get('cursor')

  let query = supabase
    .from('posts')
    .select('*, users(id, name, photo_url, xp)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (genres.length > 0) query = query.in('genre', genres)
  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ posts: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, genre } = await request.json()
  if (!title || !genre) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: post, error } = await supabase.from('posts').insert({
    author_id: user.id,
    is_gideon: false,
    title,
    content,
    genre,
    source: 'user',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Award XP + update interest vector
  await awardXp(user.id, 'post')
  const { data: profile } = await supabase.from('users').select('interest_vector').eq('id', user.id).single()
  if (profile) {
    const updatedVector = updateVector(profile.interest_vector, genre, 0.15)
    await supabase.from('users').update({ interest_vector: updatedVector }).eq('id', user.id)
  }

  return NextResponse.json({ post }, { status: 201 })
}
```

- [ ] **Step 2: Create like/unlike route**

Create `app/api/posts/[id]/like/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXp } from '@/lib/xp/award'
import { updateVector } from '@/lib/matching/vector'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const postId = params.id

  // Check if already liked
  const { data: existing } = await supabase.from('likes')
    .select('id').eq('user_id', user.id).eq('post_id', postId).single()

  if (existing) {
    // Unlike
    await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId)
    return NextResponse.json({ liked: false })
  }

  // Like
  await supabase.from('likes').insert({ user_id: user.id, post_id: postId })

  // Award XP + update vector for the genre of this post
  await awardXp(user.id, 'like')
  const { data: post } = await supabase.from('posts').select('genre').eq('id', postId).single()
  if (post) {
    const { data: profile } = await supabase.from('users').select('interest_vector').eq('id', user.id).single()
    if (profile) {
      const updatedVector = updateVector(profile.interest_vector, post.genre, 0.05)
      await supabase.from('users').update({ interest_vector: updatedVector }).eq('id', user.id)
    }
  }

  return NextResponse.json({ liked: true })
}
```

- [ ] **Step 3: Create comments route**

Create `app/api/posts/[id]/comments/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXp } from '@/lib/xp/award'
import { updateVector } from '@/lib/matching/vector'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('comments')
    .select('*, users(id, name, photo_url)')
    .eq('post_id', params.id)
    .is('parent_id', null)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, parent_id } = await request.json()
  if (!content) return NextResponse.json({ error: 'Missing content' }, { status: 400 })

  const { data: comment, error } = await supabase.from('comments').insert({
    post_id: params.id,
    author_id: user.id,
    parent_id: parent_id ?? null,
    content,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const action = parent_id ? 'reply' : 'comment'
  await awardXp(user.id, action)

  const { data: post } = await supabase.from('posts').select('genre').eq('id', params.id).single()
  if (post) {
    const { data: profile } = await supabase.from('users').select('interest_vector').eq('id', user.id).single()
    if (profile) {
      const increment = action === 'comment' ? 0.1 : 0.07
      const updatedVector = updateVector(profile.interest_vector, post.genre, increment)
      await supabase.from('users').update({ interest_vector: updatedVector }).eq('id', user.id)
    }
  }

  return NextResponse.json({ comment }, { status: 201 })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/posts/
git commit -m "feat: add posts, likes, and comments API with XP + vector updates"
```

---

### Task 8: Feed UI

**Files:**
- Create: `components/ui/GideonBadge.tsx`, `components/ui/XpBadge.tsx`, `components/feed/PostCard.tsx`, `components/feed/CreatePost.tsx`, `components/feed/CommentSection.tsx`, `app/(app)/feed/page.tsx`

- [ ] **Step 1: Create GideonBadge component**

Create `components/ui/GideonBadge.tsx`:
```tsx
export function GideonBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-indigo-900/50 text-indigo-300 text-xs px-1.5 py-0.5 rounded border border-indigo-700/50">
      <span className="font-bold">G</span>
      <span>Gideon</span>
    </span>
  )
}
```

- [ ] **Step 2: Create XpBadge component**

Create `components/ui/XpBadge.tsx`:
```tsx
const TIERS = [
  { min: 0, label: 'Explorer', color: 'text-gray-400 bg-gray-800' },
  { min: 100, label: 'Builder', color: 'text-green-400 bg-green-900/40' },
  { min: 350, label: 'Architect', color: 'text-blue-400 bg-blue-900/40' },
  { min: 700, label: 'Principal', color: 'text-purple-400 bg-purple-900/40' },
]

export function XpBadge({ xp }: { xp: number }) {
  const tier = [...TIERS].reverse().find(t => xp >= t.min) ?? TIERS[0]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tier.color}`}>
      {tier.label} · {xp} XP
    </span>
  )
}
```

- [ ] **Step 3: Create PostCard component**

Create `components/feed/PostCard.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Heart, MessageSquare, ExternalLink } from 'lucide-react'
import { GideonBadge } from '@/components/ui/GideonBadge'
import CommentSection from './CommentSection'

interface Post {
  id: string
  title: string
  content: string | null
  url: string | null
  genre: string
  is_gideon: boolean
  likes_count: number
  comments_count: number
  created_at: string
  users: { id: string; name: string; photo_url: string | null } | null
}

export function PostCard({ post, currentUserId }: { post: Post; currentUserId: string }) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likes_count)
  const [showComments, setShowComments] = useState(false)

  async function toggleLike() {
    const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' })
    const data = await res.json()
    setLiked(data.liked)
    setLikeCount(prev => data.liked ? prev + 1 : prev - 1)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {post.is_gideon ? (
            <GideonBadge />
          ) : (
            <span className="text-sm text-gray-400">{post.users?.name ?? 'Unknown'}</span>
          )}
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{post.genre}</span>
        </div>
        {post.url && (
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300">
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      <h3 className="text-white font-medium leading-snug">{post.title}</h3>
      {post.content && <p className="text-gray-400 text-sm">{post.content}</p>}

      <div className="flex items-center gap-4 pt-1">
        <button onClick={toggleLike} className={`flex items-center gap-1.5 text-sm ${liked ? 'text-red-400' : 'text-gray-500 hover:text-gray-300'}`}>
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
          {likeCount}
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300">
          <MessageSquare size={15} />
          {post.comments_count}
        </button>
      </div>

      {showComments && <CommentSection postId={post.id} currentUserId={currentUserId} />}
    </div>
  )
}
```

- [ ] **Step 4: Create CommentSection component**

Create `components/feed/CommentSection.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'

interface Comment {
  id: string
  content: string
  created_at: string
  users: { name: string }
}

export default function CommentSection({ postId, currentUserId }: { postId: string; currentUserId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/${postId}/comments`)
      .then(r => r.json())
      .then(d => setComments(d.comments ?? []))
  }, [postId])

  async function submit() {
    if (!text.trim()) return
    setLoading(true)
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
    const data = await res.json()
    if (data.comment) {
      setComments(prev => [...prev, { ...data.comment, users: { name: 'You' } }])
      setText('')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-3 border-t border-gray-800 pt-3">
      {comments.map(c => (
        <div key={c.id} className="text-sm">
          <span className="text-indigo-400 font-medium">{c.users.name}</span>
          <span className="text-gray-300 ml-2">{c.content}</span>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)}
          placeholder="Add a comment..."
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="flex-1 bg-gray-800 text-white text-sm px-3 py-1.5 rounded-md border border-gray-700 focus:outline-none focus:border-indigo-500" />
        <button onClick={submit} disabled={loading || !text.trim()}
          className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-md disabled:opacity-50">
          Post
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create CreatePost component**

Create `components/feed/CreatePost.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { GENRES } from '@/lib/genres'

export function CreatePost({ userGenres, onCreated }: { userGenres: string[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [genre, setGenre] = useState(userGenres[0] ?? '')
  const [loading, setLoading] = useState(false)

  const availableGenres = GENRES.filter(g => userGenres.includes(g.id))

  async function submit() {
    if (!title.trim() || !genre) return
    setLoading(true)
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, genre }),
    })
    setTitle('')
    setContent('')
    setOpen(false)
    setLoading(false)
    onCreated()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full bg-gray-900 border border-gray-700 border-dashed rounded-lg p-4 text-gray-500 hover:text-gray-300 hover:border-gray-600 text-sm text-left">
        + Share something with the community...
      </button>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
        className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:border-indigo-500" />
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Details (optional)"
        className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700 h-20 resize-none focus:outline-none focus:border-indigo-500" />
      <select value={genre} onChange={e => setGenre(e.target.value)}
        className="bg-gray-800 text-white px-3 py-1.5 rounded-md border border-gray-700 text-sm">
        {availableGenres.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
      </select>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
        <button onClick={submit} disabled={loading || !title.trim()}
          className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-md disabled:opacity-50">
          {loading ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create feed page**

Create `app/(app)/feed/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PostCard } from '@/components/feed/PostCard'
import { CreatePost } from '@/components/feed/CreatePost'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('genres, xp, dating_unlocked')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const { data: posts } = await supabase
    .from('posts')
    .select('*, users(id, name, photo_url)')
    .in('genre', profile.genres)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Feed</h1>
        <span className="text-sm text-indigo-400">{profile.xp} XP</span>
      </div>

      <CreatePost userGenres={profile.genres} onCreated={() => {}} />

      {!profile.dating_unlocked && (
        <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg p-3 text-sm text-indigo-300">
          Earn {100 - profile.xp} more XP to unlock dating
        </div>
      )}

      <div className="space-y-3">
        {(posts ?? []).map(post => (
          <PostCard key={post.id} post={post as any} currentUserId={user.id} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add components/ app/\(app\)/feed/
git commit -m "feat: add feed page with post cards, create post, and comments"
```

---

## Phase E: Gideon Agent

---

### Task 9: Gideon Python Setup

**Files:**
- Create: `gideon/genres.json`, `gideon/requirements.txt`, `gideon/sources/hackernews.py`, `gideon/sources/devto.py`, `gideon/fetch.py`

- [ ] **Step 1: Create genres keyword map**

Create `gideon/genres.json`:
```json
{
  "ai": {
    "hn_tags": ["machine-learning", "artificial-intelligence", "deep-learning"],
    "hn_query": "AI OR LLM OR GPT OR neural",
    "devto_tags": ["ai", "machinelearning", "deeplearning"]
  },
  "llms": {
    "hn_tags": ["llm", "gpt", "language-model"],
    "hn_query": "LLM OR GPT OR Claude OR Gemini OR language model",
    "devto_tags": ["llm", "gpt4", "openai"]
  },
  "webdev": {
    "hn_tags": ["web", "javascript", "react", "css"],
    "hn_query": "React OR Next.js OR web development OR frontend",
    "devto_tags": ["webdev", "javascript", "react", "css"]
  },
  "devops": {
    "hn_tags": ["devops", "docker", "kubernetes", "ci-cd"],
    "hn_query": "DevOps OR Docker OR Kubernetes OR CI/CD",
    "devto_tags": ["devops", "docker", "kubernetes"]
  },
  "mobile": {
    "hn_tags": ["ios", "android", "mobile"],
    "hn_query": "iOS OR Android OR React Native OR Flutter",
    "devto_tags": ["android", "ios", "flutter", "reactnative"]
  },
  "cloud": {
    "hn_tags": ["aws", "gcp", "azure", "cloud"],
    "hn_query": "AWS OR GCP OR Azure OR cloud computing",
    "devto_tags": ["aws", "cloud", "azure", "googlecloud"]
  },
  "cybersecurity": {
    "hn_tags": ["security", "hacking", "cryptography"],
    "hn_query": "security OR vulnerability OR CVE OR hacking",
    "devto_tags": ["security", "cybersecurity", "hacking"]
  },
  "opensource": {
    "hn_tags": ["open-source", "github"],
    "hn_query": "open source OR GitHub OR OSS",
    "devto_tags": ["opensource", "github"]
  },
  "startups": {
    "hn_tags": ["startup", "entrepreneurship"],
    "hn_query": "startup OR founder OR YC OR seed round",
    "devto_tags": ["startup", "entrepreneurship", "business"]
  },
  "databases": {
    "hn_tags": ["database", "postgresql", "sql", "nosql"],
    "hn_query": "database OR PostgreSQL OR MySQL OR MongoDB",
    "devto_tags": ["database", "sql", "postgres", "mongodb"]
  }
}
```

- [ ] **Step 2: Create requirements.txt**

Create `gideon/requirements.txt`:
```
httpx==0.27.0
supabase==2.4.0
python-dotenv==1.0.1
```

- [ ] **Step 3: Create HackerNews fetcher**

Create `gideon/sources/hackernews.py`:
```python
import httpx
from typing import Optional

HN_ALGOLIA = "https://hn.algolia.com/api/v1/search"

def fetch_hn_posts(query: str, tags: list[str], limit: int = 8) -> list[dict]:
    """Fetch posts from HackerNews Algolia API for a given query."""
    params = {
        "query": query,
        "tags": "story",
        "hitsPerPage": limit,
        "numericFilters": "points>10",  # min 10 upvotes
    }
    try:
        response = httpx.get(HN_ALGOLIA, params=params, timeout=10)
        response.raise_for_status()
        hits = response.json().get("hits", [])
        return [
            {
                "title": h.get("title", ""),
                "url": h.get("url") or f"https://news.ycombinator.com/item?id={h['objectID']}",
                "points": h.get("points", 0),
                "source": "hackernews",
            }
            for h in hits
            if h.get("title") and len(h.get("title", "")) > 10
        ]
    except Exception as e:
        print(f"HN fetch error: {e}")
        return []
```

- [ ] **Step 4: Create dev.to fetcher**

Create `gideon/sources/devto.py`:
```python
import httpx

DEVTO_API = "https://dev.to/api/articles"

def fetch_devto_posts(tags: list[str], limit: int = 8) -> list[dict]:
    """Fetch posts from dev.to API for given tags."""
    posts = []
    for tag in tags[:2]:  # limit API calls per genre
        try:
            params = {"tag": tag, "per_page": limit, "top": 1}
            response = httpx.get(DEVTO_API, params=params, timeout=10)
            response.raise_for_status()
            articles = response.json()
            for a in articles:
                posts.append({
                    "title": a.get("title", ""),
                    "url": a.get("url", ""),
                    "points": a.get("positive_reactions_count", 0),
                    "source": "devto",
                })
        except Exception as e:
            print(f"dev.to fetch error for tag {tag}: {e}")
    return posts
```

- [ ] **Step 5: Create main Gideon fetch script**

Create `gideon/fetch.py`:
```python
import json
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
from sources.hackernews import fetch_hn_posts
from sources.devto import fetch_devto_posts

load_dotenv()

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
MAX_POSTS_PER_GENRE = 6

def load_genres() -> dict:
    with open("gideon/genres.json") as f:
        return json.load(f)

def get_existing_urls(supabase: Client, genre: str) -> set[str]:
    """Fetch URLs already stored for this genre to avoid duplicates."""
    result = supabase.table("posts").select("url").eq("genre", genre).eq("is_gideon", True).execute()
    return {row["url"] for row in result.data if row["url"]}

def insert_posts(supabase: Client, posts: list[dict], genre: str, existing_urls: set[str]):
    """Insert new Gideon posts, skipping duplicates."""
    inserted = 0
    for post in posts:
        if not post["title"] or not post["url"]:
            continue
        if post["url"] in existing_urls:
            continue
        supabase.table("posts").insert({
            "is_gideon": True,
            "title": post["title"],
            "url": post["url"],
            "genre": genre,
            "source": post["source"],
            "author_id": None,
        }).execute()
        existing_urls.add(post["url"])
        inserted += 1
        if inserted >= MAX_POSTS_PER_GENRE:
            break
    return inserted

def run():
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    genres = load_genres()
    total = 0

    for genre_id, config in genres.items():
        print(f"Fetching for genre: {genre_id}")
        existing_urls = get_existing_urls(supabase, genre_id)

        hn_posts = fetch_hn_posts(config["hn_query"], config["hn_tags"])
        devto_posts = fetch_devto_posts(config["devto_tags"])

        all_posts = hn_posts + devto_posts
        # Sort by points descending, take top MAX_POSTS_PER_GENRE
        all_posts.sort(key=lambda p: p.get("points", 0), reverse=True)

        inserted = insert_posts(supabase, all_posts, genre_id, existing_urls)
        print(f"  Inserted {inserted} posts for {genre_id}")
        total += inserted

    print(f"Gideon done. Total inserted: {total}")

if __name__ == "__main__":
    run()
```

- [ ] **Step 6: Commit**

```bash
git add gideon/
git commit -m "feat: add Gideon Python agent with HN and dev.to fetchers"
```

---

### Task 10: GitHub Actions Cron for Gideon

**Files:**
- Create: `.github/workflows/gideon.yml`

- [ ] **Step 1: Create GitHub Actions workflow**

Create `.github/workflows/gideon.yml`:
```yaml
name: Gideon Agent

on:
  schedule:
    - cron: '0 */4 * * *'   # every 4 hours
  workflow_dispatch:          # allow manual trigger

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install -r gideon/requirements.txt

      - name: Run Gideon
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: python gideon/fetch.py
```

- [ ] **Step 2: Add secrets to GitHub repository**

Go to GitHub repo → Settings → Secrets and variables → Actions → add:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase project settings
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings (service role key, NOT anon key)

- [ ] **Step 3: Test by triggering manually**

Go to GitHub repo → Actions → "Gideon Agent" → "Run workflow". Check logs for success output.

- [ ] **Step 4: Commit**

```bash
git add .github/
git commit -m "feat: add GitHub Actions cron workflow for Gideon (every 4h)"
```

---

## Phase F: Matching Algorithm

---

### Task 11: Cosine Similarity & Candidate Scoring

**Files:**
- Create: `lib/matching/similarity.ts`, `lib/matching/candidates.ts`
- Test: `tests/lib/matching/candidates.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/matching/candidates.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { cosineSimilarity } from '@/lib/matching/similarity'
import { scoreCandidate, rankCandidates } from '@/lib/matching/candidates'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = { AI: 0.7, DevOps: 0.3 }
    expect(cosineSimilarity(v, v)).toBeCloseTo(1)
  })

  it('returns 0 for completely different vectors', () => {
    expect(cosineSimilarity({ AI: 1 }, { DevOps: 1 })).toBeCloseTo(0)
  })

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity({}, { AI: 1 })).toBe(0)
  })

  it('returns partial similarity for overlapping vectors', () => {
    const a = { AI: 0.8, DevOps: 0.2 }
    const b = { AI: 0.5, WebDev: 0.5 }
    const sim = cosineSimilarity(a, b)
    expect(sim).toBeGreaterThan(0)
    expect(sim).toBeLessThan(1)
  })
})

describe('scoreCandidate', () => {
  const baseUser = {
    id: 'u1',
    interest_vector: { AI: 0.7, DevOps: 0.3 },
    xp: 150,
    last_active: new Date(),
  }

  it('returns higher score for similar interest vector', () => {
    const similar = { id: 'u2', interest_vector: { AI: 0.8, DevOps: 0.2 }, xp: 120, last_active: new Date() }
    const different = { id: 'u3', interest_vector: { WebDev: 0.9, Mobile: 0.1 }, xp: 120, last_active: new Date() }
    expect(scoreCandidate(baseUser, similar)).toBeGreaterThan(scoreCandidate(baseUser, different))
  })

  it('penalizes stale profiles', () => {
    const recent = { id: 'u2', interest_vector: { AI: 0.7, DevOps: 0.3 }, xp: 150, last_active: new Date() }
    const stale = { id: 'u3', interest_vector: { AI: 0.7, DevOps: 0.3 }, xp: 150, last_active: new Date(Date.now() - 40 * 24 * 3600 * 1000) }
    expect(scoreCandidate(baseUser, recent)).toBeGreaterThan(scoreCandidate(baseUser, stale))
  })
})

describe('rankCandidates', () => {
  it('returns candidates sorted by score descending', () => {
    const user = { id: 'u0', interest_vector: { AI: 1 }, xp: 100, last_active: new Date() }
    const candidates = [
      { id: 'low', interest_vector: { WebDev: 1 }, xp: 100, last_active: new Date() },
      { id: 'high', interest_vector: { AI: 0.9, DevOps: 0.1 }, xp: 100, last_active: new Date() },
    ]
    const ranked = rankCandidates(user, candidates)
    expect(ranked[0].id).toBe('high')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/matching/candidates.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement cosine similarity**

Create `lib/matching/similarity.ts`:
```ts
import type { InterestVector } from './vector'

export function cosineSimilarity(a: InterestVector, b: InterestVector): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  let dot = 0, magA = 0, magB = 0
  for (const k of keys) {
    const va = a[k] ?? 0
    const vb = b[k] ?? 0
    dot += va * vb
    magA += va * va
    magB += vb * vb
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}
```

- [ ] **Step 4: Implement candidate scoring**

Create `lib/matching/candidates.ts`:
```ts
import { cosineSimilarity } from './similarity'
import type { InterestVector } from './vector'

export type Candidate = {
  id: string
  interest_vector: InterestVector
  xp: number
  last_active: Date
}

const XP_TIERS = [0, 50, 150, 350, 700]

function getXpTier(xp: number): number {
  return XP_TIERS.reduce((tier, min, i) => (xp >= min ? i : tier), 0)
}

function xpTierProximity(xpA: number, xpB: number): number {
  const diff = Math.abs(getXpTier(xpA) - getXpTier(xpB))
  return Math.max(0, 1 - diff * 0.5)
}

function activityRecency(lastActive: Date): number {
  const daysSince = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, 1 - daysSince / 30)
}

export function scoreCandidate(user: Candidate, candidate: Candidate): number {
  const sim = cosineSimilarity(user.interest_vector, candidate.interest_vector)
  const xpProx = xpTierProximity(user.xp, candidate.xp)
  const recency = activityRecency(candidate.last_active)
  return sim * 0.6 + xpProx * 0.2 + recency * 0.2
}

export function rankCandidates(user: Candidate, candidates: Candidate[]): Candidate[] {
  return candidates
    .map(c => ({ candidate: c, score: scoreCandidate(user, c) }))
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate)
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/lib/matching/candidates.test.ts
```

Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add lib/matching/similarity.ts lib/matching/candidates.ts tests/lib/matching/candidates.test.ts
git commit -m "feat: implement cosine similarity and candidate scoring algorithm"
```

---

### Task 12: Candidates API

**Files:**
- Create: `app/api/candidates/route.ts`

- [ ] **Step 1: Create candidates API**

Create `app/api/candidates/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankCandidates, type Candidate } from '@/lib/matching/candidates'

const XP_TIER_BANDS: [number, number][] = [
  [0, 149],
  [50, 349],
  [150, 699],
  [350, 9999],
  [700, 99999],
]

function getTierBand(xp: number): [number, number] {
  const tierIndex = XP_TIER_BANDS.findIndex(([min, max]) => xp >= min && xp <= max)
  return XP_TIER_BANDS[tierIndex] ?? [0, 99999]
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('city, gender, preference, xp, interest_vector, dating_unlocked')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!profile.dating_unlocked) return NextResponse.json({ error: 'Dating not unlocked' }, { status: 403 })

  // Hard filters
  const genderFilter = profile.preference === 'everyone'
    ? ['male', 'female', 'non_binary']
    : [profile.preference]

  const [xpMin, xpMax] = getTierBand(profile.xp)

  // Get already-swiped IDs to exclude
  const { data: swiped } = await supabase
    .from('swipes')
    .select('swiped_id')
    .eq('swiper_id', user.id)

  const swipedIds = (swiped ?? []).map(s => s.swiped_id)

  let query = supabase
    .from('users')
    .select('id, interest_vector, xp, last_active, name, photo_url, city, genres, bio')
    .eq('city', profile.city)
    .in('gender', genderFilter)
    .gte('xp', xpMin)
    .lte('xp', xpMax)
    .neq('id', user.id)
    .limit(100)

  if (swipedIds.length > 0) {
    query = query.not('id', 'in', `(${swipedIds.join(',')})`)
  }

  const { data: rawCandidates } = await query

  if (!rawCandidates || rawCandidates.length === 0) {
    return NextResponse.json({ candidates: [] })
  }

  const candidates: Candidate[] = rawCandidates.map(c => ({
    id: c.id,
    interest_vector: c.interest_vector,
    xp: c.xp,
    last_active: new Date(c.last_active),
  }))

  const userCandidate: Candidate = {
    id: user.id,
    interest_vector: profile.interest_vector,
    xp: profile.xp,
    last_active: new Date(),
  }

  const ranked = rankCandidates(userCandidate, candidates)
  const rankedWithData = ranked.map(c => rawCandidates.find(r => r.id === c.id))

  return NextResponse.json({ candidates: rankedWithData.slice(0, 20) })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/candidates/
git commit -m "feat: add candidates API with hard filters and cosine ranking"
```

---

## Phase G: Redis Client

---

### Task 13: Upstash Redis Client

**Files:**
- Create: `lib/redis/client.ts`

- [ ] **Step 1: Create Redis client**

Create `lib/redis/client.ts`:
```ts
import { Redis } from '@upstash/redis'

export const redis = Redis.fromEnv()

export async function getDailySwipeCount(userId: string): Promise<number> {
  const key = `swipes:${userId}:${new Date().toISOString().slice(0, 10)}`
  const count = await redis.get<number>(key)
  return count ?? 0
}

export async function incrementDailySwipeCount(userId: string): Promise<number> {
  const key = `swipes:${userId}:${new Date().toISOString().slice(0, 10)}`
  const count = await redis.incr(key)
  // Expire key at midnight (86400 seconds)
  await redis.expire(key, 86400)
  return count
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/redis/
git commit -m "feat: add Upstash Redis client for daily swipe counting"
```

---

## Phase H: Dating Layer

---

### Task 14: Swipes API

**Files:**
- Create: `app/api/swipes/route.ts`

- [ ] **Step 1: Create swipes route**

Create `app/api/swipes/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDailySwipeCount, incrementDailySwipeCount } from '@/lib/redis/client'
import type { SwipeDirection } from '@/lib/supabase/types'

const FREE_SWIPE_LIMIT = 10

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { swiped_id, direction } = await request.json() as { swiped_id: string; direction: SwipeDirection }
  if (!swiped_id || !direction) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Check premium status
  const { data: profile } = await supabase.from('users').select('is_premium, dating_unlocked').eq('id', user.id).single()
  if (!profile?.dating_unlocked) return NextResponse.json({ error: 'Dating not unlocked' }, { status: 403 })

  if (!profile.is_premium) {
    const swipeCount = await getDailySwipeCount(user.id)
    if (swipeCount >= FREE_SWIPE_LIMIT) {
      return NextResponse.json({ error: 'Daily swipe limit reached', upgrade: true }, { status: 429 })
    }
  }

  // Record swipe
  const { error } = await supabase.from('swipes').insert({
    swiper_id: user.id,
    swiped_id,
    direction,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await incrementDailySwipeCount(user.id)

  // Check for mutual match if right swipe
  if (direction === 'right') {
    const { data: theirSwipe } = await supabase
      .from('swipes')
      .select('id')
      .eq('swiper_id', swiped_id)
      .eq('swiped_id', user.id)
      .eq('direction', 'right')
      .single()

    if (theirSwipe) {
      // Create match — ensure consistent ordering to satisfy unique constraint
      const [u1, u2] = [user.id, swiped_id].sort()
      const { data: match } = await supabase.from('matches').insert({
        user1_id: u1,
        user2_id: u2,
      }).select().single()

      return NextResponse.json({ match: true, matchId: match?.id })
    }
  }

  return NextResponse.json({ match: false })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/swipes/
git commit -m "feat: add swipes API with free-tier limit check and match detection"
```

---

### Task 15: Dating UI — SwipeDeck

**Files:**
- Create: `components/dating/ProfileCard.tsx`, `components/dating/MatchModal.tsx`, `components/dating/SwipeDeck.tsx`, `app/(app)/discover/page.tsx`

- [ ] **Step 1: Create ProfileCard component**

Create `components/dating/ProfileCard.tsx`:
```tsx
import { XpBadge } from '@/components/ui/XpBadge'
import { GENRES } from '@/lib/genres'

interface DatingProfile {
  id: string
  name: string
  photo_url: string | null
  city: string
  genres: string[]
  xp: number
  bio: string | null
}

export function ProfileCard({ profile }: { profile: DatingProfile }) {
  const genreLabels = GENRES.filter(g => profile.genres.includes(g.id)).map(g => g.label)
  const topGenre = genreLabels[0] ?? ''

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden w-full max-w-sm mx-auto">
      <div className="h-64 bg-gray-800 flex items-center justify-center">
        {profile.photo_url ? (
          <img src={profile.photo_url} alt={profile.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-6xl text-gray-600">{profile.name[0]?.toUpperCase()}</div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">{profile.name}</h2>
          <span className="text-gray-400 text-sm">{profile.city}</span>
        </div>
        <XpBadge xp={profile.xp} />
        {topGenre && (
          <p className="text-indigo-400 text-sm">Most active in: {topGenre}</p>
        )}
        {profile.bio && <p className="text-gray-400 text-sm">{profile.bio}</p>}
        <div className="flex flex-wrap gap-1 pt-1">
          {genreLabels.map(g => (
            <span key={g} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{g}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create MatchModal component**

Create `components/dating/MatchModal.tsx`:
```tsx
'use client'

import { useRouter } from 'next/navigation'

interface Props {
  matchId: string
  matchName: string
  onClose: () => void
}

export function MatchModal({ matchId, matchName, onClose }: Props) {
  const router = useRouter()

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-indigo-700 rounded-2xl p-8 text-center space-y-4 max-w-sm w-full">
        <div className="text-4xl">🎉</div>
        <h2 className="text-2xl font-bold text-white">It's a Match!</h2>
        <p className="text-gray-400">You and <span className="text-indigo-400">{matchName}</span> liked each other</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-700 text-gray-300 py-2 rounded-lg">
            Keep Swiping
          </button>
          <button onClick={() => router.push(`/messages/${matchId}`)}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg">
            Message
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create SwipeDeck component**

Create `components/dating/SwipeDeck.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { X, Heart } from 'lucide-react'
import { ProfileCard } from './ProfileCard'
import { MatchModal } from './MatchModal'

interface DatingProfile {
  id: string
  name: string
  photo_url: string | null
  city: string
  genres: string[]
  xp: number
  bio: string | null
}

export function SwipeDeck({ initialCandidates }: { initialCandidates: DatingProfile[] }) {
  const [candidates, setCandidates] = useState(initialCandidates)
  const [loading, setLoading] = useState(false)
  const [match, setMatch] = useState<{ id: string; name: string } | null>(null)
  const [paywallHit, setPaywallHit] = useState(false)

  const current = candidates[0]

  async function swipe(direction: 'left' | 'right') {
    if (!current || loading) return
    setLoading(true)

    const res = await fetch('/api/swipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swiped_id: current.id, direction }),
    })

    const data = await res.json()

    if (res.status === 429) {
      setPaywallHit(true)
      setLoading(false)
      return
    }

    if (data.match) {
      setMatch({ id: data.matchId, name: current.name })
    }

    setCandidates(prev => prev.slice(1))
    setLoading(false)
  }

  if (paywallHit) {
    return (
      <div className="text-center space-y-4 py-12">
        <p className="text-white text-lg font-semibold">You've used your 10 free swipes today</p>
        <p className="text-gray-400 text-sm">Upgrade to Premium for unlimited swipes</p>
        <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg">Upgrade — ₹299/mo</button>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No more profiles right now.</p>
        <p className="text-sm mt-1">Check back tomorrow or be more active in discussions!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {match && (
        <MatchModal matchId={match.id} matchName={match.name} onClose={() => setMatch(null)} />
      )}

      <ProfileCard profile={current} />

      <div className="flex justify-center gap-8">
        <button onClick={() => swipe('left')} disabled={loading}
          className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-red-400 hover:bg-red-950 disabled:opacity-50">
          <X size={24} />
        </button>
        <button onClick={() => swipe('right')} disabled={loading}
          className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-green-400 hover:bg-green-950 disabled:opacity-50">
          <Heart size={24} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create discover page**

Create `app/(app)/discover/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SwipeDeck } from '@/components/dating/SwipeDeck'

export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('dating_unlocked, xp')
    .eq('id', user.id)
    .single()

  if (!profile?.dating_unlocked) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center space-y-3">
        <h2 className="text-white text-xl font-semibold">Dating is locked</h2>
        <p className="text-gray-400">You need 100 XP to unlock dating. You have {profile?.xp ?? 0} XP.</p>
        <p className="text-gray-500 text-sm">Discuss, post, and comment on the feed to earn XP.</p>
      </div>
    )
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/candidates`, {
    headers: { Cookie: '' },
  })

  // Fetch candidates via internal API
  const supabaseAdmin = await createClient()
  const { data: { user: authUser } } = await supabaseAdmin.auth.getUser()

  // Re-use candidates route logic inline for SSR
  const candidatesRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/candidates`,
    { headers: { cookie: '' } }
  )

  const { candidates = [] } = candidatesRes.ok ? await candidatesRes.json() : {}

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-white mb-6">Discover</h1>
      <SwipeDeck initialCandidates={candidates} />
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/dating/ app/\(app\)/discover/
git commit -m "feat: add swipe deck UI with match detection and paywall gate"
```

---

## Phase I: Messaging

---

### Task 16: Messages API & Chat UI

**Files:**
- Create: `app/api/messages/route.ts`, `app/(app)/matches/page.tsx`, `app/(app)/messages/[matchId]/page.tsx`

- [ ] **Step 1: Create messages API**

Create `app/api/messages/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FREE_MESSAGE_LIMIT = 3

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { match_id, content } = await request.json()
  if (!match_id || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Verify user is part of this match
  const { data: match } = await supabase
    .from('matches')
    .select('id, user1_id, user2_id')
    .eq('id', match_id)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .single()

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  // Check free message limit
  const { data: profile } = await supabase.from('users').select('is_premium').eq('id', user.id).single()

  if (!profile?.is_premium) {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', match_id)
      .eq('sender_id', user.id)

    if ((count ?? 0) >= FREE_MESSAGE_LIMIT) {
      return NextResponse.json({ error: 'Message limit reached', upgrade: true }, { status: 429 })
    }
  }

  const { data: message, error } = await supabase.from('messages').insert({
    match_id,
    sender_id: user.id,
    content,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message }, { status: 201 })
}
```

- [ ] **Step 2: Create matches list page**

Create `app/(app)/matches/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id,
      created_at,
      user1:users!matches_user1_id_fkey(id, name, photo_url),
      user2:users!matches_user2_id_fkey(id, name, photo_url)
    `)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-lg font-semibold text-white">Matches</h1>
      {(matches ?? []).length === 0 && (
        <p className="text-gray-500">No matches yet. Keep swiping!</p>
      )}
      {(matches ?? []).map((m: any) => {
        const other = m.user1?.id === user.id ? m.user2 : m.user1
        return (
          <Link key={m.id} href={`/messages/${m.id}`}
            className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600">
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold text-white">
              {other?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-white font-medium">{other?.name}</p>
              <p className="text-gray-500 text-sm">Tap to chat</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create chat page**

Create `app/(app)/messages/[matchId]/page.tsx`:
```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send } from 'lucide-react'
import { useParams } from 'next/navigation'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
}

export default function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [userId, setUserId] = useState('')
  const [limitHit, setLimitHit] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ''))

    supabase.from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(data ?? []))

    const channel = supabase
      .channel(`messages:${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [matchId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!text.trim()) return
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, content: text }),
    })
    if (res.status === 429) { setLimitHit(true); return }
    setText('')
  }

  return (
    <div className="flex flex-col h-screen max-w-xl mx-auto">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${m.sender_id === userId
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-200'}`}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {limitHit ? (
        <div className="p-4 text-center border-t border-gray-800">
          <p className="text-gray-400 text-sm mb-2">Free limit: 3 messages per match</p>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Upgrade to Premium</button>
        </div>
      ) : (
        <div className="p-4 border-t border-gray-800 flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-indigo-500" />
          <button onClick={send} className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Send size={16} className="text-white" />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/messages/ app/\(app\)/matches/ app/\(app\)/messages/
git commit -m "feat: add messaging with realtime, match list, and free-tier limit"
```

---

## Phase J: Navigation & Profile

---

### Task 17: App Layout & Navbar

**Files:**
- Create: `app/(app)/layout.tsx`, `components/layout/Navbar.tsx`

- [ ] **Step 1: Create Navbar**

Create `components/layout/Navbar.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Newspaper, Heart, MessageCircle, User } from 'lucide-react'

const NAV = [
  { href: '/feed', icon: Newspaper, label: 'Feed' },
  { href: '/discover', icon: Heart, label: 'Discover' },
  { href: '/matches', icon: MessageCircle, label: 'Matches' },
  { href: '/profile', icon: User, label: 'Profile' },
]

export function Navbar() {
  const path = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 z-40">
      <div className="max-w-xl mx-auto flex">
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs ${path.startsWith(href) ? 'text-indigo-400' : 'text-gray-500'}`}>
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create app layout**

Create `app/(app)/layout.tsx`:
```tsx
import { Navbar } from '@/components/layout/Navbar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-950 min-h-screen pb-20">
      {children}
      <Navbar />
    </div>
  )
}
```

- [ ] **Step 3: Create profile page**

Create `app/(app)/profile/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { XpBadge } from '@/components/ui/XpBadge'
import { GENRES } from '@/lib/genres'
import { DATING_UNLOCK_THRESHOLD } from '@/lib/xp/weights'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const genreLabels = GENRES.filter(g => profile.genres.includes(g.id)).map(g => g.label)
  const xpProgress = Math.min(100, (profile.xp / DATING_UNLOCK_THRESHOLD) * 100)

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-2xl font-bold text-white">
          {profile.name[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-white text-xl font-semibold">{profile.name}</h1>
          <p className="text-gray-400 text-sm">{profile.city}</p>
        </div>
      </div>

      <XpBadge xp={profile.xp} />

      {!profile.dating_unlocked && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Progress to dating</span>
            <span>{profile.xp}/{DATING_UNLOCK_THRESHOLD} XP</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full">
            <div className="h-2 bg-indigo-600 rounded-full" style={{ width: `${xpProgress}%` }} />
          </div>
        </div>
      )}

      {profile.bio && <p className="text-gray-300">{profile.bio}</p>}

      <div className="flex flex-wrap gap-2">
        {genreLabels.map(g => (
          <span key={g} className="text-sm bg-gray-800 text-gray-300 px-3 py-1 rounded-full">{g}</span>
        ))}
      </div>

      <form action={signOut}>
        <button type="submit" className="text-gray-500 text-sm hover:text-gray-300">Sign out</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Create landing page redirect**

Create `app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/feed')
}
```

- [ ] **Step 5: Commit**

```bash
git add components/layout/ app/\(app\)/layout.tsx app/\(app\)/profile/ app/page.tsx
git commit -m "feat: add navbar, app layout, and profile page with XP progress"
```

---

## Phase K: Final Wiring

---

### Task 18: Root Layout & Global Styles

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update root layout**

Replace contents of `app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TechDate',
  description: 'For people who build things.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Add NEXT_PUBLIC_APP_URL to .env.example**

Add to `.env.example`:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Start dev server and verify**

```bash
npm run dev
```

Visit `http://localhost:3000` — should redirect to `/feed`, then to `/login` (not authenticated).
Test login flow → onboarding → feed loads with Gideon badge visible on any pre-seeded posts.

- [ ] **Step 5: Deploy to Vercel**

```bash
npx vercel --prod
```

Set environment variables in Vercel dashboard (same as `.env.local`).

- [ ] **Step 6: Final commit**

```bash
git add app/layout.tsx .env.example
git commit -m "feat: complete TechDate MVP — feed, dating, messaging, Gideon, XP"
```

---

## Summary of All Tasks

| # | Task | Phase |
|---|---|---|
| 1 | Project Setup | Foundation |
| 2 | Supabase Client Config | Foundation |
| 3 | Database Schema (5 migrations) | Foundation |
| 4 | Phone OTP Login | Auth |
| 5 | Onboarding + Genre Selection + Vector Seed | Auth |
| 6 | XP Weights + Award Function + API | XP System |
| 7 | Posts / Like / Comments API | Feed |
| 8 | Feed UI (PostCard, CreatePost, CommentSection) | Feed |
| 9 | Gideon Python Agent (HN + dev.to) | Gideon |
| 10 | GitHub Actions Cron Workflow | Gideon |
| 11 | Cosine Similarity + Candidate Scoring | Matching |
| 12 | Candidates API (filters + ranking) | Matching |
| 13 | Upstash Redis Client | Infrastructure |
| 14 | Swipes API (match detection + rate limit) | Dating |
| 15 | SwipeDeck + ProfileCard + MatchModal | Dating |
| 16 | Messages API + Chat UI + Realtime | Messaging |
| 17 | Navbar + App Layout + Profile Page | Navigation |
| 18 | Root Layout + Deploy | Final |
