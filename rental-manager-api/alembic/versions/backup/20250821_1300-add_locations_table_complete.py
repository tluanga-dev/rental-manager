"""Add locations table with spatial indexes and hierarchy support

Revision ID: add_locations_complete
Revises: 039eaa19ce66
Create Date: 2025-08-21 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_locations_complete'
down_revision: Union[str, None] = '039eaa19ce66'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create locations table with comprehensive indexing and constraints."""
    
    # Create LocationType enum
    location_type_enum = postgresql.ENUM(
        'STORE', 'WAREHOUSE', 'SERVICE_CENTER', 'DISTRIBUTION_CENTER', 'OFFICE',
        name='locationtype',
        create_type=False
    )
    location_type_enum.create(op.get_bind(), checkfirst=True)
    
    # Create locations table
    op.create_table(
        'locations',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), 
                 server_default=sa.text('gen_random_uuid()'), 
                 nullable=False, primary_key=True),
        
        # Core fields
        sa.Column('location_code', sa.String(20), nullable=False, unique=True, 
                 comment='Unique location code'),
        sa.Column('location_name', sa.String(100), nullable=False, 
                 comment='Location name'),
        sa.Column('location_type', location_type_enum, nullable=False, 
                 comment='Location type'),
        
        # Address fields
        sa.Column('address', sa.Text(), nullable=True, comment='Street address'),
        sa.Column('city', sa.String(100), nullable=True, comment='City'),
        sa.Column('state', sa.String(100), nullable=True, comment='State/Province'),
        sa.Column('country', sa.String(100), nullable=True, comment='Country'),
        sa.Column('postal_code', sa.String(20), nullable=True, comment='Postal/ZIP code'),
        
        # Contact fields
        sa.Column('contact_number', sa.String(30), nullable=True, comment='Phone number'),
        sa.Column('email', sa.String(255), nullable=True, comment='Email address'),
        sa.Column('website', sa.String(255), nullable=True, comment='Website URL'),
        
        # Geographic fields
        sa.Column('latitude', sa.Numeric(10, 8), nullable=True, 
                 comment='Latitude coordinate'),
        sa.Column('longitude', sa.Numeric(11, 8), nullable=True, 
                 comment='Longitude coordinate'),
        sa.Column('timezone', sa.String(50), nullable=False, default='UTC', 
                 comment='Timezone identifier'),
        
        # Operational fields
        sa.Column('operating_hours', sa.JSON(), nullable=True, 
                 comment='Operating hours in JSON format'),
        sa.Column('capacity', sa.Integer(), nullable=True, 
                 comment='Storage/operational capacity'),
        sa.Column('is_default', sa.Boolean(), nullable=False, default=False, 
                 comment='Default location flag'),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True, 
                 comment='Active status'),
        
        # Hierarchical fields
        sa.Column('parent_location_id', postgresql.UUID(as_uuid=True), 
                 sa.ForeignKey('locations.id', ondelete='SET NULL'), nullable=True,
                 comment='Parent location ID for hierarchy'),
        
        # Management fields
        sa.Column('manager_user_id', postgresql.UUID(as_uuid=True), 
                 sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True,
                 comment='Manager user ID'),
        
        # Flexible metadata
        sa.Column('metadata', sa.JSON(), nullable=True, 
                 comment='Additional metadata in JSON format'),
        
        # Audit fields
        sa.Column('created_at', sa.DateTime(timezone=True), 
                 server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), 
                 server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
    )
    
    # Add table constraints
    op.create_check_constraint(
        'check_capacity_positive',
        'locations',
        'capacity >= 0'
    )
    
    op.create_check_constraint(
        'check_location_type_valid',
        'locations',
        "location_type IN ('STORE', 'WAREHOUSE', 'SERVICE_CENTER', 'DISTRIBUTION_CENTER', 'OFFICE')"
    )
    
    # Create indexes for performance optimization
    
    # Basic indexes
    op.create_index('idx_location_code', 'locations', ['location_code'], unique=True)
    op.create_index('idx_location_name', 'locations', ['location_name'])
    op.create_index('idx_location_type', 'locations', ['location_type'])
    op.create_index('idx_location_active', 'locations', ['is_active'])
    op.create_index('idx_location_default', 'locations', ['is_default'])
    
    # Geographic indexes
    op.create_index('idx_location_city', 'locations', ['city'])
    op.create_index('idx_location_state', 'locations', ['state'])
    op.create_index('idx_location_country', 'locations', ['country'])
    op.create_index('idx_location_city_state', 'locations', ['city', 'state'])
    
    # Spatial/coordinate indexes for geospatial queries
    op.create_index('idx_location_coordinates', 'locations', ['latitude', 'longitude'])
    op.create_index('idx_location_latitude', 'locations', ['latitude'])
    op.create_index('idx_location_longitude', 'locations', ['longitude'])
    
    # Hierarchical indexes
    op.create_index('idx_location_parent', 'locations', ['parent_location_id'])
    op.create_index('idx_location_manager', 'locations', ['manager_user_id'])
    
    # Composite indexes for common queries
    op.create_index('idx_location_type_active', 'locations', ['location_type', 'is_active'])
    op.create_index('idx_location_city_active', 'locations', ['city', 'is_active'])
    op.create_index('idx_location_state_active', 'locations', ['state', 'is_active'])
    op.create_index('idx_location_country_active', 'locations', ['country', 'is_active'])
    op.create_index('idx_location_parent_active', 'locations', ['parent_location_id', 'is_active'])
    
    # Performance indexes for search operations
    op.create_index('idx_location_search_name', 'locations', ['location_name', 'location_code'])
    op.create_index('idx_location_search_address', 'locations', ['city', 'state', 'country'])
    
    # Audit and timestamp indexes
    op.create_index('idx_location_created_at', 'locations', ['created_at'])
    op.create_index('idx_location_updated_at', 'locations', ['updated_at'])
    
    # Specialized indexes for location analytics
    op.create_index('idx_location_capacity', 'locations', ['capacity'])
    op.create_index('idx_location_coordinates_active', 'locations', ['latitude', 'longitude', 'is_active'])
    
    # Add a partial index for locations with coordinates (useful for geospatial queries)
    op.execute("""
        CREATE INDEX idx_location_has_coordinates 
        ON locations (id) 
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    """)
    
    # Add a partial index for active locations only (most common query pattern)
    op.execute("""
        CREATE INDEX idx_location_active_only 
        ON locations (location_type, city, state, country) 
        WHERE is_active = true
    """)
    
    # Create a GIN index for JSON metadata using jsonb_path_ops operator class
    op.execute("""
        CREATE INDEX idx_location_metadata_gin 
        ON locations USING GIN ((metadata::jsonb) jsonb_path_ops) 
        WHERE metadata IS NOT NULL
    """)


def downgrade() -> None:
    """Drop locations table and related constraints."""
    
    # Drop all indexes first
    op.drop_index('idx_location_metadata_gin', table_name='locations')
    op.drop_index('idx_location_active_only', table_name='locations')
    op.drop_index('idx_location_has_coordinates', table_name='locations')
    
    op.drop_index('idx_location_updated_at', table_name='locations')
    op.drop_index('idx_location_created_at', table_name='locations')
    op.drop_index('idx_location_search_address', table_name='locations')
    op.drop_index('idx_location_search_name', table_name='locations')
    op.drop_index('idx_location_parent_active', table_name='locations')
    op.drop_index('idx_location_country_active', table_name='locations')
    op.drop_index('idx_location_state_active', table_name='locations')
    op.drop_index('idx_location_city_active', table_name='locations')
    op.drop_index('idx_location_type_active', table_name='locations')
    op.drop_index('idx_location_manager', table_name='locations')
    op.drop_index('idx_location_parent', table_name='locations')
    op.drop_index('idx_location_longitude', table_name='locations')
    op.drop_index('idx_location_latitude', table_name='locations')
    op.drop_index('idx_location_coordinates', table_name='locations')
    op.drop_index('idx_location_city_state', table_name='locations')
    op.drop_index('idx_location_country', table_name='locations')
    op.drop_index('idx_location_state', table_name='locations')
    op.drop_index('idx_location_city', table_name='locations')
    op.drop_index('idx_location_default', table_name='locations')
    op.drop_index('idx_location_active', table_name='locations')
    op.drop_index('idx_location_type', table_name='locations')
    op.drop_index('idx_location_name', table_name='locations')
    op.drop_index('idx_location_code', table_name='locations')
    op.drop_index('idx_location_capacity', table_name='locations')
    op.drop_index('idx_location_coordinates_active', table_name='locations')
    
    # Drop table
    op.drop_table('locations')
    
    # Drop enum type
    op.execute('DROP TYPE IF EXISTS locationtype')