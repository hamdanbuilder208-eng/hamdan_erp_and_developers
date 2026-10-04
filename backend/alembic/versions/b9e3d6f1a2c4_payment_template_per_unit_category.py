"""payment plan template per unit category

Revision ID: b9e3d6f1a2c4
Revises: a7c4e2f9d1b6
Create Date: 2026-10-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9e3d6f1a2c4'
down_revision: Union[str, None] = 'a7c4e2f9d1b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing templates stay as each project's default plan (NULL category).
    op.add_column(
        'project_payment_templates',
        sa.Column('unit_category_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_payment_template_unit_category',
        'project_payment_templates', 'unit_categories',
        ['unit_category_id'], ['id'],
    )
    # Create the composite key first: MySQL needs an index starting with
    # project_id for its foreign key before the old unique one can go.
    op.create_unique_constraint(
        'uq_payment_template_project_category',
        'project_payment_templates',
        ['project_id', 'unit_category_id'],
    )
    # MySQL names a single-column unique index after its column.
    op.drop_constraint('project_id', 'project_payment_templates', type_='unique')


def downgrade() -> None:
    # Keep only each project's default plan so project_id can be unique again.
    op.execute(
        "DELETE FROM project_payment_template_lines WHERE template_id IN "
        "(SELECT id FROM project_payment_templates WHERE unit_category_id IS NOT NULL)"
    )
    op.execute("DELETE FROM project_payment_templates WHERE unit_category_id IS NOT NULL")
    op.create_unique_constraint('project_id', 'project_payment_templates', ['project_id'])
    op.drop_constraint(
        'fk_payment_template_unit_category', 'project_payment_templates', type_='foreignkey'
    )
    op.drop_constraint(
        'uq_payment_template_project_category', 'project_payment_templates', type_='unique'
    )
    op.drop_column('project_payment_templates', 'unit_category_id')
