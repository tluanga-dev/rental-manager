#!/usr/bin/env python3
"""
Test main.py with database inspector fix
"""

import subprocess
import time
import sys
from rich.console import Console

console = Console()

def test_main_db_inspector():
    """Test that main.py database inspector now works"""
    console.print("[bold blue]🧪 Testing Main.py Database Inspector Fix[/bold blue]")
    
    try:
        # Start main.py
        process = subprocess.Popen(
            ["python3", "main.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True,
            env={"PYTHONPATH": "/Users/tluanga/current_work/rental-manager/rental-manager-api/venv/lib/python3.13/site-packages"}
        )
        
        # Give it time to start
        time.sleep(3)
        
        # Send commands: 2 (Database Inspector), 1 (Show all tables), 3 (Database statistics), 0 (Back), 0 (Exit)
        commands = "2\n1\n3\n0\n0\n"
        stdout, stderr = process.communicate(input=commands, timeout=15)
        
        # Check for success indicators
        success_indicators = [
            "Database Inspector",
            "Found 0 tables",  # Expected for empty database
            "Database stats retrieved" 
        ]
        
        error_indicators = [
            "Error getting table counts",
            "Error getting database statistics",
            "current transaction is aborted"
        ]
        
        found_success = 0
        found_errors = 0
        
        for indicator in success_indicators:
            if indicator in stdout:
                found_success += 1
                console.print(f"[green]✓ Found: {indicator}[/green]")
        
        for error in error_indicators:
            if error in stdout or error in stderr:
                found_errors += 1
                console.print(f"[red]✗ Found error: {error}[/red]")
        
        if found_success >= 2 and found_errors == 0:
            console.print("[bold green]✅ Database inspector fix successful![/bold green]")
            return True
        elif found_errors > 0:
            console.print(f"[red]❌ Still has errors ({found_errors} found)[/red]")
            if stderr:
                console.print(f"[red]STDERR: {stderr[:500]}[/red]")
            return False
        else:
            console.print(f"[yellow]⚠️ Partial success ({found_success}/{len(success_indicators)} indicators)[/yellow]")
            return False
            
    except Exception as e:
        console.print(f"[red]❌ Test failed: {e}[/red]")
        return False
    finally:
        if 'process' in locals() and process.poll() is None:
            process.terminate()

if __name__ == "__main__":
    success = test_main_db_inspector()
    
    if success:
        console.print("\n[bold green]🎉 Database Inspector is now working in main.py![/bold green]")
        console.print("\nYou can now run:")
        console.print("  [cyan]python main.py[/cyan]")
        console.print("  Select option 2 (Database Inspector)")
        console.print("  All options should work without transaction errors!")
    else:
        console.print("\n[red]❌ Database inspector still has issues[/red]")
    
    sys.exit(0 if success else 1)