from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Index, Table
from app.db.base import UUIDType
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, List

from app.db.base import RentalManagerBaseModel
from app.modules.auth.enums import UserType, PermissionRiskLevel
# Import association tables from separate module to avoid circular imports
from app.modules.auth.tables import (
    role_permissions_table,
    user_roles_table,
    user_permissions_table
)


class RefreshToken(RentalManagerBaseModel):
    """Refresh token model for JWT authentication"""
    __tablename__ = "refresh_tokens"

    token: Mapped[str] = mapped_column(String(500), unique=True, index=True, nullable=False)
    user_id: Mapped[UUIDType] = mapped_column(UUIDType(), ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Device/client information
    device_info: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)  # IPv6 support
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="refresh_tokens")
    
    def __repr__(self):
        return f"<RefreshToken(id={self.id}, user_id={self.user_id}, active={self.is_active})>"


class LoginAttempt(RentalManagerBaseModel):
    """Login attempt tracking for security"""
    __tablename__ = "login_attempts"
    
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )
    
    # Additional security fields
    failure_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    def __repr__(self):
        return f"<LoginAttempt(id={self.id}, email={self.email}, success={self.success})>"


class PasswordResetToken(RentalManagerBaseModel):
    """Password reset token model"""
    __tablename__ = "password_reset_tokens"
    
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    user_id: Mapped[UUIDType] = mapped_column(UUIDType(), ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="password_reset_tokens")
    
    def __repr__(self):
        return f"<PasswordResetToken(id={self.id}, user_id={self.user_id}, used={self.is_used})>"


class Role(RentalManagerBaseModel):
    """Role model for RBAC"""
    __tablename__ = "roles"
    
    # id inherited from RentalManagerBaseModel (UUID primary key)
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Relationships
    permissions = relationship("Permission", secondary=role_permissions_table, back_populates="roles")
    users = relationship("User", secondary=user_roles_table, back_populates="roles")
    
    def __repr__(self):
        return f"<Role(id={self.id}, name={self.name})>"
    
    def has_permission(self, permission_name: str) -> bool:
        """Check if role has a specific permission"""
        return any(perm.name == permission_name for perm in self.permissions)
    
    def get_permissions(self) -> List[str]:
        """Get all permission names for this role"""
        return [perm.name for perm in self.permissions]


class Permission(RentalManagerBaseModel):
    """Permission model for fine-grained access control"""
    __tablename__ = "permissions"
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resource: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), default=PermissionRiskLevel.LOW.value, nullable=False)
    is_system_permission: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Relationships
    roles = relationship("Role", secondary=role_permissions_table, back_populates="permissions")
    
    def __repr__(self):
        return f"<Permission(id={self.id}, name={self.name}, resource={self.resource}, action={self.action})>"
    
    def get_risk_level(self) -> PermissionRiskLevel:
        """Get risk level enum"""
        return PermissionRiskLevel(self.risk_level)
