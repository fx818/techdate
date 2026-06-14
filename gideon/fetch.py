import json
import os
import sys
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

def insert_posts(supabase: Client, posts: list, genre: str, existing_urls: set) -> int:
    """Insert new Gideon posts, skipping duplicates."""
    inserted = 0
    for post in posts:
        if not post["title"] or not post["url"]:
            continue
        if post["url"] in existing_urls:
            continue
        supabase.table("posts").insert({
            "is_gideon": True,
            "title": post["title"],
            "url": post["url"],
            "genre": genre,
            "source": post["source"],
            "author_id": None,
        }).execute()
        existing_urls.add(post["url"])
        inserted += 1
        if inserted >= MAX_POSTS_PER_GENRE:
            break
    return inserted

def run():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    genres = load_genres()
    total = 0

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
