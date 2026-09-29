"""add sequence counters

Revision ID: f18d3b5c7e29
Revises: e52f7c1a9b04
Create Date: 2026-09-29 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f18d3b5c7e29'
down_revision: Union[str, None] = 'e52f7c1a9b04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sequence_counters',
        sa.Column('prefix', sa.String(length=20), nullable=False),
        sa.Column('last_value', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('prefix'),
    )


def downgrade() -> None:
    op.drop_table('sequence_counters')
