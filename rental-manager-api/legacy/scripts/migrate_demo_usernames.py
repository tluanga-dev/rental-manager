#!/usr/bin/env python3
"""
Migrate Demo User Usernames

This script updates existing demo users to use proper usernames instead of email-format usernames.
"""

import asyncio
import sys
import os
import logging
from typing import Dict, List

# Add app directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.database import AsyncSessionLocal
from app.modules.users.models import User

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Migration mappings for demo users
DEMO_USER_MIGRATIONS = {
    "manager@manager.com": {
        "new_username": "manager",
        "new_email": "manager@company.com",
        "description": "Operations Manager demo account"
    },
    "staff@staff.com": {
        "new_username": "staff", 
        "new_email": "staff@company.com",
        "description": "Staff Member demo account"
    }
}


async def check_database_connection() -> bool:
    """Check if database is accessible"""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(select(1))
            logger.info("Database connection successful")
            return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False


async def migrate_demo_users(session: AsyncSession) -> bool:
    """Migrate demo users to proper usernames"""
    try:
        migrated_users = []
        
        for old_username, migration_data in DEMO_USER_MIGRATIONS.items():
            # Find user with old username
            result = await session.execute(
                select(User).where(User.username == old_username)
            )
            user = result.scalar_one_or_none()
            
            if user:
                logger.info(f"Found user to migrate: {old_username} -> {migration_data['new_username']}")
                
                # Check if new username already exists
                result_check = await session.execute(
                    select(User).where(User.username == migration_data['new_username'])
                )
                existing_user = result_check.scalar_one_or_none()
                
                if existing_user and existing_user.id != user.id:
                    logger.warning(f"Username '{migration_data['new_username']}' already exists, skipping migration for {old_username}")
                    continue
                
                # Update user record
                await session.execute(
                    update(User)
                    .where(User.id == user.id)
                    .values(
                        username=migration_data['new_username'],
                        email=migration_data['new_email']
                    )
                )
                
                migrated_users.append({
                    "old_username": old_username,
                    "new_username": migration_data['new_username'],
                    "new_email": migration_data['new_email'],
                    "description": migration_data['description']
                })
                
                logger.info(f"✅ Migrated: {old_username} -> {migration_data['new_username']}")
            else:
                logger.info(f"User '{old_username}' not found, skipping migration")
        
        if migrated_users:
            await session.commit()
            logger.info(f"Successfully migrated {len(migrated_users)} demo users")
            
            print("\n📊 MIGRATION SUMMARY:")
            for user in migrated_users:
                print(f"  ✅ {user['old_username']} -> {user['new_username']} ({user['new_email']})")
                print(f"     {user['description']}")
            
            return True
        else:
            logger.info("No demo users found that need migration")
            return True
            
    except Exception as e:
        logger.error(f"Failed to migrate demo users: {e}")
        await session.rollback()
        return False


async def verify_migrations(session: AsyncSession) -> bool:
    """Verify that migrations were successful"""
    try:
        logger.info("Verifying demo user migrations...")
        
        for old_username, migration_data in DEMO_USER_MIGRATIONS.items():
            # Check that old username no longer exists
            result_old = await session.execute(
                select(User).where(User.username == old_username)
            )
            old_user = result_old.scalar_one_or_none()
            
            if old_user:
                logger.error(f"❌ Old username '{old_username}' still exists after migration")
                return False
            
            # Check that new username exists
            result_new = await session.execute(
                select(User).where(User.username == migration_data['new_username'])
            )
            new_user = result_new.scalar_one_or_none()
            
            if not new_user:
                logger.error(f"❌ New username '{migration_data['new_username']}' not found after migration")
                return False
            
            # Verify email was updated
            if new_user.email != migration_data['new_email']:
                logger.error(f"❌ Email not updated correctly for '{migration_data['new_username']}'")
                return False
            
            logger.info(f"✅ Verified: {migration_data['new_username']} ({migration_data['new_email']})")
        
        logger.info("All migrations verified successfully")
        return True
        
    except Exception as e:
        logger.error(f"Failed to verify migrations: {e}")
        return False


async def main():
    """Main function to run demo user migration"""
    print("🔄 Starting Demo User Username Migration")
    print("=" * 50)
    
    # Check database connection
    if not await check_database_connection():
        logger.error("Cannot connect to database. Exiting.")
        sys.exit(1)
    
    try:
        async with AsyncSessionLocal() as session:
            # Run migration
            migration_success = await migrate_demo_users(session)
            
            if not migration_success:
                logger.error("Migration failed")
                sys.exit(1)
            
            # Verify migrations
            verification_success = await verify_migrations(session)
            
            if verification_success:
                print("\n🎉 Demo user migration completed successfully!")
                print("\n🔑 Updated Demo Credentials:")
                print("   Manager - Username: manager, Email: manager@company.com")
                print("   Staff   - Username: staff, Email: staff@company.com")
                print("   Admin   - Username: admin (no change)")
                sys.exit(0)
            else:
                logger.error("Migration verification failed")
                sys.exit(1)
                
    except Exception as e:
        logger.error(f"Unexpected error during migration: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())