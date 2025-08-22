#!/usr/bin/env python3
"""
Comprehensive fix for Railway production database
This script adds the missing rental blocking columns and verifies the fix
"""
import os
import asyncio
import asyncpg
import sys
from urllib.parse import urlparse

async def fix_production_database():
    """Fix missing rental blocking columns in Railway production database"""
    
    # Railway production database connection
    # This is the public connection string for the production database
    database_url = "postgresql://postgres:nJW5I3V5bhjyWdwH0qBR@containers-us-west-31.railway.app:5558/railway"
    
    print("🚀 Railway Production Database Fix")
    print("=" * 50)
    print(f"🔗 Connecting to Railway production database...")
    
    try:
        # Parse the URL to show connection details (without password)
        parsed = urlparse(database_url)
        print(f"📍 Host: {parsed.hostname}:{parsed.port}")
        print(f"📊 Database: {parsed.path[1:]}")  # Remove leading slash
        
        conn = await asyncpg.connect(database_url)
        print("✅ Connected to Railway production database successfully")
        
        # Check current schema
        print("\\n📋 Checking current items table schema...")
        check_columns_query = """
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'items' AND table_schema = 'public'
        ORDER BY ordinal_position
        """
        
        current_columns = await conn.fetch(check_columns_query)
        column_names = [row['column_name'] for row in current_columns]
        
        print(f"✅ Items table currently has {len(current_columns)} columns")
        
        # Check for rental blocking columns specifically
        rental_columns = {
            'is_rental_blocked': {
                'type': 'BOOLEAN',
                'nullable': 'NOT NULL',
                'default': 'DEFAULT FALSE'
            },
            'rental_block_reason': {
                'type': 'TEXT',
                'nullable': 'NULL',
                'default': ''
            },
            'rental_blocked_at': {
                'type': 'TIMESTAMP',
                'nullable': 'NULL',
                'default': ''
            },
            'rental_blocked_by': {
                'type': 'UUID',
                'nullable': 'NULL',
                'default': ''
            }
        }
        
        existing_rental_columns = [col for col in rental_columns.keys() if col in column_names]
        missing_rental_columns = [col for col in rental_columns.keys() if col not in column_names]
        
        print(f"\\n🔍 Rental Blocking Columns Status:")
        print(f"   ✅ Existing: {existing_rental_columns}")
        print(f"   ❌ Missing: {missing_rental_columns}")
        
        if not missing_rental_columns:
            print("\\n🎉 SUCCESS: All rental blocking columns already exist!")
            print("✅ No database fix needed.")
            await conn.close()
            return True
        
        # Create backup information
        print(f"\\n💾 Before making changes, current table info:")
        for col in current_columns:
            if 'rental' in col['column_name'] or col['column_name'] in rental_columns:
                print(f"   {col['column_name']}: {col['data_type']} {'NOT NULL' if col['is_nullable'] == 'NO' else 'NULL'}")
        
        # Apply missing columns
        print(f"\\n🔧 Adding {len(missing_rental_columns)} missing columns...")
        
        for column_name in missing_rental_columns:
            column_def = rental_columns[column_name]
            sql = f"ALTER TABLE items ADD COLUMN {column_name} {column_def['type']}"
            if column_def['nullable']:
                sql += f" {column_def['nullable']}"
            if column_def['default']:
                sql += f" {column_def['default']}"
            
            try:
                print(f"   ➕ Adding {column_name}...")
                print(f"      SQL: {sql}")
                await conn.execute(sql)
                print(f"   ✅ Successfully added: {column_name}")
            except Exception as e:
                print(f"   ❌ Failed to add {column_name}: {e}")
                # Continue with other columns
                continue
        
        # Final verification
        print(f"\\n🔍 Final verification...")
        final_columns = await conn.fetch(check_columns_query)
        final_column_names = [row['column_name'] for row in final_columns]
        final_rental_columns = [col for col in rental_columns.keys() if col in final_column_names]
        
        print(f"✅ Items table now has {len(final_columns)} columns")
        print(f"✅ Rental blocking columns present: {final_rental_columns}")
        
        # Show the specific rental columns that were added
        rental_column_details = await conn.fetch(f"""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'items' AND table_schema = 'public'
        AND column_name IN ('is_rental_blocked', 'rental_block_reason', 'rental_blocked_at', 'rental_blocked_by')
        ORDER BY column_name
        """)
        
        if rental_column_details:
            print("\\n📋 Added Rental Blocking Columns:")
            for col in rental_column_details:
                default_val = col['column_default'] or 'NULL'
                nullable = 'NOT NULL' if col['is_nullable'] == 'NO' else 'NULL'
                print(f"   ✅ {col['column_name']}: {col['data_type']} {nullable} DEFAULT {default_val}")
        
        if len(final_rental_columns) == 4:
            print("\\n🎉 SUCCESS: All rental blocking columns have been added to Railway production!")
            print("✅ The inventory items endpoint should now work correctly.")
            success = True
        else:
            print(f"\\n⚠️ Partial Success: {len(final_rental_columns)}/4 columns are present")
            success = False
        
        await conn.close()
        print("\\n🔌 Database connection closed")
        
        return success
        
    except Exception as e:
        print(f"\\n❌ Database Fix Error: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        return False

async def verify_fix():
    """Verify that the inventory API works after the fix"""
    print("\\n🧪 Verifying API Fix...")
    
    import aiohttp
    import json
    
    try:
        async with aiohttp.ClientSession() as session:
            # Test the health check
            async with session.get('https://rental-manager-backend-production.up.railway.app/api/health/detailed') as response:
                if response.status == 200:
                    data = await response.json()
                    db_schema_status = data.get('checks', {}).get('database_schema', {})
                    print(f"📊 Database Schema Status: {db_schema_status.get('status', 'unknown')}")
                    if db_schema_status.get('status') == 'healthy':
                        print("✅ Database schema is now healthy!")
                        return True
                    else:
                        print(f"⚠️ Database schema status: {db_schema_status.get('message', 'unknown')}")
                        return False
                else:
                    print(f"❌ Health check failed: {response.status}")
                    return False
                    
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False

async def main():
    """Main function to fix and verify"""
    print("🚀 Starting Railway Production Database Fix...")
    
    # Step 1: Fix the database
    fix_success = await fix_production_database()
    
    if fix_success:
        # Step 2: Wait a moment for the changes to propagate
        print("\\n⏳ Waiting 5 seconds for changes to propagate...")
        await asyncio.sleep(5)
        
        # Step 3: Verify the fix
        verify_success = await verify_fix()
        
        if verify_success:
            print("\\n🎉 COMPLETE SUCCESS!")
            print("✅ Database fixed and verified")
            print("✅ Inventory items endpoint should now work")
            print("\\n🔗 Test the fix at: https://www.omomrentals.shop/inventory/items")
        else:
            print("\\n⚠️ Database was fixed but verification failed")
            print("Please check the API manually")
    else:
        print("\\n❌ Database fix failed")
        print("Please try manual SQL approach or contact Railway support")
    
    print("\\n" + "=" * 50)
    print("Railway Production Database Fix Complete")

if __name__ == "__main__":
    asyncio.run(main())