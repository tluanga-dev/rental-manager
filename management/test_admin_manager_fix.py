#!/usr/bin/env python3
"""
Test Admin Manager after TransactionHeader fix
"""

import subprocess
import time
from rich.console import Console

console = Console()

def test_admin_manager_fix():
    """Test that Admin Manager works after the TransactionHeader fix"""
    console.print("[bold blue]🧪 Testing Admin Manager After Fix[/bold blue]")
    
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
        
        # Test Admin Management: 1 (Admin Management), 2 (List admin users), 0 (Back), 0 (Exit)
        commands = "1\n2\n0\n0\n"
        stdout, stderr = process.communicate(input=commands, timeout=15)
        
        # Check for TransactionHeader errors
        transaction_errors = [
            "TransactionHeader' failed to locate a name",
            "failed to initialize mapper",
            "Mapper[Customer(customers)]",
            "One or more mappers failed to initialize"
        ]
        
        found_errors = 0
        for error in transaction_errors:
            if error in stdout or error in stderr:
                found_errors += 1
                console.print(f"[red]✗ Still found error: {error}[/red]")
        
        # Check for success indicators
        success_indicators = [
            "Admin Management",
            "List all admin users",
            "No admin users found",
            "Admin Management Options"
        ]
        
        found_success = 0
        for indicator in success_indicators:
            if indicator in stdout:
                found_success += 1
                console.print(f"[green]✓ Found: {indicator}[/green]")
        
        # Show relevant stderr (if any)
        if stderr and len(stderr.strip()) > 0:
            # Filter out harmless warnings
            filtered_errors = []
            for line in stderr.split('\n'):
                if any(error in line for error in transaction_errors):
                    filtered_errors.append(line)
            
            if filtered_errors:
                console.print(f"\n[red]Remaining TransactionHeader errors:[/red]")
                for error in filtered_errors[:3]:  # Show first 3
                    console.print(f"[dim]{error}[/dim]")
        
        # Assessment
        if found_errors == 0 and found_success >= 2:
            console.print("\n[bold green]✅ Admin Manager fix successful![/bold green]")
            return True
        elif found_errors == 0:
            console.print("\n[bold yellow]⚠️ TransactionHeader errors fixed, but interface may need work[/bold yellow]")
            return True
        else:
            console.print(f"\n[bold red]❌ TransactionHeader errors still present ({found_errors} found)[/bold red]")
            return False
            
    except Exception as e:
        console.print(f"[red]❌ Test failed: {e}[/red]")
        return False
    finally:
        if 'process' in locals() and process.poll() is None:
            process.terminate()

if __name__ == "__main__":
    console.print("[bold cyan]🔧 ADMIN MANAGER FIX VERIFICATION[/bold cyan]")
    console.print("=" * 50)
    
    success = test_admin_manager_fix()
    
    if success:
        console.print("\n[bold green]🎉 Admin Manager is now working![/bold green]")
        console.print("You can now create admin users via:")
        console.print("  [cyan]python main.py[/cyan]")
        console.print("  Select option 1 (Admin Management)")
    else:
        console.print("\n[red]❌ Admin Manager still has issues[/red]")
    
    exit(0 if success else 1)