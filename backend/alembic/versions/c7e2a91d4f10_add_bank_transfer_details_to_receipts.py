"""add bank transfer details to receipts

Revision ID: c7e2a91d4f10
Revises: b454a9526c6b
Create Date: 2026-09-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7e2a91d4f10'
down_revision: Union[str, None] = 'b454a9526c6b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('receipts', sa.Column('transfer_bank_name', sa.String(length=100), nullable=True))
    op.add_column('receipts', sa.Column('transfer_account_title', sa.String(length=150), nullable=True))
    op.add_column('receipts', sa.Column('transfer_account_no', sa.String(length=50), nullable=True))
    op.add_column('receipts', sa.Column('transfer_ref_no', sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_column('receipts', 'transfer_ref_no')
    op.drop_column('receipts', 'transfer_account_no')
    op.drop_column('receipts', 'transfer_account_title')
    op.drop_column('receipts', 'transfer_bank_name')
