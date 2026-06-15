import json
import os
import re
import sys
import uuid
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client
from sources.hackernews import fetch_hn_posts
from sources.devto import fetch_devto_posts

load_dotenv()

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
MAX_POSTS_PER_GENRE = 2

def load_genres() -> dict:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(script_dir, "genres.json")) as f:
        return json.load(f)

def get_existing_urls(supabase: Client, genre: str) -> set:
    """Fetch URLs already stored for this genre to avoid duplicates."""
    result = supabase.table("posts").select("url").eq("genre", genre).eq("is_gideon", True).execute()
    return {row["url"] for row in result.data if row["url"]}

_OG_PATTERNS = (
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
    r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
)

def fetch_og_image(url: str) -> str | None:
    """Best-effort: scrape the og:image (or twitter:image) from a page's HTML so
    image-less posts (e.g. Hacker News links) still get a thumbnail."""
    if not url:
        return None
    try:
        r = httpx.get(url, timeout=8, follow_redirects=True,
                      headers={"User-Agent": "Mozilla/5.0 (compatible; GideonBot/1.0)"})
        r.raise_for_status()
        html = r.text[:200000]
        for pat in _OG_PATTERNS:
            m = re.search(pat, html, re.IGNORECASE)
            if m and m.group(1).startswith("http"):
                return m.group(1)
    except Exception as e:
        print(f"  og:image fetch failed for {url}: {e}")
    return None

def slugify(text: str, max_len: int = 60) -> str:
    """Lowercase, non-alphanumerics -> hyphen, trimmed, capped. Always non-empty."""
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")[:max_len].strip("-")
    return s or "post"

def unique_slug(supabase: Client, title: str) -> str:
    """slugify(title), suffixed with a short random hex if the slug is taken."""
    slug = slugify(title)
    existing = supabase.table("posts").select("id").eq("slug", slug).limit(1).execute()
    if existing.data:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    return slug

def insert_posts(supabase: Client, posts: list, genre: str, existing_urls: set) -> int:
    """Insert new Gideon posts, skipping duplicates."""
    inserted = 0
    for post in posts:
        if not post["title"] or not post["url"]:
            continue
        if post["url"] in existing_urls:
            continue
        image_url = post.get("image_url") or fetch_og_image(post.get("url"))
        supabase.table("posts").insert({
            "is_gideon": True,
            "title": post["title"],
            "slug": unique_slug(supabase, post["title"]),
            "url": post["url"],
            "content": post.get("content") or None,
            "image_url": image_url,
            "genre": genre,
            "source": post["source"],
            "author_id": None,
        }).execute()
        existing_urls.add(post["url"])
        inserted += 1
        if inserted >= MAX_POSTS_PER_GENRE:
            break
    return inserted

def reset_gideon_posts(supabase: Client) -> None:
    """Delete every Gideon-authored post (opt-in via GIDEON_RESET) so a fresh
    fetch can repopulate the feed — used to apply content/format improvements."""
    print("GIDEON_RESET set — deleting existing Gideon posts...")
    supabase.table("posts").delete().eq("is_gideon", True).execute()
    print("  done.")

def run():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    genres = load_genres()
    total = 0

    if os.environ.get("GIDEON_RESET", "").lower() in ("1", "true", "yes"):
        reset_gideon_posts(supabase)

    for genre_id, config in genres.items():
        print(f"Fetching for genre: {genre_id}")
        existing_urls = get_existing_urls(supabase, genre_id)

        hn_posts = fetch_hn_posts(config["hn_query"], config["hn_tags"])
        devto_posts = fetch_devto_posts(config["devto_tags"])

        all_posts = hn_posts + devto_posts
        all_posts.sort(key=lambda p: p.get("points", 0), reverse=True)

        inserted = insert_posts(supabase, all_posts, genre_id, existing_urls)
        print(f"  Inserted {inserted} posts for {genre_id}")
        total += inserted

    print(f"Gideon done. Total inserted: {total}")

if __name__ == "__main__":
    run()
