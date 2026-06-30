import pytest
import judge


# --- parse_verdict ---

def test_parse_verdict_passes_at_threshold():
    keep, score, reason = judge.parse_verdict('{"score": 6, "reason": "solid"}', 6)
    assert keep is True
    assert score == 6
    assert reason == "solid"


def test_parse_verdict_fails_below_threshold():
    keep, score, reason = judge.parse_verdict('{"score": 5, "reason": "meh"}', 6)
    assert keep is False
    assert score == 5


def test_parse_verdict_extracts_fenced_json():
    content = 'Here is my verdict:\n```json\n{"score": 8, "reason": "great"}\n```'
    keep, score, reason = judge.parse_verdict(content, 6)
    assert keep is True
    assert score == 8


def test_parse_verdict_raises_on_no_json():
    with pytest.raises(ValueError):
        judge.parse_verdict("no json here", 6)


# --- judge_post (fail-open) ---

def test_judge_post_keeps_when_score_ge_threshold(monkeypatch):
    monkeypatch.setattr(judge, "_call_llm", lambda cfg, prompt: '{"score": 9, "reason": "ok"}')
    cfg = {"criteria": "c", "pass_threshold": 6, "base_url": "x", "model": "m", "api_key": "k"}
    keep, score, reason = judge.judge_post({"title": "T", "url": "u"}, cfg)
    assert keep is True
    assert score == 9


def test_judge_post_drops_when_below_threshold(monkeypatch):
    monkeypatch.setattr(judge, "_call_llm", lambda cfg, prompt: '{"score": 2, "reason": "weak"}')
    cfg = {"criteria": "c", "pass_threshold": 6, "base_url": "x", "model": "m", "api_key": "k"}
    keep, score, reason = judge.judge_post({"title": "T", "url": "u"}, cfg)
    assert keep is False
    assert score == 2


def test_judge_post_fail_open_on_call_error(monkeypatch):
    def boom(cfg, prompt):
        raise RuntimeError("network down")
    monkeypatch.setattr(judge, "_call_llm", boom)
    cfg = {"criteria": "c", "pass_threshold": 6, "base_url": "x", "model": "m", "api_key": "k"}
    keep, score, reason = judge.judge_post({"title": "T", "url": "u"}, cfg)
    assert keep is True
    assert score == -1
    assert reason == judge.JUDGE_FALLBACK_REASON


def test_judge_post_fail_open_on_bad_json(monkeypatch):
    monkeypatch.setattr(judge, "_call_llm", lambda cfg, prompt: "totally not json")
    cfg = {"criteria": "c", "pass_threshold": 6, "base_url": "x", "model": "m", "api_key": "k"}
    keep, score, reason = judge.judge_post({"title": "T", "url": "u"}, cfg)
    assert keep is True


# --- select_with_judge (backfill + dropped capture) ---

def test_select_with_judge_stops_at_n():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(10)]
    kept, dropped = judge.select_with_judge(cands, 3, lambda c: (True, 9, "ok"))
    assert [c["title"] for c in kept] == ["p0", "p1", "p2"]
    assert dropped == []


def test_select_with_judge_backfills_past_drops():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(6)]
    def jf(c):
        keep = c["title"] not in ("p0", "p1")
        return (keep, 9 if keep else 1, "x")
    kept, dropped = judge.select_with_judge(cands, 2, jf)
    assert [c["title"] for c in kept] == ["p2", "p3"]
    assert [d["post"]["title"] for d in dropped] == ["p0", "p1"]


def test_select_with_judge_exhausts_pool_when_few_pass():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(4)]
    kept, dropped = judge.select_with_judge(cands, 3, lambda c: (c["title"] == "p1", 9, "x"))
    assert [c["title"] for c in kept] == ["p1"]
    assert [d["post"]["title"] for d in dropped] == ["p0", "p2", "p3"]


def test_select_with_judge_dropped_carries_score_and_reason():
    cands = [{"title": "p0", "url": "u0"}]
    kept, dropped = judge.select_with_judge(cands, 5, lambda c: (False, 2, "weak"))
    assert kept == []
    assert dropped == [{"post": {"title": "p0", "url": "u0"}, "score": 2, "reason": "weak"}]


def test_select_with_judge_does_not_capture_unreached_candidates():
    # quota of 2 fills at p2; p3 is never judged, so it is NOT a drop.
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(4)]
    seq = {"p0": True, "p1": False, "p2": True, "p3": True}
    kept, dropped = judge.select_with_judge(
        cands, 2, lambda c: (seq[c["title"]], 9 if seq[c["title"]] else 1, "r")
    )
    assert [c["title"] for c in kept] == ["p0", "p2"]
    assert [d["post"]["title"] for d in dropped] == ["p1"]
