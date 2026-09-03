from sqlalchemy import Column, ForeignKey, Integer, JSON, String, UniqueConstraint

from .base import BaseModel


class TranscriptIngestionJob(BaseModel):
    """A user-visible, durable transcript-processing run for one video/language."""

    __tablename__ = "transcript_ingestion_jobs"
    __table_args__ = (
        UniqueConstraint("user_id", "video_id", "language", name="uq_transcript_ingestion_job"),
    )

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    video_id = Column(String, ForeignKey("tracked_videos.video_id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String(8), nullable=False)
    status = Column(String(24), nullable=False, default="receiving")
    total_chunks = Column(Integer, nullable=False)
    received_chunks = Column(Integer, nullable=False, default=0)
    processed_chunks = Column(Integer, nullable=False, default=0)
    words = Column(JSON, nullable=False, default=list)
    error = Column(String, nullable=True)


class TranscriptIngestionChunk(BaseModel):
    """One idempotent caption batch waiting for, or completed by, the worker."""

    __tablename__ = "transcript_ingestion_chunks"
    __table_args__ = (
        UniqueConstraint("job_id", "chunk_index", name="uq_transcript_ingestion_chunk"),
    )

    job_id = Column(Integer, ForeignKey("transcript_ingestion_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    subtitles = Column(JSON, nullable=False)
    status = Column(String(24), nullable=False, default="queued")
    words = Column(JSON, nullable=False, default=list)
