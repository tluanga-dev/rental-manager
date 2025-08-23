#!/usr/bin/env python3
"""
Simplified Management Console for Rental Manager
A working version with basic functionality while main.py is being fixed.
"""

import asyncio
import sys
from pathlib import Path
from typing import Optional

# Add the rental-manager-api to Python path for model imports
sys.path.append(str(Path(__file__).parent.parent / "rental-manager-api"))

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, Confirm
from rich.table import Table

from config import Config

console = Console()
config = Config()


def display_header():
    """Display the application header"""
    header_content = """
[bold blue]🏠 Rental Manager - Management Console[/bold blue]
[dim]Database Administration and System Tools[/dim]
    """
    
    panel = Panel(
        header_content.strip(),
        border_style="blue",
        padding=(1, 2)
    )
    console.print(panel)


def display_main_menu():
    """Display the main menu options"""
    console.print("\n[bold cyan]Available Options:[/bold cyan]")
    console.print("  [1] 👤 Admin Management")
    console.print("  [2] 📊 Database Inspector") 
    console.print("  [3] 🗑️  Table Cleaner")
    console.print("  [4] 🌱 Seed Manager")
    console.print("  [5] 🔄 Basic Migration Manager")
    console.print("  [6] 💾 Backup & Restore")
    console.print("  [7] ⚙️ System Status")
    console.print("  [0] ❌ Exit")


async def handle_system_status():
    """Handle system status display"""
    console.print("\n[bold blue]⚙️ System Status[/bold blue]")
    
    # Test database connection
    try:
        async with config.get_session() as session:
            console.print("[green]✓ Database connection successful[/green]")
            console.print(f"[dim]Database URL: {config.db.DATABASE_URL[:50]}...[/dim]")
    except Exception as e:
        console.print(f"[red]❌ Database connection failed: {e}[/red]")
    
    # Show configuration
    console.print(f"\n[blue]Configuration:[/blue]")
    console.print(f"  Base Directory: {config.BASE_DIR}")
    console.print(f"  Data Directory: {config.DATA_DIR}")
    console.print(f"  Backup Directory: {config.BACKUP_DIR}")
    console.print(f"  API Directory: {config.RENTAL_API_DIR}")


async def handle_database_inspector():
    """Handle basic database inspection"""
    console.print("\n[bold blue]📊 Database Inspector[/bold blue]")
    
    try:
        from modules.database_inspector import DatabaseInspector
        
        async with config.get_session() as session:
            inspector = DatabaseInspector(session)
            
            console.print("\n[yellow]Fetching database information...[/yellow]")
            tables = await inspector.get_all_tables_with_counts()
            
            if not tables:
                console.print("[red]No tables found or connection failed[/red]")
                return
            
            # Display results in a table
            table = Table(title="Database Tables", show_header=True, header_style="bold magenta")
            table.add_column("Table Name", style="cyan")
            table.add_column("Row Count", justify="right", style="green")
            table.add_column("Status", justify="center")
            
            for table_info in tables:
                status = "🟢 Active" if table_info['row_count'] > 0 else "⚪ Empty"
                table.add_row(
                    table_info['table_name'],
                    f"{table_info['row_count']:,}",
                    status
                )
            
            console.print(table)
            
    except Exception as e:
        console.print(f"[red]❌ Database inspection failed: {e}[/red]")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")


async def handle_basic_migration():
    """Handle basic migration operations"""
    console.print("\n[bold blue]🔄 Basic Migration Manager[/bold blue]")
    
    try:
        from modules.migration_manager import MigrationManager
        
        async with config.get_session() as session:
            manager = MigrationManager(session, config.RENTAL_API_DIR)
            
            console.print("\n[dim]Migration Options:[/dim]")
            console.print("  [1] Show migration status")
            console.print("  [2] Apply migrations")
            console.print("  [3] Show migration history")
            console.print("  [0] Back to main menu")
            
            choice = Prompt.ask("Select option", choices=["1", "2", "3", "0"])
            
            if choice == "0":
                return
            elif choice == "1":
                # Show status
                current_rev = await manager.get_current_revision()
                console.print(f"\n[blue]Current revision:[/blue] {current_rev or 'Not initialized'}")
                
                # Show pending
                pending = manager.get_pending_migrations()
                if pending:
                    console.print(f"[yellow]Pending migrations:[/yellow] {len(pending)}")
                else:
                    console.print("[green]No pending migrations[/green]")
                    
            elif choice == "2":
                # Apply migrations
                if Confirm.ask("\n[yellow]Apply all pending migrations?[/yellow]", default=False):
                    success, message = manager.apply_migrations()
                    if success:
                        console.print(f"[green]✓ {message}[/green]")
                    else:
                        console.print(f"[red]✗ {message}[/red]")
                        
            elif choice == "3":
                # Show history
                history = manager.get_migration_history()
                current_rev = await manager.get_current_revision()
                manager.display_migration_status(history, current_rev)
                
    except Exception as e:
        console.print(f"[red]❌ Migration manager failed: {e}[/red]")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")


async def main():
    """Main application loop"""
    console.clear()
    display_header()
    
    console.print("[green]✓ Management console started successfully[/green]")
    console.print("[dim]Note: This is a simplified version while main.py is being fixed[/dim]")
    
    while True:
        try:
            display_main_menu()
            
            choice = Prompt.ask("\n[bold]Select option", choices=["1", "2", "3", "4", "5", "6", "7", "0"])
            
            if choice == "0":
                console.print("\n[blue]👋 Goodbye![/blue]")
                break
                
            elif choice == "1":
                console.print("\n[yellow]🚧 Admin Management - Not implemented yet[/yellow]")
                
            elif choice == "2":
                await handle_database_inspector()
                
            elif choice == "3":
                console.print("\n[yellow]🚧 Table Cleaner - Not implemented yet[/yellow]")
                
            elif choice == "4":
                console.print("\n[yellow]🚧 Seed Manager - Not implemented yet[/yellow]")
                
            elif choice == "5":
                await handle_basic_migration()
                
            elif choice == "6":
                console.print("\n[yellow]🚧 Backup & Restore - Not implemented yet[/yellow]")
                
            elif choice == "7":
                await handle_system_status()
            
            # Pause before showing menu again
            console.print("\n[dim]Press Enter to continue...[/dim]")
            input()
            console.clear()
            display_header()
            
        except KeyboardInterrupt:
            console.print("\n\n[yellow]⚠️ Interrupted by user[/yellow]")
            break
        except Exception as e:
            console.print(f"\n[red]❌ Unexpected error: {e}[/red]")
            import traceback
            console.print(f"[dim]{traceback.format_exc()}[/dim]")
            console.print("\n[dim]Press Enter to continue...[/dim]")
            input()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console.print("\n[yellow]👋 Goodbye![/yellow]")
    except Exception as e:
        console.print(f"\n[red]❌ Fatal error: {e}[/red]")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")