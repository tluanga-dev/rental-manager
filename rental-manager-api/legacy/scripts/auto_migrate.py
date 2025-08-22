#!/usr/bin/env python3
"""
Automatic Migration Generator
Detects model changes and automatically generates and applies migrations
No user intervention required
"""

import os
import sys
import time
import hashlib
import asyncio
import subprocess
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, Set
import json

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import inspect, MetaData
from sqlalchemy.ext.asyncio import create_async_engine
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AutoMigrationGenerator:
    """Automatically generates and applies migrations based on model changes"""
    
    def __init__(self):
        self.database_url = os.getenv('DATABASE_URL')
        self.alembic_cfg = Config("alembic.ini")
        self.models_dir = Path("app/modules")
        self.state_file = Path("alembic/.auto_migrate_state.json")
        self.check_interval = int(os.getenv('MIGRATION_CHECK_INTERVAL', '30'))
        self.auto_apply = os.getenv('MIGRATION_AUTO_APPLY', 'true').lower() == 'true'
        self.environment = os.getenv('ENVIRONMENT', 'development')
        
        # Ensure database URL is properly formatted
        if self.database_url:
            if 'postgresql://' in self.database_url and '+asyncpg' not in self.database_url:
                self.database_url = self.database_url.replace('postgresql://', 'postgresql+asyncpg://', 1)
            self.alembic_cfg.set_main_option("sqlalchemy.url", self.database_url)
        
        # Initialize state
        self.last_model_hash = self.load_state().get('model_hash', '')
        self.last_check = time.time()
    
    def calculate_models_hash(self) -> str:
        """Calculate hash of all model files to detect changes"""
        hasher = hashlib.sha256()
        model_files = []
        
        # Find all models.py files
        for model_file in self.models_dir.rglob("models.py"):
            model_files.append(model_file)
        
        # Also check for model files with different names
        for model_file in self.models_dir.rglob("*_models.py"):
            model_files.append(model_file)
        
        # Sort files for consistent hashing
        model_files.sort()
        
        # Calculate combined hash
        for model_file in model_files:
            try:
                with open(model_file, 'rb') as f:
                    hasher.update(f.read())
            except Exception as e:
                logger.warning(f"Could not read {model_file}: {e}")
        
        return hasher.hexdigest()
    
    def load_state(self) -> Dict:
        """Load the last known state"""
        try:
            if self.state_file.exists():
                with open(self.state_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load state: {e}")
        return {}
    
    def save_state(self, state: Dict):
        """Save the current state"""
        try:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.state_file, 'w') as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            logger.error(f"Could not save state: {e}")
    
    async def get_database_schema(self) -> Set[str]:
        """Get current database schema information"""
        schema_info = set()
        
        try:
            engine = create_async_engine(self.database_url)
            async with engine.connect() as conn:
                # Get table information
                result = await conn.execute("""
                    SELECT 
                        table_name,
                        column_name,
                        data_type,
                        is_nullable
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    ORDER BY table_name, ordinal_position
                """)
                
                for row in result:
                    schema_info.add(f"{row[0]}.{row[1]}.{row[2]}.{row[3]}")
                
            await engine.dispose()
        except Exception as e:
            logger.error(f"Failed to get database schema: {e}")
        
        return schema_info
    
    def generate_migration_message(self) -> str:
        """Generate descriptive migration message based on time"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Try to detect what changed (simplified)
        changes = []
        
        # Check recent git changes for context
        try:
            result = subprocess.run(
                ["git", "diff", "--name-only", "HEAD~1", "HEAD"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                changed_files = result.stdout.strip().split('\n')
                model_changes = [f for f in changed_files if 'models.py' in f]
                if model_changes:
                    # Extract module names
                    modules = set()
                    for f in model_changes:
                        parts = f.split('/')
                        if 'modules' in parts:
                            idx = parts.index('modules')
                            if idx + 1 < len(parts):
                                modules.add(parts[idx + 1])
                    
                    if modules:
                        changes = list(modules)[:3]  # Limit to 3 modules
        except:
            pass
        
        if changes:
            return f"auto_{timestamp}_update_{_and_}.join(changes)"
        else:
            return f"auto_{timestamp}_schema_update"
    
    def check_for_pending_migrations(self) -> bool:
        """Check if there are unapplied migrations"""
        try:
            result = subprocess.run(
                ["alembic", "current"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            current = result.stdout.strip() if result.returncode == 0 else None
            
            result = subprocess.run(
                ["alembic", "heads"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            head = result.stdout.strip().split()[0] if result.returncode == 0 else None
            
            return current != head if current and head else False
            
        except Exception as e:
            logger.error(f"Failed to check pending migrations: {e}")
            return False
    
    def generate_migration(self) -> Optional[str]:
        """Generate a new migration automatically"""
        try:
            message = self.generate_migration_message()
            logger.info(f"Generating migration: {message}")
            
            result = subprocess.run(
                ["alembic", "revision", "--autogenerate", "-m", message],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                # Extract the generated file name
                for line in result.stdout.split('\n'):
                    if 'Generating' in line and '.py' in line:
                        parts = line.split('/')
                        if parts:
                            filename = parts[-1].strip()
                            logger.info(f"✓ Generated migration: {filename}")
                            return filename
                
                logger.info("✓ Migration generated successfully")
                return "generated"
            else:
                # Check if it's because there are no changes
                if "No changes" in result.stdout or "No changes" in result.stderr:
                    logger.info("No schema changes detected")
                    return None
                else:
                    logger.error(f"Failed to generate migration: {result.stderr}")
                    return None
                    
        except Exception as e:
            logger.error(f"Failed to generate migration: {e}")
            return None
    
    def apply_migration(self) -> bool:
        """Apply pending migrations automatically"""
        try:
            logger.info("Applying pending migrations...")
            
            result = subprocess.run(
                ["alembic", "upgrade", "head"],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                logger.info("✓ Migrations applied successfully")
                if result.stdout:
                    logger.info(result.stdout)
                return True
            else:
                logger.error(f"Failed to apply migrations: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to apply migrations: {e}")
            return False
    
    async def check_and_generate(self) -> bool:
        """Check for model changes and generate migration if needed"""
        # Calculate current model hash
        current_hash = self.calculate_models_hash()
        
        # Check if models have changed
        if current_hash == self.last_model_hash:
            logger.debug("No model changes detected")
            return False
        
        logger.info("Model changes detected!")
        
        # Generate migration
        migration_file = self.generate_migration()
        
        if migration_file:
            # Update state
            self.last_model_hash = current_hash
            self.save_state({
                'model_hash': current_hash,
                'last_migration': migration_file,
                'timestamp': datetime.now().isoformat()
            })
            
            # Apply migration if configured
            if self.auto_apply:
                logger.info("Auto-applying migration...")
                if self.apply_migration():
                    logger.info("✓ Migration automatically applied")
                    return True
                else:
                    logger.error("Failed to auto-apply migration")
                    return False
            else:
                logger.info("Migration generated but not applied (auto-apply disabled)")
                return True
        elif migration_file is None:
            # No changes needed, but update hash to avoid repeated checks
            self.last_model_hash = current_hash
            self.save_state({
                'model_hash': current_hash,
                'timestamp': datetime.now().isoformat(),
                'no_changes': True
            })
        
        return False
    
    async def run_continuous(self):
        """Run continuous monitoring and auto-generation"""
        logger.info("=" * 60)
        logger.info("Auto-Migration Generator Started")
        logger.info(f"Environment: {self.environment}")
        logger.info(f"Check interval: {self.check_interval} seconds")
        logger.info(f"Auto-apply: {self.auto_apply}")
        logger.info("=" * 60)
        
        # Only run in development mode
        if self.environment == 'production':
            logger.warning("Auto-migration generator disabled in production")
            return
        
        while True:
            try:
                # Check for pending migrations first
                if self.check_for_pending_migrations():
                    logger.info("Found pending migrations")
                    if self.auto_apply:
                        self.apply_migration()
                
                # Check for model changes
                await self.check_and_generate()
                
                # Wait for next check
                await asyncio.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                logger.info("Auto-migration generator stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in auto-migration loop: {e}")
                await asyncio.sleep(self.check_interval)
    
    async def run_once(self):
        """Run a single check and generation"""
        logger.info("Running one-time migration check...")
        
        # Check for pending migrations
        if self.check_for_pending_migrations():
            logger.info("Found pending migrations")
            if self.auto_apply:
                if self.apply_migration():
                    logger.info("✓ Pending migrations applied")
                else:
                    logger.error("Failed to apply pending migrations")
                    return False
        
        # Check for model changes
        result = await self.check_and_generate()
        
        if result:
            logger.info("✓ Auto-migration completed successfully")
        else:
            logger.info("No migrations needed")
        
        return result


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Automatic Migration Generator")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run once and exit"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply migrations automatically"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Check interval in seconds (default: 30)"
    )
    
    args = parser.parse_args()
    
    # Override environment variables with command line args
    if args.apply:
        os.environ['MIGRATION_AUTO_APPLY'] = 'true'
    if args.interval:
        os.environ['MIGRATION_CHECK_INTERVAL'] = str(args.interval)
    
    generator = AutoMigrationGenerator()
    
    if args.once:
        result = await generator.run_once()
        sys.exit(0 if result else 1)
    else:
        await generator.run_continuous()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Auto-migration generator stopped")
        sys.exit(0)