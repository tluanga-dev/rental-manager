#!/usr/bin/env python3
"""
Production Database Reset with Alembic Migration Setup
WARNING: This script will RESET the production database and set up proper migration tracking!

This script:
1. Backs up current schema structure
2. Drops all tables including alembic_version
3. Creates initial Alembic migration from models
4. Applies migration to create all tables
5. Initializes admin user, RBAC, and system settings
6. Optionally seeds master data

Usage:
    python reset_and_migrate_production.py --production-reset
    python reset_and_migrate_production.py --dry-run
    python reset_and_migrate_production.py --help
"""

import asyncio
import os
import sys
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
import json
from sqlalchemy import text, inspect, MetaData
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import redis.asyncio as redis

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import AsyncSessionLocal, engine
from app.core.config import settings
from app.db.base import Base

# ANSI color codes
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_step(message: str, level: str = "INFO"):
    """Print formatted step message"""
    color = Colors.BLUE if level == "INFO" else Colors.WARNING if level == "WARNING" else Colors.FAIL
    print(f"{color}[{level}]{Colors.ENDC} {message}")


def print_success(message: str):
    """Print success message"""
    print(f"{Colors.GREEN}✓{Colors.ENDC} {message}")


def print_error(message: str):
    """Print error message"""
    print(f"{Colors.FAIL}✗{Colors.ENDC} {message}")


async def backup_schema_structure(session: AsyncSession) -> Dict:
    """Backup current database schema structure"""
    print_step("Backing up current schema structure...")
    
    try:
        # Get all table names
        result = await session.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """))
        
        tables = [row[0] for row in result]
        
        schema_backup = {
            "timestamp": datetime.now().isoformat(),
            "tables": tables,
            "table_count": len(tables)
        }
        
        # Save backup to file
        backup_file = f"schema_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(backup_file, 'w') as f:
            json.dump(schema_backup, f, indent=2)
        
        print_success(f"Schema backup saved to {backup_file} ({len(tables)} tables)")
        return schema_backup
        
    except Exception as e:
        print_error(f"Failed to backup schema: {e}")
        return {}


async def drop_all_tables(session: AsyncSession, dry_run: bool = False) -> None:
    """Drop all tables including alembic_version"""
    print_step("Dropping all database tables...")
    
    try:
        # Get all table names
        result = await session.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """))
        
        tables = [row[0] for row in result]
        
        if not tables:
            print_step("No tables found to drop", "WARNING")
            return
        
        print(f"Found {len(tables)} tables to drop")
        
        if not dry_run:
            # Disable foreign key checks and drop all tables
            await session.execute(text("SET session_replication_role = 'replica';"))
            
            for table in tables:
                print(f"  Dropping table: {table}")
                await session.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
            
            await session.execute(text("SET session_replication_role = 'origin';"))
            await session.commit()
            
            print_success(f"Dropped {len(tables)} tables")
        else:
            print_step("DRY RUN - Would drop the following tables:", "WARNING")
            for table in tables:
                print(f"  - {table}")
    
    except Exception as e:
        print_error(f"Failed to drop tables: {e}")
        raise


async def clear_redis_cache() -> None:
    """Clear all Redis cache"""
    print_step("Clearing Redis cache...")
    
    try:
        if settings.REDIS_URL:
            redis_client = await redis.from_url(settings.REDIS_URL)
            await redis_client.flushall()
            await redis_client.close()
            print_success("Redis cache cleared")
        else:
            print_step("Redis URL not configured, skipping", "WARNING")
    except Exception as e:
        print_error(f"Failed to clear Redis cache: {e}")


def create_initial_migration() -> bool:
    """Create initial Alembic migration from current models"""
    print_step("Creating initial Alembic migration...")
    
    try:
        # Remove any existing migration files
        versions_dir = Path("alembic/versions")
        for file in versions_dir.glob("*.py"):
            if file.name != "__init__.py":
                file.unlink()
                print(f"  Removed old migration: {file.name}")
        
        # Generate new migration
        result = subprocess.run(
            ["alembic", "revision", "--autogenerate", "-m", "Initial complete schema"],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print_error(f"Failed to create migration: {result.stderr}")
            return False
        
        print_success("Initial migration created successfully")
        return True
        
    except Exception as e:
        print_error(f"Failed to create migration: {e}")
        return False


def apply_migrations() -> bool:
    """Apply all Alembic migrations"""
    print_step("Applying Alembic migrations...")
    
    try:
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print_error(f"Failed to apply migrations: {result.stderr}")
            return False
        
        print_success("Migrations applied successfully")
        return True
        
    except Exception as e:
        print_error(f"Failed to apply migrations: {e}")
        return False


def initialize_production_data() -> bool:
    """Initialize admin user, RBAC, and system settings"""
    print_step("Initializing production data...")
    
    scripts = [
        ("scripts/create_admin.py", "Creating admin user"),
        ("scripts/seed_rbac.py", "Setting up RBAC permissions"),
        ("scripts/init_system_settings.py", "Initializing system settings")
    ]
    
    for script, description in scripts:
        print(f"  {description}...")
        result = subprocess.run(
            ["python", script],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print_error(f"Failed: {result.stderr}")
            return False
    
    print_success("Production data initialized")
    return True


def seed_master_data() -> bool:
    """Seed master data (categories, brands, units, etc.)"""
    print_step("Seeding master data...")
    
    try:
        result = subprocess.run(
            ["python", "scripts/seed_all_data.py"],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print_error(f"Failed to seed master data: {result.stderr}")
            return False
        
        print_success("Master data seeded successfully")
        return True
        
    except Exception as e:
        print_error(f"Failed to seed master data: {e}")
        return False


async def verify_setup(session: AsyncSession) -> bool:
    """Verify the database setup is correct"""
    print_step("Verifying database setup...")
    
    checks = [
        ("SELECT COUNT(*) FROM alembic_version", "Alembic version tracking"),
        ("SELECT COUNT(*) FROM users WHERE username = 'admin'", "Admin user"),
        ("SELECT COUNT(*) FROM permissions", "RBAC permissions"),
        ("SELECT COUNT(*) FROM system_settings", "System settings")
    ]
    
    all_passed = True
    
    for query, description in checks:
        try:
            result = await session.execute(text(query))
            count = result.scalar()
            
            if count and count > 0:
                print_success(f"{description}: {count} records")
            else:
                print_error(f"{description}: No records found")
                all_passed = False
                
        except Exception as e:
            print_error(f"{description}: Failed - {e}")
            all_passed = False
    
    return all_passed


async def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--production-reset', action='store_true', help='Confirm production database reset')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--seed-master-data', action='store_true', help='Seed master data after reset')
    parser.add_argument('--skip-backup', action='store_true', help='Skip schema backup')
    
    args = parser.parse_args()
    
    if not args.production_reset and not args.dry_run:
        print_error("You must specify either --production-reset or --dry-run")
        parser.print_help()
        sys.exit(1)
    
    # Show warning
    print(f"\n{Colors.WARNING}{'='*60}")
    print("WARNING: PRODUCTION DATABASE RESET")
    print("This will DELETE ALL DATA and recreate the schema!")
    print(f"Database: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'configured database'}")
    print(f"{'='*60}{Colors.ENDC}\n")
    
    if not args.dry_run:
        confirm = input("Type 'RESET PRODUCTION' to confirm: ")
        if confirm != "RESET PRODUCTION":
            print_error("Reset cancelled")
            sys.exit(1)
    
    async with AsyncSessionLocal() as session:
        try:
            # Step 1: Backup schema
            if not args.skip_backup:
                await backup_schema_structure(session)
            
            # Step 2: Drop all tables
            await drop_all_tables(session, args.dry_run)
            
            if not args.dry_run:
                # Step 3: Clear Redis
                await clear_redis_cache()
                
                # Step 4: Create initial migration
                if not create_initial_migration():
                    print_error("Failed to create migration")
                    sys.exit(1)
                
                # Step 5: Apply migrations
                if not apply_migrations():
                    print_error("Failed to apply migrations")
                    sys.exit(1)
                
                # Step 6: Initialize production data
                if not initialize_production_data():
                    print_error("Failed to initialize production data")
                    sys.exit(1)
                
                # Step 7: Optionally seed master data
                if args.seed_master_data:
                    seed_master_data()
                
                # Step 8: Verify setup
                if await verify_setup(session):
                    print(f"\n{Colors.GREEN}{'='*60}")
                    print("SUCCESS: Production database reset complete!")
                    print("- All tables created via Alembic migration")
                    print("- Admin user created")
                    print("- RBAC permissions initialized")
                    print("- System settings configured")
                    if args.seed_master_data:
                        print("- Master data seeded")
                    print(f"{'='*60}{Colors.ENDC}\n")
                else:
                    print_error("Verification failed - please check the setup")
                    sys.exit(1)
            else:
                print(f"\n{Colors.CYAN}DRY RUN COMPLETE - No changes made{Colors.ENDC}\n")
        
        except Exception as e:
            print_error(f"Reset failed: {e}")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())