"""Lead follow-up status and date

Revision ID: f4b7c2e9a1d3
Revises: e9a2c6f4b8d1
Create Date: 2026-11-10 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f4b7c2e9a1d3'
down_revision: Union[str, None] = 'e9a2c6f4b8d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'leads', sa.Column('follow_up_status', sa.String(30), server_default='New', nullable=False)
    )
    op.add_column('leads', sa.Column('follow_up_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('leads', 'follow_up_date')
    op.drop_column('leads', 'follow_up_status')
