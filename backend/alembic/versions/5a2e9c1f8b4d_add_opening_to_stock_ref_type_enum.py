"""add opening to stock ref type enum

Revision ID: 5a2e9c1f8b4d
Revises: 480b403809f6
Create Date: 2026-09-06 19:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a2e9c1f8b4d'
down_revision: Union[str, None] = '480b403809f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'stock_ledger',
        'ref_type',
        existing_type=sa.Enum('GRN', 'ISSUE', 'RESTOCK', 'TRANSFER', name='stockreftype'),
        type_=sa.Enum('GRN', 'ISSUE', 'RESTOCK', 'TRANSFER', 'OPENING', name='stockreftype'),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'stock_ledger',
        'ref_type',
        existing_type=sa.Enum('GRN', 'ISSUE', 'RESTOCK', 'TRANSFER', 'OPENING', name='stockreftype'),
        type_=sa.Enum('GRN', 'ISSUE', 'RESTOCK', 'TRANSFER', name='stockreftype'),
        existing_nullable=False,
    )
