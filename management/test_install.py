#!/usr/bin/env python3
"""
Simple test script to verify the management tools installation.
"""

import sys
import traceback

def test_imports():
    """Test that all required modules can be imported."""
    print("Testing package imports...")
    
    try:
        import rich
        print(f"✓ Rich (version info not available)")
    except Exception as e:
        print(f"✗ Rich: {e}")
        return False
    
    try:
        import sqlalchemy
        print(f"✓ SQLAlchemy {sqlalchemy.__version__}")
    except Exception as e:
        print(f"✗ SQLAlchemy: {e}")
        return False
    
    try:
        import alembic
        print(f"✓ Alembic {alembic.__version__}")
    except Exception as e:
        print(f"✗ Alembic: {e}")
        return False
    
    try:
        import asyncpg
        print(f"✓ AsyncPG {asyncpg.__version__}")
    except Exception as e:
        print(f"✗ AsyncPG: {e}")
        return False
    
    try:
        import questionary
        print(f"✓ Questionary")
    except Exception as e:
        print(f"✗ Questionary: {e}")
        return False
    
    try:
        import typer
        print(f"✓ Typer")
    except Exception as e:
        print(f"✗ Typer: {e}")
        return False
    
    return True

def test_config():
    """Test configuration loading."""
    print("\nTesting configuration...")
    
    try:
        from config import Config
        config = Config()
        print(f"✓ Config loaded")
        print(f"  Database URL: {config.db.DATABASE_URL[:50]}...")
        return True
    except Exception as e:
        print(f"✗ Config: {e}")
        traceback.print_exc()
        return False

def test_rich_output():
    """Test Rich console output."""
    print("\nTesting Rich output...")
    
    try:
        from rich.console import Console
        from rich.table import Table
        
        console = Console()
        console.print("✓ Rich console working!", style="bold green")
        
        table = Table(title="Test Table")
        table.add_column("Column 1", style="cyan")
        table.add_column("Column 2", style="magenta")
        table.add_row("Test", "Data")
        
        console.print(table)
        return True
    except Exception as e:
        print(f"✗ Rich output: {e}")
        return False

if __name__ == "__main__":
    print("Management Tools Installation Test")
    print("=" * 40)
    
    success = True
    
    success &= test_imports()
    success &= test_config()
    success &= test_rich_output()
    
    print("\n" + "=" * 40)
    if success:
        print("✓ All tests passed! Installation looks good.")
        sys.exit(0)
    else:
        print("✗ Some tests failed. Check the errors above.")
        sys.exit(1)