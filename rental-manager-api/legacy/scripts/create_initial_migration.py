#!/usr/bin/env python3
"""
Create Initial Alembic Migration from SQLAlchemy Models
This script generates a complete initial migration capturing all tables from the models.
"""

import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime
import subprocess
from sqlalchemy import text, MetaData

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import AsyncSessionLocal, engine
from app.core.config import settings
from app.db.base import Base


async def prepare_for_migration():
    """Prepare database for initial migration generation"""
    
    print("Preparing for initial migration generation...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if alembic_version exists and clear it
            result = await session.execute(text("SELECT * FROM alembic_version"))
            rows = result.fetchall()
            if rows:
                print(f"Found {len(rows)} alembic version entries, clearing...")
                await session.execute(text("DELETE FROM alembic_version"))
                await session.commit()
                print("Cleared alembic_version table")
        except Exception as e:
            if "relation \"alembic_version\" does not exist" in str(e):
                print("No alembic_version table found - good for initial migration")
            else:
                print(f"Error checking alembic_version: {e}")
    
    # Clean up old migration files
    versions_dir = Path("alembic/versions")
    migration_files = list(versions_dir.glob("*.py"))
    migration_files = [f for f in migration_files if f.name != "__init__.py"]
    
    if migration_files:
        print(f"Found {len(migration_files)} old migration files")
        for file in migration_files:
            file.unlink()
            print(f"  Removed: {file.name}")
    else:
        print("No old migration files to remove")


def create_migration():
    """Create the initial migration"""
    
    print("\nGenerating initial migration from models...")
    
    # First, let's stamp the database as having no migrations
    print("Stamping database to base (no migrations)...")
    result = subprocess.run(
        ["alembic", "stamp", "base"],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0 and "relation \"alembic_version\" does not exist" not in result.stderr:
        print(f"Warning during stamp: {result.stderr}")
    
    # Now generate the migration
    print("Generating migration...")
    result = subprocess.run(
        ["alembic", "revision", "--autogenerate", "-m", "Initial complete database schema"],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"Error generating migration: {result.stderr}")
        return None
    
    # Extract the migration file name from output
    output_lines = result.stdout.split('\n')
    for line in output_lines:
        if "Generating" in line and ".py" in line:
            # Extract the file path
            parts = line.split()
            for part in parts:
                if ".py" in part:
                    migration_file = Path(part.replace("...", "").strip())
                    if migration_file.exists():
                        print(f"Created migration: {migration_file.name}")
                        return migration_file
    
    # Fallback: find the newest migration file
    versions_dir = Path("alembic/versions")
    migration_files = list(versions_dir.glob("*_initial_complete_database_schema.py"))
    if migration_files:
        newest = max(migration_files, key=lambda f: f.stat().st_mtime)
        print(f"Created migration: {newest.name}")
        return newest
    
    print("Could not find generated migration file")
    return None


async def verify_migration(migration_file):
    """Verify the generated migration"""
    
    if not migration_file:
        return False
    
    print(f"\nVerifying migration file: {migration_file.name}")
    
    # Read the migration file
    with open(migration_file, 'r') as f:
        content = f.read()
    
    # Check if it's creating tables (not just dropping columns)
    has_create_table = "op.create_table" in content
    has_drop_column = "op.drop_column" in content
    
    if has_create_table:
        print("✓ Migration contains table creation statements")
    else:
        print("⚠ Migration does not contain table creation statements")
    
    if has_drop_column and not has_create_table:
        print("⚠ Migration only contains column drops - this suggests tables already exist")
        print("  You may need to drop all tables first for a clean initial migration")
        return False
    
    # Count the number of tables being created
    create_count = content.count("op.create_table")
    print(f"✓ Migration will create {create_count} tables")
    
    return True


async def main():
    """Main execution"""
    
    print("=" * 60)
    print("Creating Initial Alembic Migration")
    print("=" * 60)
    
    # Step 1: Prepare
    await prepare_for_migration()
    
    # Step 2: Create migration
    migration_file = create_migration()
    
    # Step 3: Verify
    if await verify_migration(migration_file):
        print("\n" + "=" * 60)
        print("SUCCESS: Initial migration created successfully!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Review the migration file:")
        print(f"   cat {migration_file}")
        print("2. If the migration looks correct, apply it:")
        print("   alembic upgrade head")
        print("3. Commit the migration to git:")
        print("   git add alembic/versions/*.py")
        print("   git commit -m 'feat: add initial database migration'")
        print("   git push origin v5")
    else:
        print("\n" + "=" * 60)
        print("WARNING: Migration may not be complete")
        print("=" * 60)
        print("\nThe generated migration might only contain partial changes.")
        print("For a clean initial migration, you may need to:")
        print("1. Drop all existing tables")
        print("2. Run this script again")
        print("3. Or manually create the migration file")


if __name__ == "__main__":
    asyncio.run(main())