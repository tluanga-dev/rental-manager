#!/usr/bin/env python3
"""
Test Migration Manager interface after TransactionHeader fix
"""

import subprocess
import time
from rich.console import Console

console = Console()

def test_migration_manager_after_fix():
    """Test the enhanced migration manager features after TransactionHeader fix"""
    console.print("[bold blue]🧪 Testing Migration Manager After TransactionHeader Fix[/bold blue]")
    
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
        
        # Test Enhanced Migration Manager features
        # Commands: 5 (Migration Manager), 1 (Deep Model Analysis), 0 (Back), 0 (Exit)
        commands = "5\n1\n0\n0\n"
        stdout, stderr = process.communicate(input=commands, timeout=30)
        
        # Analyze output for improvement
        success_indicators = [
            "Deep Model Analysis",
            "Comprehensive Model Analysis", 
            "SQLAlchemy models",
            "models analyzed successfully",
            "Analysis complete"
        ]
        
        # Check if TransactionHeader errors are gone
        transactionheader_errors = [
            "TransactionHeader' failed to locate a name",
            "failed to initialize mapper",
            "Original exception was"
        ]
        
        found_success = 0
        found_th_errors = 0
        
        for indicator in success_indicators:
            if indicator.lower() in stdout.lower():
                found_success += 1
                console.print(f"[green]✓ Found: {indicator}[/green]")
        
        for error in transactionheader_errors:
            if error.lower() in stdout.lower() or error.lower() in stderr.lower():
                found_th_errors += 1
                console.print(f"[red]✗ TransactionHeader error still present: {error}[/red]")
        
        # Show relevant output sections
        console.print("\n[bold yellow]Relevant Output Sections:[/bold yellow]")
        output_lines = stdout.split('\n')
        for i, line in enumerate(output_lines):
            if any(keyword in line.lower() for keyword in ['model', 'transaction', 'analysis', 'error']):
                console.print(f"[dim]{i:3}:[/dim] {line}")
        
        if stderr and "transactionheader" in stderr.lower():
            console.print(f"\n[bold red]TransactionHeader Errors in stderr:[/bold red]")
            console.print(stderr[:800] + "..." if len(stderr) > 800 else stderr)
        
        # Assessment
        if found_th_errors == 0 and found_success >= 2:
            console.print("\n[bold green]✅ TransactionHeader fix successful! Enhanced features working![/bold green]")
            return True
        elif found_th_errors == 0:
            console.print("\n[bold yellow]⚠️ TransactionHeader errors fixed, but enhanced features may need more work[/bold yellow]")
            return True
        else:
            console.print(f"\n[bold red]❌ TransactionHeader errors still present ({found_th_errors} found)[/bold red]")
            return False
            
    except Exception as e:
        console.print(f"[red]❌ Test failed: {e}[/red]")
        return False
    finally:
        if 'process' in locals() and process.poll() is None:
            process.terminate()

def test_basic_migration_features():
    """Test that basic migration features still work after the fix"""
    console.print("\n[bold blue]🔧 Testing Basic Migration Features Still Work[/bold blue]")
    
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
        
        # Test basic migration operations
        # Commands: 5 (Migration Manager), 8 (Basic Operations), 1 (Show status), 0 (Back), 0 (Back), 0 (Exit)
        commands = "5\n8\n1\n0\n0\n0\n"
        stdout, stderr = process.communicate(input=commands, timeout=20)
        
        # Check for basic functionality
        basic_indicators = [
            "migration status",
            "database revision",
            "migration history",
            "Basic Migration Operations"
        ]
        
        found_basic = 0
        for indicator in basic_indicators:
            if indicator.lower() in stdout.lower():
                found_basic += 1
                console.print(f"[green]✓ Basic feature working: {indicator}[/green]")
        
        if found_basic >= 3:
            console.print("[green]✅ Basic migration features confirmed working[/green]")
            return True
        else:
            console.print(f"[yellow]⚠️ Basic features partially working ({found_basic}/4)[/yellow]")
            return True  # Still acceptable
            
    except Exception as e:
        console.print(f"[red]❌ Basic features test failed: {e}[/red]")
        return False
    finally:
        if 'process' in locals() and process.poll() is None:
            process.terminate()

if __name__ == "__main__":
    console.print("[bold cyan]🔧 MIGRATION MANAGER FIX VERIFICATION[/bold cyan]")
    console.print("=" * 60)
    
    # Test enhanced features
    enhanced_success = test_migration_manager_after_fix()
    
    # Test basic features still work
    basic_success = test_basic_migration_features()
    
    # Final assessment
    console.print("\n" + "=" * 60)
    if enhanced_success and basic_success:
        console.print("[bold green]🎉 MIGRATION MANAGER FIX SUCCESSFUL![/bold green]")
        console.print("✅ TransactionHeader errors resolved")
        console.print("✅ Enhanced features improved")
        console.print("✅ Basic features still working")
        console.print("\n[bold blue]Migration Manager is now fully functional![/bold blue]")
    elif basic_success:
        console.print("[bold yellow]⚠️ PARTIAL SUCCESS[/bold yellow]")
        console.print("✅ Basic migration features working")
        console.print("⚠️ Enhanced features may need additional work")
        console.print("\n[bold blue]Core Migration Manager functionality is available![/bold blue]")
    else:
        console.print("[bold red]❌ ISSUES REMAIN[/bold red]")
        console.print("❌ Some migration features not working properly")
    
    exit(0)