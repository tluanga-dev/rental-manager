"""
Association tables for authentication and authorization relationships.
This module is separated to avoid circular imports.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index, Table
from app.db.base import UUIDType
from sqlalchemy.sql import func

from app.db.base import RentalManagerBaseModel as Base

# Association tables for many-to-many relationships
role_permissions_table = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', UUIDType(), ForeignKey('roles.id'), primary_key=True),
    Column('permission_id', UUIDType(), ForeignKey('permissions.id'), primary_key=True),
    Index('idx_role_permissions_role', 'role_id'),
    Index('idx_role_permissions_permission', 'permission_id'),
)

user_roles_table = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', UUIDType(), ForeignKey('users.id'), primary_key=True),
    Column('role_id', UUIDType(), ForeignKey('roles.id'), primary_key=True),
    Index('idx_user_roles_user', 'user_id'),
    Index('idx_user_roles_role', 'role_id'),
)

user_permissions_table = Table(
    'user_permissions',
    Base.metadata,
    Column('user_id', UUIDType(), ForeignKey('users.id'), primary_key=True),
    Column('permission_id', UUIDType(), ForeignKey('permissions.id'), primary_key=True),
    Column('granted_by', UUIDType(), ForeignKey('users.id'), nullable=True),
    Column('granted_at', DateTime, nullable=False, default=func.now()),
    Column('expires_at', DateTime, nullable=True),
    Index('idx_user_permissions_user', 'user_id'),
    Index('idx_user_permissions_permission', 'permission_id'),
)
