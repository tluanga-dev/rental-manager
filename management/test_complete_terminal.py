#!/usr/bin/env python3
"""
Test script to verify the complete management terminal works
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

async def test_import_modules():
    """Test that all management modules can be imported"""
    console.print("\n[bold blue]🧪 Testing Module Imports[/bold blue]")
    
    modules_to_test = [
        ("modules.admin_manager", "AdminManager"),
        ("modules.database_inspector", "DatabaseInspector"),
        ("modules.table_cleaner", "TableCleaner"),
        ("modules.seed_manager", "SeedManager"),
        ("modules.migration_manager", "MigrationManager"),
        ("modules.backup_manager", "BackupManager"),
    ]
    
    success_count = 0
    
    for module_name, class_name in modules_to_test:
        try:
            module = __import__(module_name, fromlist=[class_name])
            getattr(module, class_name)
            console.print(f"[green]✓ {module_name}.{class_name}[/green]")
            success_count += 1
        except Exception as e:
            console.print(f"[red]❌ {module_name}.{class_name}: {e}[/red]")
    
    return success_count, len(modules_to_test)

async def test_enhanced_modules():
    """Test enhanced migration modules"""
    console.print("\n[bold blue]🧪 Testing Enhanced Modules[/bold blue]")
    
    enhanced_modules = [
        ("modules.migration_manager_enhanced", "EnhancedMigrationManager"),
        ("modules.model_analyzer", "ModelAnalyzer"),
        ("modules.migration_templates", "MigrationTemplates"),
    ]
    
    success_count = 0
    
    for module_name, class_name in enhanced_modules:
        try:
            module = __import__(module_name, fromlist=[class_name])
            getattr(module, class_name)
            console.print(f"[green]✓ {module_name}.{class_name}[/green]")
            success_count += 1
        except Exception as e:
            console.print(f"[red]❌ {module_name}.{class_name}: {e}[/red]")
    
    return success_count, len(enhanced_modules)

async def test_main_functions():
    """Test that main functions can be imported"""
    console.print("\n[bold blue]🧪 Testing Main Functions[/bold blue]")
    
    try:
        from main import (
            handle_admin_management,
            handle_database_inspector,
            handle_table_cleaner,
            handle_seed_manager,
            handle_migration_manager,
            handle_backup_manager,
            handle_system_status,
            main
        )
        console.print("[green]✓ All main functions imported successfully[/green]")
        return True
    except Exception as e:
        console.print(f"[red]❌ Main function import failed: {e}[/red]")
        return False

async def test_database_connection():
    """Test database connection"""
    console.print("\n[bold blue]🧪 Testing Database Connection[/bold blue]")
    
    try:
        async for session in config.get_session():
            console.print("[green]✓ Database connection successful[/green]")
            return True
    except Exception as e:
        console.print(f"[red]❌ Database connection failed: {e}[/red]")
        return False

async def main():
    """Run all tests"""
    console.print("[bold cyan]🏠 Testing Complete Management Terminal[/bold cyan]")
    console.print("=" * 60)
    
    test_results = []
    
    # Test module imports
    basic_success, basic_total = await test_import_modules()
    enhanced_success, enhanced_total = await test_enhanced_modules()
    main_funcs_success = await test_main_functions()
    db_success = await test_database_connection()
    
    # Calculate results
    total_module_tests = basic_total + enhanced_total
    passed_module_tests = basic_success + enhanced_success
    
    test_results = [
        passed_module_tests == total_module_tests,  # All modules imported
        main_funcs_success,                        # Main functions work
        db_success                                 # Database connects
    ]
    
    # Summary
    console.print("\n" + "=" * 60)
    passed = sum(test_results)
    total = len(test_results)
    
    console.print(f"\n[bold blue]📊 Test Results:[/bold blue]")
    console.print(f"  Module Imports: {passed_module_tests}/{total_module_tests}")
    console.print(f"  Main Functions: {'✓' if main_funcs_success else '❌'}")
    console.print(f"  Database: {'✓' if db_success else '❌'}")
    
    if passed == total:
        console.print(f"\n[bold green]🎉 All {total} core tests passed![/bold green]")
        console.print("\n[green]✅ Complete management terminal is ready![/green]")
        console.print("\n[dim]To start the complete terminal:[/dim]")
        console.print("  [cyan]source activate.sh[/cyan]")
        console.print("  [cyan]python main.py[/cyan]")
        console.print("\n[dim]Available features:[/dim]")
        console.print("  [blue]👤 Admin Management[/blue]")
        console.print("  [blue]📊 Database Inspector[/blue]") 
        console.print("  [blue]🗑️ Table Cleaner[/blue]")
        console.print("  [blue]🌱 Seed Manager[/blue]")
        console.print("  [blue]🔄 Enhanced Migration Manager[/blue]")
        console.print("  [blue]💾 Backup & Restore[/blue]")
        console.print("  [blue]⚙️ System Status[/blue]")
    else:
        console.print(f"\n[bold red]❌ {total - passed}/{total} tests failed[/bold red]")
        console.print("\n[yellow]Some features may not work properly[/yellow]")
    
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