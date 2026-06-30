import xml.etree.ElementTree as ET

import httpx

ARXIV_API = "https://export.arxiv.org/api/query"
ATOM = "{http://www.w3.org/2005/Atom}"
MAX_CONTENT = 800


def _clean(text: str) -> str:
    return " ".join((text or "").split()).strip()


def fetch_arxiv_posts(query: str, limit: int = 6) -> list:
    """Fetch newest arXiv papers for a search query (Atom XML, stdlib parse). Blank
    query -> [] (genres with no arXiv coverage). Fails safe. points=0 (no popularity
    signal — relies on fetch.py's normalized merge to compete)."""
    if not query or not query.strip():
        return []
    try:
        r = httpx.get(
            ARXIV_API,
            params={
                "search_query": query,
                "sortBy": "submittedDate",
                "sortOrder": "descending",
                "max_results": limit,
            },
            headers={"User-Agent": "GideonBot/1.0 (+await)"},
            timeout=15,
        )
        r.raise_for_status()
        root = ET.fromstring(r.text)
    except Exception as e:
        print(f"arxiv fetch error: {e}")
        return []

    posts = []
    for entry in root.findall(f"{ATOM}entry"):
        title = _clean(entry.findtext(f"{ATOM}title", ""))
        if not title or len(title) <= 10:
            continue
        url = ""
        for link in entry.findall(f"{ATOM}link"):
            if link.get("rel") == "alternate":
                url = link.get("href", "")
                break
        if not url:
            url = _clean(entry.findtext(f"{ATOM}id", ""))
        if not url:
            continue
        content = _clean(entry.findtext(f"{ATOM}summary", ""))[:MAX_CONTENT] or None
        posts.append({
            "title": title,
            "url": url,
            "content": content,
            "image_url": None,
            "points": 0,
            "source": "arxiv",
        })
    return posts


if __name__ == "__main__":
    assert fetch_arxiv_posts("") == [], "blank query must short-circuit to []"
    sample = fetch_arxiv_posts("cat:cs.AI", limit=5)
    print(f"arxiv: {len(sample)} posts")
    for p in sample[:3]:
        assert {"title", "url", "content", "image_url", "points", "source"} <= p.keys()
        assert p["points"] == 0
        print(f"  {p['title'][:70]}")
