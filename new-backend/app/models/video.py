import time
from sqlalchemy import Column, String, Float, Boolean, JSON
from .base import BaseModel


class TrackedVideo(BaseModel):
    """A YouTube video tracked by the Chrome extension."""
    __tablename__ = "tracked_videos"

    video_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, default="Unknown")
    youtube_url = Column(String)
    subtitles = Column(JSON, nullable=True)   # Full subtitle list, stored as JSON
    tracked_at = Column(Float, default=time.time, nullable=False)
    has_korean = Column(Boolean, nullable=True)  # None = unchecked, True/False = confirmed
