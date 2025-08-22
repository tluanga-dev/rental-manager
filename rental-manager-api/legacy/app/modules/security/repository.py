"""
Security repository for data access
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.auth.models import Role, Permission
from app.modules.users.models import User
from app.modules.security.models import SecurityAuditLog, SessionToken, IPWhitelist
from app.shared.repository import BaseRepository


class SecurityRepository(BaseRepository[SecurityAuditLog]):
    """Repository for security audit logs"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(SecurityAuditLog, db)
    
    async def log_security_event(
        self,
        user_id: str,
        user_name: str,
        action: str,
        resource: str,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> SecurityAuditLog:
        """Log a security event"""
        log_entry = SecurityAuditLog(
            user_id=user_id,
            user_name=user_name,
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            error_message=error_message
        )
        
        self.session.add(log_entry)
        await self.session.commit()
        await self.session.refresh(log_entry)
        return log_entry
    
    async def get_recent_logs(
        self,
        limit: int = 100,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource: Optional[str] = None,
        success_only: bool = False
    ) -> List[SecurityAuditLog]:
        """Get recent security audit logs with filters"""
        query = select(SecurityAuditLog)
        
        if user_id:
            query = query.where(SecurityAuditLog.user_id == user_id)
        if action:
            query = query.where(SecurityAuditLog.action == action)
        if resource:
            query = query.where(SecurityAuditLog.resource == resource)
        if success_only:
            query = query.where(SecurityAuditLog.success == True)
        
        query = query.order_by(desc(SecurityAuditLog.timestamp)).limit(limit)
        
        result = await self.session.execute(query)
        return result.scalars().all()
    
    async def get_failed_login_attempts(
        self,
        since: datetime,
        user_id: Optional[str] = None
    ) -> int:
        """Count failed login attempts since a given time"""
        query = select(func.count(SecurityAuditLog.id)).where(
            and_(
                SecurityAuditLog.action == "LOGIN_ATTEMPT",
                SecurityAuditLog.success == False,
                SecurityAuditLog.timestamp >= since
            )
        )
        
        if user_id:
            query = query.where(SecurityAuditLog.user_id == user_id)
        
        result = await self.session.execute(query)
        return result.scalar() or 0


class RolePermissionRepository:
    """Repository for role and permission management"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_all_permissions(self) -> List[Permission]:
        """Get all permissions"""
        query = select(Permission).order_by(Permission.resource, Permission.action)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_permissions_by_resource(self, resource: str) -> List[Permission]:
        """Get permissions for a specific resource"""
        query = select(Permission).where(
            Permission.resource == resource
        ).order_by(Permission.action)
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def get_permission_by_name(self, name: str) -> Optional[Permission]:
        """Get a permission by name"""
        query = select(Permission).where(Permission.name == name)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def create_permission(
        self,
        name: str,
        description: str,
        resource: str,
        action: str,
        risk_level: str = "LOW",
        is_system_permission: bool = False
    ) -> Permission:
        """Create a new permission"""
        permission = Permission(
            name=name,
            description=description,
            resource=resource,
            action=action,
            risk_level=risk_level,
            is_system_permission=is_system_permission
        )
        
        self.db.add(permission)
        await self.db.commit()
        await self.db.refresh(permission)
        return permission
    
    async def get_all_roles(self, include_permissions: bool = True) -> List[Role]:
        """Get all roles"""
        query = select(Role)
        
        if include_permissions:
            query = query.options(selectinload(Role.permissions))
        
        query = query.order_by(Role.name)
        result = await self.db.execute(query)
        return result.scalars().unique().all()
    
    async def get_role_by_id(self, role_id: str) -> Optional[Role]:
        """Get a role by ID"""
        query = select(Role).where(Role.id == role_id).options(
            selectinload(Role.permissions),
            selectinload(Role.users)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_role_by_name(self, name: str) -> Optional[Role]:
        """Get a role by name"""
        query = select(Role).where(Role.name == name).options(
            selectinload(Role.permissions)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def create_role(
        self,
        name: str,
        description: str,
        permissions: List[str] = None,
        is_system_role: bool = False
    ) -> Role:
        """Create a new role"""
        try:
            role = Role(
                name=name,
                description=description,
                is_system_role=is_system_role,
                is_active=True
            )
            
            # Add permissions if provided
            if permissions:
                for perm_name in permissions:
                    permission = await self.get_permission_by_name(perm_name)
                    if permission:
                        role.permissions.append(permission)
            
            self.db.add(role)
            await self.db.commit()
            await self.db.refresh(role)
            return role
        except Exception as e:
            await self.db.rollback()
            raise e
    
    async def update_role_permissions(
        self,
        role_id: str,
        permission_names: List[str]
    ) -> Optional[Role]:
        """Update permissions for a role"""
        role = await self.get_role_by_id(role_id)
        if not role:
            return None
        
        # Clear existing permissions
        role.permissions = []
        
        # Add new permissions
        for perm_name in permission_names:
            permission = await self.get_permission_by_name(perm_name)
            if permission:
                role.permissions.append(permission)
        
        await self.db.commit()
        await self.db.refresh(role)
        return role
    
    async def get_permission_categories(self) -> List[Dict[str, Any]]:
        """Get permissions grouped by resource/category"""
        query = select(
            Permission.resource,
            func.count(Permission.id).label("count")
        ).group_by(Permission.resource).order_by(Permission.resource)
        
        result = await self.db.execute(query)
        categories = []
        
        for row in result:
            resource = row[0]
            count = row[1]
            
            # Get permissions for this resource
            perms = await self.get_permissions_by_resource(resource)
            
            categories.append({
                "name": resource.replace("_", " ").title(),
                "resource": resource,
                "description": f"Permissions for {resource}",
                "total_permissions": count,
                "permissions": perms
            })
        
        return categories
    
    async def get_role_usage_stats(self, role_id: str) -> Dict[str, Any]:
        """Get usage statistics for a role"""
        role = await self.get_role_by_id(role_id)
        if not role:
            return {}
        
        return {
            "role_id": role.id,
            "role_name": role.name,
            "user_count": len(role.users) if role.users else 0,
            "permission_count": len(role.permissions) if role.permissions else 0,
            "is_system_role": role.is_system_role,
            "is_active": role.is_active
        }


class SessionRepository:
    """Repository for session management"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_active_sessions(
        self,
        user_id: Optional[str] = None
    ) -> List[SessionToken]:
        """Get active sessions"""
        query = select(SessionToken).where(
            and_(
                SessionToken.is_active == True,
                SessionToken.expires_at > datetime.utcnow()
            )
        )
        
        if user_id:
            query = query.where(SessionToken.user_id == user_id)
        
        query = query.order_by(desc(SessionToken.last_activity))
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def count_active_sessions(self) -> int:
        """Count total active sessions"""
        query = select(func.count(SessionToken.id)).where(
            and_(
                SessionToken.is_active == True,
                SessionToken.expires_at > datetime.utcnow()
            )
        )
        
        result = await self.db.execute(query)
        return result.scalar() or 0
    
    async def revoke_session(
        self,
        token_hash: str,
        reason: str = "Manual revocation"
    ) -> bool:
        """Revoke a session"""
        query = select(SessionToken).where(SessionToken.token_hash == token_hash)
        result = await self.db.execute(query)
        session = result.scalar_one_or_none()
        
        if session:
            session.is_active = False
            session.revoked_at = datetime.utcnow()
            session.revoke_reason = reason
            await self.db.commit()
            return True
        
        return False