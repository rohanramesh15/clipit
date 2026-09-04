"""
Gemini Live voice chat — WebSocket relay, with agentic tool-calling.

Browser ↔ FastAPI WebSocket ↔ Gemini Live session.

Wire format:
  client → server:
    - binary frames: 16-bit little-endian PCM @ 16 kHz, mono (mic)
    - text frames:   JSON control ({"event": "end"} to hang up)

  server → client:
    - binary frames: 16-bit little-endian PCM @ 24 kHz, mono (Gemini voice)
    - text frames:   JSON events
        {"event": "ready"}
        {"event": "user_transcript",      "text": "..."}
        {"event": "assistant_transcript", "text": "..."}
        {"event": "interrupted"}
        {"event": "turn_complete", "user_turn_id": 1, "assistant_turn_id": 2}
        {"event": "word_targeted", "word": "..."}
        {"event": "word_practiced", "word": "...", "result": "recalled"}
        {"event": "difficulty_changed", "level": "..."}
        {"event": "memory_saved", "category": "..."}
        {"event": "session_summary", "summary": {...}}
        {"event": "error", "message": "..."}

Gemini's function calls are dispatched through voice_tools.TOOL_REGISTRY —
the only allowlist. A tool never receives a user_id from Gemini; identity
comes from the authenticated session established at connect time. Postgres
(ChatTurn/ChatSession.session_state_json) is the durable record of the
conversation — Gemini's own context is not treated as a source of truth, so
a completed turn is persisted immediately rather than only kept in memory.
"""

import asyncio
import contextlib
import json
import traceback
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from google import genai
from google.genai import types as gtypes

from app.core.config import settings
from app.core.database import SessionLocal
from app.api.deps import get_current_user_from_token
from app.models.chat import ChatSession, ChatTurn
from app.models.user import User
from app.models.video import TrackedVideo
from app.api.routes.chat import ALLOWED_TTS_VOICES
from app.services.chat_orchestrator import build_system_instruction
from app.services.memory_service import retrieve_facts
from app.services.vocab_profile_service import build_profile
from app.services.voice_tools import ToolContext, build_function_declarations, dispatch_tool_call


router = APIRouter()

_LIVE_MODEL = "gemini-2.5-flash-native-audio-latest"
_DEFAULT_VOICE = "Aoede"  # natural female voice; "Puck"/"Charon" are alternatives
_TOOL_TIMEOUT_SECONDS = 8


_live_client: Optional[genai.Client] = None


def _get_live_client() -> genai.Client:
    global _live_client
    if _live_client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not configured.")
        _live_client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _live_client


def _authenticate(token: str, db: Session) -> Optional[User]:
    try:
        user, _is_new = get_current_user_from_token(token, db)
        return user
    except Exception:
        return None


def _video_title(db: Session, video_id: Optional[str]) -> Optional[str]:
    if not video_id:
        return None
    v = db.query(TrackedVideo).filter(TrackedVideo.video_id == video_id).first()
    return v.title if v else None


def _resolve_voice(voice: Optional[str]) -> str:
    """The learner's chosen AI voice, falling back to the default for an
    unset or unrecognized value (never pass an arbitrary string to Gemini)."""
    return voice if voice in ALLOWED_TTS_VOICES else _DEFAULT_VOICE


def _build_live_config(system_instruction: str, voice: Optional[str] = None) -> dict:
    """Live API config dict. SDK accepts plain dicts; sticking to that keeps
    us tolerant of small SDK version differences."""
    return {
        "response_modalities": ["AUDIO"],
        "speech_config": {
            "voice_config": {
                "prebuilt_voice_config": {"voice_name": _resolve_voice(voice)},
            },
        },
        "system_instruction": {"parts": [{"text": system_instruction}]},
        # These give us the transcript both directions for the optional
        # frontend transcript drawer + session summary later.
        "input_audio_transcription": {},
        "output_audio_transcription": {},
        "tools": [{"function_declarations": build_function_declarations()}],
    }


def _session_state_summary(chat_session: ChatSession) -> Optional[str]:
    """A short recap injected into the prompt so a reconnect resumes where
    the conversation left off, instead of Gemini starting cold."""
    state = chat_session.session_state_json
    if not state:
        return None
    bits = []
    if state.get("topic"):
        bits.append(f"the topic was {state['topic']}")
    if state.get("difficulty"):
        bits.append(f"difficulty was set to {state['difficulty']}")
    if state.get("target_words"):
        bits.append(f"target words in play: {', '.join(state['target_words'][:10])}")
    if state.get("struggling_words"):
        bits.append(f"words the learner has struggled with: {', '.join(state['struggling_words'][:10])}")
    if state.get("pending_feedback"):
        bits.append(f"feedback still owed to the learner: {state['pending_feedback']}")
    if not bits:
        return None
    return (
        "Resuming a previous session that disconnected — " + "; ".join(bits) + ". "
        "Pick back up naturally; don't re-explain that you're resuming."
    )


@router.websocket("/chat/voice/ws")
async def voice_ws(
    websocket: WebSocket,
    token: str = Query(..., description="Supabase access token"),
    session_id: int = Query(..., description="ChatSession id created via POST /chat/session"),
    voice: Optional[str] = Query(None, description="Learner's chosen AI voice; falls back to the default"),
):
    await websocket.accept()

    db: Session = SessionLocal()
    try:
        user = _authenticate(token, db)
        if not user:
            await websocket.send_json({"event": "error", "message": "Unauthorized"})
            await websocket.close(code=1008)
            return

        chat_session = (
            db.query(ChatSession)
            .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
            .first()
        )
        if not chat_session:
            await websocket.send_json({"event": "error", "message": "Session not found"})
            await websocket.close(code=1008)
            return
        if chat_session.ended_at:
            await websocket.send_json({"event": "error", "message": "Session already ended"})
            await websocket.close(code=1008)
            return

        lang = chat_session.language or "es"
        profile = build_profile(db, user.id, lang)
        memory_facts: list[str] = []
        try:
            memory_facts = retrieve_facts(
                db, user.id, lang, chat_session.seed_label or "", top_k=4,
            )
        except Exception:
            pass

        system_instruction = build_system_instruction(
            profile=profile,
            level=chat_session.level_used or "A2",
            seed_label=chat_session.seed_label,
            seed_video_title=_video_title(db, chat_session.seed_video_id),
            retrieved=[],  # skip subtitle retrieval on the voice path — keep prompt tight
            memory_facts=memory_facts,
            mode=chat_session.mode,
            reason=chat_session.reason,
            english_support=chat_session.english_support,
            voice=True,
        )
        resume_note = _session_state_summary(chat_session)
        if resume_note:
            system_instruction = f"{system_instruction}\n\n{resume_note}"

        client = _get_live_client()
        live_config = _build_live_config(system_instruction, voice)

        # Turn bookkeeping — mirrors chat.py's ChatTurn idx convention
        # (sequential across both roles, continuing from the last turn).
        last_turn = (
            db.query(ChatTurn)
            .filter(ChatTurn.session_id == chat_session.id)
            .order_by(ChatTurn.idx.desc())
            .first()
        )
        next_idx = (last_turn.idx + 1) if last_turn else 0

        # Transcript fragments accumulate here until turn_complete.
        input_buffer: list[str] = []
        output_buffer: list[str] = []

        # A function-call id should only ever be actually executed once per
        # connection — defends against a redelivered/duplicate call in the
        # same tool_call batch actually running its side effects twice.
        executed_call_ids: set[str] = set()

        tool_ctx = ToolContext(db=db, user_id=user.id, language=lang, chat_session=chat_session)

        async def emit_tool_event(name: str, args, result) -> None:
            """Best-effort structured events for the frontend UI. A failure
            here must never break the voice call itself."""
            try:
                if name == "get_practice_words":
                    for w in result.words:
                        await websocket.send_json({"event": "word_targeted", "word": w.word})
                elif name == "record_word_attempt":
                    await websocket.send_json({
                        "event": "word_practiced", "word": result.word, "result": result.result,
                    })
                elif name == "update_session_state" and getattr(args, "difficulty", None):
                    await websocket.send_json({"event": "difficulty_changed", "level": args.difficulty})
                elif name == "remember_learner_fact" and result.stored:
                    await websocket.send_json({"event": "memory_saved", "category": result.category})
                elif name == "complete_practice_session":
                    await websocket.send_json({"event": "session_summary", "summary": result.model_dump(mode="json")})
            except Exception:
                pass

        async def run_tool(call) -> dict:
            """Dispatch one Gemini function call via voice_tools.dispatch_tool_call
            (validation/timeout/error-handling lives there, unit-tested in
            isolation) and emit this connection's frontend event on success."""
            name = call.name or ""
            outcome = await dispatch_tool_call(name, call.args or {}, tool_ctx, timeout=_TOOL_TIMEOUT_SECONDS)
            if outcome.result is not None:
                await emit_tool_event(name, outcome.args, outcome.result)
            return outcome.response

        def flush_turn() -> tuple[Optional[int], Optional[int]]:
            """Persist accumulated transcript fragments as ChatTurn rows."""
            nonlocal next_idx
            user_turn_id: Optional[int] = None
            assistant_turn_id: Optional[int] = None
            user_text = "".join(input_buffer).strip()
            assistant_text = "".join(output_buffer).strip()
            input_buffer.clear()
            output_buffer.clear()

            if user_text:
                row = ChatTurn(session_id=chat_session.id, idx=next_idx, role="user", text=user_text)
                db.add(row)
                db.flush()
                user_turn_id = row.id
                next_idx += 1
            if assistant_text:
                row = ChatTurn(session_id=chat_session.id, idx=next_idx, role="assistant", text=assistant_text)
                db.add(row)
                db.flush()
                assistant_turn_id = row.id
                next_idx += 1
            if user_turn_id is not None or assistant_turn_id is not None:
                db.commit()
            return user_turn_id, assistant_turn_id

        async with client.aio.live.connect(model=_LIVE_MODEL, config=live_config) as live:
            await websocket.send_json({"event": "ready"})

            async def pump_client_to_gemini():
                """Browser mic → Gemini realtime input."""
                while True:
                    msg = await websocket.receive()
                    if msg.get("type") == "websocket.disconnect":
                        return
                    data = msg.get("bytes")
                    if data:
                        await live.send_realtime_input(
                            audio=gtypes.Blob(
                                data=data,
                                mime_type="audio/pcm;rate=16000",
                            )
                        )
                        continue
                    text = msg.get("text")
                    if text:
                        try:
                            ctrl = json.loads(text)
                        except Exception:
                            continue
                        if ctrl.get("event") == "end":
                            return

            async def pump_gemini_to_client():
                """Gemini audio + transcripts + tool calls → browser.

                live.receive() is scoped to a single turn — its generator
                returns right after yielding the turn_complete message — so
                without the outer loop this pump would quietly finish after
                the first exchange while pump_client_to_gemini keeps feeding
                the mic to Gemini, leaving the call silently one-directional
                for every turn after the first.
                """
                while True:
                    async for response in live.receive():
                        audio = getattr(response, "data", None)
                        if audio:
                            await websocket.send_bytes(audio)

                        tool_call = getattr(response, "tool_call", None)
                        if tool_call and tool_call.function_calls:
                            responses = []
                            for call in tool_call.function_calls:
                                if call.id and call.id in executed_call_ids:
                                    responses.append(gtypes.FunctionResponse(
                                        id=call.id, name=call.name, response={"status": "already_processed"},
                                    ))
                                    continue
                                if call.id:
                                    executed_call_ids.add(call.id)
                                result = await run_tool(call)
                                responses.append(gtypes.FunctionResponse(id=call.id, name=call.name, response=result))
                            if responses:
                                await live.send_tool_response(function_responses=responses)

                        cancellation = getattr(response, "tool_call_cancellation", None)
                        if cancellation and cancellation.ids:
                            # Handlers already run synchronously and briefly
                            # by the time a cancellation could arrive — there
                            # is nothing in-flight to actually stop. Just
                            # stop tracking them so a legitimate retry with
                            # the same id wouldn't be mistaken for a dupe.
                            for cid in cancellation.ids:
                                executed_call_ids.discard(cid)

                        sc = getattr(response, "server_content", None)
                        if not sc:
                            continue

                        inp_t = getattr(sc, "input_transcription", None)
                        if inp_t and getattr(inp_t, "text", None):
                            input_buffer.append(inp_t.text)
                            await websocket.send_json({
                                "event": "user_transcript",
                                "text": inp_t.text,
                            })

                        out_t = getattr(sc, "output_transcription", None)
                        if out_t and getattr(out_t, "text", None):
                            output_buffer.append(out_t.text)
                            await websocket.send_json({
                                "event": "assistant_transcript",
                                "text": out_t.text,
                            })

                        if getattr(sc, "interrupted", False):
                            await websocket.send_json({"event": "interrupted"})

                        if getattr(sc, "turn_complete", False):
                            user_turn_id, assistant_turn_id = flush_turn()
                            await websocket.send_json({
                                "event": "turn_complete",
                                "user_turn_id": user_turn_id,
                                "assistant_turn_id": assistant_turn_id,
                            })

            up = asyncio.create_task(pump_client_to_gemini())
            down = asyncio.create_task(pump_gemini_to_client())
            # Either pump ending (hangup, disconnect, or an error) should end
            # the call — pump_gemini_to_client now loops forever on its own,
            # so nothing else would stop it once pump_client_to_gemini exits.
            done, pending = await asyncio.wait(
                {up, down}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()
            for task in pending:
                with contextlib.suppress(asyncio.CancelledError):
                    await task
            for task in done:
                exc = task.exception()
                if exc:
                    raise exc

        # The connection is closing (hangup or disconnect) — flush whatever
        # transcript fragments never got a final turn_complete, so nothing
        # said right before hangup is silently dropped from the record.
        flush_turn()

    except WebSocketDisconnect:
        pass
    except Exception as e:
        traceback.print_exc()
        try:
            await websocket.send_json({"event": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        db.close()
        try:
            await websocket.close()
        except Exception:
            pass
