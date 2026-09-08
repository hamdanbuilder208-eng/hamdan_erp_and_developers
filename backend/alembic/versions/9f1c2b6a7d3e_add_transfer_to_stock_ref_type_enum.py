"""add transfer to stock ref type enum

Revision ID: 9f1c2b6a7d3e
Revises: 8b57e5041ea4
Create Date: 2026-09-06 18:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f1c2b6a7d3e'
down_revision: Union[str, None] = '8b57e5041ea4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'stock_ledger',
        'ref_type',
        existing_type=sa.Enum('GRN', 'ISSUE', 'RESTOCK', name='stockreftype'),
        type_=sa.Enum('GRN', 'ISSUE', 'RESTOCK', 'TRANSFER', name='stockreftype'),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'stock_ledger',
        'ref_type',
        existing_type=sa.Enum('GRN', 'ISSUE', 'RESTOCK', 'TRANSFER', name='stockreftype'),
        type_=sa.Enum('GRN', 'ISSUE', 'RESTOCK', name='stockreftype'),
        existing_nullable=False,
    )
