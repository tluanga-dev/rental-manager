"""Remove item pricing and warranty fields

Revision ID: remove_item_pricing_fields
Revises: a1b2c3d4e5f6
Create Date: 2025-08-30 19:12:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'remove_item_pricing_fields'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Remove sale_price, rental_rate_per_day, security_deposit, and warranty_expiry_date columns from items table.
    Keep model_number as it will be added back as an optional field."""
    
    # Drop columns from items table (excluding model_number)
    op.drop_column('items', 'sale_price')
    op.drop_column('items', 'rental_rate_per_day')
    op.drop_column('items', 'security_deposit')
    op.drop_column('items', 'warranty_expiry_date')
    
    # Add model_number column as optional field
    op.add_column('items', sa.Column('model_number', sa.String(100), nullable=True))
    
    # Drop any indexes that might reference these columns
    try:
        op.drop_index('idx_item_sale_price', table_name='items')
    except:
        pass  # Index might not exist
    
    try:
        op.drop_index('idx_item_rental_rate', table_name='items')
    except:
        pass  # Index might not exist


def downgrade() -> None:
    """Restore the removed columns."""
    
    # Re-add columns to items table
    op.add_column('items', sa.Column('sale_price', sa.Numeric(precision=15, scale=2), nullable=True))
    op.add_column('items', sa.Column('rental_rate_per_day', sa.Numeric(precision=15, scale=2), nullable=True))
    op.add_column('items', sa.Column('security_deposit', sa.Numeric(precision=15, scale=2), nullable=True))
    op.add_column('items', sa.Column('warranty_expiry_date', sa.DateTime(timezone=True), nullable=True))
    
    # Re-create indexes
    op.create_index('idx_item_sale_price', 'items', ['sale_price'])
    op.create_index('idx_item_rental_rate', 'items', ['rental_rate_per_day'])