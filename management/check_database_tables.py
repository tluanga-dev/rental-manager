#!/usr/bin/env python3
"""
Check what tables exist in the database
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from rich.console import Console

console = Console()

async def check_tables():
    """Check what tables exist in the database"""
    console.print("[bold blue]🔍 Checking Database Tables[/bold blue]")
    
    try:
        # Database connection
        DATABASE_URL = "postgresql+asyncpg://rental_user:rental_pass@localhost:5432/rental_db"
        
        engine = create_async_engine(DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with SessionLocal() as session:
            # Get all tables
            result = await session.execute(
                text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """)
            )
            tables = result.fetchall()
            
            console.print(f"[green]Found {len(tables)} tables:[/green]")
            for table in tables:
                console.print(f"  • {table[0]}")
            
            # Check if users table exists
            user_table_exists = any(table[0] == 'users' for table in tables)
            
            if not user_table_exists:
                console.print("\n[red]❌ Users table does not exist![/red]")
                console.print("[yellow]You need to run database migrations first[/yellow]")
                
                # Check if alembic_version exists
                alembic_exists = any(table[0] == 'alembic_version' for table in tables)
                if alembic_exists:
                    console.print("[blue]Alembic is initialized, but migrations need to be applied[/blue]")
                else:
                    console.print("[blue]Alembic is not initialized[/blue]")
            else:
                console.print("\n[green]✅ Users table exists![/green]")
            
            return user_table_exists
            
    except Exception as e:
        console.print(f"[red]❌ Failed to check tables: {e}[/red]")
        return False

if __name__ == "__main__":
    success = asyncio.run(check_tables())
    exit(0 if success else 1)