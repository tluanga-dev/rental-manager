#!/usr/bin/env python3
"""
Script to fix missing return_line_details table in production.
This script checks if the damage tracking migration was applied and applies it if missing.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Set required environment variables
os.environ.setdefault('DATABASE_URL', 'postgresql://user:password@localhost/db')
os.environ.setdefault('SECRET_KEY', 'temp-secret-key-for-script')
os.environ.setdefault('REDIS_URL', 'redis://localhost:6379')
os.environ.setdefault('UPLOAD_DIRECTORY', str(backend_dir / 'uploads'))

from sqlalchemy import text
from app.core.database import get_async_session
from app.core.config import settings
import subprocess

async def check_migration_status():
    """Check if the damage tracking migration has been applied."""
    print("🔍 Checking migration status...")
    
    try:
        async for session in get_async_session():
            # Check if alembic_version table exists
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'alembic_version'
                );
            """))
            alembic_exists = result.scalar()
            
            if not alembic_exists:
                print("❌ Alembic version table doesn't exist. Database may not be initialized.")
                return False, None
            
            # Get current migration version
            result = await session.execute(text("SELECT version_num FROM alembic_version;"))
            current_version = result.scalar()
            print(f"📍 Current migration version: {current_version}")
            
            # Check if return_line_details table exists
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'return_line_details'
                );
            """))
            table_exists = result.scalar()
            print(f"📊 return_line_details table exists: {table_exists}")
            
            return table_exists, current_version
            
    except Exception as e:
        print(f"❌ Error checking migration status: {e}")
        return False, None

async def check_table_structure():
    """Check the structure of return_line_details table if it exists."""
    print("🔍 Checking return_line_details table structure...")
    
    try:
        async for session in get_async_session():
            result = await session.execute(text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'return_line_details'
                ORDER BY ordinal_position;
            """))
            columns = result.fetchall()
            
            if columns:
                print("📋 Table structure:")
                for col in columns:
                    nullable = "NULL" if col.is_nullable == "YES" else "NOT NULL"
                    print(f"   - {col.column_name}: {col.data_type} ({nullable})")
                return True
            else:
                print("❌ Table doesn't exist or has no columns")
                return False
                
    except Exception as e:
        print(f"❌ Error checking table structure: {e}")
        return False

def run_migration():
    """Run the Alembic migration to upgrade to head."""
    print("🚀 Running Alembic migration...")
    
    try:
        # Change to backend directory for alembic
        os.chdir(backend_dir)
        
        # Run alembic upgrade head
        result = subprocess.run(['alembic', 'upgrade', 'head'], 
                              capture_output=True, text=True, check=True)
        
        print("✅ Migration completed successfully!")
        print("📋 Migration output:")
        print(result.stdout)
        
        if result.stderr:
            print("⚠️ Migration warnings/errors:")
            print(result.stderr)
            
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Migration failed with exit code {e.returncode}")
        print(f"📋 Output: {e.stdout}")
        print(f"📋 Error: {e.stderr}")
        return False
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        return False

async def verify_fix():
    """Verify that the fix worked by testing table operations."""
    print("🧪 Testing return_line_details table operations...")
    
    try:
        async for session in get_async_session():
            # Try to select from the table (should not fail)
            result = await session.execute(text("""
                SELECT COUNT(*) FROM return_line_details;
            """))
            count = result.scalar()
            print(f"✅ Table is accessible. Current records: {count}")
            
            # Check that we can describe the table
            result = await session.execute(text("""
                SELECT COUNT(*) 
                FROM information_schema.columns 
                WHERE table_name = 'return_line_details';
            """))
            column_count = result.scalar()
            print(f"✅ Table has {column_count} columns")
            
            return True
            
    except Exception as e:
        print(f"❌ Error verifying fix: {e}")
        return False

async def main():
    """Main function to fix the missing return_line_details table."""
    print("🔧 Fixing missing return_line_details table...")
    print(f"🏗️ Backend directory: {backend_dir}")
    print(f"🗄️ Database URL: {settings.DATABASE_URL.replace(settings.DATABASE_URL.split('@')[0].split('//')[-1] + '@', '***@')}")
    
    # Step 1: Check current status
    table_exists, current_version = await check_migration_status()
    
    if table_exists:
        print("✅ return_line_details table already exists!")
        await check_table_structure()
        await verify_fix()
        return True
    
    print("🔧 Table is missing. Need to apply migration...")
    
    # Step 2: Run migration
    if run_migration():
        print("✅ Migration applied successfully!")
        
        # Step 3: Verify the fix
        table_exists, _ = await check_migration_status()
        if table_exists:
            await check_table_structure()
            if await verify_fix():
                print("🎉 Fix completed successfully!")
                print("💡 The return_line_details table is now available.")
                print("🔄 You may need to restart the application to clear any cached errors.")
                return True
        
    print("❌ Fix failed. Manual intervention may be required.")
    return False

if __name__ == "__main__":
    asyncio.run(main())