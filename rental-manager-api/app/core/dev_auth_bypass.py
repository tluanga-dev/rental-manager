"""
Development Authentication Bypass Module

This module provides functionality to bypass authentication and RBAC
in development environments for easier testing and development.

SECURITY WARNING: This module should NEVER be used in production!
"""

from typing import Optional, Dict, Any
from fastapi import Request
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class MockUser:
    """Mock user for development environment"""
    
    def __init__(
        self,
        user_id: str = None,
        email: str = None,
        role: str = None
    ):
        self.id = user_id or settings.DEV_MOCK_USER_ID
        self.email = email or settings.DEV_MOCK_USER_EMAIL
        self.username = "dev_user"
        self.full_name = "Development User"
        self.is_active = True
        self.is_superuser = True
        self.is_verified = True
        self.created_at = "2024-01-01T00:00:00Z"
        self.updated_at = "2024-01-01T00:00:00Z"
        
        # Role and permissions
        self.role = role or settings.DEV_MOCK_USER_ROLE
        self.user_type = "SUPERADMIN"
        
        # Mock all permissions
        self.permissions = [
            "read:all",
            "write:all", 
            "delete:all",
            "admin:all",
            "manage:users",
            "manage:companies",
            "manage:customers",
            "manage:suppliers",
            "manage:inventory",
            "manage:transactions",
            "manage:rentals",
            "manage:analytics",
            "view:dashboard",
            "export:data"
        ]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "full_name": self.full_name,
            "is_active": self.is_active,
            "is_superuser": self.is_superuser,
            "is_verified": self.is_verified,
            "role": self.role,
            "user_type": self.user_type,
            "permissions": self.permissions,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "effective_permissions": {
                "all_permissions": self.permissions
            }
        }


def get_mock_user(
    user_id: str = None,
    email: str = None, 
    role: str = None
) -> MockUser:
    """
    Get mock user for development environment
    
    Args:
        user_id: Optional custom user ID
        email: Optional custom email
        role: Optional custom role
    
    Returns:
        MockUser instance
    """
    return MockUser(user_id=user_id, email=email, role=role)


def should_bypass_auth(request: Optional[Request] = None) -> bool:
    """
    Check if authentication should be bypassed
    
    Args:
        request: Optional FastAPI request object
    
    Returns:
        True if authentication should be bypassed, False otherwise
    """
    if not settings.auth_disabled:
        return False
    
    # Log bypass for security awareness
    logger.warning(
        "🚨 DEVELOPMENT MODE: Authentication bypass is ENABLED! "
        "This should NEVER happen in production."
    )
    
    # Additional safety check - ensure we're really in development
    if settings.ENVIRONMENT != "development":
        logger.error(
            "❌ SECURITY ALERT: Auth bypass attempted in non-development environment! "
            f"Environment: {settings.ENVIRONMENT}"
        )
        return False
    
    return True


def create_mock_token_response(user: MockUser = None) -> Dict[str, Any]:
    """
    Create mock token response for development
    
    Args:
        user: Optional mock user, creates default if None
        
    Returns:
        Mock token response dictionary
    """
    if not user:
        user = get_mock_user()
    
    return {
        "access_token": "dev-access-token-" + user.id,
        "refresh_token": "dev-refresh-token-" + user.id,
        "token_type": "bearer",
        "expires_in": 3600,  # 1 hour
        "user": user.to_dict()
    }


def log_auth_bypass_warning():
    """Log warning about authentication bypass being enabled"""
    logger.warning("=" * 80)
    logger.warning("🚨 DEVELOPMENT MODE WARNING 🚨")
    logger.warning("Authentication and RBAC are DISABLED!")
    logger.warning("All requests will be treated as authenticated superuser.")
    logger.warning("This should NEVER happen in production!")
    logger.warning(f"Environment: {settings.ENVIRONMENT}")
    logger.warning(f"Debug: {settings.DEBUG}")
    logger.warning(f"Auth Disabled: {settings.auth_disabled}")
    logger.warning("=" * 80)


# Log warning on module import if auth is disabled
if settings.auth_disabled:
    log_auth_bypass_warning()