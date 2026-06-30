import html
import os

import httpx

UA = "GideonBot/1.0 (+await; content aggregator)"
TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
OAUTH_BASE = "https://oauth.reddit.com"


def _clean(text: str) -> str:
    return " ".join((text or "").split()).strip()


def _get_token() -> str | None:
    """App-only (userless) OAuth token via client-credentials. Returns None when creds
    are absent or the request fails — caller then yields no posts (fail-safe). Needed
    because www.reddit.com/.json returns 403 Blocked for datacenter IPs (the cron's
    GitHub Actions runners); oauth.reddit.com works with a token."""
    client_id = os.environ.get("REDDIT_CLIENT_ID")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET")
    if not client_id or not client_secret:
        print("reddit: REDDIT_CLIENT_ID/SECRET not set — skipping Reddit source")
        return None
    try:
        r = httpx.post(
            TOKEN_URL,
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": UA},
            timeout=10,
        )
        r.raise_for_status()
        return r.json().get("access_token")
    except Exception as e:
        print(f"reddit token error: {e}")
        return None


def fetch_reddit_posts(subreddits: list, limit: int = 8) -> list:
    """Fetch hot posts per subreddit via Reddit's app-only OAuth API. Requires
    REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET; without them returns [] (graceful no-op).
    Fails safe per subreddit so one bad sub never breaks the run. Same dict contract
    as the other sources."""
    if not subreddits:
        return []
    token = _get_token()
    if not token:
        return []
    headers = {"Authorization": f"bearer {token}", "User-Agent": UA}
    posts = []
    for sub in subreddits:
        try:
            r = httpx.get(
                f"{OAUTH_BASE}/r/{sub}/hot",
                params={"limit": limit, "raw_json": 1},
                headers=headers,
                timeout=10,
            )
            r.raise_for_status()
            children = r.json().get("data", {}).get("children", [])
        except Exception as e:
            print(f"reddit fetch error for r/{sub}: {e}")
            continue

        for child in children:
            d = child.get("data", {})
            if d.get("stickied") or d.get("over_18"):
                continue
            title = d.get("title", "")
            if not title or len(title) <= 10:
                continue
            permalink = d.get("permalink", "")
            url = d.get("url_overridden_by_dest") or (
                f"https://www.reddit.com{permalink}" if permalink else ""
            )
            if not url:
                continue
            content = _clean(d.get("selftext", ""))[:600] or None
            image_url = None
            preview = d.get("preview", {})
            images = preview.get("images") if isinstance(preview, dict) else None
            if images:
                src = images[0].get("source", {}).get("url")
                if src:
                    image_url = html.unescape(src)
            if not image_url:
                thumb = d.get("thumbnail", "")
                if isinstance(thumb, str) and thumb.startswith("http"):
                    image_url = thumb
            posts.append({
                "title": title,
                "url": url,
                "content": content,
                "image_url": image_url,
                "points": d.get("score", 0) or 0,
                "source": "reddit",
            })
    return posts


if __name__ == "__main__":
    sample = fetch_reddit_posts(["programming"], limit=5)
    print(f"reddit: {len(sample)} posts")
    for p in sample[:3]:
        assert {"title", "url", "content", "image_url", "points", "source"} <= p.keys()
        print(f"  [{p['points']}] {p['title'][:70]}")
