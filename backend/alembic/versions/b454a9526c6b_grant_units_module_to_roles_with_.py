"""grant units module to roles with projects

Revision ID: b454a9526c6b
Revises: 5b2e33fe933e
Create Date: 2026-09-17 11:35:28.821692

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b454a9526c6b'
down_revision: Union[str, None] = '5b2e33fe933e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Units used to live under the "projects" module key; now it's its own
    # key (see app/core/modules.py). Any role already granted "projects"
    # keeps unit access after the split instead of losing it silently.
    op.execute(
        """
        INSERT IGNORE INTO role_module_permissions (role_id, module_key, created_at, updated_at)
        SELECT role_id, 'units', NOW(), NOW()
        FROM role_module_permissions
        WHERE module_key = 'projects'
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM role_module_permissions WHERE module_key = 'units'")
