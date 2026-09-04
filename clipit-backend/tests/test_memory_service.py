"""
Tests for app.services.memory_service's dedup/confirmation/expiry/
supersession logic in remember_fact() and retrieve_facts().

These exercise real pgvector cosine-distance SQL (`<=>`, `CAST(... AS
vector)`), which SQLite cannot run — the `pg_db` fixture connects to this
project's actually-configured DATABASE_URL and skips the whole module if
it isn't a reachable Postgres instance with the pgvector extension. No
network/Gemini API calls are made: embed_query is monkeypatched to return
deterministic vectors so these tests are fast and don't need a real API key.
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base, engine as configured_engine


def _pg_available() -> bool:
    if not settings.DATABASE_URL.startswith("postgresql"):
        return False
    try:
        with configured_engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _pg_available(),
    reason="memory_service's dedup/retrieval SQL needs a reachable Postgres instance with pgvector",
)


@pytest.fixture()
def pg_db():
    from app import models  # noqa: F401 — registers every model on Base.metadata

    Base.metadata.create_all(bind=configured_engine, tables=[
        __import__("app.models.chat_memory", fromlist=["ChatMemoryFact"]).ChatMemoryFact.__table__,
        __import__("app.models.user", fromlist=["User"]).User.__table__,
    ])
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=configured_engine)
    session = TestSessionLocal()
    try:
        yield session
        session.rollback()
    finally:
        # Tests are self-contained per user_id; nothing shared to clean up
        # beyond each test's own rows, deleted explicitly below.
        session.close()


@pytest.fixture()
def pg_user(pg_db):
    from app.models.chat_memory import ChatMemoryFact
    from app.models.user import User
    import uuid

    user = User(email=f"memtest-{uuid.uuid4().hex[:8]}@example.com")
    pg_db.add(user)
    pg_db.commit()
    pg_db.refresh(user)
    yield user
    # Facts reference this user via FK — clear them first or the user
    # delete below violates chat_memory_fact_user_id_fkey.
    pg_db.query(ChatMemoryFact).filter_by(user_id=user.id).delete()
    pg_db.query(User).filter_by(id=user.id).delete()
    pg_db.commit()


def _fake_vector(seed: float) -> list[float]:
    """A deterministic 768-dim unit-ish vector, distinct per seed so
    near-duplicate vs. unrelated similarity comparisons behave predictably."""
    import math
    base = [math.sin(seed + i * 0.01) for i in range(768)]
    norm = math.sqrt(sum(v * v for v in base)) or 1.0
    return [v / norm for v in base]


@pytest.fixture(autouse=True)
def _mock_embeddings(monkeypatch):
    """Route embed_query through a deterministic fake so these tests need
    no network access or Gemini API key. Same input text -> same vector;
    memory_service only ever calls this with the exact fact text, so two
    calls with identical text always land as a "duplicate" in cosine terms."""
    from app.services import memory_service

    def fake_embed_query(text_: str):
        return _fake_vector(sum(ord(c) for c in text_) % 1000)

    monkeypatch.setattr(memory_service, "embed_query", fake_embed_query)


def test_remember_fact_dedups_identical_text(pg_db, pg_user):
    from app.services import memory_service as ms

    first = ms.remember_fact(pg_db, pg_user.id, "ko", "learner is planning a trip to Seoul")
    second = ms.remember_fact(pg_db, pg_user.id, "ko", "learner is planning a trip to Seoul")

    assert first is not None and second is not None
    assert first.id == second.id  # the second call bumped the existing row, not a new insert
    assert second.last_confirmed_at is not None


def test_remember_fact_first_difficulty_mention_capped(pg_db, pg_user):
    from app.services import memory_service as ms

    row = ms.remember_fact(
        pg_db, pg_user.id, "ko", "learner struggles with the honorific verb endings",
        category="difficulty", confidence=0.9,
    )
    assert row.confidence <= ms._UNCONFIRMED_DIFFICULTY_CONFIDENCE_CAP


def test_remember_fact_reconfirmed_difficulty_not_recapped(pg_db, pg_user):
    from app.services import memory_service as ms

    ms.remember_fact(
        pg_db, pg_user.id, "ko", "learner struggles with honorific verb endings",
        category="difficulty", confidence=0.9,
    )
    second = ms.remember_fact(
        pg_db, pg_user.id, "ko", "learner struggles with honorific verb endings",
        category="difficulty", confidence=0.9,
    )
    # The second mention is a duplicate of the first -> confirmation bump,
    # not a second capped insert.
    assert second.confidence > ms._UNCONFIRMED_DIFFICULTY_CONFIDENCE_CAP


def test_retrieve_facts_excludes_expired(pg_db, pg_user):
    from app.services import memory_service as ms

    ms.remember_fact(
        pg_db, pg_user.id, "ko", "learner mentioned a trip happening next week",
        expires_at=datetime.utcnow() - timedelta(days=1),
    )
    results = ms.retrieve_facts(pg_db, pg_user.id, "ko", "trip", min_similarity=0.0)
    assert results == []


def test_retrieve_facts_excludes_superseded(pg_db, pg_user):
    from app.services import memory_service as ms
    from app.models.chat_memory import ChatMemoryFact

    old = ms.remember_fact(pg_db, pg_user.id, "ko", "learner's trip to Seoul is in June")
    old.superseded_by_id = old.id  # self-reference is fine for this test — only checking exclusion
    pg_db.commit()

    results = ms.retrieve_facts(pg_db, pg_user.id, "ko", "Seoul trip", min_similarity=0.0)
    assert all(r != old.fact for r in results)


def test_retrieve_facts_scoped_to_user_and_language(pg_db, pg_user):
    from app.services import memory_service as ms

    ms.remember_fact(pg_db, pg_user.id, "uk", "learner is planning a trip to Kyiv")
    results = ms.retrieve_facts(pg_db, pg_user.id, "ko", "trip", min_similarity=0.0)
    assert results == []  # wrong language for this query
