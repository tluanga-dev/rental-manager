#!/usr/bin/env python3
"""
Seed RBAC data via API endpoints
This script uses the production API to seed roles and permissions
"""

import requests
import json
import sys
from datetime import datetime

# Production configuration
BASE_URL = "https://rental-manager-backend-production.up.railway.app/api"
ADMIN_CREDENTIALS = {
    "username": "admin",
    "password": "K8mX#9vZ$pL2@nQ7!wR4&dF6^sA1*uE3"
}

class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    MAGENTA = '\033[0;35m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BLUE}{'='*60}{Colors.NC}")
    print(f"{Colors.BLUE}{text:^60}{Colors.NC}")
    print(f"{Colors.BLUE}{'='*60}{Colors.NC}\n")

def print_section(text):
    print(f"\n{Colors.YELLOW}▶ {text}{Colors.NC}")
    print("-" * 40)

def authenticate():
    """Authenticate and get JWT token"""
    print_section("Authenticating as Admin")
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={
                "username": ADMIN_CREDENTIALS["username"],
                "password": ADMIN_CREDENTIALS["password"]
            },
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"{Colors.GREEN}✅ Authentication successful{Colors.NC}")
            return token
        else:
            print(f"{Colors.RED}❌ Authentication failed: {response.status_code}{Colors.NC}")
            return None
    except Exception as e:
        print(f"{Colors.RED}❌ Authentication error: {e}{Colors.NC}")
        return None

def get_existing_permissions(token):
    """Get existing permissions from API"""
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/security/permissions", headers=headers, timeout=10)
        if response.status_code == 200:
            permissions = response.json()
            print(f"{Colors.GREEN}✅ Retrieved {len(permissions)} existing permissions{Colors.NC}")
            return {p["name"]: p for p in permissions}
        else:
            print(f"{Colors.YELLOW}⚠️  Could not retrieve permissions: {response.status_code}{Colors.NC}")
            return {}
    except Exception as e:
        print(f"{Colors.RED}❌ Error getting permissions: {e}{Colors.NC}")
        return {}

def create_roles(token, permissions):
    """Create system roles via API"""
    print_section("Creating System Roles")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Define roles to create
    roles = [
        {
            "name": "SUPER_ADMIN",
            "description": "Full system access with all permissions",
            "permissions": list(permissions.keys()),
            "is_system_role": True
        },
        {
            "name": "ADMIN",
            "description": "Administrative access without critical operations",
            "permissions": [p for p in permissions.keys() if "DELETE" not in p and "SYSTEM" not in p],
            "is_system_role": True
        },
        {
            "name": "MANAGER",
            "description": "Management access for business operations",
            "permissions": [
                "USER_VIEW", "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE",
                "SUPPLIER_VIEW", "SUPPLIER_CREATE", "SUPPLIER_UPDATE",
                "INVENTORY_VIEW", "INVENTORY_CREATE", "INVENTORY_UPDATE", "INVENTORY_TRANSFER",
                "RENTAL_VIEW", "RENTAL_CREATE", "RENTAL_UPDATE", "RENTAL_RETURN", "RENTAL_EXTEND",
                "SALE_VIEW", "SALE_CREATE", "SALE_UPDATE",
                "PURCHASE_VIEW", "PURCHASE_CREATE", "PURCHASE_UPDATE",
                "FINANCE_VIEW", "REPORT_VIEW", "REPORT_CREATE", "REPORT_EXPORT",
                "AUDIT_VIEW"
            ],
            "is_system_role": True
        },
        {
            "name": "STAFF",
            "description": "Regular staff access for daily operations",
            "permissions": [
                "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE",
                "INVENTORY_VIEW", "RENTAL_VIEW", "RENTAL_CREATE", "RENTAL_RETURN",
                "SALE_VIEW", "SALE_CREATE", "REPORT_VIEW"
            ],
            "is_system_role": True
        },
        {
            "name": "VIEWER",
            "description": "Read-only access to system data",
            "permissions": [p for p in permissions.keys() if "VIEW" in p],
            "is_system_role": True
        }
    ]
    
    created_count = 0
    failed_count = 0
    
    for role_data in roles:
        # Filter permissions to only include existing ones
        valid_permissions = [p for p in role_data["permissions"] if p in permissions]
        role_data["permissions"] = valid_permissions
        
        try:
            response = requests.post(
                f"{BASE_URL}/security/roles",
                json=role_data,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 201:
                print(f"{Colors.GREEN}✅ Created role: {role_data['name']} with {len(valid_permissions)} permissions{Colors.NC}")
                created_count += 1
            elif response.status_code == 400 and "already exists" in response.text:
                print(f"{Colors.YELLOW}ℹ️  Role {role_data['name']} already exists{Colors.NC}")
            else:
                print(f"{Colors.RED}❌ Failed to create role {role_data['name']}: {response.status_code}{Colors.NC}")
                if response.text:
                    print(f"   Response: {response.text[:200]}")
                failed_count += 1
        except Exception as e:
            print(f"{Colors.RED}❌ Error creating role {role_data['name']}: {e}{Colors.NC}")
            failed_count += 1
    
    return created_count, failed_count

def assign_admin_role(token):
    """Assign SUPER_ADMIN role to admin user"""
    print_section("Assigning SUPER_ADMIN Role to Admin User")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # Get admin user info
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"{Colors.RED}❌ Could not get admin user info{Colors.NC}")
            return False
        
        user_data = response.json()
        user_id = user_data.get("id")
        
        if not user_id:
            print(f"{Colors.YELLOW}⚠️  Could not determine admin user ID{Colors.NC}")
            return False
        
        # Get SUPER_ADMIN role
        response = requests.get(f"{BASE_URL}/security/roles", headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"{Colors.RED}❌ Could not get roles{Colors.NC}")
            return False
        
        roles = response.json()
        super_admin_role = None
        
        for role in roles:
            if role.get("name") == "SUPER_ADMIN":
                super_admin_role = role
                break
        
        if not super_admin_role:
            print(f"{Colors.YELLOW}⚠️  SUPER_ADMIN role not found{Colors.NC}")
            return False
        
        # Check if already assigned
        current_roles = user_data.get("roles", [])
        if any(r.get("name") == "SUPER_ADMIN" for r in current_roles):
            print(f"{Colors.GREEN}✅ Admin user already has SUPER_ADMIN role{Colors.NC}")
            return True
        
        # Assign role (this would need an endpoint that doesn't exist yet)
        print(f"{Colors.YELLOW}ℹ️  Role assignment endpoint not available via API{Colors.NC}")
        print(f"   Admin user will need to be assigned SUPER_ADMIN role manually")
        return False
        
    except Exception as e:
        print(f"{Colors.RED}❌ Error assigning role: {e}{Colors.NC}")
        return False

def main():
    print_header("RBAC API SEEDING SCRIPT")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Target: {BASE_URL}")
    
    # Authenticate
    token = authenticate()
    if not token:
        print(f"\n{Colors.RED}❌ Cannot proceed without authentication{Colors.NC}")
        return 1
    
    # Get existing permissions
    permissions = get_existing_permissions(token)
    if not permissions:
        print(f"\n{Colors.YELLOW}⚠️  No permissions found. The system may need database-level seeding first.{Colors.NC}")
    
    # Create roles
    created, failed = create_roles(token, permissions)
    
    # Try to assign admin role
    assign_admin_role(token)
    
    # Summary
    print_header("SEEDING COMPLETE")
    print(f"Roles Created: {created}")
    print(f"Roles Failed: {failed}")
    
    if failed == 0:
        print(f"\n{Colors.GREEN}🎉 RBAC seeding completed successfully!{Colors.NC}")
        return 0
    else:
        print(f"\n{Colors.YELLOW}⚠️  RBAC seeding completed with some failures{Colors.NC}")
        return 1

if __name__ == "__main__":
    sys.exit(main())