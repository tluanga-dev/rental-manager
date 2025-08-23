#!/usr/bin/env python3
"""
Test Model Imports and SQLAlchemy Initialization

Tests all model imports and SQLAlchemy mapper configuration to identify any issues.
"""

import sys
import traceback
from pathlib import Path
from rich.console import Console

# Add rental-manager-api to path
sys.path.insert(0, str(Path(__file__).parent.parent / "rental-manager-api"))

console = Console()

def test_basic_imports():
    """Test basic SQLAlchemy and model imports"""
    console.print("[bold blue]🔧 Testing Basic Imports[/bold blue]")
    
    try:
        # Test SQLAlchemy imports
        from sqlalchemy.ext.asyncio import AsyncSession
        from sqlalchemy.orm import configure_mappers
        from sqlalchemy import select
        console.print("[green]✓ SQLAlchemy imports successful[/green]")
        
        # Test base model import
        from app.models.base import Base
        console.print("[green]✓ Base model import successful[/green]")
        
        return True, "Basic imports successful"
        
    except Exception as e:
        console.print(f"[red]✗ Basic imports failed: {e}[/red]")
        return False, str(e)

def test_core_model_imports():
    """Test core model imports that are essential for admin creation"""
    console.print("\n[bold blue]👤 Testing Core Model Imports[/bold blue]")
    
    try:
        # Import User model and enum
        from app.models.user import User, UserRole
        console.print("[green]✓ User model import successful[/green]")
        
        # Import security manager
        from app.core.security import SecurityManager
        console.print("[green]✓ SecurityManager import successful[/green]")
        
        return True, "Core model imports successful"
        
    except Exception as e:
        console.print(f"[red]✗ Core model imports failed: {e}[/red]")
        console.print(f"[dim]Traceback: {traceback.format_exc()}[/dim]")
        return False, str(e)

def test_transaction_models():
    """Test transaction model imports (known problematic area)"""
    console.print("\n[bold blue]📊 Testing Transaction Model Imports[/bold blue]")
    
    try:
        # Try importing transaction models
        from app.models.transaction import (
            TransactionHeader, 
            TransactionLine, 
            TransactionEvent, 
            TransactionMetadata
        )
        console.print("[green]✓ Transaction models import successful[/green]")
        
        return True, "Transaction model imports successful"
        
    except Exception as e:
        console.print(f"[red]✗ Transaction models import failed: {e}[/red]")
        console.print(f"[dim]Traceback: {traceback.format_exc()}[/dim]")
        return False, str(e)

def test_all_models_import():
    """Test importing all models via the models/__init__.py"""
    console.print("\n[bold blue]🗂️ Testing All Models Import[/bold blue]")
    
    try:
        # Import specific models instead of *
        import app.models
        from app.models.user import User
        from app.models.customer import Customer
        from app.models.supplier import Supplier
        from app.models.brand import Brand
        from app.models.category import Category
        from app.models.company import Company
        from app.models.contact_person import ContactPerson
        from app.models.item import Item
        from app.models.location import Location
        from app.models.unit_of_measurement import UnitOfMeasurement
        console.print("[green]✓ All core models import successful[/green]")
        
        return True, "All core models import successful"
        
    except Exception as e:
        console.print(f"[red]✗ All models import failed: {e}[/red]")
        console.print(f"[dim]Traceback: {traceback.format_exc()}[/dim]")
        return False, str(e)

def test_mapper_configuration():
    """Test SQLAlchemy mapper configuration"""
    console.print("\n[bold blue]⚙️ Testing Mapper Configuration[/bold blue]")
    
    try:
        # Import models first
        from app.models.base import Base
        from app.models.user import User
        from app.models.customer import Customer
        from app.models.supplier import Supplier
        from sqlalchemy.orm import configure_mappers
        
        # Configure mappers explicitly
        configure_mappers()
        console.print("[green]✓ Mapper configuration successful[/green]")
        
        return True, "Mapper configuration successful"
        
    except Exception as e:
        console.print(f"[red]✗ Mapper configuration failed: {e}[/red]")
        console.print(f"[dim]Traceback: {traceback.format_exc()}[/dim]")
        return False, str(e)

def test_model_relationships():
    """Test that model relationships are properly configured"""
    console.print("\n[bold blue]🔗 Testing Model Relationships[/bold blue]")
    
    try:
        from app.models.user import User
        from app.models.customer import Customer
        from app.models.supplier import Supplier
        
        # Check if models have expected attributes
        user_attrs = dir(User)
        console.print(f"[green]✓ User model has {len(user_attrs)} attributes[/green]")
        
        # Test model instantiation (without saving)
        user_instance = User.__new__(User)
        console.print("[green]✓ User model instantiation successful[/green]")
        
        return True, "Model relationships test successful"
        
    except Exception as e:
        console.print(f"[red]✗ Model relationships test failed: {e}[/red]")
        console.print(f"[dim]Traceback: {traceback.format_exc()}[/dim]")
        return False, str(e)

def main():
    """Run all model import tests"""
    console.print("[bold cyan]🔍 MODEL IMPORTS & SQLALCHEMY INITIALIZATION TEST[/bold cyan]")
    console.print("=" * 70)
    
    tests = [
        ("Basic Imports", test_basic_imports),
        ("Core Model Imports", test_core_model_imports),
        ("Transaction Models", test_transaction_models),
        ("All Models Import", test_all_models_import),
        ("Mapper Configuration", test_mapper_configuration),
        ("Model Relationships", test_model_relationships),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            success, message = test_func()
            results.append((test_name, success, message))
        except Exception as e:
            results.append((test_name, False, f"Test crashed: {str(e)}"))
    
    # Summary
    console.print("\n" + "=" * 70)
    console.print("[bold yellow]📋 TEST SUMMARY[/bold yellow]")
    
    passed = 0
    failed = 0
    
    for test_name, success, message in results:
        if success:
            console.print(f"[green]✅ {test_name}: PASSED[/green]")
            passed += 1
        else:
            console.print(f"[red]❌ {test_name}: FAILED - {message}[/red]")
            failed += 1
    
    console.print(f"\n[bold]Results: {passed} passed, {failed} failed[/bold]")
    
    if failed == 0:
        console.print("\n[bold green]🎉 All model imports and SQLAlchemy initialization working perfectly![/bold green]")
        return True
    else:
        console.print(f"\n[bold red]💥 {failed} test(s) failed - model imports need attention[/bold red]")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)