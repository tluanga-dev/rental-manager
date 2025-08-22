"""
Authentication and authorization enums.
This module contains enums used by both auth and user models to avoid circular imports.
"""
from enum import Enum


class UserType(str, Enum):
    """User type enumeration for hierarchy"""
    SUPERADMIN = "SUPERADMIN"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    USER = "USER"
    CUSTOMER = "CUSTOMER"


class PermissionRiskLevel(str, Enum):
    """Permission risk level enumeration"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"
