"""add cheque and bank transfer details to all payment forms

Revision ID: a7c4e2f9d1b6
Revises: f18d3b5c7e29
Create Date: 2026-09-29 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c4e2f9d1b6'
down_revision: Union[str, None] = 'f18d3b5c7e29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ALL_COLUMNS = [
    ('cheque_no', 50),
    ('cheque_bank_name', 100),
    ('transfer_bank_name', 100),
    ('transfer_account_title', 150),
    ('transfer_account_no', 50),
    ('transfer_ref_no', 80),
    ('transfer_to_account_title', 150),
    ('transfer_to_account_no', 50),
]
# receipts already has cheque_no and the four "from" transfer columns.
_RECEIPT_COLUMNS = [
    ('cheque_bank_name', 100),
    ('transfer_to_account_title', 150),
    ('transfer_to_account_no', 50),
]


def upgrade() -> None:
    for name, length in _RECEIPT_COLUMNS:
        op.add_column('receipts', sa.Column(name, sa.String(length=length), nullable=True))
    for table in ('land_property_payments', 'rent_receipts'):
        for name, length in _ALL_COLUMNS:
            op.add_column(table, sa.Column(name, sa.String(length=length), nullable=True))


def downgrade() -> None:
    for table in ('land_property_payments', 'rent_receipts'):
        for name, _ in reversed(_ALL_COLUMNS):
            op.drop_column(table, name)
    for name, _ in reversed(_RECEIPT_COLUMNS):
        op.drop_column('receipts', name)
