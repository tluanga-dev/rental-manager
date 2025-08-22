#!/usr/bin/env python3
"""
Quick RBAC System Test
Tests the core RBAC functionality without full test suite
"""

import asyncio
import sys
import os
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'rental-manager-backend'))

from app.core.database import get_db
from app.modules.auth.models import Role, Permission
from app.modules.users.models import User
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload


class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    MAGENTA = '\033[0;35m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'  # No Color


async def test_rbac_system():
    """Quick test of RBAC system components"""
    print(f"{Colors.BLUE}{'='*60}{Colors.NC}")
    print(f"{Colors.BLUE}    RBAC System Quick Test{Colors.NC}")
    print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")
    
    test_results = {
        "passed": 0,
        "failed": 0,
        "warnings": 0
    }
    
    async for db in get_db():
        try:
            # Test 1: Check permissions exist
            print(f"{Colors.YELLOW}📋 Test 1: Checking Permissions{Colors.NC}")
            print("-" * 40)
            
            result = await db.execute(select(func.count(Permission.id)))
            perm_count = result.scalar()
            
            if perm_count > 0:
                print(f"{Colors.GREEN}✅ Found {perm_count} permissions in database{Colors.NC}")
                test_results["passed"] += 1
                
                # Check permission distribution
                result = await db.execute(
                    select(Permission.resource, func.count(Permission.id))
                    .group_by(Permission.resource)
                    .order_by(func.count(Permission.id).desc())
                )
                resource_counts = result.all()
                
                print(f"\n{Colors.CYAN}Permission Distribution by Resource:{Colors.NC}")
                for resource, count in resource_counts[:5]:  # Top 5
                    print(f"  • {resource}: {count} permissions")
                
                # Check risk levels
                result = await db.execute(
                    select(Permission.risk_level, func.count(Permission.id))
                    .group_by(Permission.risk_level)
                )
                risk_counts = dict(result.all())
                
                print(f"\n{Colors.CYAN}Permission Risk Levels:{Colors.NC}")
                for level in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']:
                    count = risk_counts.get(level, 0)
                    color = Colors.GREEN if level == 'LOW' else Colors.YELLOW if level == 'MEDIUM' else Colors.RED
                    print(f"  • {color}{level}: {count}{Colors.NC}")
            else:
                print(f"{Colors.RED}❌ No permissions found in database{Colors.NC}")
                print(f"{Colors.YELLOW}   Run: python scripts/seed_comprehensive_rbac.py{Colors.NC}")
                test_results["failed"] += 1
            
            # Test 2: Check roles exist
            print(f"\n{Colors.YELLOW}👥 Test 2: Checking Roles{Colors.NC}")
            print("-" * 40)
            
            result = await db.execute(
                select(Role).options(selectinload(Role.permissions))
            )
            roles = result.scalars().all()
            
            if roles:
                print(f"{Colors.GREEN}✅ Found {len(roles)} roles in database{Colors.NC}")
                test_results["passed"] += 1
                
                print(f"\n{Colors.CYAN}Roles and Permission Counts:{Colors.NC}")
                for role in roles:
                    icon = "🔒" if role.is_system_role else "🔓"
                    print(f"  {icon} {role.name}: {len(role.permissions)} permissions")
                    if len(role.permissions) == 0:
                        print(f"    {Colors.YELLOW}⚠️  Warning: No permissions assigned{Colors.NC}")
                        test_results["warnings"] += 1
            else:
                print(f"{Colors.RED}❌ No roles found in database{Colors.NC}")
                test_results["failed"] += 1
            
            # Test 3: Check users with roles
            print(f"\n{Colors.YELLOW}👤 Test 3: Checking User Role Assignments{Colors.NC}")
            print("-" * 40)
            
            result = await db.execute(
                select(User)
                .options(selectinload(User.roles))
                .limit(10)
            )
            users = result.scalars().all()
            
            if users:
                users_with_roles = [u for u in users if u.roles]
                superusers = [u for u in users if u.is_superuser]
                
                print(f"{Colors.GREEN}✅ Found {len(users)} users{Colors.NC}")
                print(f"  • Users with roles: {len(users_with_roles)}")
                print(f"  • Superusers: {len(superusers)}")
                test_results["passed"] += 1
                
                if users_with_roles:
                    print(f"\n{Colors.CYAN}Sample User Role Assignments:{Colors.NC}")
                    for user in users_with_roles[:5]:
                        roles_str = ", ".join([r.name for r in user.roles])
                        print(f"  • {user.username}: {roles_str}")
            else:
                print(f"{Colors.RED}❌ No users found in database{Colors.NC}")
                test_results["failed"] += 1
            
            # Test 4: Check critical permissions
            print(f"\n{Colors.YELLOW}🔐 Test 4: Checking Critical Permissions{Colors.NC}")
            print("-" * 40)
            
            critical_perms = [
                "USER_DELETE",
                "ROLE_DELETE",
                "SYSTEM_CONFIG",
                "SYSTEM_BACKUP",
                "AUDIT_DELETE"
            ]
            
            for perm_name in critical_perms:
                result = await db.execute(
                    select(Permission).where(Permission.name == perm_name)
                )
                perm = result.scalar_one_or_none()
                
                if perm:
                    print(f"{Colors.GREEN}✅ {perm_name}: Found (Risk: {perm.risk_level}){Colors.NC}")
                else:
                    print(f"{Colors.YELLOW}⚠️  {perm_name}: Not found{Colors.NC}")
                    test_results["warnings"] += 1
            
            # Test 5: Permission method test
            print(f"\n{Colors.YELLOW}🧪 Test 5: Testing Permission Methods{Colors.NC}")
            print("-" * 40)
            
            # Get a test user
            result = await db.execute(
                select(User)
                .options(selectinload(User.roles).selectinload(Role.permissions))
                .where(User.is_superuser == False)
                .limit(1)
            )
            test_user = result.scalar_one_or_none()
            
            if test_user:
                # Test has_permission method
                test_permission = "CUSTOMER_VIEW"
                has_perm = test_user.has_permission(test_permission)
                
                if test_user.roles:
                    role_names = [r.name for r in test_user.roles]
                    print(f"Testing user: {test_user.username} (Roles: {', '.join(role_names)})")
                    print(f"  • has_permission('{test_permission}'): {has_perm}")
                    
                    # Test has_role method
                    if test_user.roles:
                        test_role = test_user.roles[0].name
                        has_role = test_user.has_role(test_role)
                        print(f"  • has_role('{test_role}'): {has_role}")
                        
                        if has_role:
                            print(f"{Colors.GREEN}✅ Permission methods working correctly{Colors.NC}")
                            test_results["passed"] += 1
                        else:
                            print(f"{Colors.RED}❌ has_role method not working{Colors.NC}")
                            test_results["failed"] += 1
                else:
                    print(f"{Colors.YELLOW}⚠️  Test user has no roles assigned{Colors.NC}")
                    test_results["warnings"] += 1
            else:
                print(f"{Colors.YELLOW}⚠️  No non-superuser found for testing{Colors.NC}")
                test_results["warnings"] += 1
            
            # Test 6: Check system roles
            print(f"\n{Colors.YELLOW}🎭 Test 6: Checking System Roles{Colors.NC}")
            print("-" * 40)
            
            expected_roles = [
                "SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "STAFF",
                "ACCOUNTANT", "WAREHOUSE", "CUSTOMER_SERVICE", "AUDITOR", "GUEST"
            ]
            
            for role_name in expected_roles:
                result = await db.execute(
                    select(Role).where(Role.name == role_name)
                )
                role = result.scalar_one_or_none()
                
                if role:
                    status = "✅" if role.is_active else "⚠️"
                    print(f"{status} {role_name}: {len(role.permissions)} permissions")
                else:
                    print(f"{Colors.YELLOW}⚠️  {role_name}: Not found{Colors.NC}")
            
        except Exception as e:
            print(f"{Colors.RED}❌ Error during testing: {e}{Colors.NC}")
            test_results["failed"] += 1
        finally:
            await db.close()
            break
    
    # Print summary
    print(f"\n{Colors.BLUE}{'='*60}{Colors.NC}")
    print(f"{Colors.BLUE}                TEST SUMMARY{Colors.NC}")
    print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")
    
    total_tests = test_results["passed"] + test_results["failed"]
    
    print(f"{Colors.GREEN}✅ Passed: {test_results['passed']}/{total_tests}{Colors.NC}")
    if test_results["failed"] > 0:
        print(f"{Colors.RED}❌ Failed: {test_results['failed']}/{total_tests}{Colors.NC}")
    if test_results["warnings"] > 0:
        print(f"{Colors.YELLOW}⚠️  Warnings: {test_results['warnings']}{Colors.NC}")
    
    print()
    
    if test_results["failed"] == 0:
        print(f"{Colors.GREEN}🎉 RBAC System is properly configured!{Colors.NC}")
        return 0
    else:
        print(f"{Colors.RED}⚠️  RBAC System has issues that need attention{Colors.NC}")
        print(f"{Colors.YELLOW}Run the seeding script: cd rental-manager-backend && python scripts/seed_comprehensive_rbac.py{Colors.NC}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(test_rbac_system())
    sys.exit(exit_code)