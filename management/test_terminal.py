#!/usr/bin/env python3
"""
Test script to verify the management terminal components work
"""

import asyncio
import sys
from pathlib import Path

# Add the rental-manager-api to Python path for model imports
sys.path.append(str(Path(__file__).parent.parent / "rental-manager-api"))

from rich.console import Console
from config import Config

console = Console()
config = Config()

async def test_system_status():
    """Test system status functionality"""
    console.print("\n[bold blue]🧪 Testing System Status[/bold blue]")
    
    # Test database connection
    try:
        async for session in config.get_session():
            console.print("[green]✓ Database connection successful[/green]")
            console.print(f"[dim]Database URL: {config.db.DATABASE_URL[:50]}...[/dim]")
            return True
    except Exception as e:
        console.print(f"[red]❌ Database connection failed: {e}[/red]")
        return False

async def test_database_inspector():
    """Test database inspector functionality"""
    console.print("\n[bold blue]🧪 Testing Database Inspector[/bold blue]")
    
    try:
        from modules.database_inspector import DatabaseInspector
        
        async for session in config.get_session():
            inspector = DatabaseInspector(session)
            
            console.print("[yellow]Fetching database information...[/yellow]")
            tables = await inspector.get_all_tables_with_counts()
            
            if tables:
                console.print(f"[green]✓ Found {len(tables)} tables[/green]")
                for table in tables[:3]:  # Show first 3 tables
                    console.print(f"  • {table['table_name']}: {table['row_count']} rows")
                if len(tables) > 3:
                    console.print(f"  ... and {len(tables) - 3} more tables")
                return True
            else:
                console.print("[yellow]⚠️ No tables found (database may be empty)[/yellow]")
                return True
                
    except Exception as e:
        console.print(f"[red]❌ Database inspector failed: {e}[/red]")
        return False

async def test_basic_migration():
    """Test basic migration manager"""
    console.print("\n[bold blue]🧪 Testing Basic Migration Manager[/bold blue]")
    
    try:
        from modules.migration_manager import MigrationManager
        
        async for session in config.get_session():
            manager = MigrationManager(session, config.RENTAL_API_DIR)
            
            # Test getting current revision
            current_rev = await manager.get_current_revision()
            console.print(f"[green]✓ Current revision: {current_rev or 'Not initialized'}[/green]")
            
            # Test migration history
            history = manager.get_migration_history()
            console.print(f"[green]✓ Migration history retrieved: {len(history)} entries[/green]")
            
            return True
            
    except Exception as e:
        console.print(f"[red]❌ Migration manager failed: {e}[/red]")
        return False

async def main():
    """Run all tests"""
    console.print("[bold cyan]🏠 Testing Management Terminal Components[/bold cyan]")
    console.print("=" * 50)
    
    test_results = []
    
    # Test each component
    test_results.append(await test_system_status())
    test_results.append(await test_database_inspector())
    test_results.append(await test_basic_migration())
    
    # Summary
    console.print("\n" + "=" * 50)
    passed = sum(test_results)
    total = len(test_results)
    
    if passed == total:
        console.print(f"[bold green]🎉 All {total} tests passed![/bold green]")
        console.print("\n[green]✅ Management terminal is ready for interactive use![/green]")
        console.print("\n[dim]To start the terminal:[/dim]")
        console.print("  [cyan]source activate.sh[/cyan]")
        console.print("  [cyan]python main_simple.py[/cyan]")
    else:
        console.print(f"[bold red]❌ {total - passed}/{total} tests failed[/bold red]")
    
    return passed == total

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        console.print("\n[yellow]⚠️ Tests interrupted[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]❌ Test suite failed: {e}[/red]")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
        sys.exit(1)