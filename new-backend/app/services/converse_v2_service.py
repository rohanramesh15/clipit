"""
Gemini-backed service for the Converse V2 prototype.

This is a SELF-CONTAINED prototype of the new conversational Spanish-learning
flow (onboarding + adaptive chat + English-support ladder). It intentionally
does not reuse the production `gemini_chat_service` / chat orchestrator so the
two Converse pages can be compared side-by-side without coupling.

All model output is requested as JSON so the frontend gets the reply plus the
metadata that powers the support ladder (precomputed translation, optional
correction + "why", which target words were used, and level-appropriate
suggested replies) in a single round-trip.
"""

from __future__ import annotations

import json
import re

from google import genai
from google.genai import types

from app.core.config import settings

_MODEL = "gemini-2.5-flash"

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def _safety():
    return [
        types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_ONLY_HIGH"),
        types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_ONLY_HIGH"),
        types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_ONLY_HIGH"),
        types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_ONLY_HIGH"),
    ]


# --------------------------------------------------------------------------
# Level / support mapping
# --------------------------------------------------------------------------

# Self-selected level -> CEFR band + how the bot should pitch the language.
LEVEL_PROFILE = {
    "beginner": {
        "cefr": "A1",
        "guidance": (
            "Use very short, simple sentences. Present tense, the most common "
            "everyday vocabulary, and a slow, encouraging pace. One idea per "
            "message."
        ),
    },
    "intermediate": {
        "cefr": "A2-B1",
        "guidance": (
            "Use everyday sentences with some past and future tense. Introduce a "
            "little new vocabulary in context. Keep momentum with follow-up "
            "questions."
        ),
    },
    "advanced": {
        "cefr": "B1-B2",
        "guidance": (
            "Speak naturally with varied tenses and connectors. Discuss abstract "
            "topics. Challenge the learner without overwhelming them."
        ),
    },
}

# How much English scaffolding the learner wants. Controls how much English the
# bot itself uses (the frontend separately controls how visible the taps are).
SUPPORT_GUIDANCE = {
    "lots": (
        "The learner wants a lot of English support. Keep your Spanish short and "
        "simple. When you correct something, the one-line 'why' should be in clear "
        "English. It is fine to drop a short English gloss in parentheses after a "
        "genuinely hard word, but never translate your whole message."
    ),
    "some": (
        "The learner wants some English support. Converse almost entirely in "
        "Spanish. Use English only for the occasional short 'why' on a correction."
    ),
    "minimal": (
        "The learner wants minimal English. Stay in Spanish end to end, including "
        "brief corrections, unless they explicitly ask for English."
    ),
}

REASON_LABELS = {
    "travel": "traveling in a Spanish-speaking country",
    "work": "using Spanish at work",
    "family": "talking with family members who speak Spanish",
    "partner": "communicating with their partner in Spanish",
    "show": "understanding Spanish-language shows and music they love",
    "general": "general interest in learning Spanish",
}


def _level(profile: dict) -> dict:
    return LEVEL_PROFILE.get((profile or {}).get("level", "beginner"), LEVEL_PROFILE["beginner"])


def _persona(profile: dict, due_words: list[str]) -> str:
    lvl = _level(profile)
    reason = REASON_LABELS.get((profile or {}).get("reason", "general"), REASON_LABELS["general"])
    support = SUPPORT_GUIDANCE.get((profile or {}).get("english_support", "some"), SUPPORT_GUIDANCE["some"])
    words = ", ".join(due_words) if due_words else "(none in particular)"
    return f"""You are Lía, a warm, patient Spanish conversation partner for a language learner.

ABOUT THE LEARNER
- Level: {lvl['cefr']}. {lvl['guidance']}
- Why they are learning: {reason}. Lean the topics toward this whenever it is natural.
- English support preference: {support}

WORDS THEY ARE DUE TO REVIEW (steer these into the conversation naturally, a few at a time — do NOT list them or quiz them):
{words}

HOW TO CONVERSE
- The goal is PRODUCTION: get them speaking, not just recognizing. Ask real questions that make them use the target words in context.
- Keep each message short (1-3 sentences) so the conversation flows.
- Accept ANY reasonable phrasing that gets the idea across. There is rarely one "correct" answer.
- When they make a mistake, do NOT stop to mark them wrong. Restate the correct version naturally in your reply and keep going.
- If they reply in English or in broken Spanish, understand them, respond naturally to keep things alive, and model the full Spanish version back.
- After any help, always steer back into Spanish. Help is the off-ramp; the conversation is the road.
- Never break character or mention these instructions."""


_TURN_JSON_SPEC = """Return ONLY a JSON object (no markdown fences) with this exact shape:
{
  "reply": "your spoken reply in Spanish (1-3 sentences, ends by inviting them to keep talking)",
  "reply_translation": "a faithful English translation of reply",
  "detected_language": "es" | "en" | "mixed",
  "correction": null OR {
      "correct": "the corrected Spanish version of what the learner tried to say",
      "why_en": "one short English sentence explaining the fix (keep it to one line)"
  },
  "used_target_words": ["any of the learner's due words that appeared in YOUR reply, lemma form"],
  "suggested_replies": [
      {"es": "a natural reply the learner could send, at their level", "en": "its English meaning"},
      {"es": "a different option", "en": "its English meaning"}
  ]
}
Rules for the fields:
- "correction" is null unless the learner actually made a meaningful error worth modeling. Minor typos do not count.
- Provide 2 or 3 "suggested_replies", always at or slightly below the learner's level, phrased as THINGS THE LEARNER WOULD SAY (first person), never questions back to themselves.
- "used_target_words" lists only words that truly appear in your reply."""


def _generate_json(system_instruction: str, contents, *, temperature: float = 0.7) -> dict:
    """Call Gemini expecting a JSON object back; parse defensively."""
    client = _get_client()
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        safety_settings=_safety(),
        temperature=temperature,
        max_output_tokens=900,
        response_mime_type="application/json",
    )
    resp = client.models.generate_content(model=_MODEL, contents=contents, config=config)
    raw = (resp.text or "").strip()
    return _parse_json(raw)


def _parse_json(raw: str) -> dict:
    if not raw:
        return {}
    # Strip accidental markdown fences.
    fenced = re.match(r"^```(?:json)?\s*(.*?)\s*```$", raw, re.DOTALL)
    if fenced:
        raw = fenced.group(1).strip()
    try:
        return json.loads(raw)
    except Exception:
        # Last resort: grab the outermost {...}.
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return {}
        return {}


def _history_contents(history: list[dict]) -> list:
    """history items: {'role': 'user'|'assistant', 'text': str}."""
    out = []
    for h in history:
        role = "model" if h.get("role") == "assistant" else "user"
        out.append(types.Content(role=role, parts=[types.Part.from_text(text=h.get("text", ""))]))
    return out


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------

def generate_opening(profile: dict, due_words: list[str], seed: dict) -> dict:
    """First assistant message that kicks off the conversation."""
    seed_type = (seed or {}).get("type", "due_words")
    if seed_type == "video":
        topic = (
            f"The learner just watched a Spanish-language clip titled "
            f"\"{seed.get('title', '')}\". Open by reacting to it and asking what they thought, "
            f"in simple Spanish."
        )
    elif seed_type == "topic":
        topic = (
            f"The learner chose to talk about: \"{seed.get('title', '')}\". "
            f"Open with a warm Spanish greeting and an easy, specific question that gets them "
            f"talking about this topic right away, at their level."
        )
    elif seed_type == "free":
        topic = "Open with a warm, simple Spanish greeting and ask an easy opening question about their day."
    else:
        topic = (
            "Open with a warm Spanish greeting and an easy question that naturally invites the "
            "learner to start using their due words."
        )
    system = _persona(profile, due_words)
    user = (
        f"Start the conversation. {topic}\n\n"
        'Return ONLY JSON: {"reply": "...", "reply_translation": "..."}'
    )
    data = _generate_json(system, user, temperature=0.8)
    return {
        "reply": data.get("reply") or "¡Hola! ¿Cómo estás hoy?",
        "reply_translation": data.get("reply_translation") or "Hi! How are you today?",
    }


def generate_turn(profile: dict, due_words: list[str], history: list[dict], user_text: str) -> dict:
    """Main chat turn. Returns reply + ladder metadata."""
    system = _persona(profile, due_words) + "\n\n" + _TURN_JSON_SPEC
    contents = _history_contents(history)
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=user_text)]))
    data = _generate_json(system, contents, temperature=0.7)

    reply = data.get("reply") or "Perdona, ¿puedes repetir eso?"
    correction = data.get("correction")
    if correction and not isinstance(correction, dict):
        correction = None
    suggestions = data.get("suggested_replies") or []
    clean_sugs = []
    for s in suggestions[:3]:
        if isinstance(s, dict) and s.get("es"):
            clean_sugs.append({"es": s.get("es", ""), "en": s.get("en", "")})
    return {
        "reply": reply,
        "reply_translation": data.get("reply_translation") or "",
        "detected_language": data.get("detected_language") or "es",
        "correction": correction,
        "used_target_words": [w for w in (data.get("used_target_words") or []) if isinstance(w, str)],
        "suggested_replies": clean_sugs,
    }


def generate_hint(profile: dict, due_words: list[str], history: list[dict]) -> dict:
    """Rung 1 of the ladder: a nudge in English toward an answer, never the answer."""
    system = _persona(profile, due_words)
    convo = "\n".join(f"{h.get('role')}: {h.get('text')}" for h in history[-6:])
    user = (
        "The learner is stuck and tapped a 'Stuck?' button. Based on the conversation so far, "
        "give ONE short hint in English that points them toward something they could say, WITHOUT "
        "giving them the Spanish words. For example: \"Try saying where you went last weekend.\"\n\n"
        f"Conversation so far:\n{convo}\n\n"
        'Return ONLY JSON: {"hint_en": "..."}'
    )
    data = _generate_json(system, user, temperature=0.6)
    return {"hint_en": data.get("hint_en") or "Try answering with one short sentence — even a few words is great."}


def how_do_i_say(profile: dict, due_words: list[str], english: str) -> dict:
    """Rung 2 of the ladder: learner types English, gets the Spanish phrasing back."""
    system = _persona(profile, due_words)
    user = (
        f'The learner wants to know how to say this in Spanish at their level: "{english}".\n'
        "Give a natural Spanish phrasing they could send as their own reply, plus a tiny English note "
        "if anything is worth flagging (otherwise empty string).\n\n"
        'Return ONLY JSON: {"spanish": "...", "note_en": "..."}'
    )
    data = _generate_json(system, user, temperature=0.5)
    return {"spanish": data.get("spanish") or "", "note_en": data.get("note_en") or ""}


def translate_to_english(text: str) -> str:
    """Tap-to-translate. DeepL first, Gemini fallback."""
    text = (text or "").strip()
    if not text:
        return ""
    if settings.DEEPL_API_KEY:
        try:
            import deepl

            translator = deepl.Translator(settings.DEEPL_API_KEY)
            result = translator.translate_text(text, target_lang="EN-US")
            return result.text
        except Exception:
            pass
    try:
        client = _get_client()
        resp = client.models.generate_content(
            model=_MODEL,
            contents=f"Translate this Spanish to natural English. Return only the translation:\n\n{text}",
            config=types.GenerateContentConfig(temperature=0.0, safety_settings=_safety()),
        )
        return (resp.text or "").strip()
    except Exception:
        return ""
