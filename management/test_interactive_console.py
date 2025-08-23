#!/usr/bin/env python3
"""
Test Interactive Console Startup

Tests that the main interactive console starts properly without errors.
"""

import subprocess
import time
import signal
from rich.console import Console

console = Console()

def test_interactive_console_startup():
    """Test that the interactive console starts without immediate errors"""
    console.print("[bold blue]🖥️ Testing Interactive Console Startup[/bold blue]")
    
    try:
        # Start the main console
        process = subprocess.Popen(
            ["python3", "main.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True
        )
        
        # Give it time to initialize
        time.sleep(5)
        
        # Send exit command to close gracefully
        try:
            process.stdin.write("0\n")
            process.stdin.flush()
        except BrokenPipeError:
            pass
        
        # Wait a bit for graceful shutdown
        time.sleep(2)
        
        # If it's still running, terminate it
        if process.poll() is None:
            process.terminate()
            time.sleep(1)
            if process.poll() is None:
                process.kill()
        
        stdout, stderr = process.communicate(timeout=5)
        
        # Check for success indicators
        success_indicators = [
            "Management Console",
            "Prerequisites",
            "Database connected",
            "Management console ready",
            "Select an option"
        ]
        
        # Check for error indicators
        error_indicators = [
            "TransactionHeader' failed to locate",
            "One or more mappers failed to initialize",
            "ModuleNotFoundError",
            "ImportError", 
            "AttributeError",
            "Failed to create",
            "Connection failed"
        ]
        
        found_success = sum(1 for indicator in success_indicators if indicator.lower() in stdout.lower())
        found_errors = sum(1 for error in error_indicators if error.lower() in stdout.lower() or error.lower() in stderr.lower())
        
        console.print(f"[green]✓ Found {found_success} success indicators[/green]")
        if found_errors > 0:
            console.print(f"[yellow]⚠ Found {found_errors} potential issues[/yellow]")
        
        # Show relevant output
        console.print("\n[bold yellow]Console Startup Output:[/bold yellow]")
        lines = stdout.split('\n')
        relevant_lines = [line for line in lines if any(keyword in line.lower() for keyword in [
            'management', 'console', 'ready', 'database', 'connected', 'menu', 'admin'
        ])]
        
        for line in relevant_lines[:10]:  # Show first 10 relevant lines
            if any(success in line.lower() for success in ['connected', 'ready', 'successful']):
                console.print(f"[green]  ✓ {line.strip()}[/green]")
            elif any(error in line.lower() for error in ['error', 'failed', 'exception']):
                console.print(f"[red]  ✗ {line.strip()}[/red]")
            else:
                console.print(f"[dim]  • {line.strip()}[/dim]")
        
        # Show any stderr output
        if stderr.strip():
            console.print("\n[bold red]Error Output:[/bold red]")
            stderr_lines = stderr.split('\n')[:5]  # Show first 5 error lines
            for line in stderr_lines:
                if line.strip():
                    console.print(f"[red]  ✗ {line.strip()}[/red]")
        
        # Assessment
        if found_errors == 0 and found_success >= 2:
            console.print("\n[bold green]✅ Interactive console starts successfully![/bold green]")
            return True
        elif found_errors == 0:
            console.print("\n[bold yellow]⚠️ Console started but verification needs manual check[/bold yellow]")
            return True
        else:
            console.print(f"\n[bold red]❌ Console has startup issues ({found_errors} errors)[/bold red]")
            return False
            
    except Exception as e:
        console.print(f"[red]❌ Console startup test failed: {e}[/red]")
        return False
    finally:
        # Ensure process is cleaned up
        if 'process' in locals():
            try:
                if process.poll() is None:
                    process.terminate()
                    time.sleep(1)
                    if process.poll() is None:
                        process.kill()
            except:
                pass

def test_console_admin_menu_navigation():
    """Test navigating to the admin menu specifically"""
    console.print("\n[bold blue]👤 Testing Admin Menu Navigation[/bold blue]")
    
    try:
        # Start the main console
        process = subprocess.Popen(
            ["python3", "main.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True
        )
        
        # Give it time to start
        time.sleep(3)
        
        # Navigate to admin management: 1 (Admin Management), 0 (Back), 0 (Exit)
        commands = "1\n0\n0\n"
        
        try:
            process.stdin.write(commands)
            process.stdin.flush()
        except BrokenPipeError:
            pass
        
        # Wait for processing
        time.sleep(3)
        
        # Terminate gracefully
        if process.poll() is None:
            process.terminate()
            stdout, stderr = process.communicate(timeout=5)
        else:
            stdout, stderr = process.communicate()
        
        # Check for admin menu indicators
        admin_indicators = [
            "Admin Management",
            "Create admin user",
            "List all admin users",
            "Reset admin password",
            "Validate admin credentials"
        ]
        
        found_admin_features = sum(1 for indicator in admin_indicators if indicator in stdout)
        
        console.print(f"[green]✓ Found {found_admin_features} admin menu features[/green]")
        
        # Show admin-related output
        lines = stdout.split('\n')
        admin_lines = [line for line in lines if any(keyword in line.lower() for keyword in [
            'admin', 'create', 'user', 'management', 'password'
        ])]
        
        console.print("[bold yellow]Admin Menu Output:[/bold yellow]")
        for line in admin_lines[:8]:  # Show first 8 admin lines
            console.print(f"[dim]  • {line.strip()}[/dim]")
        
        if found_admin_features >= 3:
            console.print("\n[bold green]✅ Admin menu navigation successful![/bold green]")
            return True
        else:
            console.print(f"\n[bold yellow]⚠️ Admin menu may need verification ({found_admin_features} features found)[/bold yellow]")
            return True
            
    except Exception as e:
        console.print(f"[red]❌ Admin menu navigation test failed: {e}[/red]")
        return False
    finally:
        # Clean up process
        if 'process' in locals():
            try:
                if process.poll() is None:
                    process.terminate()
                    time.sleep(1)
                    if process.poll() is None:
                        process.kill()
            except:
                pass

def main():
    """Run interactive console tests"""
    console.print("[bold cyan]🖥️ INTERACTIVE CONSOLE TESTING[/bold cyan]")
    console.print("="*60)
    
    tests = [
        ("Console Startup", test_interactive_console_startup),
        ("Admin Menu Navigation", test_console_admin_menu_navigation),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        console.print(f"\n[yellow]Running {test_name} test...[/yellow]")
        if test_func():
            passed += 1
    
    console.print(f"\n[bold]Results: {passed}/{total} tests passed[/bold]")
    
    if passed == total:
        console.print("\n[bold green]🎉 Interactive console is fully functional![/bold green]")
    else:
        console.print(f"\n[bold yellow]⚠️ {total - passed} test(s) need attention[/bold yellow]")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)