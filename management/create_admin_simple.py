#!/usr/bin/env python3
"""
Simple admin creation script that bypasses the complex model relationships
"""

import asyncio
import sys
from pathlib import Path
from rich.console import Console

# Add rental-manager-api to path
sys.path.insert(0, str(Path(__file__).parent.parent / "rental-manager-api"))

console = Console()

async def create_admin_simple():
    """Create admin user with minimal model loading"""
    console.print("[bold blue]👤 Creating Admin User (Simple)[/bold blue]")
    
    try:
        # Import only what we need
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import text
        from app.models.user import User, UserRole
        from app.core.security import SecurityManager
        import os
        
        # Database connection
        DATABASE_URL = "postgresql+asyncpg://rental_user:rental_pass@localhost:5432/rental_db"
        
        console.print("[yellow]Connecting to database...[/yellow]")
        engine = create_async_engine(DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with SessionLocal() as session:
            console.print("[yellow]Checking if admin exists...[/yellow]")
            
            # Check if admin user already exists
            result = await session.execute(
                text("SELECT id, username FROM users WHERE username = :username"),
                {"username": "admin"}
            )
            existing_admin = result.fetchone()
            
            if existing_admin:
                console.print(f"[yellow]Admin user already exists: {existing_admin[1]}[/yellow]")
                return True
            
            console.print("[yellow]Creating new admin user...[/yellow]")
            
            # Create admin user directly
            security_manager = SecurityManager()
            hashed_password = security_manager.get_password_hash("admin123")
            
            # Insert admin user directly with SQL
            await session.execute(
                text("""
                    INSERT INTO users (username, email, full_name, hashed_password, role, is_active, is_verified)
                    VALUES (:username, :email, :full_name, :hashed_password, :role, :is_active, :is_verified)
                """),
                {
                    "username": "admin",
                    "email": "admin@rentalmanager.com", 
                    "full_name": "System Administrator",
                    "hashed_password": hashed_password,
                    "role": UserRole.ADMIN.value,
                    "is_active": True,
                    "is_verified": True
                }
            )
            
            await session.commit()
            console.print("[green]✅ Admin user created successfully![/green]")
            console.print("[green]Username: admin[/green]")
            console.print("[green]Password: admin123[/green]")
            console.print("[green]Email: admin@rentalmanager.com[/green]")
            
            return True
            
    except Exception as e:
        console.print(f"[red]❌ Failed to create admin: {e}[/red]")
        return False

if __name__ == "__main__":
    console.print("[bold cyan]👤 SIMPLE ADMIN CREATION[/bold cyan]")
    console.print("=" * 50)
    
    success = asyncio.run(create_admin_simple())
    
    if success:
        console.print("\n[bold green]🎉 Admin creation successful![/bold green]")
        console.print("\nYou can now log in with:")
        console.print("  Username: admin")
        console.print("  Password: admin123")
    else:
        console.print("\n[red]❌ Admin creation failed[/red]")
    
    exit(0 if success else 1)