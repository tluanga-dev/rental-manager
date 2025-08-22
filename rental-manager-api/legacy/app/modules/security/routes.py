"""
Security management routes
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_superuser
from app.modules.users.models import User
from app.modules.security.services import SecurityService
from app.modules.security.schemas import (
    PermissionResponse,
    PermissionCategory,
    RoleResponse,
    RoleCreate,
    RoleUpdate,
    RoleWithPermissions,
    RoleTemplate,
    SecurityStats,
    SecurityAuditLog,
    UserSecurityInfo,
    BulkRoleAssignment,
    PermissionCheckRequest,
    PermissionCheckResponse
)
from app.shared.models import BaseResponse

router = APIRouter(prefix="/api/security", tags=["Security Management"])


@router.get("/stats", response_model=SecurityStats)
async def get_security_stats(
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive security statistics (admin only)"""
    service = SecurityService(db)
    return await service.get_security_stats()


# Permission endpoints
@router.get("/permissions", response_model=List[PermissionResponse])
async def get_all_permissions(
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Get all permissions (admin only)"""
    service = SecurityService(db)
    return await service.get_all_permissions()


@router.get("/permissions/categories", response_model=List[PermissionCategory])
async def get_permission_categories(
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Get permissions grouped by category (admin only)"""
    service = SecurityService(db)
    return await service.get_permission_categories()


@router.post("/permissions/check", response_model=PermissionCheckResponse)
async def check_user_permissions(
    request: PermissionCheckRequest,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Check if a user has specific permissions (admin only)"""
    service = SecurityService(db)
    
    # Get user
    from app.modules.users.services import UserService
    user_service = UserService(db)
    user = await user_service.get_by_id(request.user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check permissions
    permissions_status = {}
    missing_permissions = []
    
    for perm in request.permissions:
        has_perm = user.has_permission(perm)
        permissions_status[perm] = has_perm
        if not has_perm:
            missing_permissions.append(perm)
    
    return PermissionCheckResponse(
        user_id=request.user_id,
        has_all_permissions=len(missing_permissions) == 0,
        permissions_status=permissions_status,
        missing_permissions=missing_permissions,
        effective_roles=[role.name for role in user.roles] if user.roles else []
    )


# Role endpoints
@router.get("/roles", response_model=List[RoleResponse])
async def get_all_roles(
    include_system: bool = Query(True, description="Include system roles"),
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Get all roles (admin only)"""
    service = SecurityService(db)
    roles = await service.get_all_roles()
    
    if not include_system:
        roles = [r for r in roles if not r.is_system_role]
    
    return roles


@router.get("/roles/templates", response_model=List[RoleTemplate])
async def get_role_templates(
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Get predefined role templates (admin only)"""
    service = SecurityService(db)
    return await service.get_role_templates()


@router.get("/roles/{role_id}", response_model=RoleWithPermissions)
async def get_role_details(
    role_id: str,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed role information (admin only)"""
    service = SecurityService(db)
    return await service.get_role_by_id(role_id)


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Create a new role (admin only)"""
    service = SecurityService(db)
    
    # Create the role first
    role = await service.create_role(
        name=role_data.name,
        description=role_data.description,
        permissions=role_data.permissions,
        is_system_role=role_data.is_system_role
    )
    
    # Try to log the action after successful creation (skip if table doesn't exist)
    try:
        await service.log_security_event(
            user_id=str(current_user.id),
            user_name=current_user.username,
            action="ROLE_CREATED",
            resource="roles",
            details={"role_name": role_data.name, "role_id": str(role.id)}
        )
    except Exception:
        # Continue without logging if table doesn't exist
        pass
    
    return role


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    role_data: RoleUpdate,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Update a role (admin only)"""
    service = SecurityService(db)
    
    # Log the action (skip if security audit table doesn't exist)
    try:
        await service.log_security_event(
            user_id=str(current_user.id),
            user_name=current_user.username,
            action="ROLE_UPDATED",
            resource="roles",
            resource_id=role_id,
            details=role_data.model_dump(exclude_none=True)
        )
    except Exception:
        pass
    
    return await service.update_role(
        role_id=role_id,
        name=role_data.name,
        description=role_data.description,
        permissions=role_data.permissions,
        is_active=role_data.is_active
    )


@router.delete("/roles/{role_id}", response_model=BaseResponse)
async def delete_role(
    role_id: str,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Delete a role (admin only)"""
    service = SecurityService(db)
    
    # Log the action (skip if security audit table doesn't exist)
    try:
        await service.log_security_event(
            user_id=str(current_user.id),
            user_name=current_user.username,
            action="ROLE_DELETED",
            resource="roles",
            resource_id=role_id
        )
    except Exception:
        pass
    
    success = await service.delete_role(role_id)
    
    if success:
        return BaseResponse(message="Role deleted successfully")
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to delete role"
        )


@router.post("/roles/bulk-assign", response_model=BaseResponse)
async def bulk_assign_roles(
    assignment: BulkRoleAssignment,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Bulk assign roles to users (admin only)"""
    from app.modules.users.services import UserRoleService
    role_service = UserRoleService(db)
    
    service = SecurityService(db)
    
    # Process each user
    for user_id in assignment.user_ids:
        for role_id in assignment.role_ids:
            if assignment.action == "add":
                await role_service.assign_role(user_id, role_id, str(current_user.id))
                
                # Log the action
                await service.log_security_event(
                    user_id=str(current_user.id),
                    user_name=current_user.username,
                    action="ROLE_ASSIGNED",
                    resource="users",
                    resource_id=user_id,
                    details={"role_id": role_id, "action": "bulk_add"}
                )
            elif assignment.action == "remove":
                await role_service.remove_role(user_id, role_id)
                
                # Log the action
                await service.log_security_event(
                    user_id=str(current_user.id),
                    user_name=current_user.username,
                    action="ROLE_REMOVED",
                    resource="users",
                    resource_id=user_id,
                    details={"role_id": role_id, "action": "bulk_remove"}
                )
    
    return BaseResponse(message=f"Bulk role assignment completed: {assignment.action}")


# Audit log endpoints
@router.get("/audit-logs", response_model=List[dict])
async def get_audit_logs(
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource: Optional[str] = Query(None),
    success_only: bool = Query(False),
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Get security audit logs (admin only)"""
    service = SecurityService(db)
    return await service.get_audit_logs(
        limit=limit,
        user_id=user_id,
        action=action,
        resource=resource,
        success_only=success_only
    )


@router.get("/users/{user_id}/security", response_model=UserSecurityInfo)
async def get_user_security_info(
    user_id: str,
    current_user: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db)
):
    """Get security information for a specific user (admin only)"""
    from app.modules.users.services import UserService
    user_service = UserService(db)
    
    user = await user_service.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get permissions
    permissions = []
    effective_permissions = set()
    
    if user.roles:
        for role in user.roles:
            if role.permissions:
                for perm in role.permissions:
                    permissions.append(perm.name)
                    effective_permissions.add(perm.name)
    
    # Get additional user permissions if any
    if hasattr(user, 'permissions') and user.permissions:
        for perm in user.permissions:
            effective_permissions.add(perm.name)
    
    # Get session info
    from app.modules.security.repository import SessionRepository
    session_repo = SessionRepository(db)
    active_sessions = await session_repo.get_active_sessions(user_id=user_id)
    
    # Get failed login attempts
    from app.modules.security.repository import SecurityRepository
    security_repo = SecurityRepository(db)
    from datetime import datetime, timedelta
    last_24h = datetime.utcnow() - timedelta(hours=24)
    failed_attempts = await security_repo.get_failed_login_attempts(
        since=last_24h,
        user_id=user_id
    )
    
    return UserSecurityInfo(
        user_id=str(user.id),
        username=user.username,
        email=user.email,
        roles=[role.name for role in user.roles] if user.roles else [],
        permissions=list(permissions),
        effective_permissions=list(effective_permissions),
        last_login=user.last_login if hasattr(user, 'last_login') else None,
        failed_login_attempts=failed_attempts,
        is_locked=not user.is_active,
        two_factor_enabled=False,  # TODO: Implement 2FA
        active_sessions=len(active_sessions)
    )