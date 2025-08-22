#!/usr/bin/env python3
"""
Update Admin Password Script

This script updates the admin user's password hash in the database
with the new secure password.
"""

import asyncio
import sys
import os
import logging
from typing import Optional

# Add app directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, update
from app.core.database import AsyncSessionLocal, engine
from app.core.security import get_password_hash, verify_password
from app.modules.users.models import User
from app.modules.users.services import UserService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# New secure password
NEW_ADMIN_PASSWORD = "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"
ADMIN_USERNAME = "admin"


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


async def update_admin_password(session: AsyncSession) -> bool:
    """Update the admin user's password"""
    try:
        # Find admin user
        result = await session.execute(
            select(User).where(User.username == ADMIN_USERNAME)
        )
        admin_user = result.scalar_one_or_none()
        
        if not admin_user:
            logger.error(f"Admin user '{ADMIN_USERNAME}' not found")
            return False
        
        logger.info(f"Found admin user: {admin_user.username} (ID: {admin_user.id})")
        
        # Generate new password hash
        new_password_hash = get_password_hash(NEW_ADMIN_PASSWORD)
        logger.info("Generated new password hash")
        
        # Update password
        await session.execute(
            update(User)
            .where(User.id == admin_user.id)
            .values(password=new_password_hash)
        )
        await session.commit()
        
        logger.info("Admin password updated successfully")
        
        # Verify the password was updated correctly
        result = await session.execute(
            select(User).where(User.username == ADMIN_USERNAME)
        )
        updated_user = result.scalar_one_or_none()
        
        if updated_user and verify_password(NEW_ADMIN_PASSWORD, updated_user.password):
            logger.info("✅ Password verification successful")
            return True
        else:
            logger.error("❌ Password verification failed")
            return False
            
    except Exception as e:
        logger.error(f"Failed to update admin password: {e}")
        return False


async def main():
    """Main function to update admin password"""
    logger.info("Starting admin password update script...")
    
    # Check database connection
    if not await check_database_connection():
        logger.error("Cannot connect to database. Exiting.")
        sys.exit(1)
    
    try:
        async with AsyncSessionLocal() as session:
            if await update_admin_password(session):
                logger.info("Admin password update completed successfully")
                print(f"\n✅ Admin password updated to: {NEW_ADMIN_PASSWORD}")
                print("Please update your login credentials accordingly.")
                sys.exit(0)
            else:
                logger.error("Admin password update failed")
                sys.exit(1)
                
    except Exception as e:
        logger.error(f"Unexpected error during password update: {e}")
        sys.exit(1)


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())