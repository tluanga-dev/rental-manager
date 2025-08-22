#!/usr/bin/env python3
"""
Apply production database fix for missing rental blocking columns
This script can be run with Railway CLI or with direct database connection
"""
import asyncio
import asyncpg
import sys
import os
from urllib.parse import urlparse

async def apply_production_fix():
    """Apply the rental blocking columns fix to production database"""
    
    # Try to get DATABASE_URL from environment (Railway sets this)
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL environment variable not found")
        print("This script should be run with: railway run python3 scripts/apply_production_fix.py")
        return False
    
    print("🚀 Applying Production Database Fix")
    print("=" * 50)
    
    # Handle asyncpg URL format
    if 'postgresql+asyncpg://' in database_url:
        database_url = database_url.replace('postgresql+asyncpg://', 'postgresql://')
    
    try:
        print(f"🔗 Connecting to production database...")
        conn = await asyncpg.connect(database_url)
        print("✅ Connected successfully")
        
        # Check current state
        print("\\n📋 Checking current rental columns...")
        current_rental_columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'items' 
            AND table_schema = 'public'
            AND column_name LIKE '%rental%'
            ORDER BY column_name
        """)
        
        print(f"Current rental-related columns: {len(current_rental_columns)}")
        for col in current_rental_columns:
            print(f"  - {col['column_name']}: {col['data_type']}")
        
        # Check for required columns
        required_columns = ['is_rental_blocked', 'rental_block_reason', 'rental_blocked_at', 'rental_blocked_by']
        existing_columns = [col['column_name'] for col in current_rental_columns]
        missing_columns = [col for col in required_columns if col not in existing_columns]
        
        print(f"\\n🔍 Analysis:")
        print(f"  Required: {required_columns}")
        print(f"  Existing: {existing_columns}")
        print(f"  Missing: {missing_columns}")
        
        if not missing_columns:
            print("\\n🎉 All rental blocking columns already exist!")
            await conn.close()
            return True
        
        # Apply fixes for missing columns
        print(f"\\n🔧 Adding {len(missing_columns)} missing columns...")
        
        # Add is_rental_blocked
        if 'is_rental_blocked' in missing_columns:
            await conn.execute("""
                ALTER TABLE items 
                ADD COLUMN is_rental_blocked BOOLEAN NOT NULL DEFAULT FALSE
            """)
            print("  ✅ Added is_rental_blocked")
        
        # Add rental_block_reason
        if 'rental_block_reason' in missing_columns:
            await conn.execute("""
                ALTER TABLE items 
                ADD COLUMN rental_block_reason TEXT
            """)
            print("  ✅ Added rental_block_reason")
        
        # Add rental_blocked_at
        if 'rental_blocked_at' in missing_columns:
            await conn.execute("""
                ALTER TABLE items 
                ADD COLUMN rental_blocked_at TIMESTAMP
            """)
            print("  ✅ Added rental_blocked_at")
        
        # Add rental_blocked_by
        if 'rental_blocked_by' in missing_columns:
            await conn.execute("""
                ALTER TABLE items 
                ADD COLUMN rental_blocked_by UUID
            """)
            print("  ✅ Added rental_blocked_by")
        
        # Add foreign key constraint
        try:
            await conn.execute("""
                ALTER TABLE items 
                ADD CONSTRAINT items_rental_blocked_by_fkey 
                FOREIGN KEY (rental_blocked_by) REFERENCES users(id)
                ON DELETE SET NULL
            """)
            print("  ✅ Added foreign key constraint")
        except Exception as e:
            if "already exists" in str(e):
                print("  ✅ Foreign key constraint already exists")
            else:
                print(f"  ⚠️ Foreign key constraint failed: {e}")
        
        # Verify final state
        print("\\n🔍 Final verification...")
        final_columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'items' 
            AND table_schema = 'public'
            AND column_name IN ('is_rental_blocked', 'rental_block_reason', 'rental_blocked_at', 'rental_blocked_by')
            ORDER BY column_name
        """)
        
        print(f"✅ Final rental blocking columns ({len(final_columns)}/4):")
        for col in final_columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            print(f"  - {col['column_name']}: {col['data_type']} {nullable}")
        
        # Test query
        print("\\n🧪 Testing sample query...")
        test_result = await conn.fetch("""
            SELECT id, item_name, is_rental_blocked, rental_block_reason 
            FROM items 
            LIMIT 1
        """)
        
        if test_result:
            print("✅ Sample query successful - columns working correctly")
        else:
            print("✅ No items in database yet, but columns added successfully")
        
        await conn.close()
        
        if len(final_columns) == 4:
            print("\\n🎉 SUCCESS! All rental blocking columns have been added to production!")
            print("✅ The inventory items endpoint should now work correctly")
            return True
        else:
            print(f"\\n⚠️ Partial success: {len(final_columns)}/4 columns added")
            return False
            
    except Exception as e:
        print(f"\\n❌ Error applying fix: {e}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        return False

def main():
    """Main function"""
    print("🚀 Production Database Fix - Rental Blocking Columns")
    
    # Check if running in Railway environment
    if os.getenv('RAILWAY_ENVIRONMENT'):
        print("🚂 Running in Railway environment")
    elif os.getenv('DATABASE_URL'):
        print("🔗 DATABASE_URL found, proceeding with fix")
    else:
        print("❌ Not in Railway environment and no DATABASE_URL found")
        print("Run with: railway run python3 scripts/apply_production_fix.py")
        sys.exit(1)
    
    # Run the async fix
    success = asyncio.run(apply_production_fix())
    
    if success:
        print("\\n✅ Production database fix completed successfully!")
        sys.exit(0)
    else:
        print("\\n❌ Production database fix failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()