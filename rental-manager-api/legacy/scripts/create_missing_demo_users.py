#!/usr/bin/env python3
"""
Create Missing Demo Users

This script ensures manager and staff demo users exist with correct passwords.
"""

import asyncio
import sys
import os
import logging

# Add app directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash, verify_password

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Demo user data
DEMO_USERS = {
    "manager": {
        "username": "manager",
        "email": "manager@company.com", 
        "password": "mR9#wE4$xN7!kP2&sL6^fA1*tZ5@gB8",
        "full_name": "Operations Manager",
        "user_type": "MANAGER"
    },
    "staff": {
        "username": "staff",
        "email": "staff@company.com",
        "password": "sT3#qW8$vE1!nM5&rA9^jK2*xL6@pC4",
        "full_name": "Staff Member", 
        "user_type": "USER"
    }
}


async def update_or_create_demo_user(session: AsyncSession, user_data: dict) -> bool:
    """Update or create a demo user with correct password"""
    try:
        username = user_data["username"]
        
        # Check if user exists
        result = await session.execute(
            text("SELECT id, password FROM users WHERE username = :username"),
            {"username": username}
        )
        user = result.fetchone()
        
        password_hash = get_password_hash(user_data["password"])
        
        if user:
            # User exists, update password
            await session.execute(
                text("""
                    UPDATE users 
                    SET password = :password, email = :email, full_name = :full_name, user_type = :user_type
                    WHERE username = :username
                """),
                {
                    "username": username,
                    "password": password_hash,
                    "email": user_data["email"],
                    "full_name": user_data["full_name"],
                    "user_type": user_data["user_type"]
                }
            )
            logger.info(f"✅ Updated existing user: {username}")
        else:
            # User doesn't exist, create new
            await session.execute(
                text("""
                    INSERT INTO users (username, email, password, full_name, user_type, is_active, is_superuser, is_verified)
                    VALUES (:username, :email, :password, :full_name, :user_type, TRUE, FALSE, TRUE)
                """),
                {
                    "username": username,
                    "email": user_data["email"],
                    "password": password_hash,
                    "full_name": user_data["full_name"],
                    "user_type": user_data["user_type"]
                }
            )
            logger.info(f"✅ Created new user: {username}")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to update/create user {user_data['username']}: {e}")
        return False


async def verify_demo_users(session: AsyncSession) -> bool:
    """Verify that demo users can authenticate"""
    try:
        all_verified = True
        
        for username, user_data in DEMO_USERS.items():
            # Get user from database
            result = await session.execute(
                text("SELECT password FROM users WHERE username = :username"),
                {"username": username}
            )
            user = result.fetchone()
            
            if user:
                # Verify password
                if verify_password(user_data["password"], user.password):
                    logger.info(f"✅ Password verification successful for: {username}")
                else:
                    logger.error(f"❌ Password verification failed for: {username}")
                    all_verified = False
            else:
                logger.error(f"❌ User not found: {username}")
                all_verified = False
        
        return all_verified
        
    except Exception as e:
        logger.error(f"Failed to verify demo users: {e}")
        return False


async def main():
    """Main function"""
    print("👥 Creating/Updating Demo Users")
    print("=" * 35)
    
    try:
        async with AsyncSessionLocal() as session:
            success = True
            
            # Update or create each demo user
            for username, user_data in DEMO_USERS.items():
                user_success = await update_or_create_demo_user(session, user_data)
                if not user_success:
                    success = False
            
            if success:
                await session.commit()
                
                # Verify users
                verification_success = await verify_demo_users(session)
                
                if verification_success:
                    print("\n🎉 Demo users created/updated successfully!")
                    print("\n🔑 Demo User Credentials:")
                    for username, user_data in DEMO_USERS.items():
                        print(f"   {user_data['full_name']:18}: username='{username}' password='{user_data['password'][:8]}...'")
                    sys.exit(0)
                else:
                    print("❌ Demo user verification failed")
                    sys.exit(1)
            else:
                await session.rollback()
                print("❌ Failed to create/update demo users")
                sys.exit(1)
                
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())