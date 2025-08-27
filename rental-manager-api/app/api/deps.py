from typing import Optional, Annotated
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.redis import get_redis, RedisManager
from app.core.security import security_manager
from app.core.dev_auth_bypass import should_bypass_auth, get_mock_user
from app.models.user import User
from app.schemas.common import PaginationParams


# Security scheme - auto_error=False allows optional authentication
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> User:
    """
    Get current authenticated user from JWT token with development bypass
    """
    # Development bypass check
    if should_bypass_auth(request):
        return get_mock_user()
    
    # Normal authentication flow
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    # Verify token and get user_id
    user_id = security_manager.verify_token(token, token_type="access")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    Get current active user
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_current_verified_user(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """
    Get current verified user
    """
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User email not verified"
        )
    return current_user


async def get_current_superuser(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """
    Get current superuser
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_current_admin_user(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """
    Get current admin user (superuser or admin role)
    """
    from app.models.user import UserRole
    
    if not current_user.is_superuser and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


async def get_current_landlord_user(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """
    Get current landlord user
    """
    from app.models.user import UserRole
    
    allowed_roles = [UserRole.ADMIN, UserRole.LANDLORD]
    if not current_user.is_superuser and current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Landlord access required."
        )
    return current_user


def get_pagination_params(
    page: int = 1,
    size: int = 20
) -> PaginationParams:
    """
    Get pagination parameters
    """
    return PaginationParams(page=page, size=size)


async def get_request_id(request: Request) -> str:
    """
    Get request ID from request state
    """
    return getattr(request.state, "request_id", "unknown")


# Dependency injection types
DatabaseDep = Annotated[AsyncSession, Depends(get_db)]
RedisDep = Annotated[RedisManager, Depends(get_redis)]
CurrentUser = Annotated[User, Depends(get_current_user)]
ActiveUser = Annotated[User, Depends(get_current_active_user)]
VerifiedUser = Annotated[User, Depends(get_current_verified_user)]
SuperUser = Annotated[User, Depends(get_current_superuser)]
AdminUser = Annotated[User, Depends(get_current_admin_user)]
LandlordUser = Annotated[User, Depends(get_current_landlord_user)]
PaginationDep = Annotated[PaginationParams, Depends(get_pagination_params)]
RequestId = Annotated[str, Depends(get_request_id)]