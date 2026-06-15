import re

import httpx

DEVTO_API = "https://dev.to/api/articles"

# Cap the stored body. dev.to articles can be very long and Gideon posts link to
# the source, so we store a generous multi-paragraph excerpt, not the whole piece.
MAX_BODY_CHARS = 3000


def _markdown_to_text(md: str) -> str:
    """Convert dev.to body_markdown into clean plain text for our <p> renderer."""
    if not md:
        return ""
    t = md.lstrip()
    # dev.to bodies begin with a YAML frontmatter block (--- ... ---) holding
    # title/description/tags/cover_image. Strip it so it doesn't leak into content.
    if t.startswith("---"):
        t = re.sub(r"^---\s*\n.*?\n---\s*\n?", "", t, count=1, flags=re.DOTALL)
    t = re.sub(r"\{%.*?%\}", "", t, flags=re.DOTALL)              # liquid tags
    t = re.sub(r"```.*?```", "", t, flags=re.DOTALL)              # fenced code
    t = re.sub(r"`([^`]*)`", r"\1", t)                            # inline code
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)                    # images
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)                # links -> text
    t = re.sub(r"^\s{0,3}#{1,6}\s*", "", t, flags=re.MULTILINE)   # headings
    t = re.sub(r"^\s{0,3}>\s?", "", t, flags=re.MULTILINE)        # blockquotes
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)                      # bold
    t = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", t)            # italic
    t = re.sub(r"^\s{0,3}[-*+]\s+", "• ", t, flags=re.MULTILINE)  # bullets
    t = re.sub(r"^\s{0,3}\d+\.\s+", "", t, flags=re.MULTILINE)    # numbered lists
    t = re.sub(r"^\s{0,3}[-*_]{3,}\s*$", "", t, flags=re.MULTILINE)  # hr rules
    t = re.sub(r"[ \t]+\n", "\n", t)                             # trailing spaces
    t = re.sub(r"\n{3,}", "\n\n", t)                             # collapse blanks
    return t.strip()


def _fetch_body(article_id) -> str:
    """Fetch the full article and return its body as trimmed plain text."""
    if not article_id:
        return ""
    try:
        r = httpx.get(f"{DEVTO_API}/{article_id}", timeout=10)
        r.raise_for_status()
        text = _markdown_to_text(r.json().get("body_markdown") or "")
        if len(text) > MAX_BODY_CHARS:
            text = text[:MAX_BODY_CHARS].rstrip() + "…"
        return text
    except Exception as e:
        print(f"dev.to body fetch error for {article_id}: {e}")
        return ""


def fetch_devto_posts(tags: list, limit: int = 8) -> list:
    """Fetch posts from dev.to API for given tags.

    Each post gets the full article body (plain text, generous excerpt) plus a
    cover image, so Gideon posts read like a real human post — not a bare link.
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
                body = _fetch_body(a.get("id"))
                image_url = a.get("cover_image") or a.get("social_image")
                posts.append({
                    "title": a.get("title", ""),
                    "url": a.get("url", ""),
                    "content": body or description or None,
                    "image_url": image_url or None,
                    "points": a.get("positive_reactions_count", 0),
                    "source": "devto",
                })
        except Exception as e:
            print(f"dev.to fetch error for tag {tag}: {e}")
    return posts
