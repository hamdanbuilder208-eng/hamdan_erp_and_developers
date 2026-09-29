"""link office expenses to land properties

Revision ID: e52f7c1a9b04
Revises: d41b6e8a2c73
Create Date: 2026-09-29 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e52f7c1a9b04'
down_revision: Union[str, None] = 'd41b6e8a2c73'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('office_expenses', sa.Column('land_property_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_office_expenses_land_property_id',
        'office_expenses',
        'land_properties',
        ['land_property_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_office_expenses_land_property_id', 'office_expenses', type_='foreignkey')
    op.drop_column('office_expenses', 'land_property_id')
