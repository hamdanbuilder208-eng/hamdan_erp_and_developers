"""link vendor refunds to the vendor and (optionally) the GRN

Revision ID: c8f2a5d1e7b3
Revises: b6e1f4a8c2d9
Create Date: 2026-10-07 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8f2a5d1e7b3'
down_revision: Union[str, None] = 'b6e1f4a8c2d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('refunds', sa.Column('vendor_id', sa.Integer(), nullable=True))
    op.add_column('refunds', sa.Column('grn_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_refunds_vendor_id', 'refunds', 'vendors', ['vendor_id'], ['id'])
    op.create_foreign_key('fk_refunds_grn_id', 'refunds', 'grns', ['grn_id'], ['id'])
    # Older vendor refunds typed the vendor's name — link those that match a vendor.
    op.execute(
        "UPDATE refunds SET vendor_id = (SELECT v.id FROM vendors v WHERE v.name = refunds.party_name LIMIT 1) "
        "WHERE refund_type = 'VENDOR' AND vendor_id IS NULL"
    )


def downgrade() -> None:
    op.drop_constraint('fk_refunds_grn_id', 'refunds', type_='foreignkey')
    op.drop_constraint('fk_refunds_vendor_id', 'refunds', type_='foreignkey')
    op.drop_column('refunds', 'grn_id')
    op.drop_column('refunds', 'vendor_id')
