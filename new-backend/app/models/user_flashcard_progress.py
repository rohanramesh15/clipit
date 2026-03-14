from sqlalchemy import Column, Integer, String, Float, DateTime, UniqueConstraint, ForeignKey
from .base import BaseModel


class UserFlashcardProgress(BaseModel):
    """Per-user FSRS card state (replaces localStorage deadbird_fsrs_cards)."""
    __tablename__ = "user_flashcard_progress"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    word = Column(String, nullable=False)
    language = Column(String, nullable=False)  # 'ko', 'uk', 'sr', 'bg'
    video_id = Column(String(20), nullable=True, index=True)  # YouTube video ID for deck organization

    # FSRS fields — match ts-fsrs Card object
    due = Column(DateTime, nullable=False)
    stability = Column(Float, default=0.0)
    difficulty = Column(Float, default=0.0)
    elapsed_days = Column(Integer, default=0)
    scheduled_days = Column(Integer, default=0)
    reps = Column(Integer, default=0)
    lapses = Column(Integer, default=0)
    state = Column(Integer, default=0)         # FSRSState: 0=New 1=Learning 2=Review 3=Relearning
    last_review = Column(DateTime, nullable=True)

    __table_args__ = (UniqueConstraint("user_id", "word", "language"),)
