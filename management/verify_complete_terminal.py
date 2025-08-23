#!/usr/bin/env python3
"""
Final verification test for the complete management terminal
"""

import asyncio
import subprocess
import sys
import time
from rich.console import Console

console = Console()

async def test_prerequisites():
    """Test all prerequisites"""
    console.print("[bold blue]🔍 Checking Prerequisites[/bold blue]")
    
    from config import Config
    config = Config()
    
    # Test database
    db_success, db_message = await config.test_database_connection()
    if db_success:
        console.print(f"[green]✅ Database: {db_message}[/green]")
    else:
        console.print(f"[red]❌ Database: {db_message}[/red]")
    
    # Test Redis
    redis_success, redis_message = await config.test_redis_connection()
    if redis_success:
        console.print(f"[green]✅ Redis: {redis_message}[/green]")
    else:
        console.print(f"[yellow]⚠️ Redis: {redis_message}[/yellow]")
    
    return db_success

def test_main_startup():
    """Test main.py startup"""
    console.print("\n[bold blue]🚀 Testing Main.py Startup[/bold blue]")
    
    try:
        process = subprocess.Popen(
            ["python", "main.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True
        )
        
        time.sleep(3)  # Give it time to start
        
        # Send exit command
        stdout, stderr = process.communicate(input="0\n", timeout=10)
        
        # Check for success indicators
        success_indicators = [
            "🏠 Rental Manager - Management Console",
            "Database Administration & System Management Tools",
            "✅ All prerequisites satisfied"
        ]
        
        found_indicators = []
        for indicator in success_indicators:
            if indicator in stdout:
                found_indicators.append(indicator)
                console.print(f"[green]✓ Found: {indicator}[/green]")
        
        if len(found_indicators) >= 2:
            console.print("[green]✅ Main terminal started successfully![/green]")
            return True
        else:
            console.print(f"[red]❌ Missing indicators. Only found {len(found_indicators)}/3[/red]")
            if stderr:
                console.print(f"[red]Errors: {stderr[:300]}[/red]")
            return False
            
    except Exception as e:
        console.print(f"[red]❌ Startup test failed: {e}[/red]")
        return False
    finally:
        if 'process' in locals() and process.poll() is None:
            process.terminate()

async def main():
    """Run all verification tests"""
    console.print("[bold cyan]🏠 Complete Management Terminal - Final Verification[/bold cyan]")
    console.print("=" * 70)
    
    # Test prerequisites
    prereqs_ok = await test_prerequisites()
    
    if not prereqs_ok:
        console.print("\n[bold red]❌ Prerequisites failed - cannot test startup[/bold red]")
        console.print("\n[dim]Make sure Docker PostgreSQL is running:[/dim]")
        console.print("  [cyan]cd ../rental-manager-api[/cyan]")
        console.print("  [cyan]docker-compose up -d postgres redis[/cyan]")
        return False
    
    # Test main startup
    startup_ok = test_main_startup()
    
    # Final results
    console.print("\n" + "=" * 70)
    
    if prereqs_ok and startup_ok:
        console.print("[bold green]🎉 COMPLETE MANAGEMENT TERMINAL IS READY! 🎉[/bold green]")
        console.print("\n[bold blue]Available Features:[/bold blue]")
        features = [
            "👤 Admin Management (create, list, reset passwords)",
            "📊 Database Inspector (table analysis, relationships)",
            "🗑️ Table Cleaner (safe data cleaning)",
            "🌱 Seed Manager (JSON-based data seeding)",
            "🔄 Enhanced Migration Manager (deep model analysis)",
            "💾 Backup & Restore (full, schema, selective)",
            "⚙️ System Status (connection tests, configuration)"
        ]
        for feature in features:
            console.print(f"  {feature}")
        
        console.print("\n[bold green]🚀 TO START:[/bold green]")
        console.print("  [cyan]source activate.sh[/cyan]")
        console.print("  [cyan]python main.py[/cyan]")
        
        return True
    else:
        console.print("[bold red]❌ VERIFICATION FAILED[/bold red]")
        if not prereqs_ok:
            console.print("  • Prerequisites not satisfied")
        if not startup_ok:
            console.print("  • Main startup failed")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)