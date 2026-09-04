"""
Shared fixtures for the agentic voice tutor test suite.

Most fixtures here run on an in-memory SQLite database — everything except
ChatMemoryFact's pgvector-backed cosine-similarity queries works fine there
(verified: Base.metadata.create_all() succeeds against SQLite even with the
Vector column present). memory_service's dedup/retrieval SQL uses `<=>` and
`CAST(... AS vector)`, which are pgvector/Postgres-only — those tests use the
`pg_db` fixture instead, which skips if DATABASE_URL isn't a real Postgres+
pgvector instance (see test_memory_service.py).
"""

import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app import models  # noqa: F401 — registers every model on Base.metadata


@pytest.fixture()
def db():
    """A fresh in-memory SQLite database per test."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def make_user(db):
    from app.models.user import User

    def _make(email: str = "learner@example.com") -> User:
        user = User(email=email)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _make


@pytest.fixture()
def make_chat_session(db):
    from app.models.chat import ChatSession

    def _make(user, language: str = "ko", **overrides) -> ChatSession:
        session = ChatSession(
            user_id=user.id,
            language=language,
            started_at=datetime.utcnow(),
            **overrides,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    return _make


@pytest.fixture()
def make_card(db):
    from app.models.user_flashcard_progress import UserFlashcardProgress

    def _make(user, word: str, language: str = "ko", **overrides) -> UserFlashcardProgress:
        defaults = dict(due=datetime.utcnow(), stability=0.0, difficulty=5.0, state=0)
        defaults.update(overrides)
        card = UserFlashcardProgress(user_id=user.id, word=word, language=language, **defaults)
        db.add(card)
        db.commit()
        db.refresh(card)
        return card

    return _make


@pytest.fixture()
def tool_ctx(db, make_user, make_chat_session):
    from app.services.voice_tools import ToolContext

    user = make_user()
    session = make_chat_session(user)
    return ToolContext(db=db, user_id=user.id, language=session.language, chat_session=session)
