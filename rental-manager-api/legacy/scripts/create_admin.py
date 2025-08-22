#!/usr/bin/env python3
"""
Admin User Creation Script

This script creates a default admin user for the FastAPI application.
It runs during container startup to ensure an admin account exists.
"""

import asyncio
import sys
import os
import logging
from typing import Optional

# Add app directory to Python path
import os
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import AsyncSessionLocal, engine
from app.core.security import get_password_hash
# Import all models to ensure relationships are properly initialized
from app.modules.users.models import User, UserProfile
from app.modules.auth.models import RefreshToken, LoginAttempt, PasswordResetToken
from app.modules.users.services import UserService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load admin configuration from settings
from app.core.config import settings

ADMIN_USERNAME = settings.ADMIN_USERNAME
ADMIN_EMAIL = settings.ADMIN_EMAIL
ADMIN_PASSWORD = settings.ADMIN_PASSWORD
ADMIN_FULL_NAME = settings.ADMIN_FULL_NAME


async def check_database_connection() -> bool:
    """Check if database is accessible"""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            logger.info("Database connection successful")
            return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False


async def admin_user_exists(session: AsyncSession) -> bool:
    """Check if admin user already exists"""
    try:
        user_service = UserService(session)
        admin_user = await user_service.get_by_username(ADMIN_USERNAME)
        return admin_user is not None
    except Exception as e:
        logger.error(f"Error checking for admin user: {e}")
        # If there's an error (like table doesn't exist), assume user doesn't exist
        return False


async def create_admin_user(session: AsyncSession) -> bool:
    """Create the admin user"""
    try:
        user_service = UserService(session)
        
        admin_data = {
            "username": ADMIN_USERNAME,
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,  # UserService.create will hash this
            "full_name": ADMIN_FULL_NAME,
            "is_active": True,
            "is_superuser": True,
            "is_verified": True
        }
        
        admin_user = await user_service.create(admin_data)
        logger.info(f"Admin user created successfully with ID: {admin_user.id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to create admin user: {e}")
        return False


async def main():
    """Main function to create admin user"""
    logger.info("Starting admin user creation script...")
    logger.info(f"Admin username: {ADMIN_USERNAME}")
    logger.info(f"Admin email: {ADMIN_EMAIL}")
    logger.info(f"Admin full name: {ADMIN_FULL_NAME}")
    
    # Validate admin credentials before proceeding
    try:
        # Test settings validation (will raise ValueError if invalid)
        from app.core.config import Settings
        test_settings = Settings()
        logger.info("✅ Admin credentials validation passed")
    except ValueError as e:
        logger.error(f"❌ Admin credentials validation failed: {e}")
        sys.exit(1)
    
    # Check database connection
    if not await check_database_connection():
        logger.error("Cannot connect to database. Exiting.")
        sys.exit(1)
    
    try:
        async with AsyncSessionLocal() as session:
            # Check if admin user already exists
            user_exists = await admin_user_exists(session)
            if user_exists:
                logger.info(f"Admin user with username '{ADMIN_USERNAME}' already exists. Skipping creation.")
                sys.exit(0)
            
            # Create admin user
            if await create_admin_user(session):
                logger.info("Admin user creation completed successfully")
                sys.exit(0)
            else:
                logger.error("Admin user creation failed")
                sys.exit(1)
                
    except Exception as e:
        logger.error(f"Unexpected error during admin user creation: {e}")
        sys.exit(1)


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())