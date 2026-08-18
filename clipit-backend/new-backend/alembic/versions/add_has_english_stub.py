"""Stub migration for missing add_has_english revision.

This migration was referenced in the production database but the original
file was lost. This stub allows Alembic to recognize the revision.

Revision ID: add_has_english
Revises: hashed_pw_nullable
Create Date: 2026-05-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_has_english'
down_revision: Union[str, None] = 'hashed_pw_nullable'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Stub migration - no changes needed
    pass


def downgrade() -> None:
    # Stub migration - no changes needed
    pass
