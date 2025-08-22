#!/usr/bin/env python3
"""
Railway Deployment Checklist
Ensures all deployment prerequisites are met before pushing to Railway
"""
import os
import sys
import subprocess
import json
from pathlib import Path


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def run_command(cmd: str, cwd: str = None) -> tuple[bool, str]:
    """Run a shell command and return success status and output."""
    try:
        result = subprocess.run(
            cmd, 
            shell=True, 
            capture_output=True, 
            text=True, 
            cwd=cwd
        )
        return result.returncode == 0, result.stdout + result.stderr
    except Exception as e:
        return False, str(e)


def check_item(description: str, check_func) -> bool:
    """Run a check and display the result."""
    print(f"  Checking: {description}...", end=" ")
    try:
        success, message = check_func()
        if success:
            print(f"{Colors.GREEN}✓{Colors.ENDC}")
            if message:
                print(f"    {Colors.BLUE}{message}{Colors.ENDC}")
        else:
            print(f"{Colors.RED}✗{Colors.ENDC}")
            if message:
                print(f"    {Colors.RED}{message}{Colors.ENDC}")
        return success
    except Exception as e:
        print(f"{Colors.RED}✗{Colors.ENDC}")
        print(f"    {Colors.RED}Error: {str(e)}{Colors.ENDC}")
        return False


def check_railway_config():
    """Check if railway.json exists and is valid."""
    config_path = Path("railway.json")
    if not config_path.exists():
        return False, "railway.json not found"
    
    try:
        with open(config_path) as f:
            config = json.load(f)
        
        # Check required fields
        if "build" not in config:
            return False, "Missing 'build' section in railway.json"
        if "deploy" not in config:
            return False, "Missing 'deploy' section in railway.json"
        
        return True, "railway.json is valid"
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON: {str(e)}"


def check_dockerfile():
    """Check if Dockerfile.railway exists."""
    if Path("Dockerfile.railway").exists():
        return True, "Dockerfile.railway found"
    return False, "Dockerfile.railway not found"


def check_requirements():
    """Check if requirements.txt exists and is valid."""
    if not Path("requirements.txt").exists():
        return False, "requirements.txt not found"
    
    # Check for common issues
    with open("requirements.txt") as f:
        content = f.read()
        if "requirements-" in content:
            return False, "requirements.txt should not reference other requirements files"
    
    return True, "requirements.txt is valid"


def check_startup_script():
    """Check if start-production.sh exists and is executable."""
    script_path = Path("start-production.sh")
    if not script_path.exists():
        return False, "start-production.sh not found"
    
    # Check if executable
    if not os.access(script_path, os.X_OK):
        return False, "start-production.sh is not executable"
    
    return True, "start-production.sh is ready"


def check_migrations():
    """Check if there are pending migrations."""
    success, output = run_command("alembic current")
    if not success:
        return False, "Could not check migration status"
    
    success, output = run_command("alembic check")
    if not success:
        if "Target database is not up to date" in output:
            return False, "Pending migrations detected. Run 'alembic upgrade head'"
    
    return True, "All migrations are up to date"


def check_env_example():
    """Check if .env.example is up to date."""
    if not Path(".env.example").exists():
        return False, ".env.example not found"
    
    # Check for required variables
    with open(".env.example") as f:
        content = f.read()
        required = ["DATABASE_URL", "SECRET_KEY", "ADMIN_USERNAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"]
        missing = [var for var in required if var not in content]
        
        if missing:
            return False, f"Missing variables in .env.example: {', '.join(missing)}"
    
    return True, ".env.example contains all required variables"


def check_tests():
    """Run core tests to ensure basic functionality."""
    print(f"\n  {Colors.YELLOW}Running core tests (this may take a moment)...{Colors.ENDC}")
    success, output = run_command("python -m pytest tests/test_core.py -v --tb=short")
    
    if success:
        return True, "Core tests passed"
    else:
        # Extract failure summary
        lines = output.split('\n')
        for i, line in enumerate(lines):
            if "FAILED" in line or "ERROR" in line:
                return False, f"Tests failed: {line.strip()}"
        return False, "Tests failed (check pytest output)"


def check_git_status():
    """Check if there are uncommitted changes."""
    success, output = run_command("git status --porcelain")
    if not success:
        return False, "Could not check git status"
    
    if output.strip():
        changed_files = len(output.strip().split('\n'))
        return False, f"{changed_files} uncommitted files. Commit or stash changes before deploying"
    
    return True, "Working directory is clean"


def check_docker_build():
    """Test if Docker image builds successfully."""
    print(f"\n  {Colors.YELLOW}Testing Docker build (this may take a few minutes)...{Colors.ENDC}")
    success, output = run_command("docker build -f Dockerfile.railway -t rental-manager-test .")
    
    if success:
        # Clean up test image
        run_command("docker rmi rental-manager-test")
        return True, "Docker image builds successfully"
    else:
        return False, "Docker build failed (check docker output)"


def main():
    """Run all deployment checks."""
    print(f"{Colors.BOLD}Railway Deployment Checklist{Colors.ENDC}")
    print("=" * 50)
    
    # Change to backend directory
    backend_dir = Path(__file__).parent.parent
    os.chdir(backend_dir)
    
    all_checks_passed = True
    
    # Configuration checks
    print(f"\n{Colors.BOLD}1. Configuration Files:{Colors.ENDC}")
    all_checks_passed &= check_item("railway.json", check_railway_config)
    all_checks_passed &= check_item("Dockerfile.railway", check_dockerfile)
    all_checks_passed &= check_item("requirements.txt", check_requirements)
    all_checks_passed &= check_item("start-production.sh", check_startup_script)
    all_checks_passed &= check_item(".env.example", check_env_example)
    
    # Code checks
    print(f"\n{Colors.BOLD}2. Code Status:{Colors.ENDC}")
    all_checks_passed &= check_item("Git status", check_git_status)
    all_checks_passed &= check_item("Database migrations", check_migrations)
    
    # Optional checks (don't fail deployment)
    print(f"\n{Colors.BOLD}3. Optional Checks:{Colors.ENDC}")
    check_item("Core tests", check_tests)
    
    # Docker build check (optional but recommended)
    if "--docker" in sys.argv:
        check_item("Docker build", check_docker_build)
    else:
        print(f"  {Colors.YELLOW}Skipping Docker build test (use --docker to enable){Colors.ENDC}")
    
    # Summary
    print("\n" + "=" * 50)
    if all_checks_passed:
        print(f"{Colors.GREEN}{Colors.BOLD}✅ All deployment checks passed!{Colors.ENDC}")
        print(f"\n{Colors.BLUE}Next steps:{Colors.ENDC}")
        print("1. Ensure Railway environment variables are configured")
        print("2. Push to your deployment branch:")
        print("   git push origin main")
        print("3. Monitor deployment in Railway dashboard")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ Some deployment checks failed!{Colors.ENDC}")
        print(f"\n{Colors.YELLOW}Fix the issues above before deploying to Railway.{Colors.ENDC}")
        return 1


if __name__ == "__main__":
    sys.exit(main())