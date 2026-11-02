"""rent receipts: security-deposit type and cheque cash date/status;
land/plot payments: cheque cash date/status

Revision ID: c5e1a8d4f2b6
Revises: b2d6f8a3c7e9
Create Date: 2026-11-02 22:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c5e1a8d4f2b6'
down_revision: Union[str, None] = 'b2d6f8a3c7e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _cheque_columns(table: str) -> None:
    op.add_column(table, sa.Column('cheque_date', sa.Date(), nullable=True))
    op.add_column(table, sa.Column('cheque_clearing_date', sa.Date(), nullable=True))
    op.add_column(
        table,
        sa.Column('cheque_status', sa.Enum('PENDING', 'CLEARED', 'BOUNCED', name='chequestatus'), nullable=True),
    )


def upgrade() -> None:
    op.add_column(
        'rent_receipts',
        sa.Column(
            'receipt_type',
            sa.Enum('RENT', 'SECURITY_DEPOSIT', name='rentreceipttype'),
            server_default='RENT',
            nullable=False,
        ),
    )
    _cheque_columns('rent_receipts')
    _cheque_columns('land_property_payments')
    # Cheques recorded before this had no status; treat them as already cleared.
    op.execute("UPDATE rent_receipts SET cheque_status = 'CLEARED' WHERE mode_of_payment = 'Cheque'")
    op.execute("UPDATE land_property_payments SET cheque_status = 'CLEARED' WHERE mode_of_payment = 'CHEQUE'")


def downgrade() -> None:
    for table in ('land_property_payments', 'rent_receipts'):
        op.drop_column(table, 'cheque_status')
        op.drop_column(table, 'cheque_clearing_date')
        op.drop_column(table, 'cheque_date')
    op.drop_column('rent_receipts', 'receipt_type')
