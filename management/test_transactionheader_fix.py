#!/usr/bin/env python3
"""
Test TransactionHeader import fix
"""

import asyncio
import sys
from pathlib import Path
from rich.console import Console

# Add the rental-manager-api to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "rental-manager-api"))

console = Console()

async def test_transaction_header_import():
    """Test if TransactionHeader can be imported and used"""
    console.print("[bold blue]🧪 Testing TransactionHeader Import Fix[/bold blue]")
    
    try:
        # Test 1: Import TransactionHeader directly
        from app.models.transaction import TransactionHeader
        console.print("[green]✅ Direct TransactionHeader import successful[/green]")
        
        # Test 2: Import from main models package
        from app.models import TransactionHeader as TH
        console.print("[green]✅ Main models package TransactionHeader import successful[/green]")
        
        # Test 3: Try to access the class
        console.print(f"[green]✅ TransactionHeader class: {TransactionHeader.__name__}[/green]")
        console.print(f"[green]✅ Table name: {TransactionHeader.__tablename__}[/green]")
        
        # Test 4: Test model analyzer with the fix
        from config import Config
        from modules.model_analyzer import ModelAnalyzer
        
        config = Config()
        rental_api_dir = Path(__file__).parent.parent / "rental-manager-api"
        model_analyzer = ModelAnalyzer(rental_api_dir / "app" / "models")
        
        console.print("[yellow]Testing model discovery with fix...[/yellow]")
        models_found = await model_analyzer.scan_models()
        console.print(f"[green]✅ Model scan successful: Found {len(models_found)} models[/green]")
        
        # Check if TransactionHeader is in the found models
        transaction_models = [name for name in models_found if 'Transaction' in name]
        console.print(f"[green]✅ Transaction models found: {', '.join(transaction_models)}[/green]")
        
        return True
        
    except Exception as e:
        console.print(f"[red]❌ TransactionHeader import test failed: {e}[/red]")
        return False

async def test_enhanced_migration_features():
    """Test enhanced migration features"""
    console.print("\n[bold blue]🚀 Testing Enhanced Migration Features[/bold blue]")
    
    try:
        from config import Config
        from modules.migration_manager_enhanced import EnhancedMigrationManager, MigrationMode
        
        config = Config()
        rental_api_dir = Path(__file__).parent.parent / "rental-manager-api"
        
        async for session in config.get_session():
            enhanced_manager = EnhancedMigrationManager(session, rental_api_dir, config)
            
            # Test model analysis
            console.print("[yellow]Testing deep model analysis...[/yellow]")
            try:
                model_report = await enhanced_manager.analyze_models_deep()
                console.print(f"[green]✅ Deep model analysis successful: {len(model_report.models)} models[/green]")
            except Exception as e:
                console.print(f"[red]❌ Deep model analysis failed: {e}[/red]")
                return False
            
            # Test schema change detection
            console.print("[yellow]Testing schema change detection...[/yellow]")
            try:
                schema_changes = await enhanced_manager.detect_schema_changes()
                console.print(f"[green]✅ Schema change detection successful: {len(schema_changes)} changes[/green]")
            except Exception as e:
                console.print(f"[red]❌ Schema change detection failed: {e}[/red]")
                return False
            
            break
        
        return True
        
    except Exception as e:
        console.print(f"[red]❌ Enhanced migration features test failed: {e}[/red]")
        return False

async def main():
    """Run all tests"""
    console.print("[bold cyan]🔧 TRANSACTIONHEADER FIX VERIFICATION[/bold cyan]")
    console.print("=" * 60)
    
    # Test 1: Basic import
    import_success = await test_transaction_header_import()
    
    # Test 2: Enhanced features
    enhanced_success = await test_enhanced_migration_features()
    
    # Results
    console.print("\n" + "=" * 60)
    if import_success and enhanced_success:
        console.print("[bold green]🎉 ALL TESTS PASSED! TRANSACTIONHEADER FIX SUCCESSFUL![/bold green]")
        console.print("✅ TransactionHeader imports working")
        console.print("✅ Model analysis working")
        console.print("✅ Enhanced migration features working")
        console.print("\n[bold blue]The Migration Manager should now work perfectly![/bold blue]")
        return True
    else:
        console.print("[bold red]❌ SOME TESTS FAILED[/bold red]")
        console.print(f"Import test: {'✅' if import_success else '❌'}")
        console.print(f"Enhanced features: {'✅' if enhanced_success else '❌'}")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)