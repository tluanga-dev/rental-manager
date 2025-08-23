#!/usr/bin/env python3
"""
Check what's in the alembic_version table
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from rich.console import Console

console = Console()

async def check_alembic_version():
    """Check what's in the alembic_version table"""
    console.print("[bold blue]🔍 Checking Alembic Version Table[/bold blue]")
    
    try:
        DATABASE_URL = "postgresql+asyncpg://rental_user:rental_pass@localhost:5432/rental_db"
        
        engine = create_async_engine(DATABASE_URL, echo=False)
        SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with SessionLocal() as session:
            # Get alembic version
            result = await session.execute(text("SELECT version_num FROM alembic_version"))
            version = result.fetchone()
            
            if version:
                console.print(f"[green]Current alembic version: {version[0]}[/green]")
                
                # Try to run the migration again to see what happens
                console.print("\n[yellow]Let's try running a specific migration...[/yellow]")
                
                # Check if users table creation migration can be run individually
                try:
                    result = await session.execute(text("SELECT 1 FROM information_schema.tables WHERE table_name = 'users'"))
                    if result.fetchone():
                        console.print("[green]Users table exists![/green]")
                    else:
                        console.print("[red]Users table doesn't exist even though migrations show applied[/red]")
                        
                        # Try to see what tables were actually created
                        result = await session.execute(text("""
                            SELECT table_name 
                            FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name != 'alembic_version'
                            ORDER BY table_name
                        """))
                        tables = result.fetchall()
                        
                        console.print(f"\n[yellow]Actual tables in database ({len(tables)}):[/yellow]")
                        for table in tables:
                            console.print(f"  • {table[0]}")
                            
                        if len(tables) == 0:
                            console.print("\n[red]No application tables found![/red]")
                            console.print("[blue]This suggests the migrations didn't actually create tables[/blue]")
                        
                except Exception as e:
                    console.print(f"[red]Error checking tables: {e}[/red]")
                    
            else:
                console.print("[red]No version found in alembic_version table![/red]")
                
    except Exception as e:
        console.print(f"[red]❌ Failed to check alembic version: {e}[/red]")

if __name__ == "__main__":
    asyncio.run(check_alembic_version())