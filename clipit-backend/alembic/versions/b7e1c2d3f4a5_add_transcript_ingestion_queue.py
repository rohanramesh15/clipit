"""add durable transcript ingestion queue

Revision ID: b7e1c2d3f4a5
Revises: 4b8f2c9d7e10
Create Date: 2026-09-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7e1c2d3f4a5"
down_revision: Union[str, None] = "4b8f2c9d7e10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tracked_videos", sa.Column("thumbnail_url", sa.String(), nullable=True))
    op.create_table(
        "transcript_ingestion_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("video_id", sa.String(), sa.ForeignKey("tracked_videos.video_id", ondelete="CASCADE"), nullable=False),
        sa.Column("language", sa.String(length=8), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("total_chunks", sa.Integer(), nullable=False),
        sa.Column("received_chunks", sa.Integer(), nullable=False),
        sa.Column("processed_chunks", sa.Integer(), nullable=False),
        sa.Column("words", sa.JSON(), nullable=False),
        sa.Column("error", sa.String(), nullable=True),
        sa.UniqueConstraint("user_id", "video_id", "language", name="uq_transcript_ingestion_job"),
    )
    op.create_index("ix_transcript_ingestion_jobs_user_id", "transcript_ingestion_jobs", ["user_id"])
    op.create_index("ix_transcript_ingestion_jobs_video_id", "transcript_ingestion_jobs", ["video_id"])
    op.create_table(
        "transcript_ingestion_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("transcript_ingestion_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("subtitles", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("words", sa.JSON(), nullable=False),
        sa.UniqueConstraint("job_id", "chunk_index", name="uq_transcript_ingestion_chunk"),
    )
    op.create_index("ix_transcript_ingestion_chunks_job_id", "transcript_ingestion_chunks", ["job_id"])


def downgrade() -> None:
    op.drop_index("ix_transcript_ingestion_chunks_job_id", table_name="transcript_ingestion_chunks")
    op.drop_table("transcript_ingestion_chunks")
    op.drop_index("ix_transcript_ingestion_jobs_video_id", table_name="transcript_ingestion_jobs")
    op.drop_index("ix_transcript_ingestion_jobs_user_id", table_name="transcript_ingestion_jobs")
    op.drop_table("transcript_ingestion_jobs")
    op.drop_column("tracked_videos", "thumbnail_url")
