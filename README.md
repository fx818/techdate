# TechDate

A platform for tech professionals to discuss tech news, earn XP through engagement, and connect with others who share their interests.

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env.local` and fill in values
3. `npm install`
4. Run Supabase migrations: `supabase db push` (or run SQL files in `supabase/migrations/` manually)
5. `npm run dev`

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (used by Gideon) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g. `https://your-app.vercel.app`) |

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables from `.env.example`
4. Deploy

## Gideon Agent

Gideon auto-fetches tech content from HackerNews and dev.to every 4 hours via GitHub Actions.

Set these GitHub Actions secrets in your repo settings:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **Backend + Auth + DB:** Supabase
- **Cache:** Upstash Redis (daily swipe counting)
- **Content:** Gideon agent (GitHub Actions cron)
