"""
Cross-session memory service.

After each chat session ends:
  1. extract_facts(transcript) — Gemini Flash extracts 1-3 durable facts
     about the user (plans, opinions, language struggles, preferences).
  2. store_facts() — embed each fact via Gemini and persist to chat_memory_fact.

When a new chat turn starts:
  3. retrieve_facts(user, query) — pgvector cosine-search the user's facts,
     return the top-K most relevant ones. These are inlined into the
     system prompt so the AI feels like an ongoing relationship.
"""

import json
from datetime import datetime
from typing import List, Optional

from google import genai
from google.genai import types as genai_types
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chat_memory import ChatMemoryFact
from app.services.embedding_service import embed_texts, embed_query


_FACT_MODEL = "gemini-2.5-flash"

# Cosine similarity bands used by remember_fact() to decide whether a new
# fact is the same as an existing one, a plausible update/contradiction of
# it, or genuinely new. These are a cheap heuristic, not true contradiction
# detection (which would need an LLM judgment call on every save) — good
# enough to avoid obvious duplicate spam and stale claims, not perfect.
_DUP_SIMILARITY_THRESHOLD = 0.92
_RELATED_SIMILARITY_THRESHOLD = 0.80
# A first-time "difficulty" claim is capped below this until independently
# reconfirmed, per "require repeated evidence before storing a permanent
# learning weakness".
_UNCONFIRMED_DIFFICULTY_CONFIDENCE_CAP = 0.4


def extract_facts(transcript: str, profile_summary: str) -> List[str]:
    """
    Run a single Gemini Flash call to extract durable facts about the user
    from a chat transcript. Returns 0-3 short facts.

    Each fact should be:
      - About the user (not the AI)
      - Durable (not "user said hi today")
      - Specific (not "user likes Spanish")
      - One sentence, written in third person, present tense
    """
    if not transcript.strip():
        return []

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    prompt = f"""Extract up to 3 durable facts about the LEARNER from this Spanish conversation transcript.

A good fact is:
- About the learner (not the AI assistant)
- Durable / worth remembering next session (a plan, an opinion, a relationship, a learning struggle, a preference)
- Specific (not generic)
- One short sentence, third person, present tense

Bad facts (do NOT include):
- "The learner said hello"
- "The learner is learning Spanish"
- "The learner likes the AI"
- Anything about the conversation itself

Profile context:
{profile_summary}

Transcript:
{transcript}

Return a JSON object with a single key "facts" mapped to an array of 0-3 short strings.
If nothing durable came up, return {{"facts": []}}.
Return ONLY valid JSON."""

    config = genai_types.GenerateContentConfig(
        temperature=0.2,
        max_output_tokens=300,
        response_mime_type="application/json",
    )

    try:
        response = client.models.generate_content(
            model=_FACT_MODEL,
            contents=prompt,
            config=config,
        )
        data = json.loads(response.text or "{}")
        raw = data.get("facts", [])
        return [str(f).strip() for f in raw if isinstance(f, str) and f.strip()][:3]
    except Exception as e:
        print(f"[memory] fact extraction failed: {e}")
        return []


def store_facts(
    db: Session,
    user_id: int,
    language: str,
    session_id: Optional[int],
    facts: List[str],
) -> int:
    """Embed and persist a batch of facts. Returns count stored."""
    if not facts:
        return 0
    try:
        vectors = embed_texts(facts)
    except Exception as e:
        print(f"[memory] embed failed: {e}")
        return 0

    stored = 0
    for fact, vec in zip(facts, vectors):
        if not vec:
            continue
        db.add(ChatMemoryFact(
            user_id=user_id,
            language=language,
            fact=fact,
            source_session_id=session_id,
            embedding=vec,
        ))
        stored += 1
    db.commit()
    return stored


def retrieve_facts(
    db: Session,
    user_id: int,
    language: str,
    query: str,
    *,
    top_k: int = 4,
    min_similarity: float = 0.5,
) -> List[str]:
    """
    pgvector cosine-search for facts most relevant to the current chat turn.
    Returns the fact strings (no metadata).
    """
    if not query.strip():
        return []
    try:
        qvec = embed_query(query)
    except Exception as e:
        print(f"[memory] query embed failed: {e}")
        return []
    if not qvec:
        return []

    sql = text("""
        SELECT fact,
               (1 - (embedding <=> CAST(:qvec AS vector))) AS similarity
        FROM chat_memory_fact
        WHERE user_id = :user_id AND language = :language
          AND superseded_by_id IS NULL
          AND (expires_at IS NULL OR expires_at > :now)
        ORDER BY embedding <=> CAST(:qvec AS vector)
        LIMIT :top_k
    """)
    rows = db.execute(sql, {
        "qvec": str(qvec),
        "user_id": user_id,
        "language": language,
        "now": datetime.utcnow(),
        "top_k": top_k,
    }).mappings().all()

    return [r["fact"] for r in rows if float(r["similarity"] or 0.0) >= min_similarity]


def remember_fact(
    db: Session,
    user_id: int,
    language: str,
    fact: str,
    *,
    category: Optional[str] = None,
    confidence: float = 0.6,
    importance: float = 0.5,
    expires_at: Optional[datetime] = None,
    source_session_id: Optional[int] = None,
) -> Optional[ChatMemoryFact]:
    """
    Store one durable fact, deduplicating against the user's existing active
    (non-superseded, non-expired) facts first:
      - Near-duplicate of an existing fact → bump its last_confirmed_at/
        confidence instead of inserting a new row.
      - Plausible update/contradiction of an existing fact → insert the new
        fact and mark the old one superseded by it.
      - Otherwise → plain insert.

    Returns the stored/updated row, or None if the fact was empty or
    embedding failed.
    """
    fact = fact.strip()
    if not fact:
        return None
    try:
        vec = embed_query(fact)
    except Exception as e:
        print(f"[memory] embed failed: {e}")
        return None
    if not vec:
        return None

    now = datetime.utcnow()

    nearest = db.execute(text("""
        SELECT id, confidence,
               (1 - (embedding <=> CAST(:qvec AS vector))) AS similarity
        FROM chat_memory_fact
        WHERE user_id = :user_id AND language = :language
          AND superseded_by_id IS NULL
          AND (expires_at IS NULL OR expires_at > :now)
        ORDER BY embedding <=> CAST(:qvec AS vector)
        LIMIT 1
    """), {"qvec": str(vec), "user_id": user_id, "language": language, "now": now}).mappings().first()

    similarity = float(nearest["similarity"] or 0.0) if nearest else 0.0

    if nearest and similarity >= _DUP_SIMILARITY_THRESHOLD:
        existing = db.query(ChatMemoryFact).filter(ChatMemoryFact.id == nearest["id"]).first()
        if existing:
            existing.last_confirmed_at = now
            existing.confidence = min(1.0, max(existing.confidence, confidence) + 0.1)
            if category and not existing.category:
                existing.category = category
            db.commit()
            return existing

    stored_confidence = confidence
    if category == "difficulty" and not (nearest and similarity >= _RELATED_SIMILARITY_THRESHOLD):
        # Only the *first* mention of a difficulty is capped — a related/
        # contradicting prior mention below counts as reconfirmation.
        stored_confidence = min(confidence, _UNCONFIRMED_DIFFICULTY_CONFIDENCE_CAP)

    row = ChatMemoryFact(
        user_id=user_id,
        language=language,
        fact=fact,
        category=category,
        confidence=stored_confidence,
        importance=importance,
        last_confirmed_at=now,
        expires_at=expires_at,
        source_session_id=source_session_id,
        embedding=vec,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    if nearest and _RELATED_SIMILARITY_THRESHOLD <= similarity < _DUP_SIMILARITY_THRESHOLD:
        old = db.query(ChatMemoryFact).filter(ChatMemoryFact.id == nearest["id"]).first()
        if old:
            old.superseded_by_id = row.id
            db.commit()

    return row
