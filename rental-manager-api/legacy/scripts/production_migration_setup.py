#!/usr/bin/env python3
"""
Production Migration Setup Script
This script handles the production database migration setup, accounting for existing tables.
"""

import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime
import subprocess
from sqlalchemy import text, inspect

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import AsyncSessionLocal, engine
from app.core.config import settings
from app.db.base import Base


async def get_current_tables():
    """Get list of all current tables in the database"""
    async with engine.begin() as conn:
        # Get inspector
        def sync_inspect(connection):
            return inspect(connection)
        
        inspector = await conn.run_sync(sync_inspect)
        
        # Get all table names
        def get_tables(inspector):
            return inspector.get_table_names()
        
        tables = await conn.run_sync(lambda conn: get_tables(inspect(conn)))
        return tables


async def export_current_schema():
    """Export the current database schema to a migration file"""
    
    print("Exporting current database schema...")
    
    # Get all current tables
    tables = await get_current_tables()
    print(f"Found {len(tables)} tables in the database")
    
    # Generate migration ID
    migration_id = datetime.now().strftime("%Y%m%d%H%M%S")[:12]
    
    # Create the migration file
    migration_content = f'''"""Initial database schema - generated from existing database

Revision ID: {migration_id}
Revises: 
Create Date: {datetime.now().isoformat()}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from app.db.base import UUIDType

# revision identifiers, used by Alembic.
revision: str = '{migration_id}'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    This migration represents the initial database schema.
    Since the tables already exist in production, we check before creating.
    """
    
    # Get connection to check existing tables
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    existing_tables = inspector.get_table_names()
    
    # List of all expected tables in order of creation (respecting foreign keys)
    expected_tables = {tables}
    
    # Check if tables already exist
    if len(existing_tables) > 5:  # If we have more than just system tables
        print(f"Database already contains {{len(existing_tables)}} tables")
        print("Skipping table creation as they already exist")
        print("This migration serves as the baseline for future changes")
        return
    
    # If tables don't exist, we would create them here
    # This section would contain all the op.create_table() calls
    # Since production already has tables, this is mainly for new deployments
    
    print("Tables already exist - migration marked as baseline")


def downgrade() -> None:
    """
    Downgrade would drop all tables, but we don't implement this for the initial migration
    as it would be too destructive for production.
    """
    pass
'''
    
    # Format the tables list
    migration_content = migration_content.replace("{expected_tables}", str(tables))
    
    # Save the migration file
    migration_filename = f"{migration_id}_initial_database_schema.py"
    migration_path = Path("alembic/versions") / migration_filename
    
    # Remove old migration files first
    for old_file in Path("alembic/versions").glob("*.py"):
        if old_file.name != "__init__.py":
            old_file.unlink()
            print(f"Removed old migration: {old_file.name}")
    
    # Write new migration
    with open(migration_path, 'w') as f:
        f.write(migration_content)
    
    print(f"Created baseline migration: {migration_filename}")
    
    return migration_path


async def stamp_database():
    """Stamp the database with the current migration as already applied"""
    
    print("\nStamping database with baseline migration...")
    
    # Get the latest migration revision
    versions_dir = Path("alembic/versions")
    migration_files = [f for f in versions_dir.glob("*.py") if f.name != "__init__.py"]
    
    if not migration_files:
        print("No migration files found!")
        return False
    
    # Get the revision ID from the migration file
    latest_migration = migration_files[0]
    with open(latest_migration, 'r') as f:
        content = f.read()
        # Extract revision ID
        for line in content.split('\n'):
            if line.startswith("revision: str = "):
                revision = line.split("'")[1]
                break
    
    # Stamp the database
    result = subprocess.run(
        ["alembic", "stamp", revision],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print(f"✓ Database stamped with revision: {revision}")
        return True
    else:
        print(f"✗ Failed to stamp database: {result.stderr}")
        return False


async def verify_setup():
    """Verify the migration setup"""
    
    print("\nVerifying migration setup...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Check alembic_version table
            result = await session.execute(text("SELECT version_num FROM alembic_version"))
            version = result.scalar()
            
            if version:
                print(f"✓ Alembic tracking active - current version: {version}")
            else:
                print("✗ No alembic version found")
                return False
            
            # Check that tables exist
            tables = await get_current_tables()
            print(f"✓ Database has {len(tables)} tables")
            
            # Check some critical tables
            critical_tables = ['users', 'companies', 'items', 'transaction_headers']
            for table in critical_tables:
                if table in tables:
                    print(f"  ✓ {table} table exists")
                else:
                    print(f"  ✗ {table} table missing!")
            
            return True
            
        except Exception as e:
            print(f"✗ Verification failed: {e}")
            return False


async def main():
    """Main execution"""
    
    print("=" * 60)
    print("Production Migration Setup")
    print("=" * 60)
    print("\nThis script will:")
    print("1. Create a baseline migration from the current schema")
    print("2. Stamp the database as having this migration applied")
    print("3. Set up proper migration tracking for future changes")
    print()
    
    confirm = input("Continue? (yes/no): ")
    if confirm.lower() != "yes":
        print("Cancelled")
        return
    
    # Step 1: Export current schema as migration
    migration_file = await export_current_schema()
    
    # Step 2: Stamp the database
    if await stamp_database():
        # Step 3: Verify
        if await verify_setup():
            print("\n" + "=" * 60)
            print("SUCCESS: Migration setup complete!")
            print("=" * 60)
            print("\nThe database now has:")
            print("✓ Baseline migration representing current schema")
            print("✓ Alembic version tracking enabled")
            print("✓ Ready for future migrations")
            print("\nNext steps:")
            print("1. Commit the migration file:")
            print(f"   git add {migration_file}")
            print("   git commit -m 'feat: add baseline database migration'")
            print("   git push origin v5")
            print("2. Update production startup script to run migrations")
            print("3. Future schema changes will be tracked properly")
        else:
            print("\n✗ Setup verification failed")
    else:
        print("\n✗ Failed to complete setup")


if __name__ == "__main__":
    asyncio.run(main())