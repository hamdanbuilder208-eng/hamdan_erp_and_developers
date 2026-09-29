"""add partner profit retention setting

Revision ID: d41b6e8a2c73
Revises: c7e2a91d4f10
Create Date: 2026-09-29 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd41b6e8a2c73'
down_revision: Union[str, None] = 'c7e2a91d4f10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'company_settings',
        sa.Column(
            'partner_profit_retention_percent',
            sa.Numeric(precision=5, scale=2),
            nullable=False,
            server_default='0',
        ),
    )


def downgrade() -> None:
    op.drop_column('company_settings', 'partner_profit_retention_percent')
