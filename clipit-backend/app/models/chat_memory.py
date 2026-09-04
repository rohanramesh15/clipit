from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, DateTime, Index
from pgvector.sqlalchemy import Vector
from .base import BaseModel

# Categories a stored fact can be classified under. Kept as a plain string
# column (not a DB enum) so adding a category never needs a migration.
MEMORY_FACT_CATEGORIES = {
    "preference", "interest", "goal", "difficulty", "background", "proficiency",
}


class ChatMemoryFact(BaseModel):
    """
    A persistent fact about a user, extracted from a past chat session.

    Example facts:
      - "user is planning a trip to Mexico City in June"
      - "user's sister also speaks Spanish"
      - "user struggles with the subjunctive mood"
      - "user enjoys discussing the show La Casa de Papel"

    Each fact is embedded so we can do similarity-search retrieval at
    chat-turn time and inject the most relevant ones into the system prompt.

    `confidence` and `importance` are independent: confidence is how sure we
    are the fact is true (rises as it's reconfirmed), importance is how much
    it should weigh in retrieval ranking regardless of confidence. A fact
    superseded by a newer/contradicting one is never deleted (auditability)
    — `superseded_by_id` points at its replacement and retrieval excludes it.
    """
    __tablename__ = "chat_memory_fact"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    language = Column(String(10), nullable=False, default="es", index=True)
    fact = Column(Text, nullable=False)
    category = Column(String(20), nullable=True)  # see MEMORY_FACT_CATEGORIES
    confidence = Column(Float, nullable=False, default=0.6)
    importance = Column(Float, nullable=False, default=0.5)
    last_confirmed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    superseded_by_id = Column(Integer, ForeignKey("chat_memory_fact.id", ondelete="SET NULL"), nullable=True)
    source_session_id = Column(Integer, ForeignKey("chat_session.id", ondelete="SET NULL"), nullable=True)
    embedding = Column(Vector(768), nullable=False)

    __table_args__ = (
        Index('ix_chat_memory_fact_user_lang', 'user_id', 'language'),
    )
