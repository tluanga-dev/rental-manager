#!/usr/bin/env python3
"""
Railway Production Database and Redis Reset Script
WARNING: This script will DELETE ALL DATA from the production database and Redis cache!

This script:
1. Clears all data from PostgreSQL database (preserves schema)
2. Clears all data from Redis cache
3. Reinitializes with admin user, RBAC, and system settings
4. Optionally seeds master data

Usage:
    python reset_railway_production.py --production-reset
    python reset_railway_production.py --dry-run
    python reset_railway_production.py --help
"""

import asyncio
import os
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple, Optional
import redis.asyncio as redis
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import subprocess
import time

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import AsyncSessionLocal, engine
from app.core.config import settings

# ANSI color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


# All tables in dependency order (most dependent first)
TABLES_TO_CLEAR = [
    # Analytics and Monitoring
    "system_alerts",
    "business_metrics",
    "analytics_reports",
    
    # System Module
    "audit_logs",
    "system_backups",
    "system_settings",
    
    # Rentals Module
    "inspection_reports",
    "rental_return_lines",
    "rental_returns",
    
    # Transactions Module
    "rental_lifecycle",
    "transaction_metadata",
    "transaction_events",
    "transaction_lines",
    "transaction_headers",
    
    # Inventory Module
    "stock_movements",
    "stock_levels",
    "inventory_units",
    "sku_sequences",
    
    # Master Data Module
    "items",
    "locations",
    "units_of_measurement",
    "brands",
    "categories",
    
    # Business Partners
    "suppliers",
    "customers",
    
    # Company
    "companies",
    
    # Authentication and RBAC (will be cleared and recreated)
    "user_permissions",
    "role_permissions",
    "user_roles",
    "refresh_tokens",
    "login_attempts",
    "password_reset_tokens",
    "user_profiles",
    "permissions",
    "roles",
    "users",
]


class RailwayReset:
    """Handles Railway production database and Redis reset."""
    
    def __init__(self, dry_run: bool = False, seed_master_data: bool = False):
        self.dry_run = dry_run
        self.seed_master_data = seed_master_data
        self.redis_client = None
        self.deleted_counts = {}
        self.start_time = datetime.now()
        
    async def connect_redis(self) -> bool:
        """Connect to Redis."""
        try:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            await self.redis_client.ping()
            print(f"{Colors.GREEN}✓{Colors.ENDC} Connected to Redis")
            return True
        except Exception as e:
            print(f"{Colors.WARNING}⚠{Colors.ENDC} Redis connection failed: {e}")
            return False
    
    async def clear_redis(self):
        """Clear all Redis cache."""
        if not self.redis_client:
            return
            
        try:
            print(f"\n{Colors.CYAN}Clearing Redis cache...{Colors.ENDC}")
            
            # Get key count before clearing
            keys = await self.redis_client.keys("*")
            key_count = len(keys)
            
            if key_count == 0:
                print(f"  {Colors.GREEN}✓{Colors.ENDC} Redis cache is already empty")
                return
            
            print(f"  Found {key_count:,} keys in Redis")
            
            if not self.dry_run:
                # Clear all keys
                await self.redis_client.flushdb()
                
                # Verify
                remaining = await self.redis_client.keys("*")
                if not remaining:
                    print(f"  {Colors.GREEN}✓{Colors.ENDC} Redis cache cleared successfully")
                else:
                    print(f"  {Colors.WARNING}⚠{Colors.ENDC} {len(remaining)} keys remain")
            else:
                print(f"  {Colors.CYAN}[DRY RUN]{Colors.ENDC} Would clear {key_count:,} Redis keys")
                
        except Exception as e:
            print(f"  {Colors.FAIL}✗{Colors.ENDC} Redis clear failed: {e}")
    
    async def get_table_counts(self, session) -> Dict[str, int]:
        """Get record counts for all tables."""
        counts = {}
        for table in TABLES_TO_CLEAR:
            try:
                result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                counts[table] = result.scalar()
            except Exception:
                counts[table] = 0  # Table might not exist
        return counts
    
    async def clear_database(self):
        """Clear all database tables."""
        async with AsyncSessionLocal() as session:
            try:
                print(f"\n{Colors.HEADER}=== DATABASE CLEARING ==={Colors.ENDC}")
                
                # Get before counts
                before_counts = await self.get_table_counts(session)
                total_records = sum(before_counts.values())
                
                if total_records == 0:
                    print(f"{Colors.GREEN}Database is already empty{Colors.ENDC}")
                    return
                
                print(f"Total records to delete: {total_records:,}")
                
                if not self.dry_run:
                    # Disable foreign key checks
                    await session.execute(text("SET session_replication_role = 'replica';"))
                    
                    # Clear each table
                    for table in TABLES_TO_CLEAR:
                        count = before_counts.get(table, 0)
                        if count > 0:
                            try:
                                # Show progress for large tables
                                if count > 10000:
                                    print(f"  {Colors.CYAN}⟳{Colors.ENDC} Clearing {table} ({count:,} records)...", end='', flush=True)
                                
                                # Use TRUNCATE for faster deletion
                                await session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
                                self.deleted_counts[table] = count
                                
                                if count > 10000:
                                    print(f"\r  {Colors.GREEN}✓{Colors.ENDC} Cleared {table:<30} ({count:,} records)")
                                else:
                                    print(f"  {Colors.GREEN}✓{Colors.ENDC} Cleared {table:<30} ({count:,} records)")
                                    
                            except Exception as e:
                                # Fallback to DELETE if TRUNCATE fails
                                try:
                                    result = await session.execute(text(f"DELETE FROM {table}"))
                                    self.deleted_counts[table] = result.rowcount
                                    print(f"  {Colors.GREEN}✓{Colors.ENDC} Cleared {table:<30} ({result.rowcount:,} records)")
                                except Exception as e2:
                                    print(f"  {Colors.FAIL}✗{Colors.ENDC} Failed to clear {table}: {e2}")
                    
                    # Re-enable foreign key checks
                    await session.execute(text("SET session_replication_role = 'origin';"))
                    
                    # Commit changes
                    await session.commit()
                    print(f"\n{Colors.GREEN}✅ Database cleared successfully{Colors.ENDC}")
                    
                else:
                    # Dry run - just show what would be deleted
                    for table in TABLES_TO_CLEAR:
                        count = before_counts.get(table, 0)
                        if count > 0:
                            print(f"  {Colors.CYAN}[DRY RUN]{Colors.ENDC} Would delete {count:,} records from {table}")
                            self.deleted_counts[table] = count
                
            except Exception as e:
                await session.rollback()
                print(f"\n{Colors.FAIL}❌ Database clear failed: {e}{Colors.ENDC}")
                raise
    
    async def run_initialization_script(self, script_path: str, description: str) -> bool:
        """Run a Python initialization script."""
        try:
            print(f"\n{Colors.CYAN}{description}...{Colors.ENDC}")
            
            if self.dry_run:
                print(f"  {Colors.CYAN}[DRY RUN]{Colors.ENDC} Would run: {script_path}")
                return True
            
            # Run the script
            result = subprocess.run(
                [sys.executable, script_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                print(f"  {Colors.GREEN}✓{Colors.ENDC} {description} completed")
                return True
            else:
                print(f"  {Colors.WARNING}⚠{Colors.ENDC} {description} had issues:")
                if result.stderr:
                    print(f"    {result.stderr[:500]}")
                return False
                
        except subprocess.TimeoutExpired:
            print(f"  {Colors.FAIL}✗{Colors.ENDC} {description} timed out")
            return False
        except Exception as e:
            print(f"  {Colors.FAIL}✗{Colors.ENDC} {description} failed: {e}")
            return False
    
    async def initialize_data(self):
        """Initialize database with essential data."""
        print(f"\n{Colors.HEADER}=== DATA INITIALIZATION ==={Colors.ENDC}")
        
        scripts_dir = Path(__file__).parent
        
        # Run initialization scripts in order
        initialization_steps = [
            ("scripts/init_production.py", "Initializing production data (admin, company, settings)"),
            ("scripts/seed_rbac.py", "Seeding RBAC permissions"),
            ("scripts/init_system_settings.py", "Initializing system settings"),
        ]
        
        if self.seed_master_data:
            initialization_steps.append(
                ("scripts/seed_all_data.py", "Seeding master data (brands, categories, etc.)")
            )
        
        success_count = 0
        for script, description in initialization_steps:
            script_path = scripts_dir / script.split('/')[-1]
            if script_path.exists():
                if await self.run_initialization_script(str(script_path), description):
                    success_count += 1
            else:
                print(f"  {Colors.WARNING}⚠{Colors.ENDC} Script not found: {script_path}")
        
        print(f"\n{Colors.GREEN}Completed {success_count}/{len(initialization_steps)} initialization steps{Colors.ENDC}")
    
    async def verify_reset(self):
        """Verify the reset was successful."""
        print(f"\n{Colors.HEADER}=== VERIFICATION ==={Colors.ENDC}")
        
        async with AsyncSessionLocal() as session:
            # Check if database is empty (except for seeded data)
            after_counts = await self.get_table_counts(session)
            
            # Check critical tables
            critical_checks = [
                ("users", "Admin user"),
                ("roles", "RBAC roles"),
                ("permissions", "RBAC permissions"),
                ("system_settings", "System settings"),
            ]
            
            for table, description in critical_checks:
                count = after_counts.get(table, 0)
                if count > 0:
                    print(f"  {Colors.GREEN}✓{Colors.ENDC} {description:<20} ({count} records)")
                else:
                    print(f"  {Colors.WARNING}⚠{Colors.ENDC} {description:<20} (empty)")
            
            # Check Redis
            if self.redis_client:
                try:
                    key_count = len(await self.redis_client.keys("*"))
                    print(f"  {Colors.GREEN}✓{Colors.ENDC} Redis cache        ({key_count} keys)")
                except:
                    print(f"  {Colors.WARNING}⚠{Colors.ENDC} Redis cache        (unavailable)")
    
    def generate_summary(self):
        """Generate a summary report."""
        elapsed = datetime.now() - self.start_time
        
        print(f"\n{Colors.HEADER}{'='*60}{Colors.ENDC}")
        print(f"{Colors.BOLD}RAILWAY PRODUCTION RESET SUMMARY{Colors.ENDC}")
        print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}")
        
        print(f"\nTimestamp: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Duration: {elapsed.total_seconds():.2f} seconds")
        print(f"Mode: {'DRY RUN' if self.dry_run else 'EXECUTED'}")
        
        if self.deleted_counts:
            total_deleted = sum(self.deleted_counts.values())
            print(f"\nTotal records deleted: {total_deleted:,}")
            print(f"Tables cleared: {len(self.deleted_counts)}")
            
            # Top 5 tables by deletion count
            if not self.dry_run:
                sorted_deletions = sorted(self.deleted_counts.items(), key=lambda x: x[1], reverse=True)[:5]
                print(f"\n{Colors.CYAN}Top tables by deletion count:{Colors.ENDC}")
                for table, count in sorted_deletions:
                    if count > 0:
                        print(f"  • {table}: {count:,} records")
        
        print(f"\n{Colors.GREEN}✅ Reset completed successfully{Colors.ENDC}")
        print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}")
    
    async def trigger_railway_restart(self):
        """Trigger Railway service restart."""
        print(f"\n{Colors.CYAN}Triggering Railway service restart...{Colors.ENDC}")
        
        if self.dry_run:
            print(f"  {Colors.CYAN}[DRY RUN]{Colors.ENDC} Would trigger Railway restart")
            return
        
        # Check if Railway CLI is available
        try:
            result = subprocess.run(["railway", "version"], capture_output=True, text=True)
            if result.returncode == 0:
                print(f"  Railway CLI detected: {result.stdout.strip()}")
                
                # Attempt to restart the service
                result = subprocess.run(["railway", "restart"], capture_output=True, text=True)
                if result.returncode == 0:
                    print(f"  {Colors.GREEN}✓{Colors.ENDC} Railway service restart triggered")
                else:
                    print(f"  {Colors.WARNING}⚠{Colors.ENDC} Railway restart failed: {result.stderr}")
            else:
                print(f"  {Colors.WARNING}⚠{Colors.ENDC} Railway CLI not available")
                print(f"  Please restart the service manually from Railway dashboard")
        except FileNotFoundError:
            print(f"  {Colors.WARNING}⚠{Colors.ENDC} Railway CLI not installed")
            print(f"  Please restart the service manually from Railway dashboard")
    
    async def run(self):
        """Execute the complete reset process."""
        try:
            # Show warning
            print(f"{Colors.FAIL}{Colors.BOLD}")
            print("="*60)
            print("WARNING: RAILWAY PRODUCTION DATABASE RESET")
            print("="*60)
            print(f"{Colors.ENDC}")
            print(f"Database: {os.getenv('DATABASE_URL', 'Not configured')[:50]}...")
            print(f"Redis: {os.getenv('REDIS_URL', 'Not configured')[:50]}...")
            
            if self.dry_run:
                print(f"\n{Colors.CYAN}Running in DRY RUN mode - no data will be deleted{Colors.ENDC}")
            else:
                print(f"\n{Colors.FAIL}This will DELETE ALL DATA from the production database!{Colors.ENDC}")
                print("Make sure you have a backup before proceeding.")
                
                # First confirmation
                response = input(f"\n{Colors.BOLD}Are you absolutely sure? Type 'DELETE ALL DATA' to confirm: {Colors.ENDC}")
                if response != "DELETE ALL DATA":
                    print(f"{Colors.CYAN}Operation cancelled.{Colors.ENDC}")
                    return
                
                # Second confirmation with countdown
                print(f"\n{Colors.WARNING}Final confirmation - proceeding in 5 seconds...{Colors.ENDC}")
                print("Press Ctrl+C to cancel")
                for i in range(5, 0, -1):
                    print(f"  {i}...", end='', flush=True)
                    time.sleep(1)
                print()
            
            # Connect to Redis
            await self.connect_redis()
            
            # Clear Redis cache
            await self.clear_redis()
            
            # Clear database
            await self.clear_database()
            
            # Initialize data
            if not self.dry_run:
                await self.initialize_data()
            
            # Verify reset
            await self.verify_reset()
            
            # Generate summary
            self.generate_summary()
            
            # Trigger Railway restart
            await self.trigger_railway_restart()
            
        except KeyboardInterrupt:
            print(f"\n{Colors.WARNING}Operation cancelled by user.{Colors.ENDC}")
            sys.exit(1)
        except Exception as e:
            print(f"\n{Colors.FAIL}❌ Reset failed: {e}{Colors.ENDC}")
            sys.exit(1)
        finally:
            # Cleanup
            if self.redis_client:
                await self.redis_client.close()
            await engine.dispose()


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Reset Railway production database and Redis cache",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run to see what would be deleted
  python reset_railway_production.py --dry-run
  
  # Full reset with confirmation
  python reset_railway_production.py --production-reset
  
  # Reset and seed master data
  python reset_railway_production.py --production-reset --seed-master-data

WARNING: This script will DELETE ALL DATA from the production database!
Always ensure you have a backup before running this script.
        """
    )
    
    parser.add_argument(
        '--production-reset',
        action='store_true',
        help='Confirm production reset (required for actual deletion)'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be deleted without actually deleting'
    )
    
    parser.add_argument(
        '--seed-master-data',
        action='store_true',
        help='Also seed master data (brands, categories, etc.) after reset'
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.production_reset and not args.dry_run:
        print(f"{Colors.FAIL}Error: Must specify either --production-reset or --dry-run{Colors.ENDC}")
        parser.print_help()
        sys.exit(1)
    
    # Check environment
    if args.production_reset and not os.getenv("DATABASE_URL"):
        print(f"{Colors.FAIL}Error: DATABASE_URL environment variable not set{Colors.ENDC}")
        sys.exit(1)
    
    # Create and run reset
    reset = RailwayReset(
        dry_run=args.dry_run,
        seed_master_data=args.seed_master_data
    )
    
    await reset.run()


if __name__ == "__main__":
    asyncio.run(main())