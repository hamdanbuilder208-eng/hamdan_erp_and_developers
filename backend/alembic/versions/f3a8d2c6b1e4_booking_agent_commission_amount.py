"""booking: fixed agent commission amount (alternative to percent)

Revision ID: f3a8d2c6b1e4
Revises: e1c7a3f9b5d2
Create Date: 2026-11-02 16:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f3a8d2c6b1e4'
down_revision: Union[str, None] = 'e1c7a3f9b5d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bookings', sa.Column('agent_commission_amount', sa.Numeric(18, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('bookings', 'agent_commission_amount')
