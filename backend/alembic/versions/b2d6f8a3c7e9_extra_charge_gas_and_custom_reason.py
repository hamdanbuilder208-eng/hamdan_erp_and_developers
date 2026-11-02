"""extra charges: Gas reason, and a typed-in name for Other

Revision ID: b2d6f8a3c7e9
Revises: a9c4e7b2d5f1
Create Date: 2026-11-02 20:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b2d6f8a3c7e9'
down_revision: Union[str, None] = 'a9c4e7b2d5f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD = ('EAST_FACING', 'WEST_FACING', 'OPEN', 'ROAD_FACING', 'CORNER', 'WATER', 'ELECTRICITY', 'DOCUMENTS', 'OTHER')
_NEW = ('EAST_FACING', 'WEST_FACING', 'OPEN', 'ROAD_FACING', 'CORNER', 'WATER', 'ELECTRICITY', 'GAS', 'DOCUMENTS', 'OTHER')


def upgrade() -> None:
    op.alter_column(
        'booking_extra_charges',
        'reason',
        existing_type=sa.Enum(*_OLD, name='extrachargesreason'),
        type_=sa.Enum(*_NEW, name='extrachargesreason'),
        existing_nullable=False,
    )
    op.add_column('booking_extra_charges', sa.Column('custom_reason', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('booking_extra_charges', 'custom_reason')
    op.execute("UPDATE booking_extra_charges SET reason = 'OTHER' WHERE reason = 'GAS'")
    op.alter_column(
        'booking_extra_charges',
        'reason',
        existing_type=sa.Enum(*_NEW, name='extrachargesreason'),
        type_=sa.Enum(*_OLD, name='extrachargesreason'),
        existing_nullable=False,
    )
