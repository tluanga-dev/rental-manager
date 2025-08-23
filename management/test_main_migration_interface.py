#!/usr/bin/env python3
"""
Test the Migration Manager interface from main.py
"""

import subprocess
import time
from rich.console import Console

console = Console()

def test_migration_manager_interface():
    """Test the migration manager interface in main.py"""
    console.print("[bold blue]🧪 Testing Migration Manager Interface in Main.py[/bold blue]")
    
    try:
        # Start main.py
        process = subprocess.Popen(
            ["python3", "main.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True
        )
        
        # Give it time to start
        time.sleep(3)
        
        # Test Migration Manager interface
        # Commands: 5 (Migration Manager), 1 (Show status), 2 (Show history), 3 (Validate), 0 (Back), 0 (Exit)
        commands = "5\n1\n2\n3\n0\n0\n"
        stdout, stderr = process.communicate(input=commands, timeout=20)
        
        # Analyze output
        success_indicators = [
            "Migration Manager",
            "Current database revision",
            "Migration history",
            "Migration integrity",
            "validation"
        ]
        
        error_indicators = [
            "Error",
            "Failed",
            "Exception",
            "Traceback",
            "transaction is aborted"
        ]
        
        found_success = 0
        found_errors = 0
        
        for indicator in success_indicators:
            if indicator.lower() in stdout.lower():
                found_success += 1
                console.print(f"[green]✓ Found: {indicator}[/green]")
        
        for error in error_indicators:
            if error.lower() in stdout.lower() or error.lower() in stderr.lower():
                found_errors += 1
                console.print(f"[red]✗ Found error indicator: {error}[/red]")
        
        # Show a preview of the output
        console.print("\n[bold yellow]Output Preview (first 1000 chars):[/bold yellow]")
        console.print(stdout[:1000] + "..." if len(stdout) > 1000 else stdout)
        
        if stderr:
            console.print("\n[bold red]Errors (first 500 chars):[/bold red]")
            console.print(stderr[:500] + "..." if len(stderr) > 500 else stderr)
        
        # Assessment
        if found_success >= 3 and found_errors == 0:
            console.print("\n[bold green]✅ Migration Manager interface is working well![/bold green]")
            return True
        elif found_success >= 2:
            console.print(f"\n[bold yellow]⚠️ Migration Manager partially functional ({found_success} success indicators, {found_errors} errors)[/bold yellow]")
            return True
        else:
            console.print(f"\n[bold red]❌ Migration Manager has significant issues ({found_success} success indicators, {found_errors} errors)[/bold red]")
            return False
            
    except Exception as e:
        console.print(f"[red]❌ Test failed: {e}[/red]")
        return False
    finally:
        if 'process' in locals() and process.poll() is None:
            process.terminate()

if __name__ == "__main__":
    success = test_migration_manager_interface()
    
    if success:
        console.print("\n[bold green]🎉 Migration Manager interface is functional![/bold green]")
        console.print("\nYou can access it via:")
        console.print("  [cyan]python main.py[/cyan]")
        console.print("  Select option 5 (Migration Manager)")
    else:
        console.print("\n[red]❌ Migration Manager interface needs attention[/red]")
    
    exit(0 if success else 1)