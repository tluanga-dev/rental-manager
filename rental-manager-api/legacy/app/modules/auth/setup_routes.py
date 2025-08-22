"""
Production setup routes for initial database configuration
These routes should be disabled after initial setup for security
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any
import uuid
import os
from passlib.context import CryptContext

from app.db.session import get_session
from app.modules.users.models import User
from app.modules.auth.models import Role, Permission
from app.core.rbac_seed import CORE_PERMISSIONS

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(
    prefix="/setup",
    tags=["Setup"]
)

# Security check - only allow in production if ALLOW_SETUP env var is set
def check_setup_allowed():
    """Check if setup endpoints are allowed"""
    # In production, require explicit environment variable
    if os.getenv("ENVIRONMENT") == "production":
        if os.getenv("ALLOW_SETUP") != "true":
            raise HTTPException(
                status_code=403,
                detail="Setup endpoints are disabled in production. Set ALLOW_SETUP=true to enable temporarily."
            )

@router.post("/initialize", response_model=Dict[str, Any])
async def initialize_database(
    session: AsyncSession = Depends(get_session)
):
    """
    Initialize the production database with admin user and basic RBAC
    This endpoint should be called once after deployment
    """
    check_setup_allowed()
    
    results = {
        "admin_created": False,
        "permissions_created": 0,
        "roles_created": 0,
        "message": ""
    }
    
    try:
        # 1. Create permissions
        for perm_data in CORE_PERMISSIONS:
            stmt = select(Permission).where(Permission.name == perm_data["name"])
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if not existing:
                permission = Permission(
                    id=uuid.uuid4(),
                    name=perm_data["name"],
                    resource=perm_data["resource"],
                    action=perm_data["action"],
                    description=perm_data["description"],
                    is_system_permission=True
                )
                session.add(permission)
                results["permissions_created"] += 1
        
        # 2. Create basic roles
        basic_roles = [
            {"name": "ADMIN", "description": "Administrator role with full access"},
            {"name": "MANAGER", "description": "Manager role with most permissions"},
            {"name": "STAFF", "description": "Staff role with limited permissions"},
            {"name": "CUSTOMER", "description": "Customer role with basic permissions"}
        ]
        
        for role_data in basic_roles:
            stmt = select(Role).where(Role.name == role_data["name"])
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if not existing:
                role = Role(
                    id=uuid.uuid4(),
                    name=role_data["name"],
                    description=role_data["description"],
                    is_system_role=True,
                    is_active=True
                )
                session.add(role)
                results["roles_created"] += 1
        
        # 3. Create admin user
        stmt = select(User).where(User.username == "admin")
        result = await session.execute(stmt)
        admin = result.scalar_one_or_none()
        
        if not admin:
            # Get admin role
            stmt = select(Role).where(Role.name == "ADMIN")
            result = await session.execute(stmt)
            admin_role = result.scalar_one_or_none()
            
            admin = User(
                id=uuid.uuid4(),
                username="admin",
                email="admin@omomrentals.shop",
                password=pwd_context.hash("Admin123456!"),
                full_name="System Administrator",
                first_name="System",
                last_name="Administrator",
                is_superuser=True,
                is_active=True,
                is_verified=True,
                user_type="SUPERADMIN"
            )
            
            if admin_role:
                admin.roles.append(admin_role)
            
            session.add(admin)
            results["admin_created"] = True
            results["message"] = "Database initialized successfully!"
        else:
            # Update existing admin
            admin.password = pwd_context.hash("Admin123456!")
            admin.is_superuser = True
            admin.is_active = True
            admin.is_verified = True
            results["message"] = "Admin user updated!"
        
        await session.commit()
        
        return {
            "success": True,
            "data": results
        }
        
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database initialization failed: {str(e)}"
        )

@router.get("/status", response_model=Dict[str, Any])
async def check_setup_status(
    session: AsyncSession = Depends(get_session)
):
    """
    Check the current setup status of the database
    """
    check_setup_allowed()
    
    try:
        # Check for admin user
        stmt = select(User).where(User.username == "admin")
        result = await session.execute(stmt)
        admin = result.scalar_one_or_none()
        
        # Count permissions
        stmt = select(Permission)
        result = await session.execute(stmt)
        permissions = result.scalars().all()
        
        # Count roles
        stmt = select(Role)
        result = await session.execute(stmt)
        roles = result.scalars().all()
        
        # Count users
        stmt = select(User)
        result = await session.execute(stmt)
        users = result.scalars().all()
        
        return {
            "success": True,
            "data": {
                "admin_exists": admin is not None,
                "admin_is_superuser": admin.is_superuser if admin else False,
                "permission_count": len(permissions),
                "role_count": len(roles),
                "user_count": len(users),
                "database_initialized": admin is not None and len(permissions) > 0
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check setup status: {str(e)}"
        )