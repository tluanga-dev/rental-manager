#!/usr/bin/env python3
"""
Test Railway database connection and table creation
This script can be run directly on Railway to debug database issues
"""
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

async def test_database_connection():
    """Test database connection and table creation"""
    print("=" * 60)
    print("Testing Railway Database Connection")
    print("=" * 60)
    
    try:
        # Get environment variables
        DATABASE_URL = os.getenv("DATABASE_URL")
        REDIS_URL = os.getenv("REDIS_URL")
        
        print(f"DATABASE_URL exists: {'Yes' if DATABASE_URL else 'No'}")
        print(f"REDIS_URL exists: {'Yes' if REDIS_URL else 'No'}")
        
        if DATABASE_URL:
            # Mask password in URL for security
            safe_url = DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'localhost'
            print(f"Database host: {safe_url}")
        
        if not DATABASE_URL:
            print("❌ DATABASE_URL not set!")
            return False
        
        # Test basic connection
        from sqlalchemy.ext.asyncio import create_async_engine
        
        print("\nTesting database connection...")
        engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
        
        # Test connection
        async with engine.begin() as conn:
            result = await conn.execute("SELECT 1 as test")
            test_value = result.scalar()
            print(f"✅ Database connection successful (test query result: {test_value})")
        
        # Check if tables exist
        print("\nChecking existing tables...")
        async with engine.begin() as conn:
            result = await conn.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            tables = [row[0] for row in result.fetchall()]
            
            if tables:
                print(f"✅ Found {len(tables)} existing tables:")
                for table in tables[:10]:  # Show first 10
                    print(f"  - {table}")
                if len(tables) > 10:
                    print(f"  ... and {len(tables) - 10} more")
            else:
                print("❌ No tables found in database")
        
        # Try to create tables
        print("\nAttempting to create tables...")
        
        # Import Base and all models
        from app.db.base import Base
        
        # Import all models to register them with Base
        print("Importing models...")
        try:
            from app.modules.auth.models import *
            print("  ✅ Auth models imported")
        except Exception as e:
            print(f"  ❌ Auth models failed: {e}")
            
        try:
            from app.modules.users.models import *
            print("  ✅ User models imported")
        except Exception as e:
            print(f"  ❌ User models failed: {e}")
            
        try:
            from app.modules.company.models import *
            print("  ✅ Company models imported")
        except Exception as e:
            print(f"  ❌ Company models failed: {e}")
            
        try:
            from app.modules.customers.models import *
            print("  ✅ Customer models imported")
        except Exception as e:
            print(f"  ❌ Customer models failed: {e}")
            
        try:
            from app.modules.suppliers.models import *
            print("  ✅ Supplier models imported")
        except Exception as e:
            print(f"  ❌ Supplier models failed: {e}")
            
        try:
            from app.modules.master_data.brands.models import *
            from app.modules.master_data.categories.models import *
            from app.modules.master_data.locations.models import *
            from app.modules.master_data.units.models import *
            from app.modules.master_data.item_master.models import *
            print("  ✅ Master data models imported")
        except Exception as e:
            print(f"  ❌ Master data models failed: {e}")
            
        try:
            from app.modules.inventory.models import *
            print("  ✅ Inventory models imported")
        except Exception as e:
            print(f"  ❌ Inventory models failed: {e}")
            
        try:
            from app.modules.transactions.base.models.transaction_headers import *
            from app.modules.transactions.base.models.transaction_lines import *
            from app.modules.transactions.base.models.rental_lifecycle import *
            print("  ✅ Transaction models imported")
        except Exception as e:
            print(f"  ❌ Transaction models failed: {e}")
            
        try:
            from app.modules.system.models import *
            print("  ✅ System models imported")
        except Exception as e:
            print(f"  ❌ System models failed: {e}")
        
        # Create all tables
        print(f"\nCreating tables from {len(Base.metadata.tables)} registered models...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            print("✅ All tables created successfully")
        
        # Verify tables were created
        print("\nVerifying table creation...")
        async with engine.begin() as conn:
            result = await conn.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """)
            new_tables = [row[0] for row in result.fetchall()]
            print(f"✅ Database now has {len(new_tables)} tables")
        
        await engine.dispose()
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_admin_user_creation():
    """Test admin user creation"""
    print("\n" + "=" * 60)
    print("Testing Admin User Creation")
    print("=" * 60)
    
    try:
        DATABASE_URL = os.getenv("DATABASE_URL")
        if not DATABASE_URL:
            print("❌ DATABASE_URL not set!")
            return False
        
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import select
        
        from app.modules.users.models import User
        from app.core.security import get_password_hash
        
        # Admin credentials from environment
        admin_username = os.getenv("ADMIN_USERNAME", "admin")
        admin_email = os.getenv("ADMIN_EMAIL", "admin@admin.com")
        admin_password = os.getenv("ADMIN_PASSWORD", "AdminSecure@Password123!")
        admin_full_name = os.getenv("ADMIN_FULL_NAME", "System Administrator")
        
        print(f"Admin username: {admin_username}")
        print(f"Admin email: {admin_email}")
        print(f"Admin password length: {len(admin_password)} chars")
        
        engine = create_async_engine(DATABASE_URL, echo=False)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session() as session:
            # Check if admin already exists
            result = await session.execute(
                select(User).where(User.username == admin_username)
            )
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print(f"✅ Admin user '{admin_username}' already exists")
                print(f"   Email: {existing_user.email}")
                print(f"   Is Superuser: {existing_user.is_superuser}")
                print(f"   Is Active: {existing_user.is_active}")
                return True
            
            # Create new admin user
            print(f"Creating new admin user '{admin_username}'...")
            hashed_password = get_password_hash(admin_password)
            
            admin_user = User(
                username=admin_username,
                email=admin_email,
                full_name=admin_full_name,
                hashed_password=hashed_password,
                is_active=True,
                is_superuser=True
            )
            
            session.add(admin_user)
            await session.commit()
            
            print(f"✅ Admin user '{admin_username}' created successfully!")
            return True
            
        await engine.dispose()
        
    except Exception as e:
        print(f"❌ Admin user creation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Railway Database Connection Test")
    print(f"Python version: {sys.version}")
    print(f"Working directory: {os.getcwd()}")
    
    # Test database connection and table creation
    db_success = asyncio.run(test_database_connection())
    
    if db_success:
        # Test admin user creation
        admin_success = asyncio.run(test_admin_user_creation())
        
        print("\n" + "=" * 60)
        print("FINAL SUMMARY")
        print("=" * 60)
        
        if admin_success:
            print("✅ Database and admin user are working correctly!")
            print("   Railway deployment should now be fully functional.")
        else:
            print("⚠️  Database works but admin user creation failed.")
            print("   Check admin user creation logic and environment variables.")
    else:
        print("\n" + "=" * 60)
        print("❌ Database connection failed!")
        print("   Check DATABASE_URL and database server status.")
    
    print("=" * 60)