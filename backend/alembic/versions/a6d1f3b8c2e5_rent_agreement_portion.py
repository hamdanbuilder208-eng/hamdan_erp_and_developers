"""Rent agreement portion (rent one property to several tenants)

Revision ID: a6d1f3b8c2e5
Revises: f4b7c2e9a1d3
Create Date: 2026-11-22 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a6d1f3b8c2e5'
down_revision: Union[str, None] = 'f4b7c2e9a1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('rent_agreements', sa.Column('portion', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('rent_agreements', 'portion')
