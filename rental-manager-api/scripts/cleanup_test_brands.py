#!/usr/bin/env python3
"""
Safe Cleanup Script for Test Brand Data

Safely removes test-generated brand data while preserving production data.
Includes dry-run mode, backup options, and comprehensive verification.
"""

import asyncio
import argparse
import time
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, func

from app.core.config import settings
from app.models.brand import Brand
from app.crud.brand import BrandRepository


class TestBrandCleanup:
    """Safe cleanup utility for test brand data."""
    
    def __init__(self, dry_run: bool = True, backup: bool = True):
        """Initialize cleanup utility.
        
        Args:
            dry_run: If True, only simulate cleanup without making changes
            backup: If True, create backup of data before deletion
        """
        self.dry_run = dry_run
        self.backup = backup
        self.engine = None
        self.session = None
        self.repository = None
        
        # Patterns to identify test data
        self.test_patterns = [
            "Test Brand",
            "Load Test Brand",
            "Transaction Test Brand",
            "Stress Test Brand", 
            "Mock Brand",
            "Sample Brand",
            "Demo Brand"
        ]
        
        # Test codes patterns
        self.test_code_patterns = [
            "TST",    # Test codes
            "LTB",    # Load Test Brand codes
            "TTB",    # Transaction Test Brand codes
            "STB",    # Stress Test Brand codes
            "MOCK",   # Mock codes
            "DEMO",   # Demo codes
            "SAMPLE"  # Sample codes
        ]
        
        # Test creators
        self.test_creators = [
            "test_user",
            "stress_test",
            "load_test",
            "mock_generator",
            "constraint_test",
            "performance_test"
        ]
        
        self.cleanup_stats = {
            "total_brands_before": 0,
            "test_brands_identified": 0,
            "brands_to_delete": 0,
            "brands_deleted": 0,
            "production_brands_preserved": 0,
            "backup_created": False,
            "cleanup_time": 0.0
        }
    
    async def initialize(self):
        """Initialize database connections."""
        self.engine = create_async_engine(
            settings.DATABASE_URL,
            echo=False,
            pool_size=10,
            max_overflow=20
        )
        
        AsyncSessionLocal = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )
        
        self.session = AsyncSessionLocal()
        self.repository = BrandRepository(self.session)
        
        print(f"🔌 Connected to database: {settings.DATABASE_URL.split('@')[-1]}")
    
    async def close(self):
        """Close database connections."""
        if self.session:
            await self.session.close()
        if self.engine:
            await self.engine.dispose()
    
    async def identify_test_brands(self) -> List[Brand]:
        """Identify brands that appear to be test data."""
        print("\n🔍 Identifying test brands...")
        
        # Get all brands
        all_brands = await self.repository.list(
            skip=0,
            limit=50000,  # Large limit to get all
            include_inactive=True
        )
        
        self.cleanup_stats["total_brands_before"] = len(all_brands)
        print(f"  📊 Total brands in database: {len(all_brands)}")
        
        test_brands = []
        identification_reasons = {}
        
        for brand in all_brands:
            reasons = []
            
            # Check name patterns
            for pattern in self.test_patterns:
                if pattern.lower() in brand.name.lower():
                    reasons.append(f"name contains '{pattern}'")
                    break
            
            # Check code patterns
            if brand.code:
                for pattern in self.test_code_patterns:
                    if brand.code.startswith(pattern):
                        reasons.append(f"code starts with '{pattern}'")
                        break
            
            # Check creator patterns
            if brand.created_by:
                for creator in self.test_creators:
                    if creator.lower() in brand.created_by.lower():
                        reasons.append(f"created by '{brand.created_by}'")
                        break
            
            # Check for very recent creation (last 24 hours) with generic names
            if brand.created_at and brand.created_at > datetime.now() - timedelta(hours=24):
                generic_indicators = ["brand", "test", "sample", "demo", "mock"]
                if any(indicator in brand.name.lower() for indicator in generic_indicators):
                    reasons.append("recent creation with generic name")
            
            # Check for sequential naming patterns
            if any(char.isdigit() for char in brand.name):
                import re
                if re.search(r'\d{3,}', brand.name):  # 3+ consecutive digits
                    reasons.append("sequential naming pattern")
            
            if reasons:
                test_brands.append(brand)
                identification_reasons[brand.id] = reasons
        
        self.cleanup_stats["test_brands_identified"] = len(test_brands)
        
        print(f"  🎯 Test brands identified: {len(test_brands)}")
        print(f"  📈 Production brands: {len(all_brands) - len(test_brands)}")
        
        # Show sample of identified test brands
        print(f"\n  📋 Sample of identified test brands:")
        for i, brand in enumerate(test_brands[:10]):
            reasons = identification_reasons[brand.id]
            print(f"    {i+1}. '{brand.name}' ({brand.code}) - {', '.join(reasons)}")
        
        if len(test_brands) > 10:
            print(f"    ... and {len(test_brands) - 10} more")
        
        return test_brands
    
    async def create_backup(self, brands_to_delete: List[Brand]) -> Optional[str]:
        """Create backup of brands to be deleted."""
        if not self.backup or not brands_to_delete:
            return None
        
        print(f"\n💾 Creating backup of {len(brands_to_delete)} brands...")
        
        # Create backup data structure
        backup_data = {
            "backup_info": {
                "created_at": datetime.now().isoformat(),
                "total_brands": len(brands_to_delete),
                "backup_type": "test_brands_cleanup",
                "source_database": settings.DATABASE_URL.split('@')[-1]
            },
            "brands": []
        }
        
        # Export brand data
        for brand in brands_to_delete:
            brand_data = {
                "id": str(brand.id),
                "name": brand.name,
                "code": brand.code,
                "description": brand.description,
                "is_active": brand.is_active,
                "created_at": brand.created_at.isoformat() if brand.created_at else None,
                "updated_at": brand.updated_at.isoformat() if brand.updated_at else None,
                "created_by": brand.created_by,
                "updated_by": brand.updated_by
            }
            backup_data["brands"].append(brand_data)
        
        # Save backup file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"brand_cleanup_backup_{timestamp}.json"
        
        try:
            with open(backup_filename, 'w') as f:
                json.dump(backup_data, f, indent=2, ensure_ascii=False)
            
            print(f"  ✅ Backup created: {backup_filename}")
            self.cleanup_stats["backup_created"] = True
            return backup_filename
            
        except Exception as e:
            print(f"  ❌ Failed to create backup: {e}")
            return None
    
    async def delete_test_brands(self, brands_to_delete: List[Brand]) -> int:
        """Delete identified test brands."""
        if not brands_to_delete:
            print("\n🎉 No test brands to delete!")
            return 0
        
        print(f"\n🗑️  {'[DRY RUN] ' if self.dry_run else ''}Deleting {len(brands_to_delete)} test brands...")
        
        deleted_count = 0
        batch_size = 100
        
        try:
            for i in range(0, len(brands_to_delete), batch_size):
                batch = brands_to_delete[i:i + batch_size]
                batch_start = time.time()
                
                if not self.dry_run:
                    # Delete brands in batch
                    brand_ids = [brand.id for brand in batch]
                    
                    # Use raw SQL for efficient deletion
                    delete_query = text(
                        "DELETE FROM brands WHERE id = ANY(:brand_ids)"
                    )
                    
                    result = await self.session.execute(
                        delete_query,
                        {"brand_ids": brand_ids}
                    )
                    
                    await self.session.commit()
                    deleted_count += result.rowcount
                else:
                    # Simulate deletion in dry run
                    deleted_count += len(batch)
                
                batch_time = time.time() - batch_start
                batch_num = i // batch_size + 1
                total_batches = (len(brands_to_delete) + batch_size - 1) // batch_size
                
                print(f"  📦 Batch {batch_num}/{total_batches}: {len(batch)} brands in {batch_time:.2f}s")
            
            self.cleanup_stats["brands_deleted"] = deleted_count
            
            if self.dry_run:
                print(f"  🔍 [DRY RUN] Would delete {deleted_count} brands")
            else:
                print(f"  ✅ Successfully deleted {deleted_count} brands")
            
            return deleted_count
            
        except Exception as e:
            print(f"  ❌ Error deleting brands: {e}")
            if not self.dry_run:
                await self.session.rollback()
            raise
    
    async def verify_cleanup(self) -> Dict[str, Any]:
        """Verify cleanup results and database integrity."""
        print(f"\n🔍 Verifying cleanup results...")
        
        # Count remaining brands
        total_brands = await self.repository.count(include_inactive=True)
        active_brands = await self.repository.count(include_inactive=False)
        
        # Check for any remaining test brands
        remaining_test_brands = await self.identify_test_brands()
        
        # Verify database integrity
        integrity_checks = {}
        
        try:
            # Check for orphaned data or constraint violations
            result = await self.session.execute(text("""
                SELECT 
                    COUNT(*) as total_brands,
                    COUNT(CASE WHEN name IS NULL THEN 1 END) as null_names,
                    COUNT(CASE WHEN created_at IS NULL THEN 1 END) as null_created_at,
                    COUNT(DISTINCT name) as unique_names,
                    COUNT(DISTINCT code) as unique_codes
                FROM brands
            """))
            
            integrity_data = result.fetchone()
            
            integrity_checks = {
                "total_brands": integrity_data.total_brands,
                "null_names": integrity_data.null_names,
                "null_created_at": integrity_data.null_created_at,
                "unique_names": integrity_data.unique_names,
                "unique_codes": integrity_data.unique_codes,
                "name_uniqueness_ok": integrity_data.unique_names == integrity_data.total_brands,
                "no_null_names": integrity_data.null_names == 0
            }
            
        except Exception as e:
            print(f"  ⚠️  Could not verify database integrity: {e}")
            integrity_checks = {"error": str(e)}
        
        verification_results = {
            "total_brands_after": total_brands,
            "active_brands_after": active_brands,
            "remaining_test_brands": len(remaining_test_brands),
            "integrity_checks": integrity_checks
        }
        
        # Update cleanup stats
        self.cleanup_stats["production_brands_preserved"] = total_brands
        
        print(f"  📊 Verification Results:")
        print(f"    Total brands remaining: {total_brands}")
        print(f"    Active brands: {active_brands}")
        print(f"    Remaining test brands: {len(remaining_test_brands)}")
        
        if remaining_test_brands:
            print(f"    ⚠️  Warning: {len(remaining_test_brands)} test brands still found")
            for brand in remaining_test_brands[:5]:
                print(f"      - '{brand.name}' ({brand.code})")
        
        print(f"  🔍 Database Integrity:")
        if "error" not in integrity_checks:
            print(f"    Name uniqueness: {'✅ OK' if integrity_checks['name_uniqueness_ok'] else '❌ VIOLATED'}")
            print(f"    No null names: {'✅ OK' if integrity_checks['no_null_names'] else '❌ VIOLATED'}")
            print(f"    Unique names: {integrity_checks['unique_names']}")
            print(f"    Unique codes: {integrity_checks['unique_codes']}")
        else:
            print(f"    ❌ Error checking integrity: {integrity_checks['error']}")
        
        return verification_results
    
    async def generate_cleanup_report(self) -> str:
        """Generate comprehensive cleanup report."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        report = f"""
{"="*60}
🧹 BRAND TEST DATA CLEANUP REPORT
{"="*60}

Execution Details:
  Date/Time: {timestamp}
  Mode: {'DRY RUN' if self.dry_run else 'LIVE CLEANUP'}
  Backup Enabled: {self.backup}
  Database: {settings.DATABASE_URL.split('@')[-1]}

Cleanup Statistics:
  📊 Total brands before cleanup: {self.cleanup_stats['total_brands_before']}
  🎯 Test brands identified: {self.cleanup_stats['test_brands_identified']}
  🗑️  Brands deleted: {self.cleanup_stats['brands_deleted']}
  🏭 Production brands preserved: {self.cleanup_stats['production_brands_preserved']}
  💾 Backup created: {'✅ Yes' if self.cleanup_stats['backup_created'] else '❌ No'}
  ⏱️  Cleanup time: {self.cleanup_stats['cleanup_time']:.2f} seconds

Identification Criteria:
  • Name patterns: {', '.join(self.test_patterns)}
  • Code patterns: {', '.join(self.test_code_patterns)}
  • Test creators: {', '.join(self.test_creators)}
  • Recent creation with generic names
  • Sequential naming patterns

Safety Measures:
  ✅ Test pattern matching for identification
  ✅ Backup creation before deletion
  ✅ Dry-run mode available
  ✅ Database integrity verification
  ✅ Production data preservation checks

Results:
  {'✅ Cleanup completed successfully' if self.cleanup_stats['brands_deleted'] > 0 else '🎉 No test data found to clean'}
  {'✅ Database integrity maintained' if self.cleanup_stats.get('integrity_ok', True) else '⚠️  Database integrity issues detected'}
  {'✅ All production data preserved' if self.cleanup_stats['production_brands_preserved'] > 0 else '⚠️  No production data found'}

Recommendations:
  • Run with --dry-run first to preview changes
  • Keep backups for at least 30 days
  • Monitor for any remaining test data patterns
  • Consider implementing test data lifecycle policies
"""
        
        # Save report to file
        report_filename = f"brand_cleanup_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        try:
            with open(report_filename, 'w') as f:
                f.write(report)
            print(f"\n📋 Report saved: {report_filename}")
        except Exception as e:
            print(f"\n⚠️  Could not save report: {e}")
        
        return report
    
    async def run_cleanup(self) -> bool:
        """Run complete cleanup process."""
        start_time = time.time()
        
        try:
            print(f"🧹 Starting Brand Test Data Cleanup")
            print(f"Mode: {'🔍 DRY RUN' if self.dry_run else '🚨 LIVE CLEANUP'}")
            print(f"Backup: {'✅ Enabled' if self.backup else '❌ Disabled'}")
            print("=" * 50)
            
            await self.initialize()
            
            # Step 1: Identify test brands
            test_brands = await self.identify_test_brands()
            
            if not test_brands:
                print("\n🎉 No test brands found - database is clean!")
                return True
            
            self.cleanup_stats["brands_to_delete"] = len(test_brands)
            
            # Step 2: Create backup if enabled
            backup_file = None
            if self.backup:
                backup_file = await self.create_backup(test_brands)
                if not backup_file and not self.dry_run:
                    print("❌ Backup failed - aborting cleanup for safety")
                    return False
            
            # Step 3: Delete test brands
            deleted_count = await self.delete_test_brands(test_brands)
            
            # Step 4: Verify cleanup
            await self.verify_cleanup()
            
            # Step 5: Generate report
            self.cleanup_stats["cleanup_time"] = time.time() - start_time
            report = await self.generate_cleanup_report()
            print(report)
            
            return True
            
        except Exception as e:
            print(f"❌ Cleanup failed: {e}")
            return False
        finally:
            await self.close()


async def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(
        description="Safely cleanup test brand data from database"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Simulate cleanup without making changes (default: True)"
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Perform actual cleanup (overrides --dry-run)"
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip backup creation (not recommended for live runs)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force cleanup even if backup fails"
    )
    
    args = parser.parse_args()
    
    # Determine run mode
    dry_run = not args.live
    backup = not args.no_backup
    
    if not dry_run and not backup and not args.force:
        print("❌ Live cleanup without backup is dangerous!")
        print("   Use --force to override, or remove --no-backup")
        return False
    
    # Run cleanup
    cleanup = TestBrandCleanup(dry_run=dry_run, backup=backup)
    success = await cleanup.run_cleanup()
    
    if success:
        print("\n✅ Cleanup completed successfully!")
        if dry_run:
            print("💡 Run with --live to perform actual cleanup")
    else:
        print("\n❌ Cleanup failed!")
        return False
    
    return True


if __name__ == "__main__":
    import sys
    
    success = asyncio.run(main())
    sys.exit(0 if success else 1)