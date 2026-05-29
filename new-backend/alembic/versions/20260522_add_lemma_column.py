"""add lemma column to user_flashcard_progress

Revision ID: add_lemma_column
Revises: add_has_spanish
Create Date: 2026-05-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_lemma_column'
down_revision: Union[str, None] = 'add_has_spanish'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_flashcard_progress',
        sa.Column('lemma', sa.String(), nullable=True),
    )
    op.create_index(
        'ix_user_flashcard_progress_lemma',
        'user_flashcard_progress',
        ['lemma'],
    )


def downgrade() -> None:
    op.drop_index('ix_user_flashcard_progress_lemma', table_name='user_flashcard_progress')
    op.drop_column('user_flashcard_progress', 'lemma')
