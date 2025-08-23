#!/usr/bin/env python3
"""
Debug the main.py output to see what's happening
"""

import subprocess
import time
from rich.console import Console

console = Console()

def debug_main_output():
    """Debug main.py output"""
    console.print("[bold blue]🔍 Debugging Main.py Output[/bold blue]")
    
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
        
        # Send commands: 2 (Database Inspector), 1 (Show all tables), 0 (Back), 0 (Exit)
        commands = "2\n1\n0\n0\n"
        stdout, stderr = process.communicate(input=commands, timeout=10)
        
        console.print("[bold yellow]STDOUT:[/bold yellow]")
        console.print(stdout)
        
        if stderr:
            console.print("\n[bold red]STDERR:[/bold red]")
            console.print(stderr)
            
    except Exception as e:
        console.print(f"[red]❌ Debug failed: {e}[/red]")
    finally:
        if 'process' in locals() and process.poll() is None:
            process.terminate()

if __name__ == "__main__":
    debug_main_output()