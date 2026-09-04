"""
Allowlisted Gemini Live function-calling tools for the agentic voice tutor.

Single dispatch surface: TOOL_REGISTRY maps a tool name to its (args model,
handler) pair. `chat_voice.py`'s receive loop is the only caller — it looks
up the tool by name, rejects unknown names, validates arguments via the
Pydantic model (rejecting on ValidationError), runs the handler with a
timeout, and returns a structured result (or error) to Gemini.

Every handler receives a `ToolContext` built from the authenticated
WebSocket session — user_id/language/chat_session never come from a Gemini
argument, so a handler cannot be pointed at another user's data no matter
what the model sends.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable, Literal, Optional

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.models.chat import ChatSession, ChatTurn, ChatWordAttempt
from app.models.user_flashcard_progress import UserFlashcardProgress
from app.services import memory_service
from app.services.translation_lookup import saved_translation

_STATE_LABEL = {0: "new", 1: "learning", 2: "review", 3: "relearning"}


@dataclass
class ToolContext:
    db: Session
    user_id: int
    language: str
    chat_session: ChatSession


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, AttributeError):
        return None


# ─────────────────────────────────────────────────────────────────────────
# 1. get_practice_words
# ─────────────────────────────────────────────────────────────────────────

class GetPracticeWordsArgs(BaseModel):
    limit: int = Field(5, ge=3, le=7)
    # Freeform hint from Gemini about how to pick words (e.g. "due soonest",
    # "match the current topic"). Advisory only — scoring below already
    # blends due date, difficulty, recent mistakes, and topic match, so an
    # unrecognized strategy just falls back to that default blend rather
    # than erroring.
    selection_strategy: Optional[str] = None


class PracticeWord(BaseModel):
    word: str
    definition: Optional[str] = None
    status: str
    source_sentence: Optional[str] = None
    source_video: Optional[str] = None
    practice_priority: float


class GetPracticeWordsResponse(BaseModel):
    words: list[PracticeWord]


def get_practice_words(args: GetPracticeWordsArgs, ctx: ToolContext) -> GetPracticeWordsResponse:
    from app.api.routes.flashcards import load_definitions, load_user_definitions

    cards = (
        ctx.db.query(UserFlashcardProgress)
        .filter(
            UserFlashcardProgress.user_id == ctx.user_id,
            UserFlashcardProgress.language == ctx.language,
        )
        .order_by(UserFlashcardProgress.due.asc())
        .limit(200)  # due-order already puts the strongest candidates first
        .all()
    )
    if not cards:
        return GetPracticeWordsResponse(words=[])

    recent_struggles = {
        row[0]
        for row in ctx.db.query(ChatWordAttempt.word)
        .filter(
            ChatWordAttempt.session_id == ctx.chat_session.id,
            ChatWordAttempt.result.in_(("forgot", "struggled")),
        )
        .all()
    }

    topic = ((ctx.chat_session.session_state_json or {}).get("topic") or "").strip().lower()
    now = datetime.utcnow()
    definitions = load_definitions()
    user_definitions = load_user_definitions()

    scored: list[tuple[float, UserFlashcardProgress]] = []
    for card in cards:
        overdue_days = max(0.0, (now - card.due).total_seconds() / 86400) if card.due else 0.0
        priority = overdue_days + float(card.difficulty or 0) * 0.1
        if card.word in recent_struggles:
            priority += 5.0
        if topic and topic in (card.word or "").lower():
            priority += 1.0
        scored.append((priority, card))
    scored.sort(key=lambda pair: pair[0], reverse=True)

    words: list[PracticeWord] = []
    for priority, card in scored[: args.limit]:
        words.append(PracticeWord(
            word=card.word,
            definition=saved_translation(card.lemma or card.word, ctx.language, definitions, user_definitions),
            status=_STATE_LABEL.get(card.state, "new"),
            source_video=card.video_id,
            practice_priority=round(priority, 3),
        ))
    return GetPracticeWordsResponse(words=words)


# ─────────────────────────────────────────────────────────────────────────
# 2. get_word_context
# ─────────────────────────────────────────────────────────────────────────

class GetWordContextArgs(BaseModel):
    word: str = Field(..., min_length=1, max_length=200)


class GetWordContextResponse(BaseModel):
    word: str
    definition: Optional[str] = None
    lemma: Optional[str] = None
    source_sentence: Optional[str] = None
    source_video: Optional[str] = None
    example_usages: list[str] = Field(default_factory=list)
    status: str = "not_tracked"


def get_word_context(args: GetWordContextArgs, ctx: ToolContext) -> GetWordContextResponse:
    from app.api.routes.flashcards import (
        load_definitions, load_user_definitions, _load_flashcard_context,
        find_sentence_for_word, find_sentence_for_word_ukrainian,
    )

    card = (
        ctx.db.query(UserFlashcardProgress)
        .filter(
            UserFlashcardProgress.user_id == ctx.user_id,
            UserFlashcardProgress.language == ctx.language,
            UserFlashcardProgress.word == args.word,
        )
        .first()
    )
    definitions = load_definitions()
    user_definitions = load_user_definitions()
    definition = saved_translation((card.lemma if card else None) or args.word, ctx.language, definitions, user_definitions)

    source_sentence = None
    source_video = card.video_id if card else None
    if source_video:
        try:
            context = _load_flashcard_context(source_video, ctx.language)
            finder = find_sentence_for_word_ukrainian if ctx.language == "uk" else find_sentence_for_word
            hit = finder(args.word, context["subtitles"])
            if hit:
                source_sentence = hit.get("sentence")
        except Exception:
            pass  # best-effort — a missing/uncached video's subtitles shouldn't fail the tool

    return GetWordContextResponse(
        word=args.word,
        definition=definition,
        lemma=card.lemma if card else None,
        source_sentence=source_sentence,
        source_video=source_video,
        example_usages=[source_sentence] if source_sentence else [],
        status=_STATE_LABEL.get(card.state, "not_tracked") if card else "not_tracked",
    )


# ─────────────────────────────────────────────────────────────────────────
# 3. record_word_attempt
# ─────────────────────────────────────────────────────────────────────────

class RecordWordAttemptArgs(BaseModel):
    word: str = Field(..., min_length=1, max_length=200)
    result: Literal["forgot", "struggled", "recalled", "mastered"]
    learner_sentence: Optional[str] = None
    evidence: Optional[str] = None


class RecordWordAttemptResponse(BaseModel):
    recorded: bool
    word: str
    result: str


def record_word_attempt(args: RecordWordAttemptArgs, ctx: ToolContext) -> RecordWordAttemptResponse:
    # Evidence only, never applied to FSRS directly here — one attempt should
    # never immediately flip a word to mastered. complete_practice_session()
    # aggregates every attempt for a word (last one wins) into a single FSRS
    # update at session end.
    ctx.db.add(ChatWordAttempt(
        session_id=ctx.chat_session.id,
        word=args.word,
        result=args.result,
        learner_sentence=args.learner_sentence,
        evidence=args.evidence,
    ))
    ctx.db.commit()
    return RecordWordAttemptResponse(recorded=True, word=args.word, result=args.result)


# ─────────────────────────────────────────────────────────────────────────
# 4. recall_learner_memory
# ─────────────────────────────────────────────────────────────────────────

class RecallLearnerMemoryArgs(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    limit: int = Field(4, ge=1, le=6)


class RecallLearnerMemoryResponse(BaseModel):
    memories: list[str]


def recall_learner_memory(args: RecallLearnerMemoryArgs, ctx: ToolContext) -> RecallLearnerMemoryResponse:
    facts = memory_service.retrieve_facts(ctx.db, ctx.user_id, ctx.language, args.query, top_k=args.limit)
    return RecallLearnerMemoryResponse(memories=facts)


# ─────────────────────────────────────────────────────────────────────────
# 5. remember_learner_fact
# ─────────────────────────────────────────────────────────────────────────

class RememberLearnerFactArgs(BaseModel):
    fact: str = Field(..., min_length=1, max_length=500)
    category: Optional[Literal["preference", "interest", "goal", "difficulty", "background", "proficiency"]] = None
    confidence: float = Field(0.6, ge=0.0, le=1.0)
    importance: float = Field(0.5, ge=0.0, le=1.0)
    expires_at: Optional[str] = None  # ISO 8601; omit for a durable (non-expiring) fact


class RememberLearnerFactResponse(BaseModel):
    stored: bool
    category: Optional[str] = None


def remember_learner_fact(args: RememberLearnerFactArgs, ctx: ToolContext) -> RememberLearnerFactResponse:
    row = memory_service.remember_fact(
        ctx.db, ctx.user_id, ctx.language, args.fact,
        category=args.category,
        confidence=args.confidence,
        importance=args.importance,
        expires_at=_parse_iso(args.expires_at),
        source_session_id=ctx.chat_session.id,
    )
    return RememberLearnerFactResponse(stored=row is not None, category=row.category if row else None)


# ─────────────────────────────────────────────────────────────────────────
# 6. update_session_state
# ─────────────────────────────────────────────────────────────────────────

class UpdateSessionStateArgs(BaseModel):
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    target_words: Optional[list[str]] = None
    struggling_words: Optional[list[str]] = None
    pending_feedback: Optional[str] = None


class UpdateSessionStateResponse(BaseModel):
    session_state: dict


def update_session_state(args: UpdateSessionStateArgs, ctx: ToolContext) -> UpdateSessionStateResponse:
    state = dict(ctx.chat_session.session_state_json or {})
    if args.topic is not None:
        state["topic"] = args.topic
    if args.difficulty is not None:
        state["difficulty"] = args.difficulty
    if args.target_words is not None:
        # Current focus words — a topic shift should replace this, not
        # accumulate forever.
        state["target_words"] = args.target_words
    if args.struggling_words is not None:
        # Cumulative record for the session — union so an earlier struggle
        # isn't forgotten just because it wasn't repeated in this call.
        state["struggling_words"] = sorted(set(state.get("struggling_words", [])) | set(args.struggling_words))
    if args.pending_feedback is not None:
        state["pending_feedback"] = args.pending_feedback

    ctx.chat_session.session_state_json = state
    ctx.db.commit()
    return UpdateSessionStateResponse(session_state=state)


# ─────────────────────────────────────────────────────────────────────────
# 7. complete_practice_session
# ─────────────────────────────────────────────────────────────────────────

class CompletePracticeSessionArgs(BaseModel):
    pass  # nothing needed beyond ToolContext


class CompletePracticeSessionResponse(BaseModel):
    summary: str
    words_practiced: int
    words_mastered: int


def _next_fsrs_state(card: Optional[UserFlashcardProgress], result: str, now: datetime):
    """Simplified FSRS-like update.

    Not a port of the real algorithm — that lives client-side in ts-fsrs and
    isn't available in Python here. This moves state/stability/difficulty in
    the same direction a real FSRS update would (state machine and rough
    interval growth), which is what vocab_profile_service's known/learning
    classification (state + stability >= 21 days) actually depends on. The
    learner's next real review of this word in the normal flashcard flow
    gets a true ts-fsrs recompute, which self-corrects any drift from here.
    """
    from app.api.routes.fsrs import CardUpsert  # route-module import matches this codebase's existing convention

    state = card.state if card else 0
    stability = float(card.stability) if card and card.stability else 0.0
    difficulty = float(card.difficulty) if card and card.difficulty else 5.0
    reps = (card.reps if card else 0) + 1
    lapses = card.lapses if card else 0

    if result == "forgot":
        lapses += 1
        state = 3 if state in (2, 3) else 1
        stability = max(0.5, stability * 0.3)
        difficulty = min(10.0, difficulty + 1.5)
        due_in_days = 0.02
    elif result == "struggled":
        state = 1 if state == 0 else state
        stability = max(1.0, stability * 1.3)
        difficulty = min(10.0, difficulty + 0.5)
        due_in_days = max(0.5, stability * 0.5)
    elif result == "mastered":
        state = 2
        stability = max(3.0, stability * 2.5 if stability else 6.0)
        difficulty = max(1.0, difficulty - 0.6)
        due_in_days = stability * 1.3
    else:  # recalled
        state = 2
        stability = max(1.0, stability * 2.0 if stability else 3.0)
        difficulty = max(1.0, difficulty - 0.3)
        due_in_days = stability

    return CardUpsert(
        word="",  # filled by the caller
        language="",
        due=(now + timedelta(days=due_in_days)).isoformat() + "Z",
        stability=stability,
        difficulty=difficulty,
        elapsed_days=(now - card.last_review).days if card and card.last_review else 0,
        scheduled_days=int(due_in_days),
        reps=reps,
        lapses=lapses,
        state=state,
        last_review=now.isoformat() + "Z",
        video_id=card.video_id if card else None,
    )


def complete_practice_session(args: CompletePracticeSessionArgs, ctx: ToolContext) -> CompletePracticeSessionResponse:
    from app.api.routes.fsrs import _apply_card_upsert

    now = datetime.utcnow()

    attempts = (
        ctx.db.query(ChatWordAttempt)
        .filter(ChatWordAttempt.session_id == ctx.chat_session.id)
        .order_by(ChatWordAttempt.id.asc())
        .all()
    )
    last_by_word: dict[str, ChatWordAttempt] = {}
    for attempt in attempts:
        last_by_word[attempt.word] = attempt  # last write wins — ordered by id above

    mastered_count = 0
    for word, attempt in last_by_word.items():
        card = (
            ctx.db.query(UserFlashcardProgress)
            .filter(
                UserFlashcardProgress.user_id == ctx.user_id,
                UserFlashcardProgress.language == ctx.language,
                UserFlashcardProgress.word == word,
            )
            .first()
        )
        next_state = _next_fsrs_state(card, attempt.result, now)
        next_state.word = word
        next_state.language = ctx.language
        _apply_card_upsert(ctx.db, ctx.user_id, next_state)
        if attempt.result == "mastered":
            mastered_count += 1
    ctx.db.commit()

    turns = (
        ctx.db.query(ChatTurn)
        .filter(ChatTurn.session_id == ctx.chat_session.id)
        .order_by(ChatTurn.idx.asc())
        .all()
    )
    transcript = "\n".join(f"{turn.role}: {turn.text}" for turn in turns)
    try:
        facts = memory_service.extract_facts(transcript, profile_summary=f"Language: {ctx.language}")
        for fact in facts:
            memory_service.remember_fact(
                ctx.db, ctx.user_id, ctx.language, fact,
                category=None, confidence=0.6, importance=0.5,
                expires_at=None, source_session_id=ctx.chat_session.id,
            )
    except Exception as e:
        print(f"[voice_tools] memory extraction failed: {e}")

    ctx.chat_session.ended_at = now
    db_summary = {"words_practiced": len(last_by_word), "words_mastered": mastered_count}
    ctx.chat_session.summary_json = db_summary
    ctx.db.commit()

    summary = f"Great session! You practiced {len(last_by_word)} word{'s' if len(last_by_word) != 1 else ''}"
    summary += f", mastering {mastered_count}." if mastered_count else "."

    return CompletePracticeSessionResponse(
        summary=summary, words_practiced=len(last_by_word), words_mastered=mastered_count,
    )


# ─────────────────────────────────────────────────────────────────────────
# Registry — the only allowlist chat_voice.py's dispatcher consults.
# ─────────────────────────────────────────────────────────────────────────

ToolHandler = Callable[[BaseModel, ToolContext], BaseModel]

TOOL_REGISTRY: dict[str, tuple[type[BaseModel], ToolHandler]] = {
    "get_practice_words": (GetPracticeWordsArgs, get_practice_words),
    "get_word_context": (GetWordContextArgs, get_word_context),
    "record_word_attempt": (RecordWordAttemptArgs, record_word_attempt),
    "recall_learner_memory": (RecallLearnerMemoryArgs, recall_learner_memory),
    "remember_learner_fact": (RememberLearnerFactArgs, remember_learner_fact),
    "update_session_state": (UpdateSessionStateArgs, update_session_state),
    "complete_practice_session": (CompletePracticeSessionArgs, complete_practice_session),
}

_TOOL_DESCRIPTIONS = {
    "get_practice_words": (
        "Pick 3-7 words the learner should practice this session, chosen from their FSRS "
        "deck by due date, difficulty, recent mistakes, and the current topic."
    ),
    "get_word_context": (
        "Look up one word's definition, dictionary form, the original subtitle sentence it "
        "came from, its source video, and the learner's current status with it."
    ),
    "record_word_attempt": (
        "Record one piece of evidence about how the learner did with a specific word in this "
        "conversation. Call this only when their response clearly shows recall or difficulty — "
        "not on every mention of the word."
    ),
    "recall_learner_memory": (
        "Search this learner's durable memory for facts relevant to the current topic (goals, "
        "interests, preferences, recurring difficulties)."
    ),
    "remember_learner_fact": (
        "Save a durable fact about the learner — a goal, interest, preference, or recurring "
        "difficulty worth remembering next time. Do not save casual remarks or sensitive details."
    ),
    "update_session_state": (
        "Persist the current topic, difficulty, target words, struggling words, or feedback to "
        "note for later, so the conversation can pick back up correctly after a disconnect."
    ),
    "complete_practice_session": (
        "End the practice session: finalize word attempts into FSRS, extract and save any new "
        "durable memories, and produce an encouraging summary."
    ),
}


def build_function_declarations() -> list[dict]:
    """Gemini Live tool declarations for every registered tool, generated
    from each tool's own Pydantic args model so the schema Gemini sees can
    never drift from what the dispatcher actually validates against."""
    return [
        {
            "name": name,
            "description": _TOOL_DESCRIPTIONS.get(name, ""),
            "parameters_json_schema": args_model.model_json_schema(),
        }
        for name, (args_model, _handler) in TOOL_REGISTRY.items()
    ]


@dataclass
class ToolDispatchOutcome:
    response: dict  # JSON-safe — what chat_voice.py sends back to Gemini
    args: Optional[BaseModel] = None  # only set on a successful dispatch
    result: Optional[BaseModel] = None  # only set on a successful dispatch


async def dispatch_tool_call(name: str, raw_args: dict, ctx: ToolContext, *, timeout: float = 8.0) -> ToolDispatchOutcome:
    """Validate and run one tool call by name against TOOL_REGISTRY — the
    single choke point every Gemini function call passes through.

    Never raises: unknown tool names, invalid arguments, a handler timeout,
    or a handler exception all come back as a structured {"error": ...}
    response instead of propagating, so one bad tool call can never take
    down the voice session. Kept free of any WebSocket/Gemini-SDK-specific
    concerns (that lives in chat_voice.py) so it's directly unit-testable.
    """
    entry = TOOL_REGISTRY.get(name)
    if entry is None:
        return ToolDispatchOutcome(response={"error": f"unknown tool: {name}"})

    args_model, handler = entry
    try:
        args = args_model.model_validate(raw_args or {})
    except ValidationError as e:
        return ToolDispatchOutcome(response={"error": f"invalid arguments: {e.errors()[:3]}"})

    try:
        result = await asyncio.wait_for(asyncio.to_thread(handler, args, ctx), timeout=timeout)
    except asyncio.TimeoutError:
        return ToolDispatchOutcome(response={"error": "tool timed out"})
    except Exception as e:
        ctx.db.rollback()
        print(f"[voice_tools] tool {name} failed: {e}")
        return ToolDispatchOutcome(response={"error": "tool failed"})

    return ToolDispatchOutcome(response=result.model_dump(mode="json"), args=args, result=result)
