"""
Security audit and management models
"""
from sqlalchemy import Column, String, Text, DateTime, Boolean, JSON, Index, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional, Dict, Any

from app.db.base import RentalManagerBaseModel, UUIDType


class SecurityAuditLog(RentalManagerBaseModel):
    """Security audit log for tracking security-related events"""
    __tablename__ = "security_audit_logs"
    
    # User information
    user_id: Mapped[UUIDType] = mapped_column(UUIDType(), ForeignKey("users.id"), nullable=False)
    user_name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Action details
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Additional details
    details: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Request information
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Result
    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Timestamp
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )
    
    # Relationships
    # Temporarily disabled back_populates to avoid circular dependency
    user = relationship("User", lazy="select")
    
    # Indexes for efficient querying
    __table_args__ = (
        Index("ix_security_audit_user_timestamp", "user_id", "timestamp"),
        Index("ix_security_audit_action_resource", "action", "resource"),
        Index("ix_security_audit_resource_id", "resource", "resource_id"),
    )
    
    def __repr__(self):
        return f"<SecurityAuditLog(id={self.id}, user={self.user_name}, action={self.action}, resource={self.resource})>"


class SessionToken(RentalManagerBaseModel):
    """Active session tracking for security management"""
    __tablename__ = "session_tokens"
    
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    user_id: Mapped[UUIDType] = mapped_column(UUIDType(), ForeignKey("users.id"), nullable=False)
    
    # Session information
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    device_info: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    last_activity: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoke_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Relationships
    # Temporarily disabled back_populates to avoid circular dependency
    user = relationship("User", lazy="select")
    
    def __repr__(self):
        return f"<SessionToken(id={self.id}, user_id={self.user_id}, active={self.is_active})>"


class IPWhitelist(RentalManagerBaseModel):
    """IP whitelist for additional security"""
    __tablename__ = "ip_whitelist"
    
    ip_address: Mapped[str] = mapped_column(String(45), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Scope
    user_id: Mapped[Optional[UUIDType]] = mapped_column(
        UUIDType(), 
        ForeignKey("users.id"), 
        nullable=True
    )
    applies_to_all: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Validity period
    valid_from: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Audit
    added_by: Mapped[UUIDType] = mapped_column(UUIDType(), ForeignKey("users.id"), nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    # Relationships
    # Temporarily disabled back_populates to avoid circular dependency
    user = relationship("User", foreign_keys=[user_id])
    added_by_user = relationship("User", foreign_keys=[added_by])
    
    def __repr__(self):
        return f"<IPWhitelist(id={self.id}, ip={self.ip_address}, active={self.is_active})>"