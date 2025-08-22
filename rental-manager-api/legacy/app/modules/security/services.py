"""
Security management service layer
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.security.repository import (
    SecurityRepository,
    RolePermissionRepository,
    SessionRepository
)
from app.modules.security.schemas import (
    PermissionResponse,
    RoleResponse,
    RoleWithPermissions,
    SecurityStats,
    UserSecurityInfo,
    PermissionCategory,
    RoleTemplate
)
from app.modules.users.services import UserService
from app.shared.exceptions import NotFoundError, ValidationError


class SecurityService:
    """Service for security management operations"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.security_repo = SecurityRepository(db)
        self.role_perm_repo = RolePermissionRepository(db)
        self.session_repo = SessionRepository(db)
        self.user_service = UserService(db)
    
    async def get_security_stats(self) -> SecurityStats:
        """Get comprehensive security statistics"""
        # Get user stats
        users = await self.user_service.get_all({})
        total_users = len(users[0]) if users else 0
        
        # Get role and permission stats
        roles = await self.role_perm_repo.get_all_roles()
        permissions = await self.role_perm_repo.get_all_permissions()
        
        # Get active sessions
        active_sessions = await self.session_repo.count_active_sessions()
        
        # Get failed login attempts today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        failed_attempts = await self.security_repo.get_failed_login_attempts(since=today_start)
        
        # Calculate security score (simplified)
        security_score = self._calculate_security_score(
            total_users,
            len(roles),
            len(permissions),
            failed_attempts
        )
        
        # Get most used roles
        most_used_roles = []
        for role in roles[:5]:  # Top 5 roles
            stats = await self.role_perm_repo.get_role_usage_stats(str(role.id))
            most_used_roles.append({
                "role": role.name,
                "user_count": stats.get("user_count", 0)
            })
        
        # Get recent security events
        recent_events = await self.security_repo.get_recent_logs(limit=10)
        recent_security_events = [
            {
                "timestamp": event.timestamp.isoformat(),
                "user": event.user_name,
                "action": event.action,
                "resource": event.resource,
                "success": event.success
            }
            for event in recent_events
        ]
        
        # Calculate permission coverage
        permission_coverage = self._calculate_permission_coverage(roles, permissions)
        
        # Calculate role distribution
        role_distribution = {role.name: len(role.users) if role.users else 0 for role in roles}
        
        return SecurityStats(
            total_users=total_users,
            total_roles=len(roles),
            total_permissions=len(permissions),
            active_sessions=active_sessions,
            failed_login_attempts_today=failed_attempts,
            security_score=security_score,
            most_used_roles=most_used_roles,
            recent_security_events=recent_security_events,
            permission_coverage=permission_coverage,
            role_distribution=role_distribution
        )
    
    async def get_all_permissions(self) -> List[PermissionResponse]:
        """Get all permissions"""
        permissions = await self.role_perm_repo.get_all_permissions()
        
        responses = []
        for perm in permissions:
            # Count how many roles use this permission
            usage_count = 0
            roles = await self.role_perm_repo.get_all_roles()
            for role in roles:
                if perm in role.permissions:
                    usage_count += 1
            
            responses.append(PermissionResponse(
                id=str(perm.id),
                name=perm.name,
                description=perm.description,
                resource=perm.resource,
                action=perm.action,
                risk_level=perm.risk_level,
                is_system_permission=perm.is_system_permission,
                usage_count=usage_count,
                created_at=perm.created_at,
                updated_at=perm.updated_at
            ))
        
        return responses
    
    async def get_permission_categories(self) -> List[PermissionCategory]:
        """Get permissions grouped by category"""
        categories = await self.role_perm_repo.get_permission_categories()
        
        result = []
        for cat in categories:
            perm_responses = [
                PermissionResponse(
                    id=str(p.id),
                    name=p.name,
                    description=p.description,
                    resource=p.resource,
                    action=p.action,
                    risk_level=p.risk_level,
                    is_system_permission=p.is_system_permission,
                    created_at=p.created_at,
                    updated_at=p.updated_at
                )
                for p in cat["permissions"]
            ]
            
            result.append(PermissionCategory(
                name=cat["name"],
                description=cat["description"],
                resource=cat["resource"],
                permissions=perm_responses,
                total_permissions=cat["total_permissions"]
            ))
        
        return result
    
    async def get_all_roles(self) -> List[RoleResponse]:
        """Get all roles"""
        roles = await self.role_perm_repo.get_all_roles()
        
        responses = []
        for role in roles:
            responses.append(RoleResponse(
                id=str(role.id),
                name=role.name,
                description=role.description,
                is_active=role.is_active,
                is_system_role=role.is_system_role,
                permissions=[p.name for p in role.permissions] if role.permissions else [],
                user_count=len(role.users) if role.users else 0,
                created_at=role.created_at,
                updated_at=role.updated_at
            ))
        
        return responses
    
    async def get_role_by_id(self, role_id: str) -> RoleWithPermissions:
        """Get role with detailed permissions"""
        role = await self.role_perm_repo.get_role_by_id(role_id)
        if not role:
            raise NotFoundError(f"Role with ID {role_id} not found")
        
        permission_details = []
        if role.permissions:
            for perm in role.permissions:
                permission_details.append(PermissionResponse(
                    id=str(perm.id),
                    name=perm.name,
                    description=perm.description,
                    resource=perm.resource,
                    action=perm.action,
                    risk_level=perm.risk_level,
                    is_system_permission=perm.is_system_permission,
                    created_at=perm.created_at,
                    updated_at=perm.updated_at
                ))
        
        return RoleWithPermissions(
            id=str(role.id),
            name=role.name,
            description=role.description,
            is_active=role.is_active,
            is_system_role=role.is_system_role,
            permissions=[p.name for p in role.permissions] if role.permissions else [],
            permission_details=permission_details,
            user_count=len(role.users) if role.users else 0,
            created_at=role.created_at,
            updated_at=role.updated_at
        )
    
    async def create_role(
        self,
        name: str,
        description: str,
        permissions: List[str],
        is_system_role: bool = False
    ) -> RoleResponse:
        """Create a new role"""
        # Check if role already exists
        existing = await self.role_perm_repo.get_role_by_name(name)
        if existing:
            raise ValidationError(f"Role with name '{name}' already exists")
        
        # Create the role
        role = await self.role_perm_repo.create_role(
            name=name,
            description=description,
            permissions=permissions,
            is_system_role=is_system_role
        )
        
        return RoleResponse(
            id=str(role.id),
            name=role.name,
            description=role.description,
            is_active=role.is_active,
            is_system_role=role.is_system_role,
            permissions=[p.name for p in role.permissions] if role.permissions else [],
            user_count=0,
            created_at=role.created_at,
            updated_at=role.updated_at
        )
    
    async def update_role(
        self,
        role_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        permissions: Optional[List[str]] = None,
        is_active: Optional[bool] = None
    ) -> RoleResponse:
        """Update a role"""
        role = await self.role_perm_repo.get_role_by_id(role_id)
        if not role:
            raise NotFoundError(f"Role with ID {role_id} not found")
        
        if role.is_system_role:
            raise ValidationError("System roles cannot be modified")
        
        # Update fields
        if name:
            role.name = name
        if description:
            role.description = description
        if is_active is not None:
            role.is_active = is_active
        
        # Update permissions if provided
        if permissions is not None:
            role = await self.role_perm_repo.update_role_permissions(role_id, permissions)
        
        await self.db.commit()
        await self.db.refresh(role)
        
        return RoleResponse(
            id=str(role.id),
            name=role.name,
            description=role.description,
            is_active=role.is_active,
            is_system_role=role.is_system_role,
            permissions=[p.name for p in role.permissions] if role.permissions else [],
            user_count=len(role.users) if role.users else 0,
            created_at=role.created_at,
            updated_at=role.updated_at
        )
    
    async def delete_role(self, role_id: str) -> bool:
        """Delete a role"""
        role = await self.role_perm_repo.get_role_by_id(role_id)
        if not role:
            raise NotFoundError(f"Role with ID {role_id} not found")
        
        if role.is_system_role:
            raise ValidationError("System roles cannot be deleted")
        
        if role.users:
            raise ValidationError(f"Cannot delete role with {len(role.users)} assigned users")
        
        await self.db.delete(role)
        await self.db.commit()
        return True
    
    async def get_role_templates(self) -> List[RoleTemplate]:
        """Get predefined role templates"""
        templates = [
            RoleTemplate(
                name="Read-Only User",
                description="User with read-only access to all resources",
                category="Basic",
                permissions=[
                    "USER_VIEW", "CUSTOMER_VIEW", "SUPPLIER_VIEW",
                    "INVENTORY_VIEW", "RENTAL_VIEW", "TRANSACTION_VIEW",
                    "MASTER_DATA_VIEW", "ANALYTICS_VIEW", "REPORT_VIEW"
                ],
                recommended_for=["Auditors", "Observers", "Trainees"]
            ),
            RoleTemplate(
                name="Data Entry Clerk",
                description="User who can create and update basic data",
                category="Operations",
                permissions=[
                    "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE",
                    "INVENTORY_VIEW", "INVENTORY_UPDATE",
                    "TRANSACTION_VIEW", "TRANSACTION_CREATE",
                    "MASTER_DATA_VIEW"
                ],
                recommended_for=["Data Entry Staff", "Junior Staff"]
            ),
            RoleTemplate(
                name="Inventory Manager",
                description="Full control over inventory management",
                category="Management",
                permissions=[
                    "INVENTORY_VIEW", "INVENTORY_CREATE", 
                    "INVENTORY_UPDATE", "INVENTORY_DELETE",
                    "SUPPLIER_VIEW", "SUPPLIER_CREATE", 
                    "SUPPLIER_UPDATE", "SUPPLIER_DELETE",
                    "MASTER_DATA_VIEW", "MASTER_DATA_CREATE", 
                    "MASTER_DATA_UPDATE",
                    "ANALYTICS_VIEW", "REPORT_VIEW", "REPORT_CREATE"
                ],
                recommended_for=["Inventory Managers", "Warehouse Managers"]
            ),
            RoleTemplate(
                name="Sales Manager",
                description="Full control over sales and customer management",
                category="Management",
                permissions=[
                    "CUSTOMER_VIEW", "CUSTOMER_CREATE", 
                    "CUSTOMER_UPDATE", "CUSTOMER_DELETE",
                    "RENTAL_VIEW", "RENTAL_CREATE", 
                    "RENTAL_UPDATE", "RENTAL_DELETE",
                    "TRANSACTION_VIEW", "TRANSACTION_CREATE", 
                    "TRANSACTION_UPDATE",
                    "ANALYTICS_VIEW", "REPORT_VIEW", "REPORT_CREATE"
                ],
                recommended_for=["Sales Managers", "Customer Service Managers"]
            ),
            RoleTemplate(
                name="System Administrator",
                description="Full system access except user management",
                category="Administration",
                permissions=[p["name"] for p in CORE_PERMISSIONS if not p["name"].startswith("USER_")],
                recommended_for=["IT Administrators", "System Managers"]
            )
        ]
        
        return templates
    
    async def get_audit_logs(
        self,
        limit: int = 100,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource: Optional[str] = None,
        success_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Get security audit logs"""
        logs = await self.security_repo.get_recent_logs(
            limit=limit,
            user_id=user_id,
            action=action,
            resource=resource,
            success_only=success_only
        )
        
        return [
            {
                "id": str(log.id),
                "timestamp": log.timestamp.isoformat(),
                "user_id": str(log.user_id),
                "user_name": log.user_name,
                "action": log.action,
                "resource": log.resource,
                "resource_id": log.resource_id,
                "details": log.details,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "success": log.success,
                "error_message": log.error_message
            }
            for log in logs
        ]
    
    async def log_security_event(
        self,
        user_id: str,
        user_name: str,
        action: str,
        resource: str,
        **kwargs
    ) -> None:
        """Log a security event"""
        await self.security_repo.log_security_event(
            user_id=user_id,
            user_name=user_name,
            action=action,
            resource=resource,
            **kwargs
        )
    
    def _calculate_security_score(
        self,
        total_users: int,
        total_roles: int,
        total_permissions: int,
        failed_attempts: int
    ) -> float:
        """Calculate a simple security score (0-100)"""
        score = 100.0
        
        # Deduct points for issues
        if total_roles == 0:
            score -= 20
        if total_permissions == 0:
            score -= 20
        if failed_attempts > 10:
            score -= min(30, failed_attempts)
        if total_users > 0 and total_roles / total_users < 0.5:
            score -= 10  # Not enough role coverage
        
        return max(0, min(100, score))
    
    def _calculate_permission_coverage(
        self,
        roles: List,
        permissions: List
    ) -> Dict[str, float]:
        """Calculate permission coverage by resource"""
        if not permissions:
            return {}
        
        # Group permissions by resource
        resource_perms = {}
        for perm in permissions:
            if perm.resource not in resource_perms:
                resource_perms[perm.resource] = []
            resource_perms[perm.resource].append(perm)
        
        # Calculate coverage
        coverage = {}
        for resource, perms in resource_perms.items():
            assigned_count = 0
            for perm in perms:
                for role in roles:
                    if role.permissions and perm in role.permissions:
                        assigned_count += 1
                        break
            
            coverage[resource] = (assigned_count / len(perms)) * 100 if perms else 0
        
        return coverage


# Define permissions for role templates
CORE_PERMISSIONS = [
    {"name": "USER_VIEW"}, {"name": "USER_CREATE"}, {"name": "USER_UPDATE"}, {"name": "USER_DELETE"},
    {"name": "ROLE_VIEW"}, {"name": "ROLE_CREATE"}, {"name": "ROLE_UPDATE"}, {"name": "ROLE_DELETE"},
    {"name": "CUSTOMER_VIEW"}, {"name": "CUSTOMER_CREATE"}, {"name": "CUSTOMER_UPDATE"}, {"name": "CUSTOMER_DELETE"},
    {"name": "SUPPLIER_VIEW"}, {"name": "SUPPLIER_CREATE"}, {"name": "SUPPLIER_UPDATE"}, {"name": "SUPPLIER_DELETE"},
    {"name": "INVENTORY_VIEW"}, {"name": "INVENTORY_CREATE"}, {"name": "INVENTORY_UPDATE"}, {"name": "INVENTORY_DELETE"},
    {"name": "RENTAL_VIEW"}, {"name": "RENTAL_CREATE"}, {"name": "RENTAL_UPDATE"}, {"name": "RENTAL_DELETE"},
    {"name": "TRANSACTION_VIEW"}, {"name": "TRANSACTION_CREATE"}, {"name": "TRANSACTION_UPDATE"}, {"name": "TRANSACTION_DELETE"},
    {"name": "MASTER_DATA_VIEW"}, {"name": "MASTER_DATA_CREATE"}, {"name": "MASTER_DATA_UPDATE"}, {"name": "MASTER_DATA_DELETE"},
    {"name": "ANALYTICS_VIEW"}, {"name": "REPORT_VIEW"}, {"name": "REPORT_CREATE"},
    {"name": "SYSTEM_CONFIG"}, {"name": "AUDIT_VIEW"}, {"name": "BACKUP_MANAGE"},
]