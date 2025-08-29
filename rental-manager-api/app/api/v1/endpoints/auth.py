from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Body, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.core.security import security_manager
from app.core.dev_auth_bypass import should_bypass_auth, create_mock_token_response, get_mock_user
from app.models.user import User
from app.schemas.auth import (
    Token,
    TokenRefresh,
    UserRegister,
    UserLogin,
)
from app.schemas.user import UserResponse

router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserRegister,
) -> Any:
    """Register a new user"""
    # Check if user exists
    result = await db.execute(
        select(User).where(
            (User.email == user_in.email) | (User.username == user_in.username)
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists",
        )
    
    # Create new user
    user = User(
        email=user_in.email,
        username=user_in.username,
        hashed_password=security_manager.get_password_hash(user_in.password),
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        phone=user_in.phone,
        role=user_in.role,
        is_active=True,
        is_verified=False,
        is_superuser=user_in.role == "ADMIN",
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    user_data: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Token login with JSON payload"""
    # Check for development mode bypass
    if should_bypass_auth(request):
        # Return mock tokens for development
        return create_mock_token_response()
    
    # Try to authenticate with email or username
    result = await db.execute(
        select(User).where(
            (User.email == user_data.username) | (User.username == user_data.username)
        )
    )
    user = result.scalar_one_or_none()
    
    if not user or not security_manager.verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    
    # Create tokens
    access_token = security_manager.create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = security_manager.create_refresh_token(
        subject=str(user.id),
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    
    # Define role-based permissions
    role_permissions = {
        "admin": [
            # Dashboard permissions
            "SALE_VIEW", "RENTAL_VIEW", "DASHBOARD_VIEW", "ANALYTICS_VIEW",
            # Customer permissions
            "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE", "CUSTOMER_DELETE",
            # Inventory permissions
            "INVENTORY_VIEW", "INVENTORY_CREATE", "INVENTORY_UPDATE", "INVENTORY_DELETE",
            # Sales permissions
            "SALE_VIEW", "SALE_CREATE", "SALE_UPDATE", "SALE_DELETE",
            # Rental permissions
            "RENTAL_VIEW", "RENTAL_CREATE", "RENTAL_UPDATE", "RENTAL_DELETE",
            # Reports permissions
            "REPORT_VIEW", "REPORT_CREATE",
            # Admin permissions
            "USER_VIEW", "USER_CREATE", "USER_UPDATE", "USER_DELETE",
            "ROLE_VIEW", "ROLE_CREATE", "ROLE_UPDATE", "ROLE_DELETE",
            "AUDIT_VIEW", "SYSTEM_CONFIG",
        ],
        "landlord": [
            "SALE_VIEW", "RENTAL_VIEW", "CUSTOMER_VIEW", "INVENTORY_VIEW",
            "RENTAL_CREATE", "RENTAL_UPDATE", "CUSTOMER_CREATE", "REPORT_VIEW"
        ],
        "tenant": [
            "RENTAL_VIEW", "DASHBOARD_VIEW"
        ],
        "maintenance": [
            "INVENTORY_VIEW", "RENTAL_VIEW", "CUSTOMER_VIEW"
        ],
        "viewer": [
            "DASHBOARD_VIEW", "RENTAL_VIEW", "SALE_VIEW", "CUSTOMER_VIEW", "INVENTORY_VIEW"
        ]
    }
    
    # Get permissions for user's role
    user_permissions = role_permissions.get(user.role, [])
    
    # Superusers get all permissions
    if user.is_superuser:
        user_permissions = list(set([perm for perms in role_permissions.values() for perm in perms]))
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "userType": user.role.upper(),  # Frontend expects userType
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "isSuperuser": user.is_superuser,  # Frontend expects camelCase
            "is_verified": user.is_verified,
            "effectivePermissions": {
                "all_permissions": user_permissions,
                "allPermissions": user_permissions  # Support both naming conventions
            }
        }
    }


@router.post("/refresh", response_model=Token)
async def refresh_token(
    *,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_data: TokenRefresh,
) -> Any:
    """Refresh access token using refresh token"""
    # Check for development mode bypass
    if should_bypass_auth(request):
        # Return mock tokens for development
        return create_mock_token_response()
    
    try:
        payload = security_manager.decode_token(token_data.refresh_token)
        user_id = payload.get("sub")
        token_type = payload.get("type")
        
        if not user_id or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
        
        # Get user
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )
        
        # Create new tokens
        access_token = security_manager.create_access_token(
            subject=str(user.id),
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        new_refresh_token = security_manager.create_refresh_token(
            subject=str(user.id),
            expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get current user information"""
    # In development mode with bypass, return enhanced mock user
    if should_bypass_auth(request) and hasattr(current_user, 'to_dict'):
        return current_user.to_dict()
    return current_user


@router.post("/dev-login", response_model=Token)
async def dev_login(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Development-only login endpoint"""
    if not should_bypass_auth(request):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Endpoint not available"
        )
    
    # Return mock tokens for development
    mock_user = get_mock_user()
    return create_mock_token_response(mock_user)


@router.get("/dev-status")
async def dev_status(request: Request) -> Any:
    """Development-only status endpoint"""
    return {
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
        "auth_disabled": settings.auth_disabled,
        "development_mode": settings.is_development
    }