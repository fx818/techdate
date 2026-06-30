"""LLM-as-judge quality gate for Gideon.

Scores candidate posts 0-10 via an OpenAI-compatible chat-completions endpoint
(Gemini by default). Configuration is read from the gideon_judge_config DB row.
Every failure path is fail-open: a candidate that can't be judged is kept, so
the judge never blocks the feed. See docs/superpowers/specs/2026-06-30-gideon-llm-judge-design.md.
"""
import json
import re
import httpx

JUDGE_FALLBACK_REASON = "judge-unavailable (fail-open)"


def load_config(supabase) -> dict | None:
    """Read the singleton gideon_judge_config row. Service-role client bypasses
    RLS, so the raw api_key comes back. Returns None on any error."""
    try:
        res = supabase.table("gideon_judge_config").select("*").eq("id", 1).single().execute()
        return res.data
    except Exception as e:
        print(f"  judge: config load failed: {e}")
        return None


def build_prompt(post: dict, criteria: str) -> str:
    title = post.get("title") or ""
    url = post.get("url") or ""
    excerpt = (post.get("content") or "")[:500]
    return (
        f"{criteria}\n\n"
        "Rate the item below for whether it is worth posting, on a 0-10 scale.\n"
        'Respond with ONLY a JSON object: {"score": <integer 0-10>, "reason": "<short>"}\n\n'
        f"Title: {title}\nURL: {url}\nExcerpt: {excerpt}"
    )


def parse_verdict(content: str, threshold: int) -> tuple[bool, int, str]:
    """Extract the first JSON object from the model output and turn it into a
    verdict. Raises if no JSON object is present or score is missing."""
    m = re.search(r"\{.*\}", content, re.DOTALL)
    if not m:
        raise ValueError("no JSON object in judge response")
    data = json.loads(m.group(0))
    score = int(data["score"])
    reason = str(data.get("reason", ""))[:200]
    return (score >= threshold, score, reason)


def _call_llm(config: dict, prompt: str) -> str:
    """One OpenAI-compatible /chat/completions request; returns message content."""
    url = config["base_url"].rstrip("/") + "/chat/completions"
    resp = httpx.post(
        url,
        headers={
            "Authorization": f"Bearer {config['api_key']}",
            "Content-Type": "application/json",
        },
        json={
            "model": config["model"],
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def judge_post(post: dict, config: dict) -> tuple[bool, int, str]:
    """Judge one post. Any error (network, HTTP, parse) fails open: keep=True."""
    threshold = int(config.get("pass_threshold", 6))
    try:
        prompt = build_prompt(post, config.get("criteria") or "")
        content = _call_llm(config, prompt)
        return parse_verdict(content, threshold)
    except Exception as e:
        print(f"  judge: error ({e}); failing open for {post.get('title')!r}")
        return (True, -1, JUDGE_FALLBACK_REASON)


def select_with_judge(candidates: list, max_n: int, judge_fn) -> tuple[list, list]:
    """Walk candidates in ranked order, judging each; collect those that pass
    until max_n are kept or the pool is exhausted (backfill). Returns
    (kept, dropped); dropped is a list of {"post", "score", "reason"} for the
    candidates judged-and-dropped during the walk (not those skipped after the
    quota filled)."""
    kept: list = []
    dropped: list = []
    for c in candidates:
        keep, score, reason = judge_fn(c)
        verdict = "KEEP" if keep else "DROP"
        print(f"  judge: {verdict} score={score} {c.get('title')!r} — {reason}")
        if keep:
            kept.append(c)
            if len(kept) >= max_n:
                break
        else:
            dropped.append({"post": c, "score": score, "reason": reason})
    return kept, dropped
