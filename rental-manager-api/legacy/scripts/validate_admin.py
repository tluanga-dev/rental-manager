#!/usr/bin/env python3
"""
Admin User Validation Script

This script validates that the admin user exists and can authenticate properly.
Useful for testing after initialization or deployment.
"""

import asyncio
import sys
import os
import logging
import httpx
from typing import Optional

# Add app directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from app.core.config import settings
from app.core.security import verify_password

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def check_admin_in_database() -> bool:
    """Check if admin user exists in database and password is correct"""
    try:
        async with AsyncSessionLocal() as session:
            from app.modules.users.services import UserService
            user_service = UserService(session)
            
            # Check if admin user exists
            admin_user = await user_service.get_by_username(settings.ADMIN_USERNAME)
            if not admin_user:
                logger.error(f"❌ Admin user '{settings.ADMIN_USERNAME}' not found in database")
                return False
            
            logger.info(f"✅ Admin user '{settings.ADMIN_USERNAME}' found in database")
            
            # Verify password
            if verify_password(settings.ADMIN_PASSWORD, admin_user.password):
                logger.info("✅ Admin password verification successful")
            else:
                logger.error("❌ Admin password verification failed")
                return False
            
            # Check user properties
            logger.info(f"  - Email: {admin_user.email}")
            logger.info(f"  - Full Name: {admin_user.full_name}")
            logger.info(f"  - Is Active: {admin_user.is_active}")
            logger.info(f"  - Is Superuser: {admin_user.is_superuser}")
            logger.info(f"  - Is Verified: {admin_user.is_verified}")
            
            if not admin_user.is_active:
                logger.warning("⚠️  Admin user is not active")
                return False
            
            if not admin_user.is_superuser:
                logger.warning("⚠️  Admin user is not a superuser")
                return False
            
            return True
            
    except Exception as e:
        logger.error(f"❌ Database check failed: {e}")
        return False


async def test_admin_api_login(base_url: str = "http://localhost:8000") -> bool:
    """Test admin login via API"""
    try:
        logger.info(f"Testing admin API login at {base_url}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test login endpoint
            login_payload = {
                "username": settings.ADMIN_USERNAME,
                "password": settings.ADMIN_PASSWORD
            }
            
            response = await client.post(
                f"{base_url}/api/auth/login",
                json=login_payload
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info("✅ Admin API login successful")
                
                # Test protected endpoint
                access_token = data.get('access_token')
                if access_token:
                    profile_response = await client.get(
                        f"{base_url}/api/auth/me",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    
                    if profile_response.status_code == 200:
                        profile_data = profile_response.json()
                        logger.info("✅ Admin protected endpoint access successful")
                        logger.info(f"  - Profile Username: {profile_data.get('username')}")
                        logger.info(f"  - Profile Email: {profile_data.get('email')}")
                        return True
                    else:
                        logger.error(f"❌ Admin protected endpoint failed: {profile_response.status_code}")
                        return False
                else:
                    logger.error("❌ No access token received")
                    return False
            else:
                logger.error(f"❌ Admin API login failed: {response.status_code}")
                if response.status_code == 422:
                    logger.error(f"  Validation error: {response.json()}")
                elif response.status_code == 401:
                    logger.error("  Invalid credentials")
                return False
                
    except httpx.ConnectError:
        logger.error(f"❌ Could not connect to API server at {base_url}")
        logger.info("  Make sure the FastAPI server is running")
        return False
    except Exception as e:
        logger.error(f"❌ API test failed: {e}")
        return False


async def validate_admin_configuration() -> bool:
    """Validate admin configuration settings"""
    try:
        logger.info("Validating admin configuration...")
        
        # Test configuration loading
        from app.core.config import Settings
        test_settings = Settings()
        
        logger.info("✅ Configuration validation passed")
        logger.info(f"  - Username: {test_settings.ADMIN_USERNAME}")
        logger.info(f"  - Email: {test_settings.ADMIN_EMAIL}")
        logger.info(f"  - Full Name: {test_settings.ADMIN_FULL_NAME}")
        logger.info(f"  - Password Length: {len(test_settings.ADMIN_PASSWORD)} characters")
        
        return True
        
    except ValueError as e:
        logger.error(f"❌ Configuration validation failed: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Configuration check failed: {e}")
        return False


async def check_database_connection() -> bool:
    """Check database connectivity"""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            logger.info("✅ Database connection successful")
            return True
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        return False


async def main():
    """Main validation function"""
    print("🔍 Admin User Validation")
    print("=" * 30)
    
    # Configuration validation
    print("\n📋 Configuration Validation:")
    config_valid = await validate_admin_configuration()
    
    if not config_valid:
        print("\n❌ Configuration validation failed. Cannot proceed.")
        sys.exit(1)
    
    # Database connectivity
    print("\n🗄️  Database Connectivity:")
    db_connected = await check_database_connection()
    
    if not db_connected:
        print("\n❌ Database connection failed. Cannot proceed.")
        sys.exit(1)
    
    # Database admin check
    print("\n👤 Database Admin User Check:")
    admin_in_db = await check_admin_in_database()
    
    # API tests (optional - server might not be running)
    print("\n🌐 API Authentication Test:")
    api_working = await test_admin_api_login()
    
    # Summary
    print("\n📊 Validation Summary:")
    print("-" * 25)
    print(f"  Configuration: {'✅ Valid' if config_valid else '❌ Invalid'}")
    print(f"  Database: {'✅ Connected' if db_connected else '❌ Failed'}")
    print(f"  Admin in DB: {'✅ Valid' if admin_in_db else '❌ Invalid'}")
    print(f"  API Login: {'✅ Working' if api_working else '❌ Failed/Server not running'}")
    
    if config_valid and db_connected and admin_in_db:
        print("\n🎉 Admin user validation successful!")
        print(f"\n🔐 Admin Login Credentials:")
        print(f"  Username: {settings.ADMIN_USERNAME}")
        print(f"  Password: {settings.ADMIN_PASSWORD[:8]}...")
        
        if not api_working:
            print("\n💡 To test API login, start the server:")
            print("  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        
        sys.exit(0)
    else:
        print("\n❌ Admin user validation failed!")
        print("\nTroubleshooting:")
        if not config_valid:
            print("  - Check your .env file admin configuration")
        if not db_connected:
            print("  - Ensure PostgreSQL is running")
            print("  - Check DATABASE_URL in .env file")
        if not admin_in_db:
            print("  - Run: python scripts/create_admin.py")
            print("  - Or run: python scripts/init_local_dev.py")
        
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️  Validation cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)