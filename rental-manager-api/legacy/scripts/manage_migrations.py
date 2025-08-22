#!/usr/bin/env python3
"""
Centralized migration management utility
Provides high-level migration operations for development and production
"""

import os
import sys
import asyncio
import subprocess
import argparse
import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Tuple
import re

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings


class MigrationManager:
    """Manages Alembic migrations with safety features"""
    
    def __init__(self):
        self.alembic_dir = Path("alembic")
        self.versions_dir = self.alembic_dir / "versions"
        self.backup_dir = Path("backups/migrations")
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.database_url = settings.DATABASE_URL
        
    async def get_current_revision(self) -> Optional[str]:
        """Get current database revision"""
        engine = create_async_engine(self.database_url)
        try:
            async with engine.connect() as conn:
                result = await conn.execute(
                    text("SELECT version_num FROM alembic_version LIMIT 1")
                )
                version = result.scalar()
                return version
        except Exception:
            return None
        finally:
            await engine.dispose()
    
    async def check_migration_status(self) -> Dict:
        """Check comprehensive migration status"""
        status = {
            "database_connected": False,
            "migration_table_exists": False,
            "current_revision": None,
            "head_revision": None,
            "pending_migrations": [],
            "migration_files": [],
            "is_up_to_date": False
        }
        
        # Check database connection
        engine = create_async_engine(self.database_url)
        try:
            async with engine.connect() as conn:
                status["database_connected"] = True
                
                # Check if alembic_version table exists
                result = await conn.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'alembic_version'
                    );
                """))
                status["migration_table_exists"] = result.scalar()
                
                # Get current revision
                if status["migration_table_exists"]:
                    result = await conn.execute(
                        text("SELECT version_num FROM alembic_version LIMIT 1")
                    )
                    status["current_revision"] = result.scalar()
        except Exception as e:
            status["error"] = str(e)
        finally:
            await engine.dispose()
        
        # Get head revision
        try:
            result = subprocess.run(
                ["alembic", "heads"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                if lines and lines[0]:
                    status["head_revision"] = lines[0].split()[0]
        except Exception as e:
            status["head_error"] = str(e)
        
        # Get migration files
        if self.versions_dir.exists():
            status["migration_files"] = [
                f.name for f in self.versions_dir.glob("*.py")
                if not f.name.startswith("__")
            ]
        
        # Check if up to date
        if status["current_revision"] and status["head_revision"]:
            status["is_up_to_date"] = status["current_revision"] == status["head_revision"]
        
        # Get pending migrations
        if not status["is_up_to_date"]:
            try:
                result = subprocess.run(
                    ["alembic", "history", "--verbose"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0:
                    # Parse pending migrations
                    current_found = False
                    for line in result.stdout.split('\n'):
                        if status["current_revision"] and status["current_revision"] in line:
                            current_found = True
                        elif current_found and '->' in line:
                            parts = line.split()
                            if parts:
                                status["pending_migrations"].append(parts[0])
            except Exception:
                pass
        
        return status
    
    def generate_migration(self, message: str, auto: bool = True) -> Tuple[bool, Optional[str]]:
        """Generate a new migration"""
        try:
            cmd = ["alembic", "revision"]
            
            if auto:
                cmd.append("--autogenerate")
            
            cmd.extend(["-m", message])
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                # Extract generated file name
                for line in result.stdout.split('\n'):
                    if 'Generating' in line and '.py' in line:
                        parts = line.split('/')
                        if parts:
                            return True, parts[-1].strip()
                return True, None
            else:
                print(f"Error: {result.stderr}")
                return False, None
                
        except Exception as e:
            print(f"Failed to generate migration: {e}")
            return False, None
    
    def apply_migrations(self, target: str = "head", dry_run: bool = False) -> bool:
        """Apply migrations to target revision"""
        try:
            if dry_run:
                print(f"DRY RUN: Would apply migrations to {target}")
                cmd = ["alembic", "upgrade", target, "--sql"]
            else:
                cmd = ["alembic", "upgrade", target]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                print(result.stdout)
                return True
            else:
                print(f"Error: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"Failed to apply migrations: {e}")
            return False
    
    def rollback_migration(self, steps: int = 1) -> bool:
        """Rollback migrations by n steps"""
        try:
            target = f"-{steps}" if steps > 0 else "base"
            
            result = subprocess.run(
                ["alembic", "downgrade", target],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                print(f"Rolled back {steps} migration(s)")
                print(result.stdout)
                return True
            else:
                print(f"Error: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"Failed to rollback: {e}")
            return False
    
    def backup_database(self) -> Optional[str]:
        """Create database backup"""
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_file = self.backup_dir / f"backup_{timestamp}.sql"
            
            # Parse database URL
            match = re.match(
                r'postgresql(?:\+\w+)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)',
                self.database_url
            )
            
            if not match:
                print("Failed to parse database URL")
                return None
            
            user, password, host, port, database = match.groups()
            port = port or '5432'
            
            env = os.environ.copy()
            env['PGPASSWORD'] = password
            
            result = subprocess.run(
                ['pg_dump', '-h', host, '-p', port, '-U', user, '-d', database,
                 '-f', str(backup_file)],
                env=env,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0:
                print(f"Backup created: {backup_file}")
                return str(backup_file)
            else:
                print(f"Backup failed: {result.stderr}")
                return None
                
        except Exception as e:
            print(f"Failed to create backup: {e}")
            return None
    
    def restore_backup(self, backup_file: str) -> bool:
        """Restore database from backup"""
        try:
            if not Path(backup_file).exists():
                print(f"Backup file not found: {backup_file}")
                return False
            
            # Parse database URL
            match = re.match(
                r'postgresql(?:\+\w+)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)',
                self.database_url
            )
            
            if not match:
                print("Failed to parse database URL")
                return False
            
            user, password, host, port, database = match.groups()
            port = port or '5432'
            
            env = os.environ.copy()
            env['PGPASSWORD'] = password
            
            result = subprocess.run(
                ['psql', '-h', host, '-p', port, '-U', user, '-d', database,
                 '-f', backup_file],
                env=env,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                print(f"Database restored from {backup_file}")
                return True
            else:
                print(f"Restore failed: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"Failed to restore backup: {e}")
            return False
    
    def validate_migration(self, revision: Optional[str] = None) -> bool:
        """Validate migration file(s)"""
        if revision:
            # Validate specific revision
            migration_files = list(self.versions_dir.glob(f"*{revision}*.py"))
        else:
            # Validate all migrations
            migration_files = list(self.versions_dir.glob("*.py"))
            migration_files = [f for f in migration_files if not f.name.startswith("__")]
        
        all_valid = True
        
        for migration_file in migration_files:
            print(f"Validating {migration_file.name}...")
            
            with open(migration_file, 'r') as f:
                content = f.read()
            
            # Check for required functions
            has_upgrade = 'def upgrade()' in content or 'def upgrade():' in content
            has_downgrade = 'def downgrade()' in content or 'def downgrade():' in content
            
            if not has_upgrade:
                print(f"  ✗ Missing upgrade() function")
                all_valid = False
            else:
                print(f"  ✓ upgrade() function found")
            
            if not has_downgrade:
                print(f"  ✗ Missing downgrade() function")
                all_valid = False
            else:
                print(f"  ✓ downgrade() function found")
            
            # Check for revision and down_revision
            has_revision = 'revision' in content and '=' in content
            has_down_revision = 'down_revision' in content
            
            if not has_revision:
                print(f"  ✗ Missing revision identifier")
                all_valid = False
            
            if not has_down_revision:
                print(f"  ✗ Missing down_revision")
                all_valid = False
        
        return all_valid
    
    def list_migrations(self) -> List[Dict]:
        """List all migrations with details"""
        migrations = []
        
        try:
            # Get migration history
            result = subprocess.run(
                ["alembic", "history", "--verbose"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if '->' in line:
                        parts = line.split()
                        if len(parts) >= 3:
                            revision = parts[0]
                            
                            # Find corresponding file
                            migration_file = None
                            for f in self.versions_dir.glob(f"*{revision}*.py"):
                                migration_file = f.name
                                break
                            
                            migrations.append({
                                "revision": revision,
                                "file": migration_file,
                                "description": ' '.join(parts[2:]) if len(parts) > 2 else ""
                            })
        except Exception as e:
            print(f"Failed to list migrations: {e}")
        
        return migrations
    
    async def repair_migration_state(self) -> bool:
        """Repair migration state if corrupted"""
        print("Checking migration state...")
        
        status = await self.check_migration_status()
        
        if not status["migration_table_exists"]:
            print("Creating alembic_version table...")
            
            # Create table and stamp with head
            try:
                result = subprocess.run(
                    ["alembic", "stamp", "head"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0:
                    print("Migration state repaired")
                    return True
                else:
                    print(f"Failed to repair: {result.stderr}")
                    return False
            except Exception as e:
                print(f"Repair failed: {e}")
                return False
        
        print("Migration state appears healthy")
        return True


async def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description="Alembic Migration Manager")
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Status command
    subparsers.add_parser("status", help="Check migration status")
    
    # Generate command
    generate_parser = subparsers.add_parser("generate", help="Generate new migration")
    generate_parser.add_argument("message", help="Migration message")
    generate_parser.add_argument("--manual", action="store_true", help="Manual migration (no auto-generate)")
    
    # Apply command
    apply_parser = subparsers.add_parser("apply", help="Apply migrations")
    apply_parser.add_argument("--target", default="head", help="Target revision (default: head)")
    apply_parser.add_argument("--dry-run", action="store_true", help="Show SQL without applying")
    
    # Rollback command
    rollback_parser = subparsers.add_parser("rollback", help="Rollback migrations")
    rollback_parser.add_argument("--steps", type=int, default=1, help="Number of steps to rollback")
    
    # Backup command
    subparsers.add_parser("backup", help="Create database backup")
    
    # Restore command
    restore_parser = subparsers.add_parser("restore", help="Restore from backup")
    restore_parser.add_argument("backup_file", help="Backup file path")
    
    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate migrations")
    validate_parser.add_argument("--revision", help="Specific revision to validate")
    
    # List command
    subparsers.add_parser("list", help="List all migrations")
    
    # Repair command
    subparsers.add_parser("repair", help="Repair migration state")
    
    args = parser.parse_args()
    
    manager = MigrationManager()
    
    if args.command == "status":
        status = await manager.check_migration_status()
        print("\n=== Migration Status ===")
        print(f"Database Connected: {status['database_connected']}")
        print(f"Migration Table: {status['migration_table_exists']}")
        print(f"Current Revision: {status['current_revision'] or 'None'}")
        print(f"Head Revision: {status['head_revision'] or 'None'}")
        print(f"Up to Date: {status['is_up_to_date']}")
        print(f"Pending Migrations: {len(status['pending_migrations'])}")
        
        if status['pending_migrations']:
            print("\nPending migrations:")
            for migration in status['pending_migrations']:
                print(f"  - {migration}")
    
    elif args.command == "generate":
        success, filename = manager.generate_migration(args.message, not args.manual)
        if success:
            print(f"✓ Migration generated: {filename}")
        else:
            print("✗ Failed to generate migration")
            sys.exit(1)
    
    elif args.command == "apply":
        # Backup before applying
        if not args.dry_run:
            print("Creating backup before migration...")
            backup_file = manager.backup_database()
            
        if manager.apply_migrations(args.target, args.dry_run):
            print("✓ Migrations applied successfully")
        else:
            print("✗ Failed to apply migrations")
            sys.exit(1)
    
    elif args.command == "rollback":
        # Backup before rollback
        print("Creating backup before rollback...")
        backup_file = manager.backup_database()
        
        if manager.rollback_migration(args.steps):
            print(f"✓ Rolled back {args.steps} migration(s)")
        else:
            print("✗ Rollback failed")
            sys.exit(1)
    
    elif args.command == "backup":
        backup_file = manager.backup_database()
        if backup_file:
            print(f"✓ Backup created: {backup_file}")
        else:
            print("✗ Backup failed")
            sys.exit(1)
    
    elif args.command == "restore":
        if manager.restore_backup(args.backup_file):
            print("✓ Database restored")
        else:
            print("✗ Restore failed")
            sys.exit(1)
    
    elif args.command == "validate":
        if manager.validate_migration(args.revision):
            print("✓ All migrations valid")
        else:
            print("✗ Validation failed")
            sys.exit(1)
    
    elif args.command == "list":
        migrations = manager.list_migrations()
        print("\n=== Migrations ===")
        for migration in migrations:
            print(f"{migration['revision']}: {migration['description']}")
            if migration['file']:
                print(f"  File: {migration['file']}")
    
    elif args.command == "repair":
        if await manager.repair_migration_state():
            print("✓ Migration state repaired")
        else:
            print("✗ Repair failed")
            sys.exit(1)
    
    else:
        parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())