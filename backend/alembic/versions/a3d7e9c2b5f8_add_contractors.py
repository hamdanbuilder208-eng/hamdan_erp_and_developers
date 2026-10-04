"""contractors: agreements, bills and payments

Revision ID: a3d7e9c2b5f8
Revises: f2c6a8e1b9d4
Create Date: 2026-10-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3d7e9c2b5f8'
down_revision: Union[str, None] = 'f2c6a8e1b9d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _timestamps():
    return [
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        'contractors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contractor_code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('cnic', sa.String(length=20), nullable=False),
        sa.Column('ntn', sa.String(length=30), nullable=True),
        sa.Column('trade', sa.String(length=80), nullable=False),
        sa.Column('phone', sa.String(length=30), nullable=True),
        sa.Column('bank_name', sa.String(length=100), nullable=True),
        sa.Column('account_iban', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        *_timestamps(),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contractor_code'),
    )
    op.create_table(
        'contract_agreements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('agreement_no', sa.String(length=30), nullable=False),
        sa.Column('agreement_date', sa.Date(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('contractor_id', sa.Integer(), nullable=False),
        sa.Column('scope_title', sa.String(length=200), nullable=False),
        sa.Column('work_type', sa.String(length=80), nullable=False),
        sa.Column('floors_scope', sa.String(length=150), nullable=True),
        sa.Column(
            'basis',
            sa.Enum('LUMP_SUM', 'PER_SQ_FT', 'PER_SQ_YD', 'PER_FLOOR', 'ITEM_RATE', name='contractbasis'),
            nullable=False,
        ),
        sa.Column('quantity', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('rate', sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column('contract_amount', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('retention_percent', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('wht_percent', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column(
            'status', sa.Enum('ACTIVE', 'COMPLETED', 'CANCELLED', name='contractstatus'), nullable=False
        ),
        sa.Column('remarks', sa.Text(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.ForeignKeyConstraint(['contractor_id'], ['contractors.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('agreement_no'),
    )
    op.create_table(
        'contractor_bills',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('bill_no', sa.String(length=30), nullable=False),
        sa.Column('agreement_id', sa.Integer(), nullable=False),
        sa.Column('bill_date', sa.Date(), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('work_quantity', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('gross_amount', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('retention_amount', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('wht_amount', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('net_amount', sa.Numeric(precision=18, scale=2), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(['agreement_id'], ['contract_agreements.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('bill_no'),
    )
    op.create_table(
        'contractor_payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payment_no', sa.String(length=30), nullable=False),
        sa.Column('agreement_id', sa.Integer(), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=False),
        sa.Column(
            'purpose',
            sa.Enum('ADVANCE', 'BILL_PAYMENT', 'RETENTION_RELEASE', name='contractorpaymentpurpose'),
            nullable=False,
        ),
        sa.Column('amount', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('credit_account_id', sa.Integer(), nullable=False),
        sa.Column('voucher_id', sa.Integer(), nullable=True),
        sa.Column('narration', sa.Text(), nullable=True),
        sa.Column('mode_of_payment', sa.String(length=30), nullable=False, server_default='Cash'),
        sa.Column('cheque_no', sa.String(length=50), nullable=True),
        sa.Column('cheque_bank_name', sa.String(length=100), nullable=True),
        sa.Column('transfer_bank_name', sa.String(length=100), nullable=True),
        sa.Column('transfer_account_title', sa.String(length=150), nullable=True),
        sa.Column('transfer_account_no', sa.String(length=50), nullable=True),
        sa.Column('transfer_ref_no', sa.String(length=80), nullable=True),
        sa.Column('transfer_to_account_title', sa.String(length=150), nullable=True),
        sa.Column('transfer_to_account_no', sa.String(length=50), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(['agreement_id'], ['contract_agreements.id']),
        sa.ForeignKeyConstraint(['credit_account_id'], ['accounts.id']),
        sa.ForeignKeyConstraint(['voucher_id'], ['vouchers.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('payment_no'),
    )


def downgrade() -> None:
    op.drop_table('contractor_payments')
    op.drop_table('contractor_bills')
    op.drop_table('contract_agreements')
    op.drop_table('contractors')
