#!/usr/bin/env python3
"""
Test that the main.py starts up correctly and shows the menu
"""

import subprocess
import sys
import time

def test_main_startup():
    """Test that main.py starts without errors and shows the menu"""
    print("🧪 Testing main.py startup...")
    
    try:
        # Run main.py in a subprocess with a timeout
        process = subprocess.Popen(
            ["python", "main.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True,
            cwd="/Users/tluanga/current_work/rental-manager/management"
        )
        
        # Wait a bit for startup
        time.sleep(2)
        
        # Send "0" to exit
        stdout, stderr = process.communicate(input="0\n", timeout=5)
        
        # Check the output
        if "🏠 Rental Manager - Management Console" in stdout:
            print("✅ Main terminal startup successful!")
            print("✅ Menu displayed correctly!")
            return True
        else:
            print("❌ Expected menu not found in output")
            print(f"stdout: {stdout[:500]}...")
            print(f"stderr: {stderr[:500]}...")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Main.py startup timed out")
        process.kill()
        return False
    except Exception as e:
        print(f"❌ Main.py startup failed: {e}")
        return False
    finally:
        if process.poll() is None:
            process.terminate()

if __name__ == "__main__":
    success = test_main_startup()
    if success:
        print("\n🎉 Complete management terminal is working!")
        print("\nTo start the terminal:")
        print("  cd /Users/tluanga/current_work/rental-manager/management")
        print("  source activate.sh") 
        print("  python main.py")
    else:
        print("\n❌ Main terminal has issues")
    
    sys.exit(0 if success else 1)