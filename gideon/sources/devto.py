import httpx

DEVTO_API = "https://dev.to/api/articles"


def fetch_devto_posts(tags: list, limit: int = 8) -> list:
    """Fetch posts from dev.to API for given tags.

    dev.to returns a real excerpt (`description`) and a cover image, so Gideon
    posts from this source render with proper body text + image like a human post.
    """
    posts = []
    for tag in tags[:2]:
        try:
            params = {"tag": tag, "per_page": limit, "top": 1}
            response = httpx.get(DEVTO_API, params=params, timeout=10)
            response.raise_for_status()
            articles = response.json()
            for a in articles:
                description = (a.get("description") or "").strip()
                image_url = a.get("cover_image") or a.get("social_image")
                posts.append({
                    "title": a.get("title", ""),
                    "url": a.get("url", ""),
                    "content": description or None,
                    "image_url": image_url or None,
                    "points": a.get("positive_reactions_count", 0),
                    "source": "devto",
                })
        except Exception as e:
            print(f"dev.to fetch error for tag {tag}: {e}")
    return posts
