#!/usr/bin/env python3
"""
Production Initialization Script
Initializes the database with required data for production
"""

import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime
import logging

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import sessionmaker

# Import models
from app.modules.users.models import User
from app.modules.auth.models import Role, Permission
from app.modules.company.models import Company
from app.modules.system.models import SystemSetting
from app.core.security import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get configuration from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost:5432/rental_db")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3")
ADMIN_FULL_NAME = os.getenv("ADMIN_FULL_NAME", "System Administrator")
COMPANY_NAME = os.getenv("COMPANY_NAME", "Rental Manager Inc.")

# Convert Railway's postgres:// to postgresql:// if needed
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Convert to async URL if needed
if "postgresql://" in DATABASE_URL and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)


async def create_admin_user(session: AsyncSession):
    """Create admin user if not exists"""
    try:
        # Check if admin exists
        result = await session.execute(
            select(User).where(User.username == ADMIN_USERNAME)
        )
        existing_admin = result.scalar_one_or_none()
        
        if existing_admin:
            logger.info(f"Admin user '{ADMIN_USERNAME}' already exists")
            return existing_admin
        
        # Create admin user
        admin_user = User(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            hashed_password=get_password_hash(ADMIN_PASSWORD),
            full_name=ADMIN_FULL_NAME,
            is_active=True,
            is_superuser=True,
            is_verified=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        session.add(admin_user)
        await session.commit()
        await session.refresh(admin_user)
        
        logger.info(f"✓ Created admin user: {ADMIN_USERNAME}")
        return admin_user
        
    except Exception as e:
        logger.error(f"Error creating admin user: {e}")
        await session.rollback()
        raise


async def create_default_roles(session: AsyncSession):
    """Create default RBAC roles"""
    try:
        default_roles = [
            {
                "name": "admin",
                "description": "Full system administrator",
                "is_active": True
            },
            {
                "name": "manager",
                "description": "Manager with most permissions",
                "is_active": True
            },
            {
                "name": "operator",
                "description": "Regular operator",
                "is_active": True
            },
            {
                "name": "viewer",
                "description": "Read-only access",
                "is_active": True
            }
        ]
        
        created_count = 0
        for role_data in default_roles:
            # Check if role exists
            result = await session.execute(
                select(Role).where(Role.name == role_data["name"])
            )
            if not result.scalar_one_or_none():
                role = Role(**role_data)
                session.add(role)
                created_count += 1
        
        if created_count > 0:
            await session.commit()
            logger.info(f"✓ Created {created_count} default roles")
        else:
            logger.info("Default roles already exist")
            
    except Exception as e:
        logger.error(f"Error creating default roles: {e}")
        await session.rollback()
        raise


async def create_default_permissions(session: AsyncSession):
    """Create default permissions"""
    try:
        resources = ["users", "items", "customers", "suppliers", "rentals", "purchases", "inventory", "reports"]
        actions = ["create", "read", "update", "delete"]
        
        created_count = 0
        for resource in resources:
            for action in actions:
                permission_name = f"{resource}:{action}"
                
                # Check if permission exists
                result = await session.execute(
                    select(Permission).where(Permission.name == permission_name)
                )
                if not result.scalar_one_or_none():
                    permission = Permission(
                        name=permission_name,
                        resource=resource,
                        action=action,
                        description=f"{action.capitalize()} {resource}",
                        is_active=True
                    )
                    session.add(permission)
                    created_count += 1
        
        if created_count > 0:
            await session.commit()
            logger.info(f"✓ Created {created_count} permissions")
        else:
            logger.info("Permissions already exist")
            
    except Exception as e:
        logger.error(f"Error creating permissions: {e}")
        await session.rollback()
        raise


async def create_default_company(session: AsyncSession):
    """Create default company"""
    try:
        # Check if company exists
        result = await session.execute(select(Company))
        existing_company = result.scalar_one_or_none()
        
        if existing_company:
            logger.info("Default company already exists")
            return existing_company
        
        # Create default company
        company = Company(
            name=COMPANY_NAME,
            email=ADMIN_EMAIL,
            phone="+1234567890",
            address="123 Main St",
            city="New York",
            state="NY",
            country="USA",
            postal_code="10001",
            tax_id="123456789",
            registration_number="REG123456",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        session.add(company)
        await session.commit()
        await session.refresh(company)
        
        logger.info(f"✓ Created default company: {COMPANY_NAME}")
        return company
        
    except Exception as e:
        logger.error(f"Error creating default company: {e}")
        await session.rollback()
        raise


async def create_system_settings(session: AsyncSession):
    """Create default system settings"""
    try:
        default_settings = [
            {"key": "timezone", "value": "UTC", "description": "System timezone"},
            {"key": "currency", "value": "USD", "description": "Default currency"},
            {"key": "date_format", "value": "YYYY-MM-DD", "description": "Date format"},
            {"key": "time_format", "value": "24h", "description": "Time format"},
            {"key": "rental_grace_period", "value": "24", "description": "Grace period in hours"},
            {"key": "late_fee_percentage", "value": "10", "description": "Late fee percentage"},
            {"key": "max_rental_days", "value": "30", "description": "Maximum rental days"},
            {"key": "min_rental_hours", "value": "4", "description": "Minimum rental hours"},
        ]
        
        created_count = 0
        for setting_data in default_settings:
            # Check if setting exists
            result = await session.execute(
                select(SystemSetting).where(SystemSetting.key == setting_data["key"])
            )
            if not result.scalar_one_or_none():
                setting = SystemSetting(**setting_data)
                session.add(setting)
                created_count += 1
        
        if created_count > 0:
            await session.commit()
            logger.info(f"✓ Created {created_count} system settings")
        else:
            logger.info("System settings already exist")
            
    except Exception as e:
        logger.error(f"Error creating system settings: {e}")
        await session.rollback()
        raise


async def initialize_production_data():
    """Initialize all production data"""
    
    logger.info("""
    =====================================
    Starting Production Initialization
    =====================================
    """)
    
    # Create engine and session
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Initialize in order of dependencies
            logger.info("1. Creating admin user...")
            await create_admin_user(session)
            
            logger.info("2. Creating default roles...")
            await create_default_roles(session)
            
            logger.info("3. Creating permissions...")
            await create_default_permissions(session)
            
            logger.info("4. Creating default company...")
            await create_default_company(session)
            
            logger.info("5. Creating system settings...")
            await create_system_settings(session)
            
            logger.info("""
            =====================================
            Production Initialization Complete
            =====================================
            ✓ Admin user created/verified
            ✓ RBAC roles and permissions set up
            ✓ Default company created
            ✓ System settings configured
            =====================================
            """)
            
        except Exception as e:
            logger.error(f"Production initialization failed: {e}")
            raise
        finally:
            await engine.dispose()


async def main():
    """Main entry point"""
    try:
        await initialize_production_data()
    except Exception as e:
        logger.error(f"Fatal error during initialization: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())