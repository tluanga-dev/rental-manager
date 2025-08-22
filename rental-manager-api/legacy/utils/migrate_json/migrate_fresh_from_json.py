#!/usr/bin/env python3
"""
Fresh migration script - clears ALL data and migrates from JSON files
"""
import asyncio
import sys
import os
from pathlib import Path

# Add the project root directory to the path so we can import the app modules
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Change to project root directory for relative paths to work
if not os.getcwd().endswith('rental-manager-backend'):
    os.chdir(project_root)

from utils.migrate_json.migrate_all_from_json import migrate_all, verify_all

async def migrate_fresh():
    """Clear all data and run fresh migration from JSON files"""
    print("🔄 FRESH MIGRATION FROM JSON FILES")
    print("=" * 60)
    print("⚠️  WARNING: This will DELETE ALL existing data!")
    print("   Then populate with fresh data from JSON files.")
    print("=" * 60)
    
    # Ask for confirmation
    confirmation = input("Are you sure you want to proceed? Type 'YES' to continue: ")
    if confirmation != 'YES':
        print("❌ Operation cancelled.")
        return False
    
    print("\n🗑️  STEP 1: CLEARING ALL EXISTING DATA")
    print("=" * 50)
    
    # Import clear_all_data from utils directory
    from utils.clear_all_data import clear_all_data
    
    # Clear all existing data
    if not await clear_all_data():
        print("❌ Failed to clear existing data. Aborting migration.")
        return False
    
    print("\n📥 STEP 2: MIGRATING FRESH DATA FROM JSON")
    print("=" * 50)
    
    # Run fresh migration
    if not await migrate_all():
        print("❌ Fresh migration failed.")
        return False
    
    print("\n🔍 STEP 3: VERIFYING FRESH DATA")
    print("=" * 40)
    
    # Verify the migration
    if not await verify_all():
        print("⚠️  Fresh migration completed but verification failed.")
        return False
    
    print("\n🎊 FRESH MIGRATION COMPLETED SUCCESSFULLY!")
    print("=" * 60)
    print("Your database now contains only fresh data from JSON files.")
    print("All previous data has been completely removed.")
    
    return True

async def migrate_fresh_specific(table_names):
    """Clear specific tables and run their migrations"""
    print(f"🔄 FRESH MIGRATION FOR SPECIFIC TABLES: {', '.join(table_names)}")
    print("=" * 60)
    
    # Import specific migration functions
    from utils.clear_all_data import clear_specific_tables
    from utils.migrate_json.migrate_customers_from_json import migrate_customers
    from utils.migrate_json.migrate_suppliers_from_json import migrate_suppliers
    from utils.migrate_json.migrate_categories_from_json import migrate_categories
    from utils.migrate_json.migrate_units_from_json import migrate_units
    
    # Clear specific tables
    print(f"\n🗑️  Clearing tables: {', '.join(table_names)}")
    if not await clear_specific_tables(table_names):
        print("❌ Failed to clear tables. Aborting migration.")
        return False
    
    # Run specific migrations
    print(f"\n📥 Running migrations for: {', '.join(table_names)}")
    success_count = 0
    
    for table_name in table_names:
        try:
            if table_name == 'customers':
                if await migrate_customers():
                    print("✅ Customers migration completed!")
                    success_count += 1
                else:
                    print("❌ Customers migration failed!")
            
            elif table_name == 'suppliers':
                if await migrate_suppliers():
                    print("✅ Suppliers migration completed!")
                    success_count += 1
                else:
                    print("❌ Suppliers migration failed!")
            
            elif table_name == 'categories':
                if await migrate_categories():
                    print("✅ Categories migration completed!")
                    success_count += 1
                else:
                    print("❌ Categories migration failed!")
            
            elif table_name == 'units_of_measurement':
                if await migrate_units():
                    print("✅ Units migration completed!")
                    success_count += 1
                else:
                    print("❌ Units migration failed!")
            
            else:
                print(f"⚠️  Unknown table: {table_name}")
        
        except Exception as e:
            print(f"❌ Error migrating {table_name}: {e}")
    
    print(f"\n📊 Completed {success_count}/{len(table_names)} migrations")
    return success_count == len(table_names)

if __name__ == "__main__":
    async def main():
        if len(sys.argv) > 1:
            # Fresh migration for specific tables
            table_names = sys.argv[1:]
            success = await migrate_fresh_specific(table_names)
        else:
            # Full fresh migration
            success = await migrate_fresh()
        
        if not success:
            sys.exit(1)
    
    asyncio.run(main())