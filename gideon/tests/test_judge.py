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


# --- select_with_judge (backfill) ---

def test_select_with_judge_stops_at_n():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(10)]
    # every candidate passes
    kept = judge.select_with_judge(cands, 3, lambda c: (True, 9, "ok"))
    assert len(kept) == 3
    assert [c["title"] for c in kept] == ["p0", "p1", "p2"]


def test_select_with_judge_backfills_past_drops():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(6)]
    # drop the first two, keep the rest
    def jf(c):
        keep = c["title"] not in ("p0", "p1")
        return (keep, 9 if keep else 1, "x")
    kept = judge.select_with_judge(cands, 2, jf)
    assert [c["title"] for c in kept] == ["p2", "p3"]


def test_select_with_judge_exhausts_pool_when_few_pass():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(4)]
    # only p1 passes; pool exhausts before reaching N=3
    kept = judge.select_with_judge(cands, 3, lambda c: (c["title"] == "p1", 9, "x"))
    assert [c["title"] for c in kept] == ["p1"]
