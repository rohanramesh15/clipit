"""consolidate mined-word storage into a single source of truth

Splits UserMinedWord's identity (user, word, language) from its per-video
occurrences (new UserMinedWordSource), so a word encountered in multiple
watched videos gets one identity row instead of duplicating word/lemma/rank
per video. Adds a nullable mined_word_id link on user_flashcard_progress so
flashcards can join back to a word's mining context without duplicating it.

user_mined_words is confirmed empty in production (nothing has ever written
to it — the only writer, POST /mining/record, was unreferenced dead code),
so this alters columns directly rather than migrating data.

Revision ID: 136f81b730b9
Revises: b7e1c2d3f4a5
Create Date: 2026-09-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "136f81b730b9"
down_revision: Union[str, None] = "b7e1c2d3f4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # user_mined_words: drop per-video columns, add identity/aggregate columns
    op.drop_constraint("uq_user_video_word_lang", "user_mined_words", type_="unique")
    op.drop_index("ix_user_mined_words_video_id", table_name="user_mined_words")
    op.drop_column("user_mined_words", "video_id")
    op.drop_column("user_mined_words", "timestamp")

    op.add_column("user_mined_words", sa.Column("lemma", sa.String(length=100), nullable=True))
    op.add_column("user_mined_words", sa.Column("rank", sa.Integer(), nullable=True))
    op.add_column("user_mined_words", sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_mined_words", sa.Column("first_seen_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")))
    op.alter_column("user_mined_words", "occurrence_count", server_default=None)
    op.alter_column("user_mined_words", "first_seen_at", server_default=None)

    op.create_index("ix_user_mined_words_lemma", "user_mined_words", ["lemma"])
    op.create_unique_constraint("uq_user_word_lang", "user_mined_words", ["user_id", "word", "language"])

    # New per-video occurrence table
    op.create_table(
        "user_mined_word_sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("mined_word_id", sa.Integer(), sa.ForeignKey("user_mined_words.id", ondelete="CASCADE"), nullable=False),
        sa.Column("video_id", sa.String(length=100), nullable=False),
        sa.Column("timestamp", sa.Float(), nullable=True),
        sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("mined_word_id", "video_id", name="uq_mined_word_video"),
    )
    op.alter_column("user_mined_word_sources", "occurrence_count", server_default=None)
    op.create_index("ix_user_mined_word_sources_mined_word_id", "user_mined_word_sources", ["mined_word_id"])
    op.create_index("ix_user_mined_word_sources_video_id", "user_mined_word_sources", ["video_id"])

    # Additive link from flashcards back to their mined-word source
    op.add_column("user_flashcard_progress", sa.Column("mined_word_id", sa.Integer(), sa.ForeignKey("user_mined_words.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_user_flashcard_progress_mined_word_id", "user_flashcard_progress", ["mined_word_id"])


def downgrade() -> None:
    op.drop_index("ix_user_flashcard_progress_mined_word_id", table_name="user_flashcard_progress")
    op.drop_column("user_flashcard_progress", "mined_word_id")

    op.drop_index("ix_user_mined_word_sources_video_id", table_name="user_mined_word_sources")
    op.drop_index("ix_user_mined_word_sources_mined_word_id", table_name="user_mined_word_sources")
    op.drop_table("user_mined_word_sources")

    op.drop_constraint("uq_user_word_lang", "user_mined_words", type_="unique")
    op.drop_index("ix_user_mined_words_lemma", table_name="user_mined_words")
    op.drop_column("user_mined_words", "first_seen_at")
    op.drop_column("user_mined_words", "occurrence_count")
    op.drop_column("user_mined_words", "rank")
    op.drop_column("user_mined_words", "lemma")

    op.add_column("user_mined_words", sa.Column("timestamp", sa.Float(), nullable=True))
    op.add_column("user_mined_words", sa.Column("video_id", sa.String(length=100), nullable=False, server_default=""))
    op.alter_column("user_mined_words", "video_id", server_default=None)
    op.create_index("ix_user_mined_words_video_id", "user_mined_words", ["video_id"])
    op.create_unique_constraint("uq_user_video_word_lang", "user_mined_words", ["user_id", "video_id", "word", "language"])
