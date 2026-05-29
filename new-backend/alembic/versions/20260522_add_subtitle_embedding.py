"""add subtitle_embedding table with pgvector

Revision ID: add_subtitle_embedding
Revises: add_lemma_column
Create Date: 2026-05-22 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


revision: str = 'add_subtitle_embedding'
down_revision: Union[str, None] = 'add_lemma_column'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extension is already enabled on the Neon project; this is a no-op if so.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        'subtitle_embedding',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('video_id', sa.String(length=100), nullable=False),
        sa.Column('language', sa.String(length=10), nullable=False),
        sa.Column('sentence', sa.String(), nullable=False),
        sa.Column('sentence_translation', sa.String(), nullable=True),
        sa.Column('lemma_set', sa.JSON(), nullable=True),
        sa.Column('ts_start', sa.Float(), nullable=True),
        sa.Column('ts_end', sa.Float(), nullable=True),
        sa.Column('embedding', Vector(768), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_subtitle_embedding_video_id', 'subtitle_embedding', ['video_id'])
    op.create_index('ix_subtitle_embedding_language', 'subtitle_embedding', ['language'])
    op.create_index('ix_subtitle_embedding_video_lang', 'subtitle_embedding', ['video_id', 'language'])

    # HNSW index for fast cosine similarity search
    op.execute("""
        CREATE INDEX ix_subtitle_embedding_hnsw
        ON subtitle_embedding
        USING hnsw (embedding vector_cosine_ops)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_subtitle_embedding_hnsw")
    op.drop_index('ix_subtitle_embedding_video_lang', table_name='subtitle_embedding')
    op.drop_index('ix_subtitle_embedding_language', table_name='subtitle_embedding')
    op.drop_index('ix_subtitle_embedding_video_id', table_name='subtitle_embedding')
    op.drop_table('subtitle_embedding')
