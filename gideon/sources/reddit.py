import html

import httpx

UA = "GideonBot/1.0 (+await; content aggregator)"


def _clean(text: str) -> str:
    return " ".join((text or "").split()).strip()


def fetch_reddit_posts(subreddits: list, limit: int = 8) -> list:
    """Fetch hot posts from each subreddit's public .json endpoint. Fails safe per
    subreddit (continues on error) so one bad sub never breaks the run. Same dict
    contract as the other sources."""
    posts = []
    for sub in (subreddits or []):
        try:
            r = httpx.get(
                f"https://www.reddit.com/r/{sub}/hot.json",
                params={"limit": limit, "raw_json": 1},
                headers={"User-Agent": UA},
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
