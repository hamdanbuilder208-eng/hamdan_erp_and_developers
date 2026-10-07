"""rent on a project's unit/shop counts as that project's income

Revision ID: e1c7a3f9b5d2
Revises: d4b9e2f7a6c1
Create Date: 2026-10-07 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e1c7a3f9b5d2'
down_revision: Union[str, None] = 'd4b9e2f7a6c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_UNIT_RENT_VOUCHERS = (
    "SELECT r.voucher_id FROM rent_receipts r JOIN rent_agreements a ON a.id = r.agreement_id "
    "WHERE a.unit_id IS NOT NULL AND r.voucher_id IS NOT NULL"
)


def upgrade() -> None:
    # Rent already received on project units gets tagged to the project too.
    op.execute(
        "UPDATE vouchers SET project_id = "
        "(SELECT u.project_id FROM rent_receipts r JOIN rent_agreements a ON a.id = r.agreement_id "
        "JOIN units u ON u.id = a.unit_id WHERE r.voucher_id = vouchers.id) "
        f"WHERE project_id IS NULL AND id IN ({_UNIT_RENT_VOUCHERS})"
    )


def downgrade() -> None:
    op.execute(f"UPDATE vouchers SET project_id = NULL WHERE id IN ({_UNIT_RENT_VOUCHERS})")
