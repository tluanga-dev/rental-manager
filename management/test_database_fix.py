#!/usr/bin/env python3
"""
Test script to verify database connection is working
"""

import asyncio
from config import Config
from rich.console import Console

console = Console()

async def main():
    """Test database connection"""
    console.print("[bold blue]🧪 Testing Database Connection Fix[/bold blue]")
    
    config = Config()
    
    # Test database connection
    db_success, db_message = await config.test_database_connection()
    
    if db_success:
        console.print(f"[green]✅ {db_message}[/green]")
    else:
        console.print(f"[red]❌ {db_message}[/red]")
    
    # Test Redis connection  
    redis_success, redis_message = await config.test_redis_connection()
    
    if redis_success:
        console.print(f"[green]✅ {redis_message}[/green]")
    else:
        console.print(f"[yellow]⚠️ {redis_message}[/yellow]")
    
    # Overall result
    if db_success:
        console.print("\n[bold green]🎉 Database connection fixed successfully![/bold green]")
        console.print("\n[dim]You can now run:[/dim]")
        console.print("  [cyan]python main.py[/cyan]")
        return True
    else:
        console.print("\n[bold red]❌ Database connection still has issues[/bold red]")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)