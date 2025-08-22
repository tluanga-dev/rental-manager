"""
Shared fixtures for sale transition tests
"""

import pytest
from datetime import datetime
from decimal import Decimal
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.modules.users.models import User, Role
from app.modules.auth.service import AuthService


@pytest.fixture(scope="function")
async def session():
    """Create a test database session"""
    # Use test database URL
    engine = create_async_engine(
        settings.TEST_DATABASE_URL or settings.DATABASE_URL.replace("rental_manager", "test_rental_manager"),
        echo=False
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    async_session = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()
    
    # Clean up
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest.fixture
async def test_user(session: AsyncSession):
    """Create a test user with basic role"""
    role = Role(
        id=uuid4(),
        name="USER",
        description="Regular user role"
    )
    
    user = User(
        id=uuid4(),
        username="testuser",
        email="test@example.com",
        full_name="Test User",
        hashed_password=AuthService.hash_password("TestPassword123!"),
        is_active=True,
        role_id=role.id,
        role=role
    )
    
    session.add(role)
    session.add(user)
    await session.commit()
    return user


@pytest.fixture
async def manager_user(session: AsyncSession):
    """Create a manager user"""
    role = Role(
        id=uuid4(),
        name="MANAGER",
        description="Manager role with approval permissions"
    )
    
    user = User(
        id=uuid4(),
        username="manager",
        email="manager@example.com",
        full_name="Manager User",
        hashed_password=AuthService.hash_password("ManagerPassword123!"),
        is_active=True,
        role_id=role.id,
        role=role
    )
    
    session.add(role)
    session.add(user)
    await session.commit()
    return user


@pytest.fixture
async def admin_user(session: AsyncSession):
    """Create an admin user"""
    role = Role(
        id=uuid4(),
        name="ADMIN",
        description="Administrator role"
    )
    
    user = User(
        id=uuid4(),
        username="admin",
        email="admin@example.com",
        full_name="Admin User",
        hashed_password=AuthService.hash_password("AdminPassword123!"),
        is_active=True,
        role_id=role.id,
        role=role
    )
    
    session.add(role)
    session.add(user)
    await session.commit()
    return user