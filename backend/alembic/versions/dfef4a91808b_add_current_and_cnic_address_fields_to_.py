"""add current and cnic address fields to allottee and nominee

Revision ID: dfef4a91808b
Revises: b308ad404f97
Create Date: 2026-09-15 10:05:31.811541

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'dfef4a91808b'
down_revision: Union[str, None] = 'b308ad404f97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Renamed in place (not add+drop) so existing allottees don't lose their
    # recorded address — it becomes their current_address.
    op.alter_column('allottees', 'address', new_column_name='current_address', existing_type=sa.Text())
    op.add_column('allottees', sa.Column('cnic_address', sa.Text(), nullable=True))
    op.add_column('allottees', sa.Column('nominee_current_address', sa.Text(), nullable=True))
    op.add_column('allottees', sa.Column('nominee_cnic_address', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('allottees', 'nominee_cnic_address')
    op.drop_column('allottees', 'nominee_current_address')
    op.drop_column('allottees', 'cnic_address')
    op.alter_column('allottees', 'current_address', new_column_name='address', existing_type=sa.Text())
