#!/usr/bin/env python3
"""
Test if models load correctly without errors
"""

import sys
from pathlib import Path
from rich.console import Console

console = Console()

# Add rental-manager-api to path
sys.path.insert(0, str(Path(__file__).parent.parent / "rental-manager-api"))

# Import all models at module level
console.print("[yellow]Importing all models...[/yellow]")
from app.models import *
console.print("[green]✅ All models imported successfully[/green]")

def test_models_loading():
    """Test if all models can be imported without errors"""
    console.print("[bold blue]🧪 Testing Models Loading[/bold blue]")
    
    try:
        console.print("[yellow]Testing specific model access...[/yellow]")
        
        # Test specific models
        console.print(f"[green]✅ TransactionHeader: {TransactionHeader.__name__}[/green]")
        console.print(f"[green]✅ Customer: {Customer.__name__}[/green]")
        console.print(f"[green]✅ User: {User.__name__}[/green]")
        
        console.print("[yellow]Testing model relationships...[/yellow]")
        
        # Check if we can access the relationships without SQLAlchemy errors
        try:
            # This will trigger SQLAlchemy to initialize relationships
            from sqlalchemy import create_engine
            from sqlalchemy.orm import sessionmaker
            
            # Create a test engine (not connected to anything)
            engine = create_engine("sqlite:///:memory:")
            
            # Try to create all tables - this will validate relationships
            from app.db.base import Base
            Base.metadata.create_all(engine)
            
            console.print("[green]✅ Model relationships validated successfully[/green]")
            
        except Exception as e:
            console.print(f"[red]❌ Model relationship error: {e}[/red]")
            return False
            
        return True
        
    except Exception as e:
        console.print(f"[red]❌ Model loading failed: {e}[/red]")
        return False

if __name__ == "__main__":
    console.print("[bold cyan]🔧 MODELS LOADING TEST[/bold cyan]")
    console.print("=" * 50)
    
    success = test_models_loading()
    
    if success:
        console.print("\n[bold green]🎉 All models load correctly![/bold green]")
    else:
        console.print("\n[red]❌ Model loading has issues[/red]")
    
    exit(0 if success else 1)