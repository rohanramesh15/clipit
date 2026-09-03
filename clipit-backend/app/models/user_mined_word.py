from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from .base import BaseModel


class UserMinedWord(BaseModel):
    """Single source of truth for a word a user has encountered across the
    videos they've watched. One row per (user, word, language) — video
    associations live on UserMinedWordSource, not here, since a word can
    come from more than one watched video."""
    __tablename__ = "user_mined_words"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    word = Column(String(100), nullable=False, index=True)
    lemma = Column(String(100), nullable=True, index=True)  # canonical dictionary form, when known
    language = Column(String(10), nullable=False, default="ko")
    rank = Column(Integer, nullable=True)  # frequency rank at time of mining
    occurrence_count = Column(Integer, nullable=False, default=0)  # cumulative, across all videos
    first_seen_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="mined_words")
    sources = relationship("UserMinedWordSource", back_populates="mined_word", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('user_id', 'word', 'language', name='uq_user_word_lang'),
    )
