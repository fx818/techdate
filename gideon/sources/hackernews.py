import httpx

HN_ALGOLIA = "https://hn.algolia.com/api/v1/search"

def fetch_hn_posts(query: str, tags: list, limit: int = 8) -> list:
    """Fetch posts from HackerNews Algolia API for a given query."""
    params = {
        "query": query,
        "tags": "story",
        "hitsPerPage": limit,
        "numericFilters": "points>10",
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
