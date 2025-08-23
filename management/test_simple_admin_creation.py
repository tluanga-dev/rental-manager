#!/usr/bin/env python3
"""
Simple test of admin creation logic without the full interface
"""

import sys
import asyncio
from pathlib import Path
from rich.console import Console

# Add rental-manager-api to path
sys.path.insert(0, str(Path(__file__).parent.parent / "rental-manager-api"))

# Import all models first
from app.models import *

console = Console()

async def test_admin_creation_direct():
    """Test admin creation directly without full interface"""
    console.print("[bold blue]🧪 Testing Direct Admin Creation[/bold blue]")
    
    try:
        from config import Config
        from modules.admin_manager import AdminManager
        
        console.print("[yellow]Initializing config...[/yellow]")
        config = Config()
        
        console.print("[yellow]Testing database connection...[/yellow]")
        db_success, db_message = await config.test_database_connection()
        if not db_success:
            console.print(f"[red]❌ Database connection failed: {db_message}[/red]")
            return False
        console.print(f"[green]✅ Database connected: {db_message}[/green]")
        
        console.print("[yellow]Creating admin manager...[/yellow]")
        async for session in config.get_session():
            admin_manager = AdminManager(session, config.admin)
            
            console.print("[yellow]Testing admin creation...[/yellow]")
            try:
                success, message, user = await admin_manager.create_admin_user(force=True)
                if success:
                    console.print(f"[green]✅ Admin creation successful: {message}[/green]")
                    return True
                else:
                    console.print(f"[red]❌ Admin creation failed: {message}[/red]")
                    return False
            except Exception as e:
                console.print(f"[red]❌ Admin creation error: {e}[/red]")
                return False
            
            break  # Use only first session
            
    except Exception as e:
        console.print(f"[red]❌ Test failed: {e}[/red]")
        return False

if __name__ == "__main__":
    console.print("[bold cyan]👤 DIRECT ADMIN CREATION TEST[/bold cyan]")
    console.print("=" * 60)
    
    success = asyncio.run(test_admin_creation_direct())
    
    if success:
        console.print("\n[bold green]🎉 Direct admin creation works![/bold green]")
    else:
        console.print("\n[red]❌ Direct admin creation failed[/red]")
    
    exit(0 if success else 1)