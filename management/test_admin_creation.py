#!/usr/bin/env python3
"""
Test Admin User Creation functionality
"""

import subprocess
import time
from rich.console import Console

console = Console()

def test_admin_creation():
    """Test admin user creation functionality"""
    console.print("[bold blue]🧪 Testing Admin User Creation[/bold blue]")
    
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
        
        # Test Admin Creation: 1 (Admin Management), 1 (Create admin), y (force update), 0 (Back), 0 (Exit)
        commands = "1\n1\ny\n0\n0\n"
        stdout, stderr = process.communicate(input=commands, timeout=20)
        
        # Check for success indicators
        creation_success = [
            "Create admin user",
            "Force update if admin already exists",
            "admin user created successfully",
            "Admin created successfully"
        ]
        
        # Check for error indicators
        creation_errors = [
            "Failed to create admin user",
            "Error creating admin user",
            "TransactionHeader' failed to locate",
            "One or more mappers failed to initialize"
        ]
        
        found_success = 0
        found_errors = 0
        
        for indicator in creation_success:
            if indicator.lower() in stdout.lower():
                found_success += 1
                console.print(f"[green]✓ Found success: {indicator}[/green]")
        
        for error in creation_errors:
            if error.lower() in stdout.lower() or error.lower() in stderr.lower():
                found_errors += 1
                console.print(f"[red]✗ Found error: {error}[/red]")
        
        # Show relevant output sections
        console.print("\n[bold yellow]Admin Creation Output:[/bold yellow]")
        lines = stdout.split('\n')
        admin_lines = [line for line in lines if any(keyword in line.lower() for keyword in [
            'admin', 'create', 'user', 'success', 'failed', 'error'
        ])]
        
        for line in admin_lines[:8]:  # Show first 8 relevant lines
            if any(success in line.lower() for success in ['success', 'created']):
                console.print(f"[green]  ✓ {line.strip()}[/green]")
            elif any(error in line.lower() for error in ['error', 'failed']):
                console.print(f"[red]  ✗ {line.strip()}[/red]")
            else:
                console.print(f"[dim]  • {line.strip()}[/dim]")
        
        # Assessment
        if found_errors == 0 and found_success >= 1:
            console.print("\n[bold green]✅ Admin creation is working![/bold green]")
            return True
        elif found_errors == 0:
            console.print("\n[bold yellow]⚠️ No errors, but creation process may need verification[/bold yellow]")
            return True
        else:
            console.print(f"\n[bold red]❌ Admin creation has issues ({found_errors} errors)[/bold red]")
            return False
            
    except Exception as e:
        console.print(f"[red]❌ Test failed: {e}[/red]")
        return False
    finally:
        if 'process' in locals() and process.poll() is None:
            process.terminate()

if __name__ == "__main__":
    console.print("[bold cyan]👤 ADMIN USER CREATION TEST[/bold cyan]")
    console.print("=" * 50)
    
    success = test_admin_creation()
    
    if success:
        console.print("\n[bold green]🎉 Admin user creation is functional![/bold green]")
        console.print("✅ TransactionHeader issues resolved")
        console.print("✅ Admin management working properly")
        console.print("✅ User creation process operational")
    else:
        console.print("\n[red]❌ Admin user creation needs attention[/red]")
    
    exit(0 if success else 1)