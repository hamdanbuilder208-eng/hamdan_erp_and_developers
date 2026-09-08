"""add petty cash to stock ref type enum

Revision ID: c1d4e8f2a6b7
Revises: f8ae9a7cf0c0
Create Date: 2026-09-07 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d4e8f2a6b7'
down_revision: Union[str, None] = 'f8ae9a7cf0c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'stock_ledger',
        'ref_type',
        existing_type=sa.Enum('GRN', 'ISSUE', 'RESTOCK', 'TRANSFER', 'OPENING', name='stockreftype'),
        type_=sa.Enum('GRN', 'ISSUE', 'RESTOCK', 'TRANSFER', 'OPENING', 'PETTY_CASH', name='stockreftype'),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'stock_ledger',
        'ref_type',
        existing_type=sa.Enum('GRN', 'ISSUE', 'RESTOCK', 'TRANSFER', 'OPENING', 'PETTY_CASH', name='stockreftype'),
        type_=sa.Enum('GRN', 'ISSUE', 'RESTOCK', 'TRANSFER', 'OPENING', name='stockreftype'),
        existing_nullable=False,
    )
