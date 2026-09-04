"""
Tests for app.services.voice_tools — argument validation, tool dispatch,
user isolation, and the individual tool handlers' logic.

Runs against the in-memory SQLite `db` fixture from conftest.py (none of
this touches ChatMemoryFact's pgvector queries).
"""

import asyncio
import time

import pytest
from pydantic import ValidationError

from app.services import voice_tools as vt


# ── Tool registry never accepts identity from Gemini ────────────────────────

def test_no_tool_args_model_accepts_identity_fields():
    """Every arg model in TOOL_REGISTRY must never declare a user_id/db-id
    field — identity comes exclusively from ToolContext, never from Gemini."""
    forbidden = {"user_id", "db_id", "id", "owner_id"}
    for name, (args_model, _handler) in vt.TOOL_REGISTRY.items():
        fields = set(args_model.model_fields.keys())
        assert not (fields & forbidden), f"{name}'s args model exposes identity field(s): {fields & forbidden}"


def test_build_function_declarations_covers_every_registered_tool():
    decls = vt.build_function_declarations()
    assert {d["name"] for d in decls} == set(vt.TOOL_REGISTRY.keys())
    for d in decls:
        assert d["parameters_json_schema"]["type"] == "object"


# ── dispatch_tool_call: validation, unknown tools, failures ─────────────────

def test_dispatch_rejects_unknown_tool(tool_ctx):
    outcome = asyncio.run(vt.dispatch_tool_call("delete_everything", {}, tool_ctx))
    assert "error" in outcome.response
    assert outcome.result is None


def test_dispatch_rejects_invalid_arguments(tool_ctx):
    # result must be one of the four literal values
    outcome = asyncio.run(vt.dispatch_tool_call(
        "record_word_attempt", {"word": "가다", "result": "not_a_real_result"}, tool_ctx,
    ))
    assert "error" in outcome.response
    assert outcome.result is None


def test_dispatch_rejects_missing_required_argument(tool_ctx):
    outcome = asyncio.run(vt.dispatch_tool_call("get_word_context", {}, tool_ctx))
    assert "error" in outcome.response


def test_dispatch_never_raises_on_handler_exception(tool_ctx, monkeypatch):
    """One failed tool must not kill the voice session — dispatch_tool_call
    must catch and report, never propagate."""
    def boom(args, ctx):
        raise RuntimeError("simulated handler crash")

    monkeypatch.setitem(vt.TOOL_REGISTRY, "get_word_context", (vt.GetWordContextArgs, boom))
    outcome = asyncio.run(vt.dispatch_tool_call("get_word_context", {"word": "가다"}, tool_ctx))
    assert outcome.response == {"error": "tool failed"}
    assert outcome.result is None


def test_dispatch_reports_timeout_without_raising(tool_ctx, monkeypatch):
    def slow(args, ctx):
        time.sleep(0.2)
        return vt.GetWordContextResponse(word="가다")

    monkeypatch.setitem(vt.TOOL_REGISTRY, "get_word_context", (vt.GetWordContextArgs, slow))
    outcome = asyncio.run(vt.dispatch_tool_call("get_word_context", {"word": "가다"}, tool_ctx, timeout=0.01))
    assert outcome.response == {"error": "tool timed out"}


def test_dispatch_success_returns_json_safe_response(tool_ctx):
    outcome = asyncio.run(vt.dispatch_tool_call("get_word_context", {"word": "가다"}, tool_ctx))
    assert "error" not in outcome.response
    assert outcome.response["word"] == "가다"
    assert isinstance(outcome.result, vt.GetWordContextResponse)


# ── record_word_attempt: evidence only, never touches FSRS directly ─────────

def test_record_word_attempt_persists_evidence_without_touching_fsrs(db, tool_ctx, make_card):
    card_before = make_card(_user_for(tool_ctx), "가다", state=0, stability=0.0)

    args = vt.RecordWordAttemptArgs(word="가다", result="mastered")
    result = vt.record_word_attempt(args, tool_ctx)

    assert result.recorded is True
    attempts = db.query(vt.ChatWordAttempt).filter_by(session_id=tool_ctx.chat_session.id).all()
    assert len(attempts) == 1
    assert attempts[0].word == "가다"
    assert attempts[0].result == "mastered"

    # A single attempt must NOT immediately update the FSRS card.
    db.refresh(card_before)
    assert card_before.state == 0
    assert card_before.stability == 0.0


def _user_for(tool_ctx):
    from app.models.user import User
    return tool_ctx.db.query(User).filter_by(id=tool_ctx.user_id).first()


# ── get_practice_words: scoring by due date, recent struggle, topic ─────────

def test_get_practice_words_prioritizes_recent_struggles(db, tool_ctx, make_card):
    user = _user_for(tool_ctx)
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    make_card(user, "안녕", due=now - timedelta(days=1))
    make_card(user, "감사", due=now - timedelta(days=1))
    db.add(vt.ChatWordAttempt(session_id=tool_ctx.chat_session.id, word="감사", result="forgot"))
    db.commit()

    result = vt.get_practice_words(vt.GetPracticeWordsArgs(limit=3), tool_ctx)
    words = [w.word for w in result.words]
    assert "감사" in words
    # The recently-struggled word should be prioritized ahead of the other
    # equally-overdue card.
    assert words.index("감사") < words.index("안녕")


def test_get_practice_words_only_sees_own_language(db, tool_ctx, make_card):
    user = _user_for(tool_ctx)
    make_card(user, "hello", language="en")  # ctx.language is "ko" (conftest default)
    result = vt.get_practice_words(vt.GetPracticeWordsArgs(limit=5), tool_ctx)
    assert all(w.word != "hello" for w in result.words)


# ── User isolation: a tool must never see another user's data ───────────────

def test_get_word_context_is_isolated_per_user(db, make_user, make_chat_session, make_card):
    from app.services.voice_tools import ToolContext

    user_a = make_user("a@example.com")
    user_b = make_user("b@example.com")
    make_card(user_b, "가다", state=2, stability=30.0)  # only user B has this word tracked

    session_a = make_chat_session(user_a)
    ctx_a = ToolContext(db=db, user_id=user_a.id, language="ko", chat_session=session_a)

    result = vt.get_word_context(vt.GetWordContextArgs(word="가다"), ctx_a)
    assert result.status == "not_tracked"  # user A has no card for this word, even though B does


def test_get_practice_words_is_isolated_per_user(db, make_user, make_chat_session, make_card):
    from app.services.voice_tools import ToolContext

    user_a = make_user("a2@example.com")
    user_b = make_user("b2@example.com")
    make_card(user_b, "다른단어")

    session_a = make_chat_session(user_a)
    ctx_a = ToolContext(db=db, user_id=user_a.id, language="ko", chat_session=session_a)
    result = vt.get_practice_words(vt.GetPracticeWordsArgs(), ctx_a)
    assert result.words == []


# ── update_session_state: merge, not overwrite ───────────────────────────────

def test_update_session_state_merges_across_calls(tool_ctx, db):
    vt.update_session_state(vt.UpdateSessionStateArgs(topic="travel"), tool_ctx)
    vt.update_session_state(vt.UpdateSessionStateArgs(struggling_words=["가다"]), tool_ctx)
    result = vt.update_session_state(vt.UpdateSessionStateArgs(struggling_words=["오다"]), tool_ctx)

    # topic set in an earlier call must survive later, unrelated updates.
    assert result.session_state["topic"] == "travel"
    # struggling_words accumulates across calls instead of being replaced.
    assert set(result.session_state["struggling_words"]) == {"가다", "오다"}


def test_update_session_state_target_words_replaces_not_unions(tool_ctx):
    vt.update_session_state(vt.UpdateSessionStateArgs(target_words=["가다", "오다"]), tool_ctx)
    result = vt.update_session_state(vt.UpdateSessionStateArgs(target_words=["먹다"]), tool_ctx)
    assert result.session_state["target_words"] == ["먹다"]


# ── complete_practice_session: last-attempt-wins aggregation + FSRS + memory ─

def test_complete_practice_session_last_attempt_wins(db, tool_ctx, make_card, monkeypatch):
    monkeypatch.setattr(vt.memory_service, "extract_facts", lambda *a, **k: [])
    user = _user_for(tool_ctx)
    make_card(user, "가다", state=0, stability=0.0)

    # Two attempts for the same word — "forgot" then "mastered". The final
    # aggregate should reflect the LAST one, not the first.
    vt.record_word_attempt(vt.RecordWordAttemptArgs(word="가다", result="forgot"), tool_ctx)
    vt.record_word_attempt(vt.RecordWordAttemptArgs(word="가다", result="mastered"), tool_ctx)

    result = vt.complete_practice_session(vt.CompletePracticeSessionArgs(), tool_ctx)

    assert result.words_practiced == 1
    assert result.words_mastered == 1

    from app.models.user_flashcard_progress import UserFlashcardProgress
    card = db.query(UserFlashcardProgress).filter_by(user_id=user.id, word="가다").first()
    assert card.state == 2  # "mastered" path sets review state, not relearning


def test_complete_practice_session_marks_session_ended(db, tool_ctx, monkeypatch):
    monkeypatch.setattr(vt.memory_service, "extract_facts", lambda *a, **k: [])
    assert tool_ctx.chat_session.ended_at is None
    vt.complete_practice_session(vt.CompletePracticeSessionArgs(), tool_ctx)
    assert tool_ctx.chat_session.ended_at is not None


def test_complete_practice_session_saves_extracted_memories(db, tool_ctx, monkeypatch):
    saved = []
    monkeypatch.setattr(vt.memory_service, "extract_facts", lambda *a, **k: ["learner is planning a trip to Seoul"])
    monkeypatch.setattr(vt.memory_service, "remember_fact", lambda *a, **k: saved.append(k) or None)

    vt.complete_practice_session(vt.CompletePracticeSessionArgs(), tool_ctx)
    assert len(saved) == 1
    assert saved[0]["category"] is None  # extracted facts aren't pre-categorized
