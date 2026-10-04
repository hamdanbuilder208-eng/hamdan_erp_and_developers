"""mode of payment + cheque / transfer details on every payment form

Revision ID: f2c6a8e1b9d4
Revises: e7b4d9f2a1c3
Create Date: 2026-10-05 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2c6a8e1b9d4'
down_revision: Union[str, None] = 'e7b4d9f2a1c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = (
    'office_expenses',
    'wage_payments',
    'owner_personal_expenses',
    'grns',
    'refund_payments',
    'petty_cash_topups',
    'partner_contributions',
    'partner_drawings',
    'commission_payouts',
)
_DETAIL_COLUMNS = [
    ('cheque_no', 50),
    ('cheque_bank_name', 100),
    ('transfer_bank_name', 100),
    ('transfer_account_title', 150),
    ('transfer_account_no', 50),
    ('transfer_ref_no', 80),
    ('transfer_to_account_title', 150),
    ('transfer_to_account_no', 50),
]


def upgrade() -> None:
    # MySQL DDL isn't transactional, so a run that stopped half-way leaves some
    # columns behind — only add what's missing so the migration can be re-run.
    inspector = sa.inspect(op.get_bind())
    for table in _TABLES:
        existing = {c['name'] for c in inspector.get_columns(table)}
        if 'mode_of_payment' not in existing:
            op.add_column(
                table,
                sa.Column('mode_of_payment', sa.String(length=30), nullable=False, server_default='Cash'),
            )
        for name, length in _DETAIL_COLUMNS:
            if name not in existing:
                op.add_column(table, sa.Column(name, sa.String(length=length), nullable=True))


def downgrade() -> None:
    for table in _TABLES:
        for name, _ in reversed(_DETAIL_COLUMNS):
            op.drop_column(table, name)
        op.drop_column(table, 'mode_of_payment')
