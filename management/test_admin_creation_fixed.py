#!/usr/bin/env python3
"""
Test admin creation with fresh Python process
"""

import subprocess
import time
from rich.console import Console

console = Console()

def test_admin_creation_fresh():
    """Test admin creation in a fresh Python process"""
    console.print("[bold blue]🧪 Testing Admin Creation with Fresh Process[/bold blue]")
    
    try:
        # Start main.py in a completely fresh process
        process = subprocess.Popen(
            ["python3", "main.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True,
            cwd="/Users/tluanga/current_work/rental-manager/management",
            env={
                "PYTHONPATH": "/Users/tluanga/current_work/rental-manager/rental-manager-api:/Users/tluanga/current_work/rental-manager/rental-manager-api/venv/lib/python3.13/site-packages",
                "PATH": "/Users/tluanga/current_work/rental-manager/rental-manager-api/venv/bin:/usr/local/bin:/usr/bin:/bin"
            }
        )
        
        # Give it time to start
        time.sleep(4)
        
        # Test Admin Creation: 1 (Admin Management), 1 (Create admin), y (force update), 0 (Back), 0 (Exit)
        commands = "1\n1\ny\n0\n0\n"
        stdout, stderr = process.communicate(input=commands, timeout=25)
        
        # Check for TransactionHeader errors specifically
        transaction_errors = [
            "TransactionHeader' failed to locate a name",
            "failed to initialize mapper"
        ]
        
        # Check for success indicators
        success_indicators = [
            "admin user created successfully",
            "Admin created successfully",
            "✓ Admin user",
            "Successfully created admin"
        ]
        
        found_errors = 0
        found_success = 0
        
        for error in transaction_errors:
            if error in stdout or error in stderr:
                found_errors += 1
                console.print(f"[red]✗ TransactionHeader error: {error}[/red]")
        
        for success in success_indicators:
            if success.lower() in stdout.lower():
                found_success += 1
                console.print(f"[green]✓ Success indicator: {success}[/green]")
        
        # Show relevant output
        console.print("\n[bold yellow]Key Output Lines:[/bold yellow]")
        lines = stdout.split('\n')
        key_lines = [line for line in lines if any(keyword in line.lower() for keyword in [
            'admin', 'create', 'user', 'success', 'failed', 'error', 'transactionheader'
        ])]
        
        for line in key_lines[:10]:  # Show first 10 relevant lines
            if 'transactionheader' in line.lower() or 'error' in line.lower():
                console.print(f"[red]  ✗ {line.strip()}[/red]")
            elif 'success' in line.lower() or 'created' in line.lower():
                console.print(f"[green]  ✓ {line.strip()}[/green]")
            else:
                console.print(f"[dim]  • {line.strip()}[/dim]")
        
        # Assessment
        if found_errors == 0 and found_success > 0:
            console.print("\n[bold green]✅ Admin creation successful - no TransactionHeader errors![/bold green]")
            return True
        elif found_errors == 0:
            console.print("\n[bold yellow]⚠️ No TransactionHeader errors, but creation status unclear[/bold yellow]")
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
    console.print("[bold cyan]👤 FRESH ADMIN CREATION TEST[/bold cyan]")
    console.print("=" * 60)
    
    success = test_admin_creation_fresh()
    
    if success:
        console.print("\n[bold green]🎉 Admin creation working with fresh process![/bold green]")
    else:
        console.print("\n[red]❌ Admin creation still has issues[/red]")
    
    exit(0 if success else 1)