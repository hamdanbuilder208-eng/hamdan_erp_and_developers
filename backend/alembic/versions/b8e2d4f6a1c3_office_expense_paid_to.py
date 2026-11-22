"""Office expense paid-to (who the money went to)

Revision ID: b8e2d4f6a1c3
Revises: a6d1f3b8c2e5
Create Date: 2026-11-22 13:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b8e2d4f6a1c3'
down_revision: Union[str, None] = 'a6d1f3b8c2e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('office_expenses', sa.Column('paid_to', sa.String(150), nullable=True))


def downgrade() -> None:
    op.drop_column('office_expenses', 'paid_to')
