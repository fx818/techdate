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
