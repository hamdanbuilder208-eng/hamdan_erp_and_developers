"""project chooses lower ground / ground / mezzanine levels

Revision ID: c3f8a1d5e7b2
Revises: b9e3d6f1a2c4
Create Date: 2026-10-04 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f8a1d5e7b2'
down_revision: Union[str, None] = 'b9e3d6f1a2c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing projects always offered Lower Ground + Ground, so keep both on.
    op.add_column('projects', sa.Column('has_lower_ground', sa.Boolean(), nullable=False, server_default=sa.text('1')))
    op.add_column('projects', sa.Column('has_ground', sa.Boolean(), nullable=False, server_default=sa.text('1')))
    op.add_column('projects', sa.Column('has_mezzanine', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    # New projects default to no lower ground (the model's server_default).
    op.alter_column('projects', 'has_lower_ground', existing_type=sa.Boolean(), existing_nullable=False, server_default=sa.text('0'))


def downgrade() -> None:
    op.drop_column('projects', 'has_mezzanine')
    op.drop_column('projects', 'has_ground')
    op.drop_column('projects', 'has_lower_ground')
