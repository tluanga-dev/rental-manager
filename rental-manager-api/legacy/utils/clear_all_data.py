#!/usr/bin/env python3
"""
Clear all data from database tables (for development/testing purposes)
"""
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def clear_all_data():
    """Clear all data from all tables in the correct order (respecting foreign keys)"""
    print("🚨 CLEARING ALL DATA FROM DATABASE")
    print("=" * 50)
    print("⚠️  WARNING: This will delete ALL data from the database!")
    print("   This operation is irreversible!")
    print("=" * 50)
    
    # Ask for confirmation
    confirmation = input("Are you sure you want to proceed? Type 'YES' to continue: ")
    if confirmation != 'YES':
        print("❌ Operation cancelled.")
        return False
    
    async with AsyncSessionLocal() as session:
        try:
            # Clear data in reverse dependency order to avoid foreign key conflicts
            tables_to_clear = [
                # Items and related data (if they exist)
                ("items", "🏷️  Items"),
                
                # Master data that might be referenced
                ("categories", "📁 Categories"),
                ("units_of_measurement", "📏 Units of Measurement"),
                
                # Business entities
                ("customers", "👥 Customers"),
                ("suppliers", "🏭 Suppliers"),
                
                # System data
                ("audit_logs", "📋 Audit Logs"),
                ("login_attempts", "🔐 Login Attempts"),
                ("system_backups", "💾 System Backups"),
                ("system_settings", "⚙️  System Settings"),
                
                # User and auth data
                ("user_roles", "👤 User Roles"),
                ("role_permissions", "🔑 Role Permissions"),
                ("refresh_tokens", "🎫 Refresh Tokens"),
                ("users", "👥 Users"),
                ("roles", "🎭 Roles"),
                ("permissions", "🔐 Permissions"),
                
                # Other entities
                ("companies", "🏢 Companies"),
                ("locations", "📍 Locations"),
                ("sku_sequences", "🔢 SKU Sequences"),
            ]
            
            cleared_count = 0
            total_records_deleted = 0
            
            for table_name, display_name in tables_to_clear:
                try:
                    # Check if table exists
                    result = await session.execute(text(f"""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_name = '{table_name}'
                        );
                    """))
                    table_exists = result.scalar()
                    
                    if not table_exists:
                        print(f"⏭️  {display_name}: Table doesn't exist, skipping...")
                        continue
                    
                    # Count records before deletion
                    result = await session.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                    record_count = result.scalar()
                    
                    if record_count == 0:
                        print(f"✅ {display_name}: Already empty")
                        continue
                    
                    # Delete all records
                    await session.execute(text(f"DELETE FROM {table_name}"))
                    print(f"🧹 {display_name}: Cleared {record_count} records")
                    
                    cleared_count += 1
                    total_records_deleted += record_count
                    
                except Exception as e:
                    print(f"❌ {display_name}: Error clearing - {e}")
                    continue
            
            # Commit all deletions
            await session.commit()
            
            print("\n" + "=" * 50)
            print("📊 CLEARING SUMMARY")
            print("=" * 50)
            print(f"✅ Tables cleared: {cleared_count}")
            print(f"🗑️  Total records deleted: {total_records_deleted}")
            print("🎉 Database clearing completed successfully!")
            
            return True
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Database clearing failed: {e}")
            return False

async def clear_specific_tables(table_names):
    """Clear specific tables only"""
    print(f"🧹 Clearing specific tables: {', '.join(table_names)}")
    
    async with AsyncSessionLocal() as session:
        try:
            cleared_count = 0
            total_records_deleted = 0
            
            for table_name in table_names:
                try:
                    # Check if table exists
                    result = await session.execute(text(f"""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_name = '{table_name}'
                        );
                    """))
                    table_exists = result.scalar()
                    
                    if not table_exists:
                        print(f"⏭️  {table_name}: Table doesn't exist, skipping...")
                        continue
                    
                    # Count records before deletion
                    result = await session.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                    record_count = result.scalar()
                    
                    if record_count == 0:
                        print(f"✅ {table_name}: Already empty")
                        continue
                    
                    # Delete all records
                    await session.execute(text(f"DELETE FROM {table_name}"))
                    print(f"🧹 {table_name}: Cleared {record_count} records")
                    
                    cleared_count += 1
                    total_records_deleted += record_count
                    
                except Exception as e:
                    print(f"❌ {table_name}: Error clearing - {e}")
                    continue
            
            # Commit all deletions
            await session.commit()
            
            print(f"\n✅ Cleared {cleared_count} tables, deleted {total_records_deleted} records")
            return True
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Table clearing failed: {e}")
            return False

if __name__ == "__main__":
    import sys
    
    async def main():
        if len(sys.argv) > 1:
            # Clear specific tables
            table_names = sys.argv[1:]
            await clear_specific_tables(table_names)
        else:
            # Clear all data
            await clear_all_data()
    
    asyncio.run(main())