#!/usr/bin/env python3
"""
Apply database migrations and then create admin user
"""

import subprocess
import asyncio
from pathlib import Path
from rich.console import Console

console = Console()

def apply_migrations():
    """Apply database migrations using Alembic"""
    console.print("[bold blue]🔄 Applying Database Migrations[/bold blue]")
    
    try:
        # Change to rental-manager-api directory
        api_dir = Path(__file__).parent.parent / "rental-manager-api"
        
        console.print("[yellow]Running alembic upgrade head...[/yellow]")
        
        # Run alembic upgrade
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=api_dir,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            console.print("[green]✅ Migrations applied successfully![/green]")
            console.print("[dim]" + result.stdout + "[/dim]")
            return True
        else:
            console.print(f"[red]❌ Migration failed: {result.stderr}[/red]")
            return False
            
    except Exception as e:
        console.print(f"[red]❌ Error applying migrations: {e}[/red]")
        return False

async def create_admin_after_migrations():
    """Create admin user after migrations are applied"""
    console.print("\n[bold blue]👤 Creating Admin User[/bold blue]")
    
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import text
        import sys
        from pathlib import Path
        
        # Add rental-manager-api to path
        sys.path.insert(0, str(Path(__file__).parent.parent / "rental-manager-api"))
        
        from app.models.user import UserRole
        from app.core.security import SecurityManager
        
        # Database connection
        DATABASE_URL = "postgresql+asyncpg://rental_user:rental_pass@localhost:5432/rental_db"
        
        engine = create_async_engine(DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with SessionLocal() as session:
            # Check if admin user already exists
            result = await session.execute(
                text("SELECT id, username FROM users WHERE username = :username"),
                {"username": "admin"}
            )
            existing_admin = result.fetchone()
            
            if existing_admin:
                console.print(f"[yellow]Admin user already exists: {existing_admin[1]}[/yellow]")
                return True
            
            # Create admin user
            security_manager = SecurityManager()
            hashed_password = security_manager.get_password_hash("admin123")
            
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
            return True
            
    except Exception as e:
        console.print(f"[red]❌ Failed to create admin: {e}[/red]")
        return False

if __name__ == "__main__":
    console.print("[bold cyan]🚀 SETUP DATABASE AND ADMIN[/bold cyan]")
    console.print("=" * 60)
    
    # Step 1: Apply migrations
    migrations_success = apply_migrations()
    
    if migrations_success:
        # Step 2: Create admin user
        admin_success = asyncio.run(create_admin_after_migrations())
        
        if admin_success:
            console.print("\n[bold green]🎉 Setup completed successfully![/bold green]")
            console.print("\n[bold blue]✅ Database migrations applied[/bold blue]")
            console.print("[bold blue]✅ Admin user created[/bold blue]")
            console.print("\n[bold green]Login credentials:[/bold green]")
            console.print("  Username: admin")
            console.print("  Password: admin123")
            console.print("  Email: admin@rentalmanager.com")
            
            console.print("\n[bold yellow]You can now use the Admin Management in main.py![/bold yellow]")
        else:
            console.print("\n[red]❌ Admin creation failed[/red]")
    else:
        console.print("\n[red]❌ Migration failed - cannot proceed[/red]")
    
    exit(0 if migrations_success and admin_success else 1)