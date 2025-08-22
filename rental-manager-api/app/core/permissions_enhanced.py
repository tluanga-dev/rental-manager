"""
Enhanced permission system with dependency injection for FastAPI
Provides decorators and dependencies for granular permission enforcement
"""
from functools import wraps
from typing import List, Optional, Union, Callable
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.api.deps import get_current_user
from app.models.user import User


class PermissionChecker:
    """
    A callable dependency class for checking permissions.
    Can be used with FastAPI's Depends() system.
    """
    
    def __init__(self, required_permissions: Union[str, List[str]], 
                 require_all: bool = True,
                 allow_superuser: bool = True):
        """
        Initialize permission checker.
        
        Args:
            required_permissions: Single permission or list of permissions
            require_all: If True, user must have ALL permissions. If False, ANY permission is sufficient
            allow_superuser: If True, superusers bypass permission checks
        """
        self.permissions = [required_permissions] if isinstance(required_permissions, str) else required_permissions
        self.require_all = require_all
        self.allow_superuser = allow_superuser
    
    async def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        """
        Check if the current user has required permissions.
        
        Args:
            current_user: The authenticated user
            
        Returns:
            The user if they have permissions
            
        Raises:
            HTTPException: 403 if user lacks permissions
        """
        # Superuser bypass
        if self.allow_superuser and current_user.is_superuser:
            return current_user
        
        # Check permissions
        if self.require_all:
            # User must have ALL permissions
            for permission in self.permissions:
                if not await self._has_permission(current_user, permission):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Permission denied. Required: {permission}"
                    )
        else:
            # User must have AT LEAST ONE permission
            has_any = False
            for permission in self.permissions:
                if await self._has_permission(current_user, permission):
                    has_any = True
                    break
            
            if not has_any:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied. Required one of: {', '.join(self.permissions)}"
                )
        
        return current_user
    
    async def _has_permission(self, user: User, permission: str) -> bool:
        """Check if user has a specific permission"""
        return user.has_permission(permission) if hasattr(user, 'has_permission') else True


class RoleChecker:
    """
    A callable dependency class for checking roles.
    Can be used with FastAPI's Depends() system.
    """
    
    def __init__(self, required_roles: Union[str, List[str]], 
                 require_all: bool = False,
                 allow_superuser: bool = True):
        """
        Initialize role checker.
        
        Args:
            required_roles: Single role or list of roles
            require_all: If True, user must have ALL roles. If False, ANY role is sufficient
            allow_superuser: If True, superusers bypass role checks
        """
        self.roles = [required_roles] if isinstance(required_roles, str) else required_roles
        self.require_all = require_all
        self.allow_superuser = allow_superuser
    
    async def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        """
        Check if the current user has required roles.
        
        Args:
            current_user: The authenticated user
            
        Returns:
            The user if they have roles
            
        Raises:
            HTTPException: 403 if user lacks roles
        """
        # Superuser bypass
        if self.allow_superuser and current_user.is_superuser:
            return current_user
        
        # Check roles
        if self.require_all:
            # User must have ALL roles
            for role in self.roles:
                if not self._has_role(current_user, role):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Role required: {role}"
                    )
        else:
            # User must have AT LEAST ONE role
            has_any = False
            for role in self.roles:
                if self._has_role(current_user, role):
                    has_any = True
                    break
            
            if not has_any:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role required. One of: {', '.join(self.roles)}"
                )
        
        return current_user
    
    def _has_role(self, user: User, role: str) -> bool:
        """Check if user has a specific role"""
        return hasattr(user, 'has_role') and user.has_role(role)


class ResourceOwnerChecker:
    """
    Check if user owns or has access to a specific resource.
    Useful for checking if user can only access their own data.
    """
    
    def __init__(self, 
                 resource_type: str,
                 owner_field: str = "user_id",
                 allow_permission: Optional[str] = None,
                 allow_superuser: bool = True):
        """
        Initialize resource owner checker.
        
        Args:
            resource_type: Type of resource (e.g., "customer", "rental")
            owner_field: Field name that contains owner ID
            allow_permission: Permission that allows access regardless of ownership
            allow_superuser: If True, superusers bypass ownership checks
        """
        self.resource_type = resource_type
        self.owner_field = owner_field
        self.allow_permission = allow_permission
        self.allow_superuser = allow_superuser
    
    async def __call__(self, 
                       resource_id: str,
                       current_user: User = Depends(get_current_user)) -> User:
        """
        Check if user owns or has access to the resource.
        
        Args:
            resource_id: ID of the resource to check
            current_user: The authenticated user
            
        Returns:
            The user if they have access
            
        Raises:
            HTTPException: 403 if user lacks access
        """
        # Superuser bypass
        if self.allow_superuser and current_user.is_superuser:
            return current_user
        
        # Permission bypass
        if self.allow_permission and hasattr(current_user, 'has_permission') and current_user.has_permission(self.allow_permission):
            return current_user
        
        # Check ownership (this would need to be implemented based on your data access layer)
        # For now, returning user - implement actual ownership check based on resource type
        return current_user


# Convenience functions for common permission patterns

def RequirePermissions(*permissions: str, require_all: bool = True) -> Depends:
    """
    Require one or more permissions.
    
    Usage:
        @router.get("/users", dependencies=[RequirePermissions("USER_VIEW")])
        @router.post("/users", dependencies=[RequirePermissions("USER_CREATE", "USER_MANAGE")])
    """
    return Depends(PermissionChecker(list(permissions), require_all=require_all))


def RequireAnyPermission(*permissions: str) -> Depends:
    """
    Require at least one of the specified permissions.
    
    Usage:
        @router.get("/reports", dependencies=[RequireAnyPermission("REPORT_VIEW", "ANALYTICS_VIEW")])
    """
    return Depends(PermissionChecker(list(permissions), require_all=False))


def RequireRoles(*roles: str, require_all: bool = False) -> Depends:
    """
    Require one or more roles.
    
    Usage:
        @router.get("/admin", dependencies=[RequireRoles("ADMIN")])
        @router.get("/management", dependencies=[RequireRoles("MANAGER", "SUPERVISOR")])
    """
    return Depends(RoleChecker(list(roles), require_all=require_all))


def RequireAnyRole(*roles: str) -> Depends:
    """
    Require at least one of the specified roles.
    
    Usage:
        @router.get("/reports", dependencies=[RequireAnyRole("MANAGER", "ACCOUNTANT")])
    """
    return Depends(RoleChecker(list(roles), require_all=False))


# Module-specific permission dependencies

class CustomerPermissions:
    """Customer module permission dependencies"""
    VIEW = RequirePermissions("CUSTOMER_VIEW")
    CREATE = RequirePermissions("CUSTOMER_CREATE")
    UPDATE = RequirePermissions("CUSTOMER_UPDATE")
    DELETE = RequirePermissions("CUSTOMER_DELETE")
    BLACKLIST = RequirePermissions("CUSTOMER_BLACKLIST")
    VIEW_TRANSACTIONS = RequirePermissions("CUSTOMER_VIEW_TRANSACTIONS")
    VIEW_RENTALS = RequirePermissions("CUSTOMER_VIEW_RENTALS")
    UPDATE_CREDIT = RequirePermissions("CUSTOMER_UPDATE_CREDIT")
    EXPORT = RequirePermissions("CUSTOMER_EXPORT")
    MANAGE = RequireAnyPermission("CUSTOMER_CREATE", "CUSTOMER_UPDATE", "CUSTOMER_DELETE")


class SupplierPermissions:
    """Supplier module permission dependencies"""
    VIEW = RequirePermissions("SUPPLIER_VIEW")
    CREATE = RequirePermissions("SUPPLIER_CREATE")
    UPDATE = RequirePermissions("SUPPLIER_UPDATE")
    DELETE = RequirePermissions("SUPPLIER_DELETE")
    VIEW_TRANSACTIONS = RequirePermissions("SUPPLIER_VIEW_TRANSACTIONS")
    VIEW_PRODUCTS = RequirePermissions("SUPPLIER_VIEW_PRODUCTS")
    UPDATE_STATUS = RequirePermissions("SUPPLIER_UPDATE_STATUS")
    EXPORT = RequirePermissions("SUPPLIER_EXPORT")
    MANAGE = RequireAnyPermission("SUPPLIER_CREATE", "SUPPLIER_UPDATE", "SUPPLIER_DELETE")


class InventoryPermissions:
    """Inventory module permission dependencies"""
    VIEW = RequirePermissions("INVENTORY_VIEW")
    CREATE = RequirePermissions("INVENTORY_CREATE")
    UPDATE = RequirePermissions("INVENTORY_UPDATE")
    DELETE = RequirePermissions("INVENTORY_DELETE")
    ADJUST = RequirePermissions("INVENTORY_ADJUST")
    TRANSFER = RequirePermissions("INVENTORY_TRANSFER")
    VIEW_HISTORY = RequirePermissions("INVENTORY_VIEW_HISTORY")
    STOCK_TAKE = RequirePermissions("INVENTORY_STOCK_TAKE")
    EXPORT = RequirePermissions("INVENTORY_EXPORT")
    MANAGE = RequireAnyPermission("INVENTORY_CREATE", "INVENTORY_UPDATE", "INVENTORY_DELETE")


class ItemPermissions:
    """Item module permission dependencies"""
    VIEW = RequirePermissions("ITEM_VIEW")
    CREATE = RequirePermissions("ITEM_CREATE")
    UPDATE = RequirePermissions("ITEM_UPDATE")
    DELETE = RequirePermissions("ITEM_DELETE")
    UPDATE_PRICE = RequirePermissions("ITEM_UPDATE_PRICE")
    UPDATE_STATUS = RequirePermissions("ITEM_UPDATE_STATUS")
    VIEW_HISTORY = RequirePermissions("ITEM_VIEW_HISTORY")
    EXPORT = RequirePermissions("ITEM_EXPORT")
    MANAGE = RequireAnyPermission("ITEM_CREATE", "ITEM_UPDATE", "ITEM_DELETE")


class RentalPermissions:
    """Rental module permission dependencies"""
    VIEW = RequirePermissions("RENTAL_VIEW")
    CREATE = RequirePermissions("RENTAL_CREATE")
    UPDATE = RequirePermissions("RENTAL_UPDATE")
    DELETE = RequirePermissions("RENTAL_DELETE")
    RETURN = RequirePermissions("RENTAL_RETURN")
    EXTEND = RequirePermissions("RENTAL_EXTEND")
    CANCEL = RequirePermissions("RENTAL_CANCEL")
    VIEW_HISTORY = RequirePermissions("RENTAL_VIEW_HISTORY")
    APPLY_PENALTY = RequirePermissions("RENTAL_APPLY_PENALTY")
    WAIVE_PENALTY = RequirePermissions("RENTAL_WAIVE_PENALTY")
    EXPORT = RequirePermissions("RENTAL_EXPORT")
    MANAGE = RequireAnyPermission("RENTAL_CREATE", "RENTAL_UPDATE", "RENTAL_DELETE")


class PurchasePermissions:
    """Purchase module permission dependencies"""
    VIEW = RequirePermissions("PURCHASE_VIEW")
    CREATE = RequirePermissions("PURCHASE_CREATE")
    UPDATE = RequirePermissions("PURCHASE_UPDATE")
    DELETE = RequirePermissions("PURCHASE_DELETE")
    APPROVE = RequirePermissions("PURCHASE_APPROVE")
    REJECT = RequirePermissions("PURCHASE_REJECT")
    RETURN = RequirePermissions("PURCHASE_RETURN")
    VIEW_HISTORY = RequirePermissions("PURCHASE_VIEW_HISTORY")
    EXPORT = RequirePermissions("PURCHASE_EXPORT")
    MANAGE = RequireAnyPermission("PURCHASE_CREATE", "PURCHASE_UPDATE", "PURCHASE_DELETE")


class SalesPermissions:
    """Sales module permission dependencies"""
    VIEW = RequirePermissions("SALES_VIEW")
    CREATE = RequirePermissions("SALES_CREATE")
    UPDATE = RequirePermissions("SALES_UPDATE")
    DELETE = RequirePermissions("SALES_DELETE")
    RETURN = RequirePermissions("SALES_RETURN")
    APPLY_DISCOUNT = RequirePermissions("SALES_APPLY_DISCOUNT")
    VIEW_HISTORY = RequirePermissions("SALES_VIEW_HISTORY")
    EXPORT = RequirePermissions("SALES_EXPORT")
    MANAGE = RequireAnyPermission("SALES_CREATE", "SALES_UPDATE", "SALES_DELETE")


class TransactionPermissions:
    """Transaction module permission dependencies"""
    VIEW = RequirePermissions("TRANSACTION_VIEW")
    CREATE = RequirePermissions("TRANSACTION_CREATE")
    UPDATE = RequirePermissions("TRANSACTION_UPDATE")
    DELETE = RequirePermissions("TRANSACTION_DELETE")
    VOID = RequirePermissions("TRANSACTION_VOID")
    VIEW_DETAILS = RequirePermissions("TRANSACTION_VIEW_DETAILS")
    EXPORT = RequirePermissions("TRANSACTION_EXPORT")
    MANAGE = RequireAnyPermission("TRANSACTION_CREATE", "TRANSACTION_UPDATE", "TRANSACTION_DELETE")


class MasterDataPermissions:
    """Master data module permission dependencies"""
    VIEW = RequirePermissions("MASTER_DATA_VIEW")
    CREATE = RequirePermissions("MASTER_DATA_CREATE")
    UPDATE = RequirePermissions("MASTER_DATA_UPDATE")
    DELETE = RequirePermissions("MASTER_DATA_DELETE")
    IMPORT = RequirePermissions("MASTER_DATA_IMPORT")
    EXPORT = RequirePermissions("MASTER_DATA_EXPORT")
    MANAGE = RequireAnyPermission("MASTER_DATA_CREATE", "MASTER_DATA_UPDATE", "MASTER_DATA_DELETE")


class UserPermissions:
    """User module permission dependencies"""
    VIEW = RequirePermissions("USER_VIEW")
    CREATE = RequirePermissions("USER_CREATE")
    UPDATE = RequirePermissions("USER_UPDATE")
    DELETE = RequirePermissions("USER_DELETE")
    ACTIVATE = RequirePermissions("USER_ACTIVATE")
    RESET_PASSWORD = RequirePermissions("USER_RESET_PASSWORD")
    ASSIGN_ROLE = RequirePermissions("USER_ASSIGN_ROLE")
    VIEW_PERMISSIONS = RequirePermissions("USER_VIEW_PERMISSIONS")
    EXPORT = RequirePermissions("USER_EXPORT")
    MANAGE = RequireAnyPermission("USER_CREATE", "USER_UPDATE", "USER_DELETE")


class RolePermissions:
    """Role module permission dependencies"""
    VIEW = RequirePermissions("ROLE_VIEW")
    CREATE = RequirePermissions("ROLE_CREATE")
    UPDATE = RequirePermissions("ROLE_UPDATE")
    DELETE = RequirePermissions("ROLE_DELETE")
    ASSIGN_PERMISSION = RequirePermissions("ROLE_ASSIGN_PERMISSION")
    VIEW_USERS = RequirePermissions("ROLE_VIEW_USERS")
    CLONE = RequirePermissions("ROLE_CLONE")
    MANAGE = RequireAnyPermission("ROLE_CREATE", "ROLE_UPDATE", "ROLE_DELETE")


class SystemPermissions:
    """System module permission dependencies"""
    CONFIG = RequirePermissions("SYSTEM_CONFIG")
    VIEW_LOGS = RequirePermissions("SYSTEM_VIEW_LOGS")
    CLEAR_CACHE = RequirePermissions("SYSTEM_CLEAR_CACHE")
    MAINTENANCE = RequirePermissions("SYSTEM_MAINTENANCE")
    BACKUP = RequirePermissions("SYSTEM_BACKUP")
    RESTORE = RequirePermissions("SYSTEM_RESTORE")
    ADMIN = RequireAnyPermission("SYSTEM_CONFIG", "SYSTEM_MAINTENANCE", "SYSTEM_BACKUP", "SYSTEM_RESTORE")


class AuditPermissions:
    """Audit module permission dependencies"""
    VIEW = RequirePermissions("AUDIT_VIEW")
    EXPORT = RequirePermissions("AUDIT_EXPORT")
    DELETE = RequirePermissions("AUDIT_DELETE")


# Export all permission classes for easy import
__all__ = [
    'PermissionChecker',
    'RoleChecker',
    'ResourceOwnerChecker',
    'RequirePermissions',
    'RequireAnyPermission',
    'RequireRoles',
    'RequireAnyRole',
    'CustomerPermissions',
    'SupplierPermissions',
    'InventoryPermissions',
    'ItemPermissions',
    'RentalPermissions',
    'PurchasePermissions',
    'SalesPermissions',
    'TransactionPermissions',
    'MasterDataPermissions',
    'UserPermissions',
    'RolePermissions',
    'SystemPermissions',
    'AuditPermissions',
]