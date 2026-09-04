"""Tests for chat_voice.py's pure helper functions — no DB or Gemini SDK
connection needed for these."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.api.routes import chat_voice as cv


def test_resolve_voice_falls_back_for_unrecognized_value():
    assert cv._resolve_voice("not-a-real-voice") == cv._DEFAULT_VOICE
    assert cv._resolve_voice(None) == cv._DEFAULT_VOICE


def test_resolve_voice_accepts_allowed_value():
    from app.api.routes.chat import ALLOWED_TTS_VOICES

    allowed = next(iter(ALLOWED_TTS_VOICES))
    assert cv._resolve_voice(allowed) == allowed


class _FakeSession:
    def __init__(self, session_state_json):
        self.session_state_json = session_state_json


def test_session_state_summary_none_when_empty():
    assert cv._session_state_summary(_FakeSession(None)) is None
    assert cv._session_state_summary(_FakeSession({})) is None


def test_session_state_summary_mentions_stored_fields():
    state = {
        "topic": "ordering food",
        "difficulty": "a bit easier",
        "target_words": ["먹다", "마시다"],
        "struggling_words": ["맛있다"],
        "pending_feedback": "watch the honorific ending",
    }
    summary = cv._session_state_summary(_FakeSession(state))
    assert summary is not None
    assert "ordering food" in summary
    assert "먹다" in summary
    assert "맛있다" in summary
    assert "resuming" in summary.lower()
