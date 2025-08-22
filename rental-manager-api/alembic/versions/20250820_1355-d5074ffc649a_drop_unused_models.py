"""drop_unused_models

Revision ID: d5074ffc649a
Revises: 
Create Date: 2025-08-20 13:55:44.342428

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5074ffc649a'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop tables in order to respect foreign key dependencies (if they exist)
    # First drop tables that reference other tables
    try:
        op.drop_table('maintenance_requests')
    except:
        pass
    try:
        op.drop_table('payments')
    except:
        pass
    try:
        op.drop_table('leases')
    except:
        pass
    
    # Then drop tables that are referenced by others
    try:
        op.drop_table('tenants')
    except:
        pass
    try:
        op.drop_table('properties')
    except:
        pass


def downgrade() -> None:
    # This migration is not reversible as we're removing models from code
    # If needed, would require recreating all deleted model files
    pass