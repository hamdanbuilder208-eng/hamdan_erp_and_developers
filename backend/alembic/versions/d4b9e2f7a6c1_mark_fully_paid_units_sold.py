"""mark units Sold whose booking is already paid in full

Revision ID: d4b9e2f7a6c1
Revises: c8f2a5d1e7b3
Create Date: 2026-10-07 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4b9e2f7a6c1'
down_revision: Union[str, None] = 'c8f2a5d1e7b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Receipts now flip a unit to Sold once its booking is paid in full;
    # catch up the bookings that were already fully paid before that.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT b.unit_id, b.total_price, "
            "COALESCE(SUM(l.amount), 0) AS scheduled, COALESCE(SUM(l.paid_amount), 0) AS paid "
            "FROM bookings b JOIN units u ON u.id = b.unit_id "
            "LEFT JOIN payment_schedule_lines l ON l.booking_id = b.id "
            "WHERE b.status IN ('BOOKED', 'CONFIRMED') AND u.status = 'BOOKED' "
            "GROUP BY b.id, b.unit_id, b.total_price"
        )
    ).fetchall()
    for unit_id, total_price, scheduled, paid in rows:
        due = max(float(total_price or 0), float(scheduled or 0))
        if due > 0 and float(paid or 0) >= due - 0.01:
            conn.execute(sa.text("UPDATE units SET status = 'SOLD' WHERE id = :u"), {"u": unit_id})


def downgrade() -> None:
    # Which units were flipped isn't recorded; Sold stays Sold.
    pass
