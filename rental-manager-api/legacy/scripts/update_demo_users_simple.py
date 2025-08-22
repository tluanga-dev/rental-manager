#!/usr/bin/env python3
"""
Simple Demo User Update Script

This script directly updates existing demo users with SQL commands.
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
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def update_demo_users():
    """Update demo users with direct SQL"""
    try:
        async with AsyncSessionLocal() as session:
            # Update manager user
            result1 = await session.execute(
                text("""
                    UPDATE users 
                    SET username = 'manager', email = 'manager@company.com'
                    WHERE username = 'manager@manager.com'
                """)
            )
            
            # Update staff user  
            result2 = await session.execute(
                text("""
                    UPDATE users 
                    SET username = 'staff', email = 'staff@company.com'
                    WHERE username = 'staff@staff.com'
                """)
            )
            
            await session.commit()
            
            manager_updated = result1.rowcount
            staff_updated = result2.rowcount
            
            logger.info(f"Manager users updated: {manager_updated}")
            logger.info(f"Staff users updated: {staff_updated}")
            
            if manager_updated > 0 or staff_updated > 0:
                print("✅ Demo users updated successfully!")
                print(f"  - Manager users updated: {manager_updated}")
                print(f"  - Staff users updated: {staff_updated}")
            else:
                print("ℹ️  No demo users found to update (already using correct usernames)")
            
            return True
            
    except Exception as e:
        logger.error(f"Failed to update demo users: {e}")
        return False


async def verify_demo_users():
    """Verify demo user usernames"""
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("""
                    SELECT username, email, full_name 
                    FROM users 
                    WHERE username IN ('admin', 'manager', 'staff')
                    ORDER BY username
                """)
            )
            
            users = result.fetchall()
            
            print("\n📋 Current Demo Users:")
            for user in users:
                print(f"  - Username: {user.username:8} Email: {user.email:20} Name: {user.full_name}")
            
            return True
            
    except Exception as e:
        logger.error(f"Failed to verify demo users: {e}")
        return False


async def main():
    """Main function"""
    print("🔄 Updating Demo User Usernames")
    print("=" * 40)
    
    try:
        # Update users
        success = await update_demo_users()
        
        if success:
            # Verify results
            await verify_demo_users()
            print("\n🎉 Demo user update completed!")
        else:
            print("❌ Demo user update failed")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())