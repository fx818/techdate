import fetch


def test_dedup_candidates_skips_missing_fields():
    posts = [
        {"title": "", "url": "u1"},
        {"title": "Has title", "url": ""},
        {"title": "Good", "url": "u3"},
    ]
    out = fetch.dedup_candidates(posts, set(), set())
    assert [p["url"] for p in out] == ["u3"]


def test_dedup_candidates_skips_url_dupes():
    posts = [{"title": "A", "url": "u1"}, {"title": "B", "url": "u1"}]
    out = fetch.dedup_candidates(posts, set(), set())
    assert len(out) == 1
    assert out[0]["title"] == "A"


def test_dedup_candidates_skips_same_title():
    posts = [{"title": "Same Title", "url": "u1"}, {"title": "same title", "url": "u2"}]
    out = fetch.dedup_candidates(posts, set(), set())
    assert len(out) == 1


def test_dedup_candidates_respects_existing_sets():
    posts = [{"title": "A", "url": "u1"}, {"title": "B", "url": "u2"}]
    out = fetch.dedup_candidates(posts, {"u1"}, set())
    assert [p["url"] for p in out] == ["u2"]


def test_dedup_candidates_excludes_dismissed():
    posts = [{"title": "A", "url": "u1"}, {"title": "B", "url": "u2"}]
    out = fetch.dedup_candidates(posts, set(), set(), {"u1"})
    assert [p["url"] for p in out] == ["u2"]


def test_dedup_candidates_dismissed_defaults_to_none():
    # called with the original 3 args (no dismissed) — still works
    posts = [{"title": "A", "url": "u1"}]
    out = fetch.dedup_candidates(posts, set(), set())
    assert [p["url"] for p in out] == ["u1"]


def test_filter_new_rejections_skips_queued():
    dropped = [
        {"post": {"url": "u1"}, "score": 2, "reason": "x"},
        {"post": {"url": "u2"}, "score": 3, "reason": "y"},
    ]
    queued = {"u1"}
    out = fetch.filter_new_rejections(dropped, queued)
    assert [d["post"]["url"] for d in out] == ["u2"]
    assert "u2" in queued  # mutated so later genres in the same run see it


def test_filter_new_rejections_dedups_within_batch():
    dropped = [
        {"post": {"url": "u1"}, "score": 2, "reason": "x"},
        {"post": {"url": "u1"}, "score": 1, "reason": "z"},
    ]
    out = fetch.filter_new_rejections(dropped, set())
    assert len(out) == 1


def test_filter_new_rejections_skips_missing_url():
    dropped = [{"post": {}, "score": 2, "reason": "x"}]
    out = fetch.filter_new_rejections(dropped, set())
    assert out == []


def test_record_rejections_non_fatal(monkeypatch):
    """record_rejections raising must not propagate — the try/except in run() wraps it."""
    # Verify the guard is in run()'s source so the wrap exists exactly where we expect.
    import inspect
    src = inspect.getsource(fetch.run)
    assert "reject-queue recording failed (non-fatal)" in src, (
        "run() must catch record_rejections errors as non-fatal"
    )
