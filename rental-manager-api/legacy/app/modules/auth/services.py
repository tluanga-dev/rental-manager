from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status, Request
import secrets
import uuid

from app.core.security import (
    verify_password, 
    get_password_hash, 
    create_token_pair,
    verify_token,
    create_access_token
)
from app.core.config import settings
from app.shared.exceptions import (
    InvalidCredentialsError,
    NotFoundError,
    AlreadyExistsError,
    ValidationError
)
from app.modules.auth.models import RefreshToken, LoginAttempt, PasswordResetToken, Role
from app.modules.users.models import User
from app.modules.users.services import UserService


class AuthService:
    """Authentication service"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_service = UserService(db)
    
    async def register(self, username: str, email: str, password: str, full_name: str) -> User:
        """Register a new user"""
        # Check if user already exists
        existing_user = await self.user_service.get_by_email(email)
        if existing_user:
            raise AlreadyExistsError("User", "email", email)
        
        # Check if username already exists
        existing_username = await self.user_service.get_by_username(username)
        if existing_username:
            raise AlreadyExistsError("User", "username", username)
        
        # Validate password
        if len(password) < settings.PASSWORD_MIN_LENGTH:
            raise ValidationError(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long")
        
        # Create user
        user_data = {
            "username": username,
            "email": email,
            "password": password,  # UserService will hash this
            "full_name": full_name,
            "is_active": True
        }
        
        user = await self.user_service.create(user_data)
        return user
    
    async def login(self, username_or_email: str, password: str, request: Request = None) -> Dict[str, Any]:
        """Authenticate user and return tokens"""
        # Get client info
        ip_address = request.client.host if request else None
        user_agent = request.headers.get("user-agent") if request else None
        
        # Get user by username or email with roles and permissions
        user = await self._get_user_with_permissions(username_or_email)
        
        if not user:
            # Log failed login attempt
            await self._log_login_attempt(
                email=username_or_email,
                ip_address=ip_address,
                user_agent=user_agent,
                success=False,
                failure_reason="User not found"
            )
            raise InvalidCredentialsError("Invalid username/email or password")
        
        if not user.is_active:
            # Log failed login attempt
            await self._log_login_attempt(
                email=username_or_email,
                ip_address=ip_address,
                user_agent=user_agent,
                success=False,
                failure_reason="Account disabled"
            )
            raise InvalidCredentialsError("Account is disabled")
        
        # Verify password
        if not verify_password(password, user.password):
            # Log failed login attempt
            await self._log_login_attempt(
                email=username_or_email,
                ip_address=ip_address,
                user_agent=user_agent,
                success=False,
                failure_reason="Invalid password"
            )
            raise InvalidCredentialsError("Invalid username/email or password")
        
        # Create tokens
        tokens = create_token_pair(
            user_id=str(user.id),  # int → str
            username=user.username,
            scopes=["read", "write"] if user.is_active else ["read"]
        )
        
        # Store refresh token
        await self._store_refresh_token(
            user_id=user.id,
            token=tokens.refresh_token,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        # Log successful login attempt
        await self._log_login_attempt(
            email=username_or_email,
            ip_address=ip_address,
            user_agent=user_agent,
            success=True
        )
        
        # Update last login
        await self.user_service.update_last_login(user.id)
        
        # Build comprehensive user response
        try:
            user_response = self._build_user_response(user)
        except Exception as e:
            # Fallback to minimal user response if there are any issues
            user_response = {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name or "",
                "isActive": user.is_active,
                "isSuperuser": user.is_superuser,
                "userType": user.user_type,
                "effectivePermissions": {
                    "userType": user.user_type,
                    "isSuperuser": user.is_superuser,
                    "rolePermissions": [],
                    "directPermissions": [],
                    "allPermissions": [],
                }
            }
        
        # Ensure all async operations are complete before returning
        await self.db.commit()
        
        return {
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "token_type": tokens.token_type,
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "expiresIn": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # camelCase for frontend
            "user": user_response
        }
    
    async def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh access token using refresh token"""
        # Verify refresh token
        token_data = verify_token(refresh_token, "refresh")
        
        # Check if refresh token exists in database
        stmt = select(RefreshToken).where(
            and_(
                RefreshToken.token == refresh_token,
                RefreshToken.is_active == True,
                RefreshToken.expires_at > datetime.now(timezone.utc)
            )
        )
        result = await self.db.execute(stmt)
        stored_token = result.scalar_one_or_none()
        
        if not stored_token:
            raise InvalidCredentialsError("Invalid refresh token")
        
        # Get user
        user = await self.user_service.get_by_id(token_data.user_id)
        if not user or not user.is_active:
            raise InvalidCredentialsError("User not found or inactive")
        
        # Create new access token
        access_token = create_access_token({
            "sub": user.email,
            "user_id": str(user.id),  # int → str
            "scopes": ["read", "write"] if user.is_active else ["read"]
        })
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    
    async def logout(self, refresh_token: str) -> None:
        """Logout user by invalidating refresh token"""
        stmt = select(RefreshToken).where(RefreshToken.token == refresh_token)
        result = await self.db.execute(stmt)
        stored_token = result.scalar_one_or_none()
        
        if stored_token:
            stored_token.is_active = False
            await self.db.commit()
    
    async def logout_all(self, user_id: uuid.UUID) -> None:
        """Logout user from all devices"""
        stmt = (
            select(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .where(RefreshToken.is_active == True)
        )
        result = await self.db.execute(stmt)
        tokens = result.scalars().all()
        
        for token in tokens:
            token.is_active = False
        
        await self.db.commit()
    
    async def change_password(self, user_id: uuid.UUID, current_password: str, new_password: str) -> None:
        """Change user password"""
        user = await self.user_service.get_by_id(user_id)
        if not user:
            raise NotFoundError("User", user_id)
        
        # Verify current password
        if not verify_password(current_password, user.password):
            raise InvalidCredentialsError("Current password is incorrect")
        
        # Validate new password
        if len(new_password) < settings.PASSWORD_MIN_LENGTH:
            raise ValidationError(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long")
        
        # Update password
        user.password = get_password_hash(new_password)
        await self.db.commit()
        
        # Logout from all devices for security
        await self.logout_all(user_id)
    
    async def forgot_password(self, email: str) -> str:
        """Generate password reset token"""
        user = await self.user_service.get_by_email(email)
        if not user:
            # Don't reveal if email exists
            return "If the email exists, a reset link will be sent"
        
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)  # 1 hour expiry
        
        # Store reset token
        password_reset = PasswordResetToken(
            token=reset_token,
            user_id=user.id,
            expires_at=expires_at
        )
        
        self.db.add(password_reset)
        await self.db.commit()
        
        # In production, send email here
        return reset_token
    
    async def reset_password(self, token: str, new_password: str) -> None:
        """Reset password using reset token"""
        # Find valid reset token
        stmt = select(PasswordResetToken).where(
            and_(
                PasswordResetToken.token == token,
                PasswordResetToken.is_used == False,
                PasswordResetToken.expires_at > datetime.now(timezone.utc)
            )
        )
        result = await self.db.execute(stmt)
        reset_token = result.scalar_one_or_none()
        
        if not reset_token:
            raise InvalidCredentialsError("Invalid or expired reset token")
        
        # Get user
        user = await self.user_service.get_by_id(reset_token.user_id)
        if not user:
            raise NotFoundError("User", reset_token.user_id)
        
        # Validate new password
        if len(new_password) < settings.PASSWORD_MIN_LENGTH:
            raise ValidationError(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long")
        
        # Update password
        user.password = get_password_hash(new_password)
        reset_token.is_used = True
        
        await self.db.commit()
        
        # Logout from all devices for security
        await self.logout_all(user.id)
    
    async def _store_refresh_token(
        self, 
        user_id: uuid.UUID, 
        token: str, 
        ip_address: str = None,
        user_agent: str = None
    ) -> None:
        """Store refresh token in database"""
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
        # First, check if this token already exists and delete it
        existing_stmt = delete(RefreshToken).where(RefreshToken.token == token)
        await self.db.execute(existing_stmt)
        
        refresh_token = RefreshToken(
            token=token,
            user_id=user_id,
            expires_at=expires_at,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        self.db.add(refresh_token)
        await self.db.commit()
    
    async def _log_login_attempt(
        self,
        email: str,
        ip_address: str = None,
        user_agent: str = None,
        success: bool = False,
        failure_reason: str = None
    ) -> None:
        """Log login attempt for security tracking"""
        login_attempt = LoginAttempt(
            email=email,
            ip_address=ip_address or "unknown",
            user_agent=user_agent,
            success=success,
            failure_reason=failure_reason
        )
        
        self.db.add(login_attempt)
        await self.db.commit()
    
    async def cleanup_expired_tokens(self) -> None:
        """Clean up expired refresh tokens and reset tokens"""
        now = datetime.now(timezone.utc)
        
        # Delete expired refresh tokens
        await self.db.execute(
            delete(RefreshToken).where(RefreshToken.expires_at < now)
        )
        
        # Delete expired reset tokens
        await self.db.execute(
            delete(PasswordResetToken).where(PasswordResetToken.expires_at < now)
        )
        
        await self.db.commit()
    
    async def _get_user_with_permissions(self, username_or_email: str) -> Optional[User]:
        """Get user with roles and permissions loaded"""
        # Check if it's email or username
        if "@" in username_or_email:
            stmt = select(User).where(User.email == username_or_email)
        else:
            stmt = select(User).where(User.username == username_or_email)
        
        # Load roles and permissions
        stmt = stmt.options(
            selectinload(User.roles).selectinload(Role.permissions),
            selectinload(User.direct_permissions)
        )
        
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    def _build_user_response(self, user: User) -> Dict[str, Any]:
        """Build minimal user response to avoid any lazy loading issues"""
        # Build minimal effective permissions structure without accessing relationships
        effective_permissions = {
            "userType": user.user_type,
            "isSuperuser": user.is_superuser,
            "rolePermissions": [],  # Will be populated separately if needed
            "directPermissions": [],  # Will be populated separately if needed
            "allPermissions": [],
            "all_permissions": [],
        }
        
        # Build basic user response with only direct attributes
        user_response = {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "firstName": "",  # Simplified - avoid accessing potentially missing attributes
            "lastName": "",
            "name": user.full_name or "",
            "full_name": user.full_name or "",
            "userType": user.user_type,
            "locationId": None,
            "isActive": user.is_active,
            "is_active": user.is_active,
            "isSuperuser": user.is_superuser,
            "is_superuser": user.is_superuser,
            "lastLogin": user.last_login.isoformat() if user.last_login else None,
            "createdAt": user.created_at.isoformat() if user.created_at else None,
            "updatedAt": user.updated_at.isoformat() if user.updated_at else None,
            "directPermissions": [],
            "effectivePermissions": effective_permissions,
            "effective_permissions": effective_permissions,
        }
        
        return user_response