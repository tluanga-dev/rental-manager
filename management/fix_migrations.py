#!/usr/bin/env python3
"""
Fix the migration issue by resetting and properly applying migrations
"""

import subprocess
import asyncio
from pathlib import Path
from rich.console import Console

console = Console()

def reset_and_apply_migrations():
    """Reset alembic and properly apply migrations"""
    console.print("[bold blue]🔄 Fixing Migration Issues[/bold blue]")
    
    try:
        api_dir = Path(__file__).parent.parent / "rental-manager-api"
        
        console.print("[yellow]Step 1: Reset alembic to base state...[/yellow]")
        
        # Reset alembic to base (before any migrations)
        result = subprocess.run(
            ["alembic", "stamp", "base"],
            cwd=api_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            console.print(f"[red]❌ Failed to reset alembic: {result.stderr}[/red]")
            return False
        
        console.print("[green]✅ Reset to base state[/green]")
        
        console.print("[yellow]Step 2: Apply migrations properly...[/yellow]")
        
        # Now apply all migrations properly
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=api_dir,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode == 0:
            console.print("[green]✅ Migrations applied successfully![/green]")
            if result.stdout:
                console.print("[dim]" + result.stdout + "[/dim]")
            return True
        else:
            console.print(f"[red]❌ Migration failed: {result.stderr}[/red]")
            return False
            
    except Exception as e:
        console.print(f"[red]❌ Error fixing migrations: {e}[/red]")
        return False

async def verify_tables_created():
    """Verify that tables were actually created"""
    console.print("\n[bold blue]🔍 Verifying Tables Were Created[/bold blue]")
    
    try:
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from sqlalchemy import text
        
        DATABASE_URL = "postgresql+asyncpg://rental_user:rental_pass@localhost:5432/rental_db"
        
        engine = create_async_engine(DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with SessionLocal() as session:
            result = await session.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name != 'alembic_version'
                ORDER BY table_name
            """))
            tables = result.fetchall()
            
            console.print(f"[green]Found {len(tables)} application tables:[/green]")
            for table in tables:
                console.print(f"  • {table[0]}")
            
            # Check specifically for users table
            users_exists = any(table[0] == 'users' for table in tables)
            
            if users_exists:
                console.print("\n[green]✅ Users table exists - ready for admin creation![/green]")
                return True
            else:
                console.print("\n[red]❌ Users table still missing![/red]")
                return False
                
    except Exception as e:
        console.print(f"[red]❌ Error verifying tables: {e}[/red]")
        return False

if __name__ == "__main__":
    console.print("[bold cyan]🛠️ FIX DATABASE MIGRATIONS[/bold cyan]")
    console.print("=" * 60)
    
    # Step 1: Fix migrations
    migrations_success = reset_and_apply_migrations()
    
    if migrations_success:
        # Step 2: Verify tables were created
        verification_success = asyncio.run(verify_tables_created())
        
        if verification_success:
            console.print("\n[bold green]🎉 Database setup completed successfully![/bold green]")
            console.print("[bold blue]✅ Migrations properly applied[/bold blue]")
            console.print("[bold blue]✅ Tables created[/bold blue]")
            console.print("\n[bold yellow]You can now create admin users![/bold yellow]")
        else:
            console.print("\n[red]❌ Tables verification failed[/red]")
    else:
        console.print("\n[red]❌ Migration fix failed[/red]")
    
    exit(0 if migrations_success and verification_success else 1)