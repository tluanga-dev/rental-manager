"""
WebSocket Authentication Utilities

Provides authentication for WebSocket connections using JWT tokens.
"""

from typing import Optional
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.modules.users.models import User


async def verify_websocket_token(
    token: str,
    db: AsyncSession
) -> Optional[User]:
    """
    Verify JWT token for WebSocket connection.
    
    Args:
        token: JWT token string
        db: Database session
        
    Returns:
        User object if token is valid, None otherwise
    """
    try:
        # Decode JWT token
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Get user ID from token
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        # Get user from database
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        # Check if user is active
        if user and user.is_active:
            return user
        
        return None
        
    except JWTError:
        return None
    except Exception:
        return None