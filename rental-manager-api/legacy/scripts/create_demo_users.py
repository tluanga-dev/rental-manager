#!/usr/bin/env python3
"""
Create demo users for testing the production system.
This script creates demo and admin users with known credentials.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.security import get_password_hash
from app.modules.users.models import User
from app.modules.auth.models import Role
from sqlalchemy import select
import uuid
from datetime import datetime

async def create_demo_users():
    """Create demo users with known credentials"""
    
    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    AsyncSessionLocal = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with AsyncSessionLocal() as session:
        try:
            # Define users to create
            users_to_create = [
                {
                    "username": "demo",
                    "email": "demo@example.com",
                    "password": "demo123",
                    "full_name": "Demo User",
                    "is_active": True,
                    "is_superuser": False
                },
                {
                    "username": "admin",
                    "email": "admin@example.com", 
                    "password": "admin123",
                    "full_name": "Admin User",
                    "is_active": True,
                    "is_superuser": True
                },
                {
                    "username": "test",
                    "email": "test@example.com",
                    "password": "test123",
                    "full_name": "Test User",
                    "is_active": True,
                    "is_superuser": False
                }
            ]
            
            for user_data in users_to_create:
                # Check if user already exists
                existing_user = await session.execute(
                    select(User).where(
                        (User.username == user_data["username"]) | 
                        (User.email == user_data["email"])
                    )
                )
                existing_user = existing_user.scalar_one_or_none()
                
                if existing_user:
                    print(f"✅ User {user_data['username']} already exists, updating password...")
                    # Update password for existing user
                    existing_user.hashed_password = get_password_hash(user_data["password"])
                    existing_user.is_active = True
                    existing_user.updated_at = datetime.utcnow()
                    await session.commit()
                    print(f"✅ Updated password for {user_data['username']}")
                else:
                    # Create new user
                    new_user = User(
                        id=str(uuid.uuid4()),
                        username=user_data["username"],
                        email=user_data["email"],
                        hashed_password=get_password_hash(user_data["password"]),
                        full_name=user_data["full_name"],
                        is_active=user_data["is_active"],
                        is_superuser=user_data["is_superuser"],
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    session.add(new_user)
                    await session.commit()
                    print(f"✅ Created user: {user_data['username']}")
            
            print("\n✅ All demo users created/updated successfully!")
            print("\nYou can now login with:")
            print("- demo/demo123")
            print("- admin/admin123")
            print("- test/test123")
            
        except Exception as e:
            print(f"❌ Error creating users: {e}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_demo_users())