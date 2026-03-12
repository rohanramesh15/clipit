from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from .base import BaseModel


class UserVocabularySettings(BaseModel):
    """User's global settings for vocabulary prioritization"""
    __tablename__ = "user_vocabulary_settings"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    priority_mode = Column(String(20), nullable=False, default="mixed")  # 'uploaded_only', 'frequency_only', 'mixed'

    # Relationships
    user = relationship("User", backref="vocabulary_settings", uselist=False)
