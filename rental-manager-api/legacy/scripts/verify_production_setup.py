#!/usr/bin/env python3
"""
Verify Production Setup
This script verifies that the production database migration setup is complete and working.
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime
import subprocess
from typing import Dict, List, Tuple

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import AsyncSessionLocal
from sqlalchemy import text, select, inspect
from sqlalchemy.ext.asyncio import create_async_engine

# ANSI color codes
class Colors:
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    BLUE = '\033[94m'


def print_status(message: str, status: str = "CHECK"):
    """Print status message with color"""
    if status == "PASS":
        print(f"{Colors.GREEN}✓{Colors.ENDC} {message}")
    elif status == "FAIL":
        print(f"{Colors.FAIL}✗{Colors.ENDC} {message}")
    elif status == "WARN":
        print(f"{Colors.WARNING}⚠{Colors.ENDC} {message}")
    else:
        print(f"{Colors.BLUE}🔍{Colors.ENDC} {message}")


def print_section(title: str):
    """Print section header"""
    print(f"\n{Colors.BOLD}{'='*60}")
    print(f"{title}")
    print(f"{'='*60}{Colors.ENDC}")


async def check_database_connection():
    """Check database connection"""
    print_section("Database Connection")
    
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT version()"))
            version = result.scalar()
            print_status(f"PostgreSQL Connected: {version}", "PASS")
            return True
    except Exception as e:
        print_status(f"Database connection failed: {str(e)}", "FAIL")
        return False


async def check_alembic_setup():
    """Check Alembic migration setup"""
    print_section("Alembic Migration Setup")
    
    checks_passed = True
    
    # Check alembic.ini exists
    if Path("alembic.ini").exists():
        print_status("alembic.ini configuration file exists", "PASS")
    else:
        print_status("alembic.ini configuration file missing", "FAIL")
        checks_passed = False
    
    # Check migrations directory
    versions_dir = Path("alembic/versions")
    if versions_dir.exists():
        migration_files = list(versions_dir.glob("*.py"))
        migration_files = [f for f in migration_files if f.name != "__init__.py"]
        
        if migration_files:
            print_status(f"Migration files found: {len(migration_files)}", "PASS")
            for mig in migration_files[:3]:  # Show first 3
                print(f"  - {mig.name}")
            if len(migration_files) > 3:
                print(f"  ... and {len(migration_files) - 3} more")
        else:
            print_status("No migration files found", "WARN")
    else:
        print_status("Migrations directory missing", "FAIL")
        checks_passed = False
    
    # Check alembic_version table
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'alembic_version'
                )
            """))
            
            if result.scalar():
                print_status("alembic_version table exists", "PASS")
                
                # Get current version
                result = await session.execute(text("SELECT version_num FROM alembic_version"))
                version = result.scalar()
                
                if version:
                    print_status(f"Current migration version: {version}", "PASS")
                else:
                    print_status("alembic_version table is empty", "WARN")
            else:
                print_status("alembic_version table missing", "FAIL")
                checks_passed = False
                
    except Exception as e:
        print_status(f"Error checking alembic_version: {str(e)}", "FAIL")
        checks_passed = False
    
    return checks_passed


async def check_tables():
    """Check database tables"""
    print_section("Database Tables")
    
    critical_tables = [
        'users', 'companies', 'roles', 'permissions',
        'categories', 'brands', 'items', 'locations',
        'customers', 'suppliers', 'transaction_headers',
        'inventory_units', 'stock_levels'
    ]
    
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """))
            
            existing_tables = [row[0] for row in result]
            
            print_status(f"Total tables found: {len(existing_tables)}", "PASS")
            
            # Check critical tables
            missing_tables = []
            for table in critical_tables:
                if table in existing_tables:
                    print_status(f"  {table}: exists", "PASS")
                else:
                    print_status(f"  {table}: missing", "FAIL")
                    missing_tables.append(table)
            
            return len(missing_tables) == 0
            
    except Exception as e:
        print_status(f"Error checking tables: {str(e)}", "FAIL")
        return False


async def check_admin_user():
    """Check admin user exists"""
    print_section("Admin User")
    
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("SELECT username, email, is_active, is_superuser FROM users WHERE username = 'admin'")
            )
            admin = result.first()
            
            if admin:
                print_status(f"Admin user exists: {admin.username}", "PASS")
                print_status(f"  Email: {admin.email}", "PASS")
                print_status(f"  Active: {admin.is_active}", "PASS" if admin.is_active else "WARN")
                print_status(f"  Superuser: {admin.is_superuser}", "PASS" if admin.is_superuser else "WARN")
                return True
            else:
                print_status("Admin user not found", "FAIL")
                return False
                
    except Exception as e:
        print_status(f"Error checking admin user: {str(e)}", "FAIL")
        return False


async def check_rbac():
    """Check RBAC setup"""
    print_section("RBAC Setup")
    
    try:
        async with AsyncSessionLocal() as session:
            # Check roles
            result = await session.execute(text("SELECT COUNT(*) FROM roles"))
            role_count = result.scalar()
            
            if role_count > 0:
                print_status(f"Roles configured: {role_count}", "PASS")
            else:
                print_status("No roles found", "FAIL")
                return False
            
            # Check permissions
            result = await session.execute(text("SELECT COUNT(*) FROM permissions"))
            perm_count = result.scalar()
            
            if perm_count > 0:
                print_status(f"Permissions configured: {perm_count}", "PASS")
            else:
                print_status("No permissions found", "FAIL")
                return False
            
            # Check role-permission associations
            result = await session.execute(text("SELECT COUNT(*) FROM role_permissions"))
            assoc_count = result.scalar()
            
            if assoc_count > 0:
                print_status(f"Role-Permission associations: {assoc_count}", "PASS")
            else:
                print_status("No role-permission associations", "WARN")
            
            return True
            
    except Exception as e:
        print_status(f"Error checking RBAC: {str(e)}", "FAIL")
        return False


def check_startup_script():
    """Check production startup script"""
    print_section("Production Startup Script")
    
    script_path = Path("start-production.sh")
    
    if script_path.exists():
        print_status("start-production.sh exists", "PASS")
        
        # Check if it's executable
        if os.access(script_path, os.X_OK):
            print_status("Script is executable", "PASS")
        else:
            print_status("Script is not executable", "WARN")
        
        # Check for key components in script
        with open(script_path, 'r') as f:
            content = f.read()
            
        checks = [
            ("Database wait logic", "wait_for_db"),
            ("Migration handling", "alembic upgrade"),
            ("Admin user creation", "ensure_admin"),
            ("RBAC seeding", "seed_rbac"),
            ("Application start", "uvicorn app.main:app")
        ]
        
        for check_name, check_string in checks:
            if check_string in content:
                print_status(f"  {check_name}: configured", "PASS")
            else:
                print_status(f"  {check_name}: missing", "FAIL")
        
        return True
    else:
        print_status("start-production.sh missing", "FAIL")
        return False


def check_railway_config():
    """Check Railway configuration"""
    print_section("Railway Configuration")
    
    config_path = Path("railway.json")
    
    if config_path.exists():
        print_status("railway.json exists", "PASS")
        
        import json
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Check builder
        if config.get("build", {}).get("builder") == "NIXPACKS":
            print_status("Builder: NIXPACKS", "PASS")
        else:
            print_status("Builder not set to NIXPACKS", "WARN")
        
        # Check start command
        start_cmd = config.get("deploy", {}).get("startCommand")
        if start_cmd and "start-production.sh" in start_cmd:
            print_status(f"Start command: {start_cmd}", "PASS")
        else:
            print_status("Start command not configured", "FAIL")
        
        return True
    else:
        print_status("railway.json missing", "WARN")
        return True  # Not critical if using Railway defaults


async def check_data_statistics():
    """Check data statistics"""
    print_section("Data Statistics")
    
    try:
        async with AsyncSessionLocal() as session:
            tables = [
                'users', 'companies', 'categories', 'brands', 
                'items', 'customers', 'suppliers', 'transaction_headers'
            ]
            
            for table in tables:
                try:
                    result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                    count = result.scalar()
                    
                    if count > 0:
                        print_status(f"{table}: {count} records", "PASS")
                    else:
                        print_status(f"{table}: empty", "WARN")
                except:
                    print_status(f"{table}: error reading", "FAIL")
            
            return True
            
    except Exception as e:
        print_status(f"Error getting statistics: {str(e)}", "FAIL")
        return False


async def main():
    """Main verification process"""
    print(f"\n{Colors.BOLD}{'='*60}")
    print("PRODUCTION SETUP VERIFICATION")
    print(f"{'='*60}{Colors.ENDC}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    results = {
        'passed': [],
        'failed': [],
        'warnings': []
    }
    
    # Run all checks
    checks = [
        ("Database Connection", check_database_connection),
        ("Alembic Setup", check_alembic_setup),
        ("Database Tables", check_tables),
        ("Admin User", check_admin_user),
        ("RBAC Setup", check_rbac),
        ("Data Statistics", check_data_statistics)
    ]
    
    # Run async checks
    for check_name, check_func in checks:
        if asyncio.iscoroutinefunction(check_func):
            if await check_func():
                results['passed'].append(check_name)
            else:
                results['failed'].append(check_name)
    
    # Run sync checks
    sync_checks = [
        ("Startup Script", check_startup_script),
        ("Railway Config", check_railway_config)
    ]
    
    for check_name, check_func in sync_checks:
        if check_func():
            results['passed'].append(check_name)
        else:
            results['failed'].append(check_name)
    
    # Print summary
    print(f"\n{Colors.BOLD}{'='*60}")
    print("VERIFICATION SUMMARY")
    print(f"{'='*60}{Colors.ENDC}")
    
    total_checks = len(results['passed']) + len(results['failed'])
    pass_rate = (len(results['passed']) / total_checks * 100) if total_checks > 0 else 0
    
    print(f"\n{Colors.GREEN}✓ Passed: {len(results['passed'])}/{total_checks} ({pass_rate:.1f}%){Colors.ENDC}")
    for check in results['passed']:
        print(f"  • {check}")
    
    if results['failed']:
        print(f"\n{Colors.FAIL}✗ Failed: {len(results['failed'])}/{total_checks}{Colors.ENDC}")
        for check in results['failed']:
            print(f"  • {check}")
    
    # Final verdict
    print(f"\n{Colors.BOLD}{'='*60}{Colors.ENDC}")
    if not results['failed']:
        print(f"{Colors.GREEN}{Colors.BOLD}✓ PRODUCTION SETUP VERIFIED!{Colors.ENDC}")
        print("Your production environment is properly configured.")
        print("\nNext steps:")
        print("1. Push changes to main branch")
        print("2. Railway will automatically deploy")
        print("3. Monitor deployment logs in Railway dashboard")
    else:
        print(f"{Colors.FAIL}{Colors.BOLD}✗ SETUP INCOMPLETE{Colors.ENDC}")
        print("Please address the failed checks above.")
        print("\nRecommended actions:")
        print("1. Review failed checks")
        print("2. Run appropriate setup scripts")
        print("3. Verify environment variables in Railway")
    print(f"{Colors.BOLD}{'='*60}{Colors.ENDC}\n")
    
    return len(results['failed']) == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)