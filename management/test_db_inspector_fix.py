#!/usr/bin/env python3
"""
Test the fixed database inspector
"""

import asyncio
from config import Config
from modules.database_inspector import DatabaseInspector
from rich.console import Console

console = Console()

async def main():
    """Test the fixed database inspector"""
    console.print("[bold blue]🧪 Testing Fixed Database Inspector[/bold blue]")
    
    config = Config()
    
    async for session in config.get_session():
        inspector = DatabaseInspector(session)
        
        # Test 1: Get all tables
        console.print("\n[yellow]Testing get_all_tables_with_counts...[/yellow]")
        try:
            tables = await inspector.get_all_tables_with_counts()
            console.print(f"[green]✅ Found {len(tables)} tables[/green]")
            for table in tables:
                console.print(f"  • {table['table_name']}: {table['row_count']} rows")
        except Exception as e:
            console.print(f"[red]❌ Failed: {e}[/red]")
        
        # Test 2: Database statistics
        console.print("\n[yellow]Testing get_database_statistics...[/yellow]")
        try:
            stats = await inspector.get_database_statistics()
            console.print(f"[green]✅ Database stats retrieved[/green]")
            console.print(f"  • Database: {stats['database_name']}")
            console.print(f"  • Tables: {stats['table_count']}")
            console.print(f"  • Version: {stats['postgresql_version'][:20]}...")
        except Exception as e:
            console.print(f"[red]❌ Failed: {e}[/red]")
        
        # Test 3: Table health analysis
        console.print("\n[yellow]Testing analyze_table_health...[/yellow]")
        try:
            health = await inspector.analyze_table_health()
            console.print(f"[green]✅ Health analysis completed[/green]")
            console.print(f"  • Analyzed {len(health)} tables")
        except Exception as e:
            console.print(f"[red]❌ Failed: {e}[/red]")
        
        break  # Exit the async generator

if __name__ == "__main__":
    asyncio.run(main())