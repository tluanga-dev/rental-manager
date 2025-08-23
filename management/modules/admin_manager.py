"""
Admin Manager Module

Handles admin user creation, management, and validation for the rental management system.
Integrates with the existing User model and authentication system.
"""

import asyncio
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

# Import from existing rental-manager-api
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "rental-manager-api"))

# Import all models to ensure proper initialization
from app.models import *  # This includes TransactionHeader and all other models
from app.models.user import User, UserRole
from app.core.security import SecurityManager

# Configure SQLAlchemy registry to resolve all relationships
from sqlalchemy.orm import configure_mappers
try:
    configure_mappers()
except Exception as e:
    # Ignore configuration errors for now
    pass

logger = logging.getLogger(__name__)
console = Console()


class AdminManager:
    """Manages admin users for the rental management system"""
    
    def __init__(self, session: AsyncSession, admin_config):
        self.session = session
        self.admin_config = admin_config
    
    async def create_admin_user(self, force: bool = False) -> tuple[bool, str, Optional[User]]:
        """
        Create admin user from configuration
        
        Args:
            force: If True, update existing admin user
            
        Returns:
            Tuple of (success, message, user_object)
        """
        try:
            # Validate admin configuration
            valid, issues = self._validate_admin_config()
            if not valid:
                return False, f"Invalid admin configuration: {'; '.join(issues)}", None
            
            # Check if admin already exists
            existing_admin = await self.get_admin_by_username(self.admin_config.ADMIN_USERNAME)
            
            if existing_admin and not force:
                return False, f"Admin user '{self.admin_config.ADMIN_USERNAME}' already exists", existing_admin
            
            if existing_admin and force:
                # Update existing admin
                return await self._update_existing_admin(existing_admin)
            else:
                # Create new admin
                return await self._create_new_admin()
                
        except Exception as e:
            logger.error(f"Error creating admin user: {e}")
            return False, f"Failed to create admin user: {str(e)}", None
    
    async def _create_new_admin(self) -> tuple[bool, str, User]:
        """Create new admin user"""
        try:
            # Hash password
            hashed_password = SecurityManager.get_password_hash(self.admin_config.ADMIN_PASSWORD)
            
            # Split full name
            name_parts = self.admin_config.ADMIN_FULL_NAME.split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""
            
            # Create admin user
            admin_user = User(
                email=self.admin_config.ADMIN_EMAIL,
                username=self.admin_config.ADMIN_USERNAME,
                hashed_password=hashed_password,
                first_name=first_name,
                last_name=last_name,
                role=UserRole.ADMIN.value,
                is_active=True,
                is_verified=True,
                is_superuser=True,
                password_changed_at=datetime.utcnow()
            )
            
            self.session.add(admin_user)
            await self.session.commit()
            await self.session.refresh(admin_user)
            
            logger.info(f"Admin user created successfully: {admin_user.username} (ID: {admin_user.id})")
            return True, f"Admin user '{admin_user.username}' created successfully", admin_user
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error creating new admin: {e}")
            raise
    
    async def _update_existing_admin(self, existing_admin: User) -> tuple[bool, str, User]:
        """Update existing admin user"""
        try:
            # Hash new password
            hashed_password = SecurityManager.get_password_hash(self.admin_config.ADMIN_PASSWORD)
            
            # Split full name
            name_parts = self.admin_config.ADMIN_FULL_NAME.split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""
            
            # Update admin user
            stmt = update(User).where(User.id == existing_admin.id).values(
                email=self.admin_config.ADMIN_EMAIL,
                hashed_password=hashed_password,
                first_name=first_name,
                last_name=last_name,
                role=UserRole.ADMIN.value,
                is_active=True,
                is_verified=True,
                is_superuser=True,
                password_changed_at=datetime.utcnow()
            )
            
            await self.session.execute(stmt)
            await self.session.commit()
            
            # Refresh the object
            await self.session.refresh(existing_admin)
            
            logger.info(f"Admin user updated successfully: {existing_admin.username}")
            return True, f"Admin user '{existing_admin.username}' updated successfully", existing_admin
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error updating existing admin: {e}")
            raise
    
    async def get_admin_by_username(self, username: str) -> Optional[User]:
        """Get admin user by username"""
        try:
            stmt = select(User).where(
                User.username == username,
                User.role == UserRole.ADMIN.value
            )
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting admin by username: {e}")
            return None
    
    async def get_admin_by_email(self, email: str) -> Optional[User]:
        """Get admin user by email"""
        try:
            stmt = select(User).where(
                User.email == email,
                User.role == UserRole.ADMIN.value
            )
            result = await self.session.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error getting admin by email: {e}")
            return None
    
    async def list_all_admins(self) -> List[User]:
        """Get all admin users"""
        try:
            stmt = select(User).where(User.role == UserRole.ADMIN.value)
            result = await self.session.execute(stmt)
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error listing admin users: {e}")
            return []
    
    async def validate_admin_credentials(self, username: str, password: str) -> tuple[bool, str, Optional[User]]:
        """Validate admin credentials"""
        try:
            admin = await self.get_admin_by_username(username)
            if not admin:
                return False, "Admin user not found", None
            
            if not admin.is_active:
                return False, "Admin account is inactive", None
            
            if not SecurityManager.verify_password(password, admin.hashed_password):
                return False, "Invalid password", None
            
            return True, "Credentials valid", admin
            
        except Exception as e:
            logger.error(f"Error validating admin credentials: {e}")
            return False, f"Validation error: {str(e)}", None
    
    async def reset_admin_password(self, username: str, new_password: str) -> tuple[bool, str]:
        """Reset admin password"""
        try:
            admin = await self.get_admin_by_username(username)
            if not admin:
                return False, f"Admin user '{username}' not found"
            
            # Validate new password
            if len(new_password) < 8:
                return False, "Password must be at least 8 characters long"
            
            # Hash new password
            hashed_password = SecurityManager.get_password_hash(new_password)
            
            # Update password
            stmt = update(User).where(User.id == admin.id).values(
                hashed_password=hashed_password,
                password_changed_at=datetime.utcnow()
            )
            
            await self.session.execute(stmt)
            await self.session.commit()
            
            logger.info(f"Password reset for admin user: {username}")
            return True, f"Password reset successfully for '{username}'"
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error resetting admin password: {e}")
            return False, f"Failed to reset password: {str(e)}"
    
    async def delete_admin_user(self, username: str) -> tuple[bool, str]:
        """Delete admin user (soft delete by deactivating)"""
        try:
            admin = await self.get_admin_by_username(username)
            if not admin:
                return False, f"Admin user '{username}' not found"
            
            # Don't allow deleting the last admin
            all_admins = await self.list_all_admins()
            active_admins = [a for a in all_admins if a.is_active]
            
            if len(active_admins) <= 1:
                return False, "Cannot delete the last active admin user"
            
            # Deactivate admin
            stmt = update(User).where(User.id == admin.id).values(
                is_active=False,
                updated_at=datetime.utcnow()
            )
            
            await self.session.execute(stmt)
            await self.session.commit()
            
            logger.info(f"Admin user deactivated: {username}")
            return True, f"Admin user '{username}' has been deactivated"
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Error deleting admin user: {e}")
            return False, f"Failed to delete admin: {str(e)}"
    
    def _validate_admin_config(self) -> tuple[bool, List[str]]:
        """Validate admin configuration"""
        issues = []
        
        # Validate password
        valid_password, password_msg = self.admin_config.validate_admin_password()
        if not valid_password:
            issues.append(password_msg)
        
        # Validate email
        valid_email, email_msg = self.admin_config.validate_admin_email()
        if not valid_email:
            issues.append(email_msg)
        
        # Validate username
        valid_username, username_msg = self.admin_config.validate_admin_username()
        if not valid_username:
            issues.append(username_msg)
        
        return len(issues) == 0, issues
    
    def display_admin_table(self, admins: List[User]) -> None:
        """Display admin users in a formatted table"""
        if not admins:
            console.print("[yellow]No admin users found[/yellow]")
            return
        
        table = Table(title="Admin Users", show_header=True, header_style="bold magenta")
        
        table.add_column("ID", style="dim", width=6)
        table.add_column("Username", style="bold blue")
        table.add_column("Email", style="cyan")
        table.add_column("Full Name", style="green")
        table.add_column("Status", justify="center")
        table.add_column("Last Login", style="dim")
        table.add_column("Created", style="dim")
        
        for admin in admins:
            status = "🟢 Active" if admin.is_active else "🔴 Inactive"
            last_login = admin.last_login.strftime("%Y-%m-%d %H:%M") if admin.last_login else "Never"
            created = admin.created_at.strftime("%Y-%m-%d")
            
            table.add_row(
                str(admin.id),
                admin.username,
                admin.email,
                admin.full_name,
                status,
                last_login,
                created
            )
        
        console.print(table)
    
    def display_admin_summary(self, admin: User) -> None:
        """Display admin user summary"""
        status = "🟢 Active" if admin.is_active else "🔴 Inactive"
        verified = "✅ Verified" if admin.is_verified else "❌ Not Verified"
        superuser = "👑 Superuser" if admin.is_superuser else "👤 Regular Admin"
        
        panel_content = f"""
[bold blue]Username:[/bold blue] {admin.username}
[bold blue]Email:[/bold blue] {admin.email}
[bold blue]Full Name:[/bold blue] {admin.full_name}
[bold blue]Role:[/bold blue] {admin.role.upper()}
[bold blue]Status:[/bold blue] {status}
[bold blue]Verified:[/bold blue] {verified}
[bold blue]Type:[/bold blue] {superuser}
[bold blue]Created:[/bold blue] {admin.created_at.strftime("%Y-%m-%d %H:%M:%S")}
[bold blue]Last Login:[/bold blue] {admin.last_login.strftime("%Y-%m-%d %H:%M:%S") if admin.last_login else "Never"}
[bold blue]Password Changed:[/bold blue] {admin.password_changed_at.strftime("%Y-%m-%d %H:%M:%S") if admin.password_changed_at else "Unknown"}
        """
        
        panel = Panel(
            panel_content.strip(),
            title=f"Admin User Details - {admin.username}",
            border_style="blue",
            padding=(1, 2)
        )
        
        console.print(panel)