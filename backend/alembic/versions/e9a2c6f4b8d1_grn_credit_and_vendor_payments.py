"""GRN on credit: amount paid on receipt, due date, later vendor payments

Revision ID: e9a2c6f4b8d1
Revises: d7f3b9e1a4c8
Create Date: 2026-11-03 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e9a2c6f4b8d1'
down_revision: Union[str, None] = 'd7f3b9e1a4c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'grns', sa.Column('amount_paid_now', sa.Numeric(18, 2), server_default='0', nullable=False)
    )
    op.add_column('grns', sa.Column('payment_due_date', sa.Date(), nullable=True))
    # Every GRN before this was paid in full on receipt.
    op.execute("UPDATE grns SET amount_paid_now = total_amount")
    op.alter_column('grns', 'payment_account_id', existing_type=sa.Integer(), nullable=True)

    op.create_table(
        'grn_payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payment_no', sa.String(length=30), nullable=False),
        sa.Column('grn_id', sa.Integer(), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('payment_account_id', sa.Integer(), nullable=False),
        sa.Column('voucher_id', sa.Integer(), nullable=True),
        sa.Column('narration', sa.Text(), nullable=True),
        sa.Column('mode_of_payment', sa.String(length=30), server_default='Cash', nullable=False),
        sa.Column('cheque_no', sa.String(length=50), nullable=True),
        sa.Column('cheque_bank_name', sa.String(length=100), nullable=True),
        sa.Column('transfer_bank_name', sa.String(length=100), nullable=True),
        sa.Column('transfer_account_title', sa.String(length=150), nullable=True),
        sa.Column('transfer_account_no', sa.String(length=50), nullable=True),
        sa.Column('transfer_ref_no', sa.String(length=80), nullable=True),
        sa.Column('transfer_to_account_title', sa.String(length=150), nullable=True),
        sa.Column('transfer_to_account_no', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['grn_id'], ['grns.id']),
        sa.ForeignKeyConstraint(['payment_account_id'], ['accounts.id']),
        sa.ForeignKeyConstraint(['voucher_id'], ['vouchers.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('payment_no'),
    )


def downgrade() -> None:
    op.drop_table('grn_payments')
    op.alter_column('grns', 'payment_account_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('grns', 'payment_due_date')
    op.drop_column('grns', 'amount_paid_now')
