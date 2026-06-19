import httpx

# Lobsters is a techie-native link aggregator (https://lobste.rs). Adding it as a
# third source diversifies the feed beyond HN + dev.to so it doesn't recycle the
# same stories — the main cure for a feed that "feels static".
LOBSTERS_HOTTEST = "https://lobste.rs/hottest.json"


def _clean(text: str) -> str:
    return " ".join((text or "").split()).strip()


def fetch_lobsters_posts(tags: list, limit: int = 8) -> list:
    """Fetch hot stories from Lobsters and keep those whose tags intersect the
    given genre tags. Fails safe (returns []) so a source outage never breaks the
    cron — same contract as the HN and dev.to sources."""
    wanted = {t.lower() for t in (tags or [])}
    try:
        r = httpx.get(LOBSTERS_HOTTEST, timeout=10,
                      headers={"User-Agent": "GideonBot/1.0 (+await)"})
        r.raise_for_status()
        stories = r.json()
    except Exception as e:
        print(f"lobsters fetch error: {e}")
        return []

    posts = []
    for s in stories:
        story_tags = {str(t).lower() for t in (s.get("tags") or [])}
        if wanted and not (story_tags & wanted):
            continue
        title = s.get("title", "")
        if not title or len(title) <= 10:
            continue
        url = s.get("url") or s.get("comments_url") or ""
        if not url:
            continue
        content = _clean(s.get("description_plain") or s.get("description") or "")
        posts.append({
            "title": title,
            "url": url,
            "content": (content[:600] or None),
            "image_url": None,  # Lobsters exposes no image
            "points": s.get("score", 0) or 0,
            "source": "lobsters",
        })
        if len(posts) >= limit:
            break
    return posts
