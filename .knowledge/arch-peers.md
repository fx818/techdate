---
type: architecture
title: Peers & Connections
description: Ping → accept → Peer; Discover browse, requests inbox, per-match chat
tags: [peers, connections, ping, swipes, matches, messages]
timestamp: 2026-06-19T00:00:00Z
---

# Peers & Connections

The networking layer. Connection model is **Ping → accept → Peer** — open to everyone, no XP gate, no gender filter. (Romantic/dating framing was dropped; this is professional networking.)

- **Browse:** the **Discover** tab (`/discover`) shows interest-ranked people (`components/dating/SwipeDeck.tsx`, `ProfileCard.tsx`). Right-swipe = a Ping. A Ping can also be sent from any profile via `components/dating/PingButton.tsx`.
- **Ping = pending request:** a row in `swipes` (direction `right`). Recipient sees it in the requests inbox (`/requests`, `components/dating/RequestList.tsx`).
- **Accept → Peer:** accepting creates a `matches` row. Match IDs use sorted user IDs (`[u1,u2].sort()`) to satisfy the unique constraint; on duplicate-insert race the route falls back to fetching the existing match.
- **Peers list:** `app/(app)/matches` route renders the **Peers** tab (`components/dating/PeersList.tsx`) — accepted connections, with a search box filtering by name/@username.
- **Chat:** each Peer has a 1:1 chat at `app/(app)/messages/[matchId]` (`005_messages`). `/messages` is still a chat (only the "Chats/Matches" *label* became "Peers").
- **Internal names kept:** routes/tables `/discover`, `/requests`, `/matches`, `swipes`, `matches` were NOT renamed — only user-facing copy/nav labels changed (avoids a risky rename). See [glossary](glossary.md), [matching](arch-matching.md).
- Daily Ping/swipe cap via Redis counter — see [database](arch-database.md). Messages are rate-limited too — see [moderation](arch-moderation.md). (`components/dating/MatchModal.tsx` was deleted on 2026-06-19 — it was unused.)
