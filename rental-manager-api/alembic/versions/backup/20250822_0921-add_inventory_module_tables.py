"""Add inventory module tables

Revision ID: add_inventory_module
Revises: 2f1a99355fd8
Create Date: 2025-08-22 09:21:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_inventory_module'
down_revision: Union[str, None] = '2f1a99355fd8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create SKU sequences table
    op.create_table('sku_sequences',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('brand_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('prefix', sa.String(10), nullable=True),
        sa.Column('suffix', sa.String(10), nullable=True),
        sa.Column('next_sequence', sa.Integer(), nullable=False, default=1),
        sa.Column('padding_length', sa.Integer(), nullable=False, default=4),
        sa.Column('format_template', sa.String(100), nullable=True),
        sa.Column('total_generated', sa.Integer(), nullable=False, default=0),
        sa.Column('last_generated_sku', sa.String(50), nullable=True),
        sa.Column('last_generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('version', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['brand_id'], ['brands.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for SKU sequences
    op.create_index('ix_sku_sequences_brand_category', 'sku_sequences', ['brand_id', 'category_id'], unique=True)
    op.create_index('ix_sku_sequences_is_active', 'sku_sequences', ['is_active'])
    op.create_index('ix_sku_sequences_last_generated_sku', 'sku_sequences', ['last_generated_sku'])
    
    # Create stock levels table
    op.create_table('stock_levels',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('location_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantity_on_hand', sa.Numeric(10, 2), nullable=False, default=0),
        sa.Column('quantity_available', sa.Numeric(10, 2), nullable=False, default=0),
        sa.Column('quantity_reserved', sa.Numeric(10, 2), nullable=False, default=0),
        sa.Column('quantity_on_rent', sa.Numeric(10, 2), nullable=False, default=0),
        sa.Column('quantity_damaged', sa.Numeric(10, 2), nullable=False, default=0),
        sa.Column('quantity_in_maintenance', sa.Numeric(10, 2), nullable=False, default=0),
        sa.Column('reorder_point', sa.Numeric(10, 2), nullable=True),
        sa.Column('reorder_quantity', sa.Numeric(10, 2), nullable=True),
        sa.Column('max_stock_level', sa.Numeric(10, 2), nullable=True),
        sa.Column('last_reorder_date', sa.Date(), nullable=True),
        sa.Column('last_stock_check', sa.DateTime(timezone=True), nullable=True),
        sa.Column('average_daily_usage', sa.Numeric(10, 2), nullable=True),
        sa.Column('days_until_reorder', sa.Integer(), nullable=True),
        sa.Column('is_low_stock', sa.Boolean(), nullable=False, default=False),
        sa.Column('version', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('quantity_on_hand >= 0', name='check_quantity_on_hand_positive'),
        sa.CheckConstraint('quantity_available >= 0', name='check_quantity_available_positive'),
        sa.CheckConstraint('quantity_reserved >= 0', name='check_quantity_reserved_positive'),
        sa.CheckConstraint('quantity_on_rent >= 0', name='check_quantity_on_rent_positive'),
        sa.CheckConstraint('quantity_damaged >= 0', name='check_quantity_damaged_positive'),
        sa.CheckConstraint('quantity_in_maintenance >= 0', name='check_quantity_in_maintenance_positive')
    )
    
    # Create indexes for stock levels
    op.create_index('ix_stock_levels_item_location', 'stock_levels', ['item_id', 'location_id'], unique=True)
    op.create_index('ix_stock_levels_location_id', 'stock_levels', ['location_id'])
    op.create_index('ix_stock_levels_is_low_stock', 'stock_levels', ['is_low_stock'])
    op.create_index('ix_stock_levels_quantity_available', 'stock_levels', ['quantity_available'])
    
    # Create inventory units table
    op.create_table('inventory_units',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('location_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sku', sa.String(50), nullable=False),
        sa.Column('serial_number', sa.String(100), nullable=True),
        sa.Column('batch_code', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, default='AVAILABLE'),
        sa.Column('condition', sa.String(20), nullable=False, default='NEW'),
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('purchase_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('warranty_end_date', sa.Date(), nullable=True),
        sa.Column('last_maintenance_date', sa.Date(), nullable=True),
        sa.Column('next_maintenance_date', sa.Date(), nullable=True),
        sa.Column('maintenance_history', postgresql.JSONB(), nullable=True),
        sa.Column('rental_count', sa.Integer(), nullable=False, default=0),
        sa.Column('total_rental_days', sa.Integer(), nullable=False, default=0),
        sa.Column('last_rental_date', sa.Date(), nullable=True),
        sa.Column('current_customer_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('is_rental_blocked', sa.Boolean(), nullable=False, default=False),
        sa.Column('rental_block_reason', sa.Text(), nullable=True),
        sa.Column('rental_blocked_until', sa.Date(), nullable=True),
        sa.Column('rental_blocked_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('custom_attributes', postgresql.JSONB(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['current_customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['rental_blocked_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('serial_number', name='uq_inventory_units_serial_number'),
        sa.CheckConstraint("status IN ('AVAILABLE', 'ON_RENT', 'IN_MAINTENANCE', 'DAMAGED', 'RESERVED', 'IN_TRANSIT', 'RETIRED', 'LOST')", 
                          name='check_inventory_unit_status'),
        sa.CheckConstraint("condition IN ('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'SCRAP')", 
                          name='check_inventory_unit_condition')
    )
    
    # Create indexes for inventory units
    op.create_index('ix_inventory_units_item_location', 'inventory_units', ['item_id', 'location_id'])
    op.create_index('ix_inventory_units_sku', 'inventory_units', ['sku'])
    op.create_index('ix_inventory_units_serial_number', 'inventory_units', ['serial_number'])
    op.create_index('ix_inventory_units_batch_code', 'inventory_units', ['batch_code'])
    op.create_index('ix_inventory_units_status', 'inventory_units', ['status'])
    op.create_index('ix_inventory_units_condition', 'inventory_units', ['condition'])
    op.create_index('ix_inventory_units_current_customer', 'inventory_units', ['current_customer_id'])
    op.create_index('ix_inventory_units_is_rental_blocked', 'inventory_units', ['is_rental_blocked'])
    op.create_index('ix_inventory_units_warranty_end_date', 'inventory_units', ['warranty_end_date'])
    op.create_index('ix_inventory_units_next_maintenance_date', 'inventory_units', ['next_maintenance_date'])
    
    # Create stock movements table (immutable audit log)
    op.create_table('stock_movements',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('movement_type', sa.String(20), nullable=False),
        sa.Column('item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('location_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('from_location_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('to_location_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('quantity_change', sa.Numeric(10, 2), nullable=False),
        sa.Column('quantity_before', sa.Numeric(10, 2), nullable=False),
        sa.Column('quantity_after', sa.Numeric(10, 2), nullable=False),
        sa.Column('unit_cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('total_cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('inventory_unit_ids', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['from_location_id'], ['locations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['to_location_id'], ['locations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("movement_type IN ('PURCHASE', 'SALE', 'RENTAL_OUT', 'RENTAL_RETURN', 'TRANSFER', 'ADJUSTMENT', 'DAMAGE', 'REPAIR', 'WRITE_OFF', 'FOUND', 'PRODUCTION', 'CONSUMPTION')", 
                          name='check_movement_type')
    )
    
    # Create indexes for stock movements (immutable, so optimize for reads)
    op.create_index('ix_stock_movements_item_id', 'stock_movements', ['item_id'])
    op.create_index('ix_stock_movements_location_id', 'stock_movements', ['location_id'])
    op.create_index('ix_stock_movements_movement_type', 'stock_movements', ['movement_type'])
    op.create_index('ix_stock_movements_transaction_id', 'stock_movements', ['transaction_id'])
    op.create_index('ix_stock_movements_customer_id', 'stock_movements', ['customer_id'])
    op.create_index('ix_stock_movements_supplier_id', 'stock_movements', ['supplier_id'])
    op.create_index('ix_stock_movements_created_at', 'stock_movements', ['created_at'])
    op.create_index('ix_stock_movements_reference', 'stock_movements', ['reference_type', 'reference_id'])
    
    # Create composite indexes for common queries
    op.create_index('ix_stock_movements_item_location_date', 'stock_movements', 
                    ['item_id', 'location_id', 'created_at'])
    op.create_index('ix_inventory_units_available_at_location', 'inventory_units',
                    ['location_id', 'status', 'is_rental_blocked'],
                    postgresql_where=sa.text("status = 'AVAILABLE' AND is_rental_blocked = false"))


def downgrade() -> None:
    # Drop tables in reverse order due to foreign key dependencies
    op.drop_index('ix_inventory_units_available_at_location', 'inventory_units')
    op.drop_index('ix_stock_movements_item_location_date', 'stock_movements')
    
    # Drop stock movements indexes
    op.drop_index('ix_stock_movements_reference', 'stock_movements')
    op.drop_index('ix_stock_movements_created_at', 'stock_movements')
    op.drop_index('ix_stock_movements_supplier_id', 'stock_movements')
    op.drop_index('ix_stock_movements_customer_id', 'stock_movements')
    op.drop_index('ix_stock_movements_transaction_id', 'stock_movements')
    op.drop_index('ix_stock_movements_movement_type', 'stock_movements')
    op.drop_index('ix_stock_movements_location_id', 'stock_movements')
    op.drop_index('ix_stock_movements_item_id', 'stock_movements')
    op.drop_table('stock_movements')
    
    # Drop inventory units indexes
    op.drop_index('ix_inventory_units_next_maintenance_date', 'inventory_units')
    op.drop_index('ix_inventory_units_warranty_end_date', 'inventory_units')
    op.drop_index('ix_inventory_units_is_rental_blocked', 'inventory_units')
    op.drop_index('ix_inventory_units_current_customer', 'inventory_units')
    op.drop_index('ix_inventory_units_condition', 'inventory_units')
    op.drop_index('ix_inventory_units_status', 'inventory_units')
    op.drop_index('ix_inventory_units_batch_code', 'inventory_units')
    op.drop_index('ix_inventory_units_serial_number', 'inventory_units')
    op.drop_index('ix_inventory_units_sku', 'inventory_units')
    op.drop_index('ix_inventory_units_item_location', 'inventory_units')
    op.drop_table('inventory_units')
    
    # Drop stock levels indexes
    op.drop_index('ix_stock_levels_quantity_available', 'stock_levels')
    op.drop_index('ix_stock_levels_is_low_stock', 'stock_levels')
    op.drop_index('ix_stock_levels_location_id', 'stock_levels')
    op.drop_index('ix_stock_levels_item_location', 'stock_levels')
    op.drop_table('stock_levels')
    
    # Drop SKU sequences indexes
    op.drop_index('ix_sku_sequences_last_generated_sku', 'sku_sequences')
    op.drop_index('ix_sku_sequences_is_active', 'sku_sequences')
    op.drop_index('ix_sku_sequences_brand_category', 'sku_sequences')
    op.drop_table('sku_sequences')