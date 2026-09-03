from sqlalchemy import Column, String, Integer, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from .base import BaseModel


class UserMinedWordSource(BaseModel):
    """Which watched video(s) a mined word came from — split out from
    UserMinedWord so a word encountered in multiple videos doesn't duplicate
    its identity row, and so History can show per-video word lists."""
    __tablename__ = "user_mined_word_sources"

    mined_word_id = Column(Integer, ForeignKey("user_mined_words.id", ondelete="CASCADE"), nullable=False, index=True)
    video_id = Column(String(100), nullable=False, index=True)  # YouTube ID or netflix_{id}
    timestamp = Column(Float, nullable=True)  # first occurrence of this word in this video
    occurrence_count = Column(Integer, nullable=False, default=0)  # occurrences within this video only

    # Relationships
    mined_word = relationship("UserMinedWord", back_populates="sources")

    __table_args__ = (
        UniqueConstraint('mined_word_id', 'video_id', name='uq_mined_word_video'),
    )
