"""add has_english column

Revision ID: add_has_english
Revises: add_chat_mode
Create Date: 2026-05-22 00:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_has_english'
down_revision: Union[str, None] = 'add_chat_mode'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tracked_videos', sa.Column('has_english', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('tracked_videos', 'has_english')
