"""extend chat_memory_fact and add chat_word_attempt

Revision ID: af3471fc61ab
Revises: a38cbb7f792d
Create Date: 2026-09-03 22:52:22.059209

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'af3471fc61ab'
down_revision: Union[str, None] = 'a38cbb7f792d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chat_memory_fact', sa.Column('category', sa.String(length=20), nullable=True))
    op.add_column('chat_memory_fact', sa.Column('confidence', sa.Float(), nullable=False, server_default='0.6'))
    op.add_column('chat_memory_fact', sa.Column('importance', sa.Float(), nullable=False, server_default='0.5'))
    op.add_column('chat_memory_fact', sa.Column('last_confirmed_at', sa.DateTime(), nullable=True))
    op.add_column('chat_memory_fact', sa.Column('expires_at', sa.DateTime(), nullable=True))
    op.add_column('chat_memory_fact', sa.Column('superseded_by_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_chat_memory_fact_superseded_by_id', 'chat_memory_fact', 'chat_memory_fact',
        ['superseded_by_id'], ['id'], ondelete='SET NULL',
    )
    # Existing rows predate created_at/updated_at defaults being meaningful
    # for this table's new "confirmed" semantics — server_default above
    # covers confidence/importance; nothing else needs backfilling since the
    # new nullable columns default to NULL, which retrieve_facts() already
    # treats as "not expired / not superseded".

    op.create_table(
        'chat_word_attempt',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('chat_session.id', ondelete='CASCADE'), nullable=False),
        sa.Column('word', sa.String(), nullable=False),
        sa.Column('result', sa.String(length=16), nullable=False),
        sa.Column('learner_sentence', sa.Text(), nullable=True),
        sa.Column('evidence', sa.Text(), nullable=True),
    )
    op.create_index('ix_chat_word_attempt_session', 'chat_word_attempt', ['session_id'])


def downgrade() -> None:
    op.drop_index('ix_chat_word_attempt_session', table_name='chat_word_attempt')
    op.drop_table('chat_word_attempt')

    op.drop_constraint('fk_chat_memory_fact_superseded_by_id', 'chat_memory_fact', type_='foreignkey')
    op.drop_column('chat_memory_fact', 'superseded_by_id')
    op.drop_column('chat_memory_fact', 'expires_at')
    op.drop_column('chat_memory_fact', 'last_confirmed_at')
    op.drop_column('chat_memory_fact', 'importance')
    op.drop_column('chat_memory_fact', 'confidence')
    op.drop_column('chat_memory_fact', 'category')
