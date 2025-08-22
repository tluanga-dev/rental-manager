#!/usr/bin/env python3
"""
Create admin user for Railway deployment
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.modules.users.models import User
from app.core.security import get_password_hash
from app.core.config import settings

async def create_admin_user():
    """Create admin user if it doesn't exist"""
    try:
        # Get database URL
        DATABASE_URL = os.getenv("DATABASE_URL")
        if not DATABASE_URL:
            print("ERROR: DATABASE_URL not set!")
            return False

        # Admin credentials from environment
        admin_username = os.getenv("ADMIN_USERNAME", "admin")
        admin_email = os.getenv("ADMIN_EMAIL", "admin@admin.com")
        admin_password = os.getenv("ADMIN_PASSWORD", "AdminSecure@Password123!")
        admin_full_name = os.getenv("ADMIN_FULL_NAME", "System Administrator")

        print(f"Creating admin user: {admin_username}")
        print(f"Email: {admin_email}")

        engine = create_async_engine(DATABASE_URL, echo=False)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as session:
            # Check if admin already exists
            result = await session.execute(
                select(User).where(User.username == admin_username)
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                print(f"✓ Admin user '{admin_username}' already exists")
                return True

            # Create new admin user
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
            
            print(f"✓ Admin user '{admin_username}' created successfully!")
            return True

    except Exception as e:
        print(f"Error creating admin user: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if 'engine' in locals():
            await engine.dispose()

if __name__ == "__main__":
    success = asyncio.run(create_admin_user())
    sys.exit(0 if success else 1)