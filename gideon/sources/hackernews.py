import html
import re
import time

import httpx

HN_ALGOLIA = "https://hn.algolia.com/api/v1/search"

# Only consider stories from the last N days so each run surfaces FRESH content
# instead of re-hitting the same all-time-top URLs (which dedup then skips).
HN_RECENCY_DAYS = 7


def _clean(text: str) -> str:
    """Strip HTML tags + decode entities from HN story_text into plain prose."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _build_content(hit: dict) -> str:
    """HN link stories have no description; use story_text if present,
    otherwise a clean metadata blurb so the post reads like a real one."""
    story_text = _clean(hit.get("story_text", ""))
    if story_text:
        return story_text[:600]
    author = hit.get("author", "")
    points = hit.get("points", 0)
    comments = hit.get("num_comments", 0) or 0
    parts = []
    if author:
        parts.append(f"by {author}")
    parts.append(f"{points} points")
    parts.append(f"{comments} comments")
    return f"Trending on Hacker News — {' · '.join(parts)}."


def fetch_hn_posts(query: str, tags: list, limit: int = 12) -> list:
    """Fetch recent, popular posts from the HackerNews Algolia API for a query."""
    cutoff = int(time.time()) - HN_RECENCY_DAYS * 86400
    params = {
        "query": query,
        "tags": "story",
        "hitsPerPage": limit,
        "numericFilters": f"points>10,created_at_i>{cutoff}",
    }
    try:
        response = httpx.get(HN_ALGOLIA, params=params, timeout=10)
        response.raise_for_status()
        hits = response.json().get("hits", [])
        return [
            {
                "title": h.get("title", ""),
                "url": h.get("url") or f"https://news.ycombinator.com/item?id={h['objectID']}",
                "content": _build_content(h),
                "image_url": None,  # HN Algolia exposes no image for link stories
                "points": h.get("points", 0),
                "source": "hackernews",
            }
            for h in hits
            if h.get("title") and len(h.get("title", "")) > 10
        ]
    except Exception as e:
        print(f"HN fetch error: {e}")
        return []
