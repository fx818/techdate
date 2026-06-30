import json
import os
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client
from sources.hackernews import fetch_hn_posts
from sources.devto import fetch_devto_posts
from sources.lobsters import fetch_lobsters_posts
from sources.reddit import fetch_reddit_posts
from sources.arxiv import fetch_arxiv_posts
from sources.github import fetch_github_posts
from judge import load_config, judge_post, select_with_judge

load_dotenv()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
# How many posts to insert per genre per run. Configurable so we can dial feed
# volume without a code change. Default raised from 2 → 5 to fix a static feed.
MAX_POSTS_PER_GENRE = int(os.environ.get("GIDEON_MAX_POSTS_PER_GENRE", "5"))

def load_genres() -> dict:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(script_dir, "genres.json")) as f:
        return json.load(f)

def get_existing(supabase: Client, genre: str) -> tuple[set, set]:
    """Fetch URLs and normalized title keys already stored for this genre, so we
    can skip both exact-URL dupes and near-dupes that share a title across sources."""
    result = supabase.table("posts").select("url, title").eq("genre", genre).eq("is_gideon", True).execute()
    urls = {row["url"] for row in result.data if row["url"]}
    title_keys = {slugify(row["title"]) for row in result.data if row.get("title")}
    return urls, title_keys

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
    # HN discussion/self-post pages have no useful image and rate-limit scrapers.
    if "news.ycombinator.com" in url:
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

def dedup_candidates(posts: list, existing_urls: set, existing_title_keys: set,
                     dismissed: set | None = None) -> list:
    """Filter candidates to those with a title+url that aren't URL dupes,
    same-title near-dupes, or tombstoned (dismissed) URLs. Mutates the two
    dedup sets so later candidates see earlier ones."""
    dismissed = dismissed or set()
    unique: list = []
    for post in posts:
        if not post.get("title") or not post.get("url"):
            continue
        if post["url"] in dismissed:
            continue
        if post["url"] in existing_urls:
            continue
        title_key = slugify(post["title"])
        if title_key in existing_title_keys:
            continue
        existing_urls.add(post["url"])
        existing_title_keys.add(title_key)
        unique.append(post)
    return unique


def load_dismissed_urls(supabase: Client) -> set:
    """All tombstoned URLs — excluded from both the feed and the reject queue."""
    res = supabase.table("gideon_dismissed_urls").select("url").execute()
    return {row["url"] for row in res.data if row.get("url")}


def load_queued_reject_urls(supabase: Client) -> set:
    """URLs already sitting in the reject queue (from prior runs)."""
    res = supabase.table("gideon_rejections").select("url").execute()
    return {row["url"] for row in res.data if row.get("url")}


def load_live_gideon_urls(supabase: Client) -> set:
    """URLs already live as Gideon posts (any genre) — never re-queue these."""
    res = supabase.table("posts").select("url").eq("is_gideon", True).execute()
    return {row["url"] for row in res.data if row.get("url")}


def filter_new_rejections(dropped: list, skip_urls: set) -> list:
    """From judge drops, keep only entries whose URL isn't already in skip_urls
    (or missing), deduped within the batch. Mutates skip_urls so a URL dropped
    under one genre isn't re-queued under another in the same run. skip_urls is
    seeded with both queued-reject and live-post URLs by the caller; dismissed
    URLs are already excluded upstream by dedup_candidates."""
    out: list = []
    for d in dropped:
        url = d["post"].get("url")
        if not url or url in skip_urls:
            continue
        skip_urls.add(url)
        out.append(d)
    return out


def record_rejections(supabase: Client, dropped: list, genre: str, skip_urls: set) -> int:
    """Insert the judge's drops into gideon_rejections (skipping URLs already
    queued or live). Returns how many were recorded."""
    rows = filter_new_rejections(dropped, skip_urls)
    for d in rows:
        p = d["post"]
        supabase.table("gideon_rejections").insert({
            "title": p["title"],
            "url": p["url"],
            "content": p.get("content") or None,
            "image_url": p.get("image_url"),
            "genre": genre,
            "source": p["source"],
            "score": d["score"],
            "reason": d["reason"],
        }).execute()
    return len(rows)


def purge_expired_rejections(supabase: Client) -> None:
    """Delete un-actioned rejects older than 14 days (does NOT tombstone)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    supabase.table("gideon_rejections").delete().lt("created_at", cutoff).execute()


def insert_records(supabase: Client, posts: list, genre: str) -> tuple[int, list]:
    """Insert already-selected posts (dedup + judging done upstream). Returns
    (count, new_post_records) where each record is {"id","title","genre"} for push."""
    inserted = 0
    new_post_records: list = []
    for post in posts:
        image_url = post.get("image_url") or fetch_og_image(post.get("url"))
        result = supabase.table("posts").insert({
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
        inserted += 1
        if result.data and len(result.data) > 0:
            row_id = result.data[0].get("id")
            if row_id:
                new_post_records.append({"id": row_id, "title": post["title"], "genre": genre})
    return inserted, new_post_records

def reset_gideon_posts(supabase: Client) -> None:
    """Delete every Gideon-authored post (opt-in via GIDEON_RESET) so a fresh
    fetch can repopulate the feed — used to apply content/format improvements."""
    print("GIDEON_RESET set — deleting existing Gideon posts...")
    supabase.table("posts").delete().eq("is_gideon", True).execute()
    print("  done.")

def merge_normalized(source_lists: list) -> list:
    """Per source, normalize points to 0-1 relative to that source's own max, then
    merge and sort by the normalized score. A source whose max is 0 (e.g. arXiv) gets
    a flat 0.5 so it still competes instead of always sinking last under a raw-points
    sort. The `_score` key is internal-only; insert_posts builds an explicit row dict
    so it never reaches the DB."""
    scored = []
    for posts in source_lists:
        if not posts:
            continue
        mx = max((p.get("points", 0) or 0) for p in posts)
        for p in posts:
            pts = p.get("points", 0) or 0
            p["_score"] = (pts / mx) if mx > 0 else 0.5
            scored.append(p)
    scored.sort(key=lambda p: p.get("_score", 0), reverse=True)
    return scored


def run():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    genres = load_genres()
    total = 0
    all_new_posts: list = []

    # Load the LLM-judge config once. Active only when enabled AND a key is set;
    # otherwise we fall back to ranked-top-N insert (fail open).
    judge_config = load_config(supabase)
    judge_active = bool(judge_config and judge_config.get("enabled"))
    if judge_active and not judge_config.get("api_key"):
        print("  judge: enabled but no api_key set — inserting unjudged (fail open)")
        judge_active = False
    print(f"  judge: {'ACTIVE' if judge_active else 'inactive'}")

    # Reject-queue state: tombstoned URLs (excluded everywhere) + the set of
    # URLs a new reject must not duplicate (already queued OR already live).
    # Purge stale rejects once per run.
    dismissed_urls = load_dismissed_urls(supabase)
    reject_skip_urls = (
        load_queued_reject_urls(supabase) | load_live_gideon_urls(supabase)
        if judge_active else set()
    )
    purge_expired_rejections(supabase)

    if os.environ.get("GIDEON_RESET", "").lower() in ("1", "true", "yes"):
        reset_gideon_posts(supabase)

    for genre_id, config in genres.items():
        print(f"Fetching for genre: {genre_id}")
        existing_urls, existing_title_keys = get_existing(supabase, genre_id)

        hn_posts = fetch_hn_posts(config["hn_query"], config["hn_tags"])
        devto_posts = fetch_devto_posts(config["devto_tags"])
        lobsters_posts = fetch_lobsters_posts(config.get("lobsters_tags", []))
        reddit_posts = fetch_reddit_posts(config.get("subreddits", []))
        arxiv_posts = fetch_arxiv_posts(config.get("arxiv_query", ""))
        github_posts = fetch_github_posts(config.get("github_query", ""))

        all_posts = merge_normalized([
            hn_posts, devto_posts, lobsters_posts,
            reddit_posts, arxiv_posts, github_posts,
        ])

        unique = dedup_candidates(all_posts, existing_urls, existing_title_keys, dismissed_urls)
        if judge_active:
            selected, dropped = select_with_judge(
                unique, MAX_POSTS_PER_GENRE, lambda c: judge_post(c, judge_config)
            )
            recorded = record_rejections(supabase, dropped, genre_id, reject_skip_urls)
            if recorded:
                print(f"  Queued {recorded} rejected posts for {genre_id}")
        else:
            selected = unique[:MAX_POSTS_PER_GENRE]

        inserted, new_post_records = insert_records(supabase, selected, genre_id)
        print(f"  Inserted {inserted} posts for {genre_id}")
        total += inserted
        all_new_posts.extend(new_post_records)

    print(f"Gideon done. Total inserted: {total}")

    # Broadcast push notifications for newly inserted posts
    app_url = os.environ.get("APP_URL", "").rstrip("/")
    push_secret = os.environ.get("GIDEON_PUSH_SECRET", "")
    if all_new_posts and app_url and push_secret:
        try:
            resp = httpx.post(
                f"{app_url}/api/internal/gideon-push",
                json={"posts": all_new_posts},
                headers={"x-gideon-secret": push_secret},
                timeout=30,
            )
            print(f"Gideon push notified: {resp.json()}")
        except Exception as e:
            print(f"Gideon push notification failed (non-fatal): {e}")

if __name__ == "__main__":
    run()
