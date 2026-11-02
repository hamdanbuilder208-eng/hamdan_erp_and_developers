"""rent / land cheques recorded before cheque tracking: back to Pending

c5e1a8d4f2b6 marked them Cleared because they had no cash date. They're
pending in reality, so they go back to Pending and show on the dashboard
reminder (which now also lists pending cheques without a cash date) for
the owner to confirm. Since c5e1a8d4f2b6 every new cheque needs a cash
date, so Cleared-with-no-cash-date only ever means one of these.

Revision ID: d7f3b9e1a4c8
Revises: c5e1a8d4f2b6
Create Date: 2026-11-03 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd7f3b9e1a4c8'
down_revision: Union[str, None] = 'c5e1a8d4f2b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = (("rent_receipts", "Cheque"), ("land_property_payments", "CHEQUE"))


def upgrade() -> None:
    for table, cheque in _TABLES:
        op.execute(
            f"UPDATE {table} SET cheque_status = 'PENDING' "
            f"WHERE mode_of_payment = '{cheque}' AND cheque_status = 'CLEARED' AND cheque_clearing_date IS NULL"
        )


def downgrade() -> None:
    for table, cheque in _TABLES:
        op.execute(
            f"UPDATE {table} SET cheque_status = 'CLEARED' "
            f"WHERE mode_of_payment = '{cheque}' AND cheque_status = 'PENDING' AND cheque_clearing_date IS NULL"
        )
