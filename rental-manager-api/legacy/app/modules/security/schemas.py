"""
Security Management Schemas
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from app.shared.models import BaseResponse
from datetime import datetime

class TimestampMixin(BaseModel):
    """Mixin for timestamp fields"""
    created_at: datetime
    updated_at: datetime


class PermissionBase(BaseModel):
    """Base permission schema"""
    name: str = Field(..., description="Permission name/code")
    description: Optional[str] = Field(None, description="Permission description")
    resource: str = Field(..., description="Resource this permission applies to")
    action: str = Field(..., description="Action allowed by this permission")
    risk_level: str = Field(default="LOW", description="Risk level (LOW, MEDIUM, HIGH, CRITICAL)")


class PermissionCreate(PermissionBase):
    """Schema for creating a permission"""
    is_system_permission: bool = Field(default=False, description="Is this a system permission")


class PermissionUpdate(BaseModel):
    """Schema for updating a permission"""
    description: Optional[str] = None
    risk_level: Optional[str] = None


class PermissionResponse(PermissionBase, TimestampMixin):
    """Permission response schema"""
    id: str
    is_system_permission: bool
    usage_count: Optional[int] = Field(0, description="Number of roles using this permission")
    
    class Config:
        from_attributes = True


class PermissionCategory(BaseModel):
    """Permission category for grouping"""
    name: str
    description: str
    resource: str
    permissions: List[PermissionResponse]
    total_permissions: int


class RoleBase(BaseModel):
    """Base role schema"""
    name: str = Field(..., description="Role name")
    description: Optional[str] = Field(None, description="Role description")
    is_active: bool = Field(default=True, description="Is role active")


class RoleCreate(RoleBase):
    """Schema for creating a role"""
    permissions: List[str] = Field(default_factory=list, description="List of permission names")
    is_system_role: bool = Field(default=False, description="Is this a system role")


class RoleUpdate(BaseModel):
    """Schema for updating a role"""
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    permissions: Optional[List[str]] = None


class RoleResponse(RoleBase, TimestampMixin):
    """Role response schema"""
    id: str
    is_system_role: bool
    permissions: List[str] = Field(default_factory=list, description="List of permission names")
    user_count: Optional[int] = Field(0, description="Number of users with this role")
    
    class Config:
        from_attributes = True


class RoleWithPermissions(RoleResponse):
    """Role with detailed permission information"""
    permission_details: List[PermissionResponse]


class RoleTemplate(BaseModel):
    """Predefined role template"""
    name: str
    description: str
    category: str
    permissions: List[str]
    recommended_for: List[str]


class SecurityAuditLog(BaseModel):
    """Security audit log entry"""
    id: str
    timestamp: datetime
    user_id: str
    user_name: str
    action: str
    resource: str
    resource_id: Optional[str]
    details: Dict[str, Any]
    ip_address: Optional[str]
    user_agent: Optional[str]
    success: bool
    
    class Config:
        from_attributes = True


class SecurityStats(BaseModel):
    """Security statistics"""
    total_users: int
    total_roles: int
    total_permissions: int
    active_sessions: int
    failed_login_attempts_today: int
    security_score: float
    most_used_roles: List[Dict[str, Any]]
    recent_security_events: List[Dict[str, Any]]
    permission_coverage: Dict[str, float]
    role_distribution: Dict[str, int]


class UserSecurityInfo(BaseModel):
    """User security information"""
    user_id: str
    username: str
    email: str
    roles: List[str]
    permissions: List[str]
    effective_permissions: List[str]
    last_login: Optional[datetime]
    failed_login_attempts: int
    is_locked: bool
    two_factor_enabled: bool
    active_sessions: int
    
    class Config:
        from_attributes = True


class BulkRoleAssignment(BaseModel):
    """Bulk role assignment request"""
    user_ids: List[str]
    role_ids: List[str]
    action: str = Field(default="add", description="Action to perform (add/remove/replace)")


class PermissionCheckRequest(BaseModel):
    """Request to check permissions"""
    user_id: str
    permissions: List[str]
    resource: Optional[str] = None


class PermissionCheckResponse(BaseModel):
    """Permission check response"""
    user_id: str
    has_all_permissions: bool
    permissions_status: Dict[str, bool]
    missing_permissions: List[str]
    effective_roles: List[str]