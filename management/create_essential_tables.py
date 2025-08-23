#!/usr/bin/env python3
"""
Create essential tables manually to bypass migration issues
"""

import asyncio
import sys
from pathlib import Path
from rich.console import Console

# Add rental-manager-api to path
sys.path.insert(0, str(Path(__file__).parent.parent / "rental-manager-api"))

console = Console()

async def create_essential_tables():
    """Create essential tables manually"""
    console.print("[bold blue]🛠️ Creating Essential Tables Manually[/bold blue]")
    
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import text
        
        DATABASE_URL = "postgresql+asyncpg://rental_user:rental_pass@localhost:5432/rental_db"
        
        engine = create_async_engine(DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with SessionLocal() as session:
            console.print("[yellow]Creating users table...[/yellow]")
            
            # Create users table manually
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    full_name VARCHAR(200),
                    hashed_password VARCHAR(255) NOT NULL,
                    role VARCHAR(20) NOT NULL DEFAULT 'user',
                    is_active BOOLEAN DEFAULT true,
                    is_verified BOOLEAN DEFAULT false,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """))
            
            console.print("[green]✅ Users table created[/green]")
            
            console.print("[yellow]Creating indexes...[/yellow]")
            
            # Create indexes
            await session.execute(text("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);"))
            await session.execute(text("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);"))
            await session.execute(text("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);"))
            
            console.print("[green]✅ Indexes created[/green]")
            
            await session.commit()
            
            console.print("[yellow]Verifying table creation...[/yellow]")
            
            # Verify table exists
            result = await session.execute(text("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'users'"))
            count = result.fetchone()[0]
            
            if count > 0:
                console.print("[green]✅ Users table verified![/green]")
                return True
            else:
                console.print("[red]❌ Users table not found after creation![/red]")
                return False
                
    except Exception as e:
        console.print(f"[red]❌ Failed to create tables: {e}[/red]")
        return False

async def create_admin_user():
    """Create admin user after table creation"""
    console.print("\n[bold blue]👤 Creating Admin User[/bold blue]")
    
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import text
        from app.models.user import UserRole
        from app.core.security import SecurityManager
        
        DATABASE_URL = "postgresql+asyncpg://rental_user:rental_pass@localhost:5432/rental_db"
        
        engine = create_async_engine(DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with SessionLocal() as session:
            # Check if admin already exists
            result = await session.execute(
                text("SELECT username FROM users WHERE username = :username"),
                {"username": "admin"}
            )
            existing = result.fetchone()
            
            if existing:
                console.print("[yellow]Admin user already exists[/yellow]")
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
            console.print("[green]Username: admin[/green]")
            console.print("[green]Password: admin123[/green]")
            console.print("[green]Email: admin@rentalmanager.com[/green]")
            
            return True
            
    except Exception as e:
        console.print(f"[red]❌ Failed to create admin: {e}[/red]")
        return False

if __name__ == "__main__":
    console.print("[bold cyan]🚀 MANUAL DATABASE SETUP[/bold cyan]")
    console.print("=" * 60)
    
    async def main():
        # Step 1: Create essential tables
        tables_success = await create_essential_tables()
        
        if tables_success:
            # Step 2: Create admin user
            admin_success = await create_admin_user()
            
            if admin_success:
                console.print("\n[bold green]🎉 Setup completed successfully![/bold green]")
                console.print("[bold blue]✅ Essential tables created[/bold blue]")
                console.print("[bold blue]✅ Admin user created[/bold blue]")
                console.print("\n[bold green]Login credentials:[/bold green]")
                console.print("  Username: admin")
                console.print("  Password: admin123")
                console.print("  Email: admin@rentalmanager.com")
                
                console.print("\n[bold yellow]🎯 Admin Management should now work in main.py![/bold yellow]")
                return True
            else:
                console.print("\n[red]❌ Admin creation failed[/red]")
                return False
        else:
            console.print("\n[red]❌ Table creation failed[/red]")
            return False
    
    success = asyncio.run(main())
    exit(0 if success else 1)