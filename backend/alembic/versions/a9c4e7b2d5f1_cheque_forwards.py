"""cheque_forwards: customer cheques handed on to another party as payment

Revision ID: a9c4e7b2d5f1
Revises: f3a8d2c6b1e4
Create Date: 2026-11-02 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a9c4e7b2d5f1'
down_revision: Union[str, None] = 'f3a8d2c6b1e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cheque_forwards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('forward_no', sa.String(length=30), nullable=False),
        sa.Column('receipt_id', sa.Integer(), nullable=False),
        sa.Column('forward_date', sa.Date(), nullable=False),
        sa.Column('party_name', sa.String(length=150), nullable=False),
        sa.Column('party_contact', sa.String(length=100), nullable=True),
        sa.Column('debit_account_id', sa.Integer(), nullable=False),
        sa.Column('voucher_id', sa.Integer(), nullable=True),
        sa.Column(
            'status',
            sa.Enum('FORWARDED', 'CLEARED', 'BOUNCED', name='chequeforwardstatus'),
            nullable=False,
        ),
        sa.Column('status_date', sa.Date(), nullable=True),
        sa.Column('narration', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['receipt_id'], ['receipts.id']),
        sa.ForeignKeyConstraint(['debit_account_id'], ['accounts.id']),
        sa.ForeignKeyConstraint(['voucher_id'], ['vouchers.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('forward_no'),
    )


def downgrade() -> None:
    op.drop_table('cheque_forwards')
