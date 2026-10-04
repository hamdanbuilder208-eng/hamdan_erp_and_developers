"""partner profit backup % per project share instead of company-wide

Revision ID: e7b4d9f2a1c3
Revises: d5a2c8e4f6b1
Create Date: 2026-10-04 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7b4d9f2a1c3'
down_revision: Union[str, None] = 'd5a2c8e4f6b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'project_partner_shares',
        sa.Column('retention_percent', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0'),
    )
    # Existing shares keep the company-wide % they were using until now.
    op.execute(
        "UPDATE project_partner_shares SET retention_percent = COALESCE("
        "(SELECT partner_profit_retention_percent FROM company_settings WHERE id = 1), 0)"
    )
    op.drop_column('company_settings', 'partner_profit_retention_percent')


def downgrade() -> None:
    op.add_column(
        'company_settings',
        sa.Column(
            'partner_profit_retention_percent', sa.Numeric(precision=5, scale=2),
            nullable=False, server_default='0',
        ),
    )
    op.execute(
        "UPDATE company_settings SET partner_profit_retention_percent = COALESCE("
        "(SELECT MAX(retention_percent) FROM project_partner_shares), 0)"
    )
    op.drop_column('project_partner_shares', 'retention_percent')
