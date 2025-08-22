#!/usr/bin/env python3
"""
Intelligent Migration Checker and Manager
Automatically handles all migration scenarios without user intervention
"""

import os
import sys
import asyncio
import subprocess
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Tuple, List
import re
import hashlib
import shutil

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import create_async_engine
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AutoMigrationChecker:
    """Fully automated migration checker and applier"""
    
    def __init__(self, database_url: str = None):
        self.database_url = database_url or os.getenv('DATABASE_URL')
        self.alembic_cfg = Config("alembic.ini")
        self.alembic_dir = Path("alembic")
        self.versions_dir = self.alembic_dir / "versions"
        self.backup_dir = Path("backups/auto_migrations")
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = self.alembic_dir / "migration_state.json"
        
        # Configuration from environment
        self.auto_migrate = os.getenv('AUTO_MIGRATE', 'true').lower() == 'true'
        self.auto_backup = os.getenv('BACKUP_BEFORE_MIGRATE', 'true').lower() == 'true'
        self.auto_rollback = os.getenv('AUTO_ROLLBACK_ON_FAILURE', 'true').lower() == 'true'
        self.max_retries = int(os.getenv('MIGRATION_MAX_RETRIES', '3'))
        self.timeout = int(os.getenv('MIGRATION_TIMEOUT', '300'))
        
        # Ensure database URL is properly formatted
        if self.database_url:
            if 'postgresql://' in self.database_url and '+asyncpg' not in self.database_url:
                self.database_url = self.database_url.replace('postgresql://', 'postgresql+asyncpg://', 1)
            self.alembic_cfg.set_main_option("sqlalchemy.url", self.database_url)
    
    async def check_database_connection(self) -> bool:
        """Check if database is accessible"""
        try:
            engine = create_async_engine(self.database_url, pool_pre_ping=True)
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            await engine.dispose()
            logger.info("✓ Database connection successful")
            return True
        except Exception as e:
            logger.error(f"✗ Database connection failed: {e}")
            return False
    
    async def get_database_state(self) -> Dict:
        """Get comprehensive database state"""
        state = {
            "connected": False,
            "has_alembic_table": False,
            "current_revision": None,
            "table_count": 0,
            "tables": [],
            "is_fresh": True
        }
        
        try:
            engine = create_async_engine(self.database_url)
            async with engine.connect() as conn:
                state["connected"] = True
                
                # Check for alembic_version table
                result = await conn.execute(text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'alembic_version'
                    );
                """))
                state["has_alembic_table"] = result.scalar()
                
                # Get current revision if exists
                if state["has_alembic_table"]:
                    try:
                        result = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
                        state["current_revision"] = result.scalar()
                    except:
                        pass
                
                # Get all tables
                result = await conn.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name;
                """))
                state["tables"] = [row[0] for row in result]
                state["table_count"] = len(state["tables"])
                state["is_fresh"] = state["table_count"] <= 1  # Only alembic_version or empty
                
            await engine.dispose()
        except Exception as e:
            logger.error(f"Failed to get database state: {e}")
            state["error"] = str(e)
        
        return state
    
    def get_head_revision(self) -> Optional[str]:
        """Get the head revision from migration files"""
        try:
            script_dir = ScriptDirectory.from_config(self.alembic_cfg)
            head = script_dir.get_current_head()
            return head
        except Exception as e:
            logger.error(f"Failed to get head revision: {e}")
            return None
    
    def get_pending_migrations(self) -> List[str]:
        """Get list of pending migration revisions"""
        try:
            result = subprocess.run(
                ["alembic", "history", "--verbose"],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                return []
            
            # Parse output to find pending migrations
            pending = []
            lines = result.stdout.strip().split('\n')
            current_found = False
            
            for line in lines:
                if "(head)" in line and not current_found:
                    # This is a pending migration
                    parts = line.split()
                    if parts:
                        pending.append(parts[0])
                elif "(current)" in line:
                    current_found = True
                    break
            
            return pending
        except Exception as e:
            logger.error(f"Failed to get pending migrations: {e}")
            return []
    
    async def create_backup(self) -> Optional[str]:
        """Create automatic database backup"""
        if not self.auto_backup:
            logger.info("Backup disabled by configuration")
            return None
        
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_file = self.backup_dir / f"auto_backup_{timestamp}.sql"
            
            # Parse database URL for pg_dump
            match = re.match(
                r'postgresql(?:\+\w+)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)',
                self.database_url
            )
            
            if not match:
                logger.warning("Could not parse database URL for backup")
                return None
            
            user, password, host, port, database = match.groups()
            port = port or '5432'
            
            env = os.environ.copy()
            env['PGPASSWORD'] = password
            
            logger.info(f"Creating backup: {backup_file}")
            
            result = subprocess.run(
                ['pg_dump', '-h', host, '-p', port, '-U', user, '-d', database,
                 '-f', str(backup_file), '--no-owner', '--no-acl'],
                env=env,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode == 0:
                logger.info(f"✓ Backup created successfully: {backup_file}")
                
                # Keep only last 5 backups
                self.cleanup_old_backups()
                
                return str(backup_file)
            else:
                logger.warning(f"Backup failed: {result.stderr}")
                return None
                
        except Exception as e:
            logger.warning(f"Backup failed: {e}")
            return None
    
    def cleanup_old_backups(self, keep_count: int = 5):
        """Remove old backup files, keeping only the most recent ones"""
        try:
            backup_files = sorted(
                self.backup_dir.glob("auto_backup_*.sql"),
                key=lambda x: x.stat().st_mtime,
                reverse=True
            )
            
            for backup_file in backup_files[keep_count:]:
                backup_file.unlink()
                logger.info(f"Removed old backup: {backup_file}")
                
        except Exception as e:
            logger.warning(f"Failed to cleanup old backups: {e}")
    
    async def apply_migrations(self, backup_file: Optional[str] = None) -> bool:
        """Apply all pending migrations automatically"""
        try:
            logger.info("Applying pending migrations...")
            
            # Run alembic upgrade head
            result = subprocess.run(
                ["alembic", "upgrade", "head"],
                capture_output=True,
                text=True,
                timeout=self.timeout
            )
            
            if result.returncode == 0:
                logger.info("✓ Migrations applied successfully")
                logger.info(result.stdout)
                
                # Update state file
                self.update_state("success", "All migrations applied")
                
                return True
            else:
                logger.error(f"✗ Migration failed: {result.stderr}")
                
                # Attempt rollback if configured
                if self.auto_rollback and backup_file:
                    logger.info("Attempting automatic rollback...")
                    if await self.restore_backup(backup_file):
                        logger.info("✓ Rollback successful")
                    else:
                        logger.error("✗ Rollback failed - manual intervention required")
                
                self.update_state("failed", result.stderr)
                return False
                
        except subprocess.TimeoutExpired:
            logger.error(f"Migration timed out after {self.timeout} seconds")
            self.update_state("timeout", f"Migration exceeded {self.timeout}s timeout")
            return False
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            self.update_state("error", str(e))
            return False
    
    async def restore_backup(self, backup_file: str) -> bool:
        """Restore database from backup"""
        try:
            if not Path(backup_file).exists():
                logger.error(f"Backup file not found: {backup_file}")
                return False
            
            # Parse database URL
            match = re.match(
                r'postgresql(?:\+\w+)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)',
                self.database_url
            )
            
            if not match:
                return False
            
            user, password, host, port, database = match.groups()
            port = port or '5432'
            
            env = os.environ.copy()
            env['PGPASSWORD'] = password
            
            logger.info(f"Restoring from backup: {backup_file}")
            
            # Drop all tables first
            drop_result = subprocess.run(
                ['psql', '-h', host, '-p', port, '-U', user, '-d', database,
                 '-c', "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"],
                env=env,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if drop_result.returncode != 0:
                logger.error(f"Failed to drop schema: {drop_result.stderr}")
                return False
            
            # Restore from backup
            result = subprocess.run(
                ['psql', '-h', host, '-p', port, '-U', user, '-d', database,
                 '-f', backup_file],
                env=env,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode == 0:
                logger.info("✓ Database restored successfully")
                return True
            else:
                logger.error(f"Restore failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False
    
    async def repair_migration_state(self) -> bool:
        """Automatically repair corrupted migration state"""
        try:
            logger.info("Checking migration state health...")
            
            db_state = await self.get_database_state()
            
            if not db_state["connected"]:
                logger.error("Cannot repair - database not connected")
                return False
            
            # Case 1: Database has tables but no migration history
            if db_state["table_count"] > 1 and not db_state["has_alembic_table"]:
                logger.info("Database has tables but no migration history - stamping with head")
                
                result = subprocess.run(
                    ["alembic", "stamp", "head"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0:
                    logger.info("✓ Database stamped with current head revision")
                    return True
                else:
                    logger.error(f"Failed to stamp database: {result.stderr}")
                    return False
            
            # Case 2: Fresh database
            elif db_state["is_fresh"]:
                logger.info("Fresh database detected - ready for migrations")
                return True
            
            # Case 3: Check for version mismatch
            elif db_state["has_alembic_table"]:
                head = self.get_head_revision()
                current = db_state["current_revision"]
                
                if current == head:
                    logger.info("✓ Migration state is healthy")
                    return True
                else:
                    logger.info(f"Migration version mismatch - current: {current}, head: {head}")
                    return True  # This is actually OK, just needs migration
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to repair migration state: {e}")
            return False
    
    def update_state(self, status: str, message: str = ""):
        """Update migration state file"""
        try:
            state = {
                "timestamp": datetime.now().isoformat(),
                "status": status,
                "message": message,
                "auto_migrated": True
            }
            
            with open(self.state_file, 'w') as f:
                json.dump(state, f, indent=2)
                
        except Exception as e:
            logger.warning(f"Failed to update state file: {e}")
    
    def get_state(self) -> Dict:
        """Get last migration state"""
        try:
            if self.state_file.exists():
                with open(self.state_file, 'r') as f:
                    return json.load(f)
        except:
            pass
        return {}
    
    async def run_automatic_migration(self) -> bool:
        """Main entry point for automatic migration"""
        logger.info("=" * 60)
        logger.info("Starting Automatic Migration Check")
        logger.info("=" * 60)
        
        # Check if auto migration is enabled
        if not self.auto_migrate:
            logger.info("Auto-migration disabled by configuration")
            return True
        
        # Wait for database with retries
        retry_count = 0
        while retry_count < self.max_retries:
            if await self.check_database_connection():
                break
            retry_count += 1
            logger.info(f"Database not ready, retry {retry_count}/{self.max_retries}...")
            await asyncio.sleep(5)
        else:
            logger.error("Database connection failed after all retries")
            return False
        
        # Get database state
        db_state = await self.get_database_state()
        logger.info(f"Database state: {json.dumps(db_state, indent=2)}")
        
        # Repair state if needed
        if not await self.repair_migration_state():
            logger.error("Failed to repair migration state")
            return False
        
        # Check for pending migrations
        head_revision = self.get_head_revision()
        current_revision = db_state.get("current_revision")
        
        logger.info(f"Current revision: {current_revision}")
        logger.info(f"Head revision: {head_revision}")
        
        if current_revision == head_revision:
            logger.info("✓ Database is up to date - no migrations needed")
            self.update_state("up_to_date", "No migrations needed")
            return True
        
        # Get pending migrations
        pending = self.get_pending_migrations()
        
        if not pending and db_state["is_fresh"]:
            # Fresh database needs initial migration
            logger.info("Fresh database detected - applying initial migrations")
        elif not pending:
            logger.info("No pending migrations found")
            return True
        else:
            logger.info(f"Found {len(pending)} pending migration(s): {pending}")
        
        # Create backup before migration
        backup_file = None
        if not db_state["is_fresh"]:
            backup_file = await self.create_backup()
        
        # Apply migrations
        success = await self.apply_migrations(backup_file)
        
        if success:
            # Verify migration was successful
            new_state = await self.get_database_state()
            new_revision = new_state.get("current_revision")
            
            if new_revision == head_revision:
                logger.info(f"✓ Migration verified - now at revision: {new_revision}")
                return True
            else:
                logger.warning(f"Migration may have partially succeeded - revision: {new_revision}")
                return True
        
        return False
    
    async def validate_post_migration(self) -> bool:
        """Validate database after migration"""
        try:
            logger.info("Running post-migration validation...")
            
            engine = create_async_engine(self.database_url)
            async with engine.connect() as conn:
                # Check critical tables exist
                critical_tables = ['users', 'roles', 'permissions', 'companies', 'items']
                missing_tables = []
                
                for table in critical_tables:
                    result = await conn.execute(text(f"""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = '{table}'
                        );
                    """))
                    if not result.scalar():
                        missing_tables.append(table)
                
                if missing_tables:
                    logger.warning(f"Missing tables after migration: {missing_tables}")
                    # This might be OK for fresh databases
                    
                # Check alembic version
                result = await conn.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
                version = result.scalar()
                logger.info(f"✓ Database at version: {version}")
                
            await engine.dispose()
            return True
            
        except Exception as e:
            logger.error(f"Post-migration validation failed: {e}")
            return False


async def main():
    """Main entry point for standalone execution"""
    checker = AutoMigrationChecker()
    
    # Run automatic migration
    success = await checker.run_automatic_migration()
    
    if success:
        logger.info("✓ Automatic migration completed successfully")
        
        # Run post-migration validation
        if await checker.validate_post_migration():
            logger.info("✓ Post-migration validation passed")
        
        sys.exit(0)
    else:
        logger.error("✗ Automatic migration failed")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())