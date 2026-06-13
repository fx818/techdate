import httpx

DEVTO_API = "https://dev.to/api/articles"

def fetch_devto_posts(tags: list, limit: int = 8) -> list:
    """Fetch posts from dev.to API for given tags."""
    posts = []
    for tag in tags[:2]:
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
