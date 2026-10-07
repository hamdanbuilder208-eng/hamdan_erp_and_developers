"""reverse the unpaid part of the sale when a paid booking is cancelled

Revision ID: b6e1f4a8c2d9
Revises: a3d7e9c2b5f8
Create Date: 2026-10-07 11:00:00.000000

"""
from datetime import date
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6e1f4a8c2d9'
down_revision: Union[str, None] = 'a3d7e9c2b5f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _next_jv_no(conn) -> str:
    rows = conn.execute(sa.text("SELECT voucher_no FROM vouchers WHERE voucher_no LIKE 'JV-%'")).fetchall()
    numbers = [int(v[3:]) for (v,) in rows if v[3:].isdigit()]
    return f"JV-{(max(numbers) if numbers else 0) + 1:05d}"


def upgrade() -> None:
    op.add_column('bookings', sa.Column('cancellation_voucher_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_bookings_cancellation_voucher_id', 'bookings', 'vouchers', ['cancellation_voucher_id'], ['id']
    )

    # Bookings already cancelled with payments kept their full sale in the
    # books — reverse the part the customer never paid, as cancelling now does.
    conn = op.get_bind()
    ar = conn.execute(sa.text("SELECT id FROM accounts WHERE code = '1030'")).scalar()
    sales = conn.execute(sa.text("SELECT id FROM accounts WHERE code = '4010'")).scalar()
    if not (ar and sales):
        return

    # Refunds on cancelled bookings could be booked against any account; they
    # now always come off Unit Sales so the sale and refund net out. Move the
    # existing ones over too.
    refund_payments = conn.execute(
        sa.text(
            "SELECT rp.id, rp.voucher_id, rp.account_id FROM refund_payments rp "
            "JOIN refunds r ON r.id = rp.refund_id "
            "WHERE r.refund_type = 'CUSTOMER' AND r.booking_id IS NOT NULL AND rp.account_id <> :s"
        ),
        {"s": sales},
    ).fetchall()
    for payment_id, voucher_id, account_id in refund_payments:
        if voucher_id:
            conn.execute(
                sa.text(
                    "UPDATE voucher_lines SET account_id = :s "
                    "WHERE voucher_id = :v AND account_id = :a AND debit > 0"
                ),
                {"s": sales, "v": voucher_id, "a": account_id},
            )
        conn.execute(
            sa.text("UPDATE refund_payments SET account_id = :s WHERE id = :p"), {"s": sales, "p": payment_id}
        )

    bookings = conn.execute(
        sa.text(
            "SELECT id, booking_ref_no, project_id, revenue_voucher_id, status_date FROM bookings "
            "WHERE status = 'CANCELLED' AND revenue_voucher_id IS NOT NULL"
        )
    ).fetchall()
    for booking_id, ref_no, project_id, revenue_voucher_id, status_date in bookings:
        voucher_ids = {revenue_voucher_id}
        voucher_ids |= {
            v for (v,) in conn.execute(
                sa.text("SELECT voucher_id FROM booking_extra_charges WHERE booking_id = :b"), {"b": booking_id}
            )
            if v
        }
        voucher_ids |= {
            v for (v,) in conn.execute(
                sa.text("SELECT voucher_id FROM receipts WHERE booking_id = :b"), {"b": booking_id}
            )
            if v
        }
        ids = ", ".join(str(int(v)) for v in voucher_ids)
        unpaid = conn.execute(
            sa.text(
                f"SELECT COALESCE(SUM(debit - credit), 0) FROM voucher_lines "
                f"WHERE account_id = :ar AND voucher_id IN ({ids})"
            ),
            {"ar": ar},
        ).scalar()
        unpaid = round(float(unpaid or 0), 2)
        if unpaid <= 0.005:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO vouchers (voucher_no, voucher_type, voucher_date, project_id, narration) "
                "VALUES (:no, 'JOURNAL', :d, :p, :n)"
            ),
            {
                "no": _next_jv_no(conn),
                "d": status_date or date.today(),
                "p": project_id,
                "n": f"Sale reversed — booking {ref_no} cancelled (unpaid balance)",
            },
        )
        voucher_id = conn.execute(
            sa.text("SELECT id FROM vouchers WHERE narration = :n ORDER BY id DESC LIMIT 1"),
            {"n": f"Sale reversed — booking {ref_no} cancelled (unpaid balance)"},
        ).scalar()
        for account_id, debit, credit in ((sales, unpaid, 0), (ar, 0, unpaid)):
            conn.execute(
                sa.text(
                    "INSERT INTO voucher_lines (voucher_id, account_id, debit, credit, narration) "
                    "VALUES (:v, :a, :dr, :cr, :n)"
                ),
                {"v": voucher_id, "a": account_id, "dr": debit, "cr": credit, "n": f"Cancelled booking {ref_no}"},
            )
        conn.execute(
            sa.text("UPDATE bookings SET cancellation_voucher_id = :v WHERE id = :b"),
            {"v": voucher_id, "b": booking_id},
        )


def downgrade() -> None:
    conn = op.get_bind()
    ids = [v for (v,) in conn.execute(
        sa.text("SELECT cancellation_voucher_id FROM bookings WHERE cancellation_voucher_id IS NOT NULL")
    )]
    op.drop_constraint('fk_bookings_cancellation_voucher_id', 'bookings', type_='foreignkey')
    op.drop_column('bookings', 'cancellation_voucher_id')
    for voucher_id in ids:
        conn.execute(sa.text("DELETE FROM voucher_lines WHERE voucher_id = :v"), {"v": voucher_id})
        conn.execute(sa.text("DELETE FROM vouchers WHERE id = :v"), {"v": voucher_id})
