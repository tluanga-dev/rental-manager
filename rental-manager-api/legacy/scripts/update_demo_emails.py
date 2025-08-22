#!/usr/bin/env python3
"""
Update Demo User Emails

This script updates demo user emails to use company domain.
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


async def update_demo_emails():
    """Update demo user emails"""
    try:
        async with AsyncSessionLocal() as session:
            # Update manager email
            result1 = await session.execute(
                text("""
                    UPDATE users 
                    SET email = 'manager@company.com'
                    WHERE username = 'manager' AND email = 'manager@manager.com'
                """)
            )
            
            # Update staff email  
            result2 = await session.execute(
                text("""
                    UPDATE users 
                    SET email = 'staff@company.com'
                    WHERE username = 'staff' AND email = 'staff@staff.com'
                """)
            )
            
            await session.commit()
            
            manager_updated = result1.rowcount
            staff_updated = result2.rowcount
            
            logger.info(f"Manager emails updated: {manager_updated}")
            logger.info(f"Staff emails updated: {staff_updated}")
            
            if manager_updated > 0 or staff_updated > 0:
                print("✅ Demo user emails updated successfully!")
                print(f"  - Manager emails updated: {manager_updated}")
                print(f"  - Staff emails updated: {staff_updated}")
            else:
                print("ℹ️  No demo user emails found to update")
            
            return True
            
    except Exception as e:
        logger.error(f"Failed to update demo emails: {e}")
        return False


async def main():
    """Main function"""
    print("📧 Updating Demo User Emails")
    print("=" * 35)
    
    try:
        success = await update_demo_emails()
        
        if success:
            print("\n🎉 Demo user email update completed!")
        else:
            print("❌ Demo user email update failed")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())