---
type: architecture
title: Auth & Sessions
description: Supabase cookie auth, route-group guard, idle session keep-alive
tags: [auth, session, supabase, proxy, verification]
timestamp: 2026-06-19T00:00:00Z
---

# Auth & Sessions

Supabase Auth with cookie-based sessions (`@supabase/ssr`). Server routes use the anon-key client (cookie auth), **not** the service role key.

- **Route groups:** `app/(auth)/` (login, onboarding, reset-password) has no navbar and no auth guard. `app/(app)/` is guarded — `app/(app)/layout.tsx` does the `getUser()` check and renders the bottom Navbar.
- **`proxy.ts` (NOT `middleware.ts`):** Next.js 16 renamed middleware → `proxy.ts` (root). It redirects unauthenticated → `/login` (except public routes `/login`, `/onboarding`, `/posts`), authenticated at `/` → `/feed`, and enforces the company-email gate for **personal-email** users on soft navigations. Matcher **excludes `api` and `auth`**; API routes do their own `getUser()` checks. (CLAUDE.md still says "middleware.ts" — stale.)
- **Email verification (real, not a denylist):** `lib/auth/email.ts` (`isPersonalEmail`, ~25 personal domains + 7-day trial), `lib/auth/disposable.ts` (`isDisposableEmail`, ~120k `disposable-email-domains` list — server-only), `lib/auth/mx.ts` (`domainHasMx`, MX with A-record fallback). Enforced at `/api/verify-company` and `app/(app)/layout.tsx`. **Disposable emails get NO trial** (gated immediately in the layout, since the 120k list can't run at the edge proxy); personal emails get the 7-day trial. `company_email_verified` clears the gate.
- **OAuth/callback:** `app/auth/callback`.
- **Idle keep-alive:** `components/layout/SessionWatcher.tsx` (mounted in the (app) layout) keeps the Supabase token refreshing while the tab is idle, so links stop dying after ~1h.

Type-inference workaround applies project-wide: `(supabase as any).from(...)` on every server query — see [database](arch-database.md).
