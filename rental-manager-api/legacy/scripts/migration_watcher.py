#!/usr/bin/env python3
"""
Alembic Migration Watcher
Automatically detects and applies new database migrations in development
"""

import os
import sys
import time
import hashlib
import logging
import subprocess
import asyncio
from pathlib import Path
from typing import Set, Optional, Dict, List, Tuple
from datetime import datetime
import json
import shutil

# Add app directory to path
sys.path.insert(0, '/app')

# Configure logging
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/app/logs/migration_watcher.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)

class MigrationWatcher:
    """Watches for new Alembic migrations and applies them automatically"""
    
    def __init__(self):
        self.migrations_dir = Path('/app/alembic/versions')
        self.models_dir = Path('/app/app/modules')
        self.state_file = Path('/app/.migration_state.json')
        self.watch_interval = int(os.getenv('WATCH_INTERVAL', '5'))
        self.auto_apply = os.getenv('AUTO_APPLY', 'true').lower() == 'true'
        self.auto_generate = os.getenv('AUTO_GENERATE', 'true').lower() == 'true'
        self.backup_before_migrate = os.getenv('BACKUP_BEFORE_MIGRATE', 'true').lower() == 'true'
        self.backup_dir = Path('/app/backups')
        self.backup_dir.mkdir(exist_ok=True)
        
        # Track processed migrations and model changes
        self.processed_migrations: Set[str] = self._load_state()
        self.model_hashes: Dict[str, str] = {}
        self.migration_history: List[Dict] = []
        
    def _load_state(self) -> Set[str]:
        """Load previously processed migrations from state file"""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    data = json.load(f)
                    self.model_hashes = data.get('model_hashes', {})
                    self.migration_history = data.get('history', [])
                    return set(data.get('processed_migrations', []))
            except Exception as e:
                logger.error(f"Failed to load state file: {e}")
        return set()
    
    def _save_state(self):
        """Save current state to file"""
        try:
            state_data = {
                'processed_migrations': list(self.processed_migrations),
                'model_hashes': self.model_hashes,
                'last_check': datetime.now().isoformat(),
                'history': self.migration_history[-20:]  # Keep last 20 migrations
            }
            with open(self.state_file, 'w') as f:
                json.dump(state_data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save state: {e}")
    
    def _get_migration_files(self) -> Set[str]:
        """Get all migration files in the versions directory"""
        if not self.migrations_dir.exists():
            logger.warning(f"Migrations directory does not exist: {self.migrations_dir}")
            return set()
        
        migration_files = set()
        for file in self.migrations_dir.glob('*.py'):
            if file.name != '__init__.py' and not file.name.startswith('__'):
                migration_files.add(file.name)
        
        return migration_files
    
    def _get_file_hash(self, filepath: Path) -> str:
        """Calculate hash of a file for change detection"""
        try:
            with open(filepath, 'rb') as f:
                return hashlib.md5(f.read()).hexdigest()
        except Exception as e:
            logger.error(f"Failed to hash file {filepath}: {e}")
            return ""
    
    def _get_model_files(self) -> Dict[str, str]:
        """Get all model files and their hashes"""
        model_files = {}
        for model_file in self.models_dir.rglob('models.py'):
            file_hash = self._get_file_hash(model_file)
            if file_hash:
                model_files[str(model_file)] = file_hash
        return model_files
    
    def _check_model_changes(self) -> bool:
        """Check if any model files have changed"""
        current_hashes = self._get_model_files()
        
        # Check for new or modified files
        for file_path, file_hash in current_hashes.items():
            if file_path not in self.model_hashes or self.model_hashes[file_path] != file_hash:
                logger.info(f"Model change detected in {file_path}")
                return True
        
        # Check for deleted files
        for file_path in self.model_hashes:
            if file_path not in current_hashes:
                logger.info(f"Model file deleted: {file_path}")
                return True
        
        return False
    
    def _check_database_connection(self) -> bool:
        """Check if database is accessible"""
        try:
            result = subprocess.run(
                ['alembic', 'current'],
                capture_output=True,
                text=True,
                cwd='/app',
                timeout=10
            )
            return result.returncode == 0
        except Exception as e:
            logger.error(f"Database connection check failed: {e}")
            return False
    
    def _get_current_revision(self) -> Optional[str]:
        """Get current database revision"""
        try:
            result = subprocess.run(
                ['alembic', 'current'],
                capture_output=True,
                text=True,
                cwd='/app',
                timeout=10
            )
            if result.returncode == 0:
                # Parse revision from output
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if '(head)' in line or 'revision' in line.lower():
                        # Extract revision hash
                        parts = line.split()
                        if parts:
                            return parts[0]
            return None
        except Exception as e:
            logger.error(f"Failed to get current revision: {e}")
            return None
    
    def _get_pending_migrations(self) -> List[str]:
        """Get list of pending migrations"""
        try:
            result = subprocess.run(
                ['alembic', 'history', '--verbose'],
                capture_output=True,
                text=True,
                cwd='/app',
                timeout=10
            )
            
            if result.returncode == 0:
                current_rev = self._get_current_revision()
                pending = []
                found_current = False if current_rev else True
                
                for line in result.stdout.split('\n'):
                    if '->' in line:
                        parts = line.split('->')
                        if len(parts) >= 2:
                            revision = parts[0].strip().split()[0]
                            if found_current:
                                pending.append(revision)
                            elif revision == current_rev:
                                found_current = True
                
                return pending
            return []
        except Exception as e:
            logger.error(f"Failed to get pending migrations: {e}")
            return []
    
    def _backup_database(self) -> Optional[str]:
        """Create database backup before migration"""
        if not self.backup_before_migrate:
            return None
        
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_file = self.backup_dir / f"backup_{timestamp}.sql"
            
            # Get database credentials from environment
            db_url = os.getenv('DATABASE_URL', '')
            if 'postgresql' in db_url:
                # Parse database URL
                import re
                match = re.match(r'postgresql(?:\+\w+)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', db_url)
                if match:
                    user, password, host, port, database = match.groups()
                    port = port or '5432'
                    
                    # Create backup using pg_dump
                    env = os.environ.copy()
                    env['PGPASSWORD'] = password
                    
                    result = subprocess.run(
                        ['pg_dump', '-h', host, '-p', port, '-U', user, '-d', database, '-f', str(backup_file)],
                        env=env,
                        capture_output=True,
                        text=True,
                        timeout=60
                    )
                    
                    if result.returncode == 0:
                        logger.info(f"Database backup created: {backup_file}")
                        
                        # Keep only last 10 backups
                        self._cleanup_old_backups(10)
                        
                        return str(backup_file)
                    else:
                        logger.error(f"Backup failed: {result.stderr}")
            
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
        
        return None
    
    def _cleanup_old_backups(self, keep_count: int):
        """Remove old backup files, keeping only the most recent ones"""
        try:
            backup_files = sorted(self.backup_dir.glob('backup_*.sql'), key=lambda x: x.stat().st_mtime)
            if len(backup_files) > keep_count:
                for backup_file in backup_files[:-keep_count]:
                    backup_file.unlink()
                    logger.info(f"Removed old backup: {backup_file}")
        except Exception as e:
            logger.error(f"Failed to cleanup backups: {e}")
    
    def _generate_migration(self, message: str = None) -> Tuple[bool, Optional[str]]:
        """Generate new migration based on model changes"""
        try:
            # Generate descriptive message if not provided
            if not message:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                message = f"Auto-generated migration {timestamp}"
            
            logger.info(f"Generating migration: {message}")
            
            result = subprocess.run(
                ['alembic', 'revision', '--autogenerate', '-m', message],
                capture_output=True,
                text=True,
                cwd='/app',
                timeout=30
            )
            
            if result.returncode == 0:
                # Extract migration file name from output
                for line in result.stdout.split('\n'):
                    if 'Generating' in line and '.py' in line:
                        parts = line.split('/')
                        if parts:
                            migration_file = parts[-1].strip()
                            logger.info(f"Generated migration: {migration_file}")
                            return True, migration_file
                
                logger.info("Migration generated successfully")
                return True, None
            else:
                logger.error(f"Migration generation failed: {result.stderr}")
                return False, None
                
        except Exception as e:
            logger.error(f"Failed to generate migration: {e}")
            return False, None
    
    def _apply_migration(self, target: str = 'head') -> bool:
        """Apply database migrations"""
        try:
            logger.info(f"Applying migrations to {target}")
            
            # Create backup first
            backup_file = self._backup_database()
            
            result = subprocess.run(
                ['alembic', 'upgrade', target],
                capture_output=True,
                text=True,
                cwd='/app',
                timeout=60
            )
            
            if result.returncode == 0:
                logger.info(f"Migrations applied successfully")
                
                # Record in history
                self.migration_history.append({
                    'timestamp': datetime.now().isoformat(),
                    'action': 'upgrade',
                    'target': target,
                    'backup': backup_file,
                    'success': True
                })
                
                return True
            else:
                logger.error(f"Migration failed: {result.stderr}")
                
                # Record failure
                self.migration_history.append({
                    'timestamp': datetime.now().isoformat(),
                    'action': 'upgrade',
                    'target': target,
                    'backup': backup_file,
                    'success': False,
                    'error': result.stderr
                })
                
                # Attempt rollback if we have a backup
                if backup_file:
                    logger.warning("Attempting to restore from backup...")
                    self._restore_backup(backup_file)
                
                return False
                
        except Exception as e:
            logger.error(f"Failed to apply migration: {e}")
            return False
    
    def _restore_backup(self, backup_file: str) -> bool:
        """Restore database from backup"""
        try:
            logger.info(f"Restoring database from {backup_file}")
            
            # Get database credentials
            db_url = os.getenv('DATABASE_URL', '')
            if 'postgresql' in db_url:
                import re
                match = re.match(r'postgresql(?:\+\w+)?://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', db_url)
                if match:
                    user, password, host, port, database = match.groups()
                    port = port or '5432'
                    
                    env = os.environ.copy()
                    env['PGPASSWORD'] = password
                    
                    # Restore from backup
                    result = subprocess.run(
                        ['psql', '-h', host, '-p', port, '-U', user, '-d', database, '-f', backup_file],
                        env=env,
                        capture_output=True,
                        text=True,
                        timeout=120
                    )
                    
                    if result.returncode == 0:
                        logger.info("Database restored successfully")
                        return True
                    else:
                        logger.error(f"Restore failed: {result.stderr}")
            
        except Exception as e:
            logger.error(f"Failed to restore backup: {e}")
        
        return False
    
    def _validate_migration(self, migration_file: str) -> bool:
        """Validate a migration file before applying"""
        try:
            migration_path = self.migrations_dir / migration_file
            
            if not migration_path.exists():
                return False
            
            # Basic validation - check for upgrade and downgrade functions
            with open(migration_path, 'r') as f:
                content = f.read()
                
                if 'def upgrade()' not in content:
                    logger.error(f"Migration {migration_file} missing upgrade function")
                    return False
                
                if 'def downgrade()' not in content:
                    logger.error(f"Migration {migration_file} missing downgrade function")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to validate migration {migration_file}: {e}")
            return False
    
    async def watch(self):
        """Main watch loop"""
        logger.info("Starting migration watcher...")
        logger.info(f"Auto-apply: {self.auto_apply}")
        logger.info(f"Auto-generate: {self.auto_generate}")
        logger.info(f"Backup before migrate: {self.backup_before_migrate}")
        logger.info(f"Watch interval: {self.watch_interval} seconds")
        
        # Initial model hashes
        self.model_hashes = self._get_model_files()
        
        while True:
            try:
                # Check database connection
                if not self._check_database_connection():
                    logger.warning("Database not available, waiting...")
                    await asyncio.sleep(self.watch_interval)
                    continue
                
                # Check for model changes and auto-generate migrations
                if self.auto_generate and self._check_model_changes():
                    logger.info("Model changes detected, generating migration...")
                    
                    success, migration_file = self._generate_migration()
                    if success:
                        # Update model hashes
                        self.model_hashes = self._get_model_files()
                        
                        # Add to processed if file was returned
                        if migration_file:
                            self.processed_migrations.add(migration_file)
                        
                        # Save state
                        self._save_state()
                        
                        # Apply if auto-apply is enabled
                        if self.auto_apply:
                            logger.info("Auto-applying generated migration...")
                            self._apply_migration()
                
                # Check for new migration files
                current_migrations = self._get_migration_files()
                new_migrations = current_migrations - self.processed_migrations
                
                if new_migrations:
                    logger.info(f"Found {len(new_migrations)} new migration(s)")
                    
                    for migration in sorted(new_migrations):
                        logger.info(f"Processing migration: {migration}")
                        
                        # Validate migration
                        if not self._validate_migration(migration):
                            logger.error(f"Migration {migration} failed validation")
                            continue
                        
                        # Apply if auto-apply is enabled
                        if self.auto_apply:
                            if self._apply_migration():
                                self.processed_migrations.add(migration)
                            else:
                                logger.error(f"Failed to apply migration {migration}")
                        else:
                            logger.info(f"Auto-apply disabled, marking {migration} as seen")
                            self.processed_migrations.add(migration)
                    
                    # Save state after processing
                    self._save_state()
                
                # Check for pending migrations (useful after manual generation)
                pending = self._get_pending_migrations()
                if pending and self.auto_apply:
                    logger.info(f"Found {len(pending)} pending migration(s)")
                    self._apply_migration()
                
            except Exception as e:
                logger.error(f"Error in watch loop: {e}")
            
            # Wait before next check
            await asyncio.sleep(self.watch_interval)
    
    def run(self):
        """Run the watcher"""
        try:
            asyncio.run(self.watch())
        except KeyboardInterrupt:
            logger.info("Migration watcher stopped by user")
        except Exception as e:
            logger.error(f"Migration watcher crashed: {e}")
            raise


if __name__ == '__main__':
    watcher = MigrationWatcher()
    watcher.run()