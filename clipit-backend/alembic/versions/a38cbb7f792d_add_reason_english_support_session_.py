"""add reason, english_support, session_state to chat_session

Revision ID: a38cbb7f792d
Revises: 136f81b730b9
Create Date: 2026-09-03 22:51:23.205461

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a38cbb7f792d'
down_revision: Union[str, None] = '136f81b730b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chat_session', sa.Column('reason', sa.String(length=20), nullable=True))
    op.add_column('chat_session', sa.Column('english_support', sa.String(length=10), nullable=True))
    op.add_column('chat_session', sa.Column('session_state_json', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('chat_session', 'session_state_json')
    op.drop_column('chat_session', 'english_support')
    op.drop_column('chat_session', 'reason')
