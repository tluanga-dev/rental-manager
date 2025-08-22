from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, Column, String, DateTime, CheckConstraint
from sqlalchemy.orm import relationship
import enum

from app.db.base import RentalManagerBaseModel


class UserRole(str, enum.Enum):
    """User role enumeration"""
    ADMIN = "admin"
    LANDLORD = "landlord"
    TENANT = "tenant"
    MAINTENANCE = "maintenance"
    VIEWER = "viewer"


class User(RentalManagerBaseModel):
    """User model for authentication and authorization"""
    
    __tablename__ = "users"
    
    # Basic info
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Profile info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    
    # Role and permissions
    role = Column(String(20), default=UserRole.VIEWER.value, nullable=False)
    
    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    last_login = Column(DateTime)
    email_verified_at = Column(DateTime)
    password_changed_at = Column(DateTime, default=datetime.utcnow)
    
    # Table constraints
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'landlord', 'tenant', 'maintenance', 'viewer')", name='check_user_role'),
    )
    
    # Relationships removed - only keeping User model
    
    @property
    def full_name(self) -> str:
        """Get user's full name"""
        return f"{self.first_name} {self.last_name}"
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"