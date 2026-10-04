"""link vouchers to land properties for Land & Plots / Office reports

Revision ID: d5a2c8e4f6b1
Revises: c3f8a1d5e7b2
Create Date: 2026-10-04 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5a2c8e4f6b1'
down_revision: Union[str, None] = 'c3f8a1d5e7b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('vouchers', sa.Column('land_property_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_vouchers_land_property_id', 'vouchers', 'land_properties', ['land_property_id'], ['id']
    )

    # Office expenses recorded against a land property.
    op.execute(
        "UPDATE vouchers SET land_property_id = "
        "(SELECT e.land_property_id FROM office_expenses e WHERE e.voucher_id = vouchers.id) "
        "WHERE id IN (SELECT voucher_id FROM office_expenses "
        "WHERE land_property_id IS NOT NULL AND voucher_id IS NOT NULL)"
    )
    # Rent received on a land property.
    op.execute(
        "UPDATE vouchers SET land_property_id = "
        "(SELECT a.land_property_id FROM rent_receipts r JOIN rent_agreements a ON a.id = r.agreement_id "
        "WHERE r.voucher_id = vouchers.id) "
        "WHERE id IN (SELECT r.voucher_id FROM rent_receipts r JOIN rent_agreements a ON a.id = r.agreement_id "
        "WHERE a.land_property_id IS NOT NULL AND r.voucher_id IS NOT NULL)"
    )


def downgrade() -> None:
    op.drop_constraint('fk_vouchers_land_property_id', 'vouchers', type_='foreignkey')
    op.drop_column('vouchers', 'land_property_id')
