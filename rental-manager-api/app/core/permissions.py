"""
Permission decorators and middleware for FastAPI endpoints
"""
from functools import wraps
from typing import List, Optional, Union
from fastapi import HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db


def require_permissions(permissions: Union[str, List[str]]):
    """
    Decorator to require specific permissions for an endpoint.
    
    Args:
        permissions: Single permission string or list of permissions
        
    Usage:
        @require_permissions("USER_VIEW")
        @require_permissions(["USER_VIEW", "USER_EDIT"])
    """
    if isinstance(permissions, str):
        permissions = [permissions]
    
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current user from dependencies
            current_user = None
            for key, value in kwargs.items():
                # Check if we have a user object (will need to implement User model)
                if hasattr(value, 'has_permission'):  # Duck typing for now
                    current_user = value
                    break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Check permissions (placeholder - will be implemented when User model exists)
            # for permission in permissions:
            #     if not current_user.has_permission(permission):
            #         raise HTTPException(
            #             status_code=status.HTTP_403_FORBIDDEN,
            #             detail=f"Permission denied: {permission} required"
            #         )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_role(role_name: str):
    """
    Decorator to require a specific role for an endpoint.
    
    Args:
        role_name: Name of the required role
        
    Usage:
        @require_role("ADMIN")
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current user from dependencies
            current_user = None
            for key, value in kwargs.items():
                if hasattr(value, 'has_role'):  # Duck typing for now
                    current_user = value
                    break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Check role (placeholder - will be implemented when User model exists)
            # if not current_user.has_role(role_name):
            #     raise HTTPException(
            #         status_code=status.HTTP_403_FORBIDDEN,
            #         detail=f"Role denied: {role_name} required"
            #     )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_superuser():
    """
    Decorator to require superuser status for an endpoint.
    
    Usage:
        @require_superuser()
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current user from dependencies
            current_user = None
            for key, value in kwargs.items():
                if hasattr(value, 'is_superuser'):  # Duck typing for now
                    current_user = value
                    break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Check superuser status (placeholder)
            # if not current_user.is_superuser:
            #     raise HTTPException(
            #         status_code=status.HTTP_403_FORBIDDEN,
            #         detail="Superuser access required"
            #     )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_any_permission(permissions: List[str]):
    """
    Decorator to require ANY of the specified permissions (OR logic).
    
    Args:
        permissions: List of permissions (user needs at least one)
        
    Usage:
        @require_any_permission(["USER_VIEW", "ADMIN_VIEW"])
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current user from dependencies
            current_user = None
            for key, value in kwargs.items():
                if hasattr(value, 'has_permission'):
                    current_user = value
                    break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            # Check if user has any of the required permissions
            # has_any_permission = False
            # for permission in permissions:
            #     if current_user.has_permission(permission):
            #         has_any_permission = True
            #         break
            # 
            # if not has_any_permission:
            #     raise HTTPException(
            #         status_code=status.HTTP_403_FORBIDDEN,
            #         detail=f"Access denied: requires one of {permissions}"
            #     )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


# Permission constants for easy reference
class Permissions:
    """Permission constants for the application."""
    
    # User management
    USER_VIEW = "USER_VIEW"
    USER_CREATE = "USER_CREATE"
    USER_UPDATE = "USER_UPDATE"
    USER_DELETE = "USER_DELETE"
    
    # Customer management
    CUSTOMER_VIEW = "CUSTOMER_VIEW"
    CUSTOMER_CREATE = "CUSTOMER_CREATE"
    CUSTOMER_UPDATE = "CUSTOMER_UPDATE"
    CUSTOMER_DELETE = "CUSTOMER_DELETE"
    
    # Supplier management
    SUPPLIER_VIEW = "SUPPLIER_VIEW"
    SUPPLIER_CREATE = "SUPPLIER_CREATE"
    SUPPLIER_UPDATE = "SUPPLIER_UPDATE"
    SUPPLIER_DELETE = "SUPPLIER_DELETE"
    
    # Inventory management
    INVENTORY_VIEW = "INVENTORY_VIEW"
    INVENTORY_UPDATE = "INVENTORY_UPDATE"
    INVENTORY_MANAGE = "INVENTORY_MANAGE"
    
    # Transaction management
    TRANSACTION_VIEW = "TRANSACTION_VIEW"
    TRANSACTION_CREATE = "TRANSACTION_CREATE"
    TRANSACTION_UPDATE = "TRANSACTION_UPDATE"
    TRANSACTION_DELETE = "TRANSACTION_DELETE"
    
    # Purchase transactions
    PURCHASE_VIEW = "PURCHASE_VIEW"
    PURCHASE_CREATE = "PURCHASE_CREATE"
    PURCHASE_UPDATE = "PURCHASE_UPDATE"
    PURCHASE_DELETE = "PURCHASE_DELETE"
    
    # Rental transactions
    RENTAL_VIEW = "RENTAL_VIEW"
    RENTAL_CREATE = "RENTAL_CREATE"
    RENTAL_UPDATE = "RENTAL_UPDATE"
    RENTAL_DELETE = "RENTAL_DELETE"
    RENTAL_RETURN = "RENTAL_RETURN"
    
    # Reports and analytics
    REPORTS_VIEW = "REPORTS_VIEW"
    ANALYTICS_VIEW = "ANALYTICS_VIEW"
    
    # System administration
    SYSTEM_ADMIN = "SYSTEM_ADMIN"
    SYSTEM_CONFIG = "SYSTEM_CONFIG"
    
    # Master data management
    MASTER_DATA_VIEW = "MASTER_DATA_VIEW"
    MASTER_DATA_MANAGE = "MASTER_DATA_MANAGE"


# Role constants
class Roles:
    """Role constants for the application."""
    
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    EMPLOYEE = "EMPLOYEE"
    USER = "USER"
    READONLY = "READONLY"


# Helper functions for permission checks
def check_permission(user, permission: str) -> bool:
    """Check if user has a specific permission."""
    # Placeholder implementation
    # return user.has_permission(permission) if user else False
    return True  # Temporary - always allow for now


def check_role(user, role: str) -> bool:
    """Check if user has a specific role."""
    # Placeholder implementation
    # return user.has_role(role) if user else False
    return True  # Temporary - always allow for now


def check_any_permission(user, permissions: List[str]) -> bool:
    """Check if user has any of the specified permissions."""
    # Placeholder implementation
    # return any(user.has_permission(perm) for perm in permissions) if user else False
    return True  # Temporary - always allow for now