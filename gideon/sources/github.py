import os
from datetime import datetime, timedelta, timezone

import httpx

GITHUB_SEARCH = "https://api.github.com/search/repositories"


def fetch_github_posts(query: str, limit: int = 6) -> list:
    """Search GitHub repos for a topic query, most-starred first, restricted to repos
    pushed in the last ~90 days (favor active projects). Blank query -> []. Fails safe.
    Optional GITHUB_TOKEN raises the search rate limit (10 -> 30 req/min)."""
    if not query or not query.strip():
        return []
    since = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")
    q = f"{query} pushed:>{since}"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "GideonBot/1.0 (+await)",
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = httpx.get(
            GITHUB_SEARCH,
            params={"q": q, "sort": "stars", "order": "desc", "per_page": limit},
            headers=headers,
            timeout=15,
        )
        r.raise_for_status()
        items = r.json().get("items", [])
    except Exception as e:
        print(f"github fetch error: {e}")
        return []

    posts = []
    for repo in items:
        title = repo.get("full_name", "")
        url = repo.get("html_url", "")
        if not title or not url:
            continue
        description = (repo.get("description") or "").strip()
        posts.append({
            "title": title,
            "url": url,
            "content": description or None,
            "image_url": None,  # fetch.py og-scraper grabs GitHub's repo social card
            "points": repo.get("stargazers_count", 0) or 0,
            "source": "github",
        })
    return posts


if __name__ == "__main__":
    assert fetch_github_posts("") == [], "blank query must short-circuit to []"
    sample = fetch_github_posts("topic:react", limit=5)
    print(f"github: {len(sample)} posts")
    for p in sample[:3]:
        assert {"title", "url", "content", "image_url", "points", "source"} <= p.keys()
        print(f"  [{p['points']}*] {p['title']}")
