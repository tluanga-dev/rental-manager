#!/usr/bin/env python3
"""
Production RBAC Seeding Script
Seeds roles and permissions to the production Railway database
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the path
sys.path.insert(0, 'rental-manager-backend')

# Set production database URL from Railway
PRODUCTION_DATABASE_URL = "postgresql+asyncpg://postgres:UqUgnCJRbuJEFVaxQwETjRAzwydrNdKD@junction.proxy.rlwy.net:34798/railway"

# Override the DATABASE_URL environment variable
os.environ["DATABASE_URL"] = PRODUCTION_DATABASE_URL

print("🚀 Production RBAC Seeding Script")
print("=" * 60)
print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Target Database: Railway Production")
print("=" * 60)

async def seed_rbac():
    """Seed RBAC data to production database"""
    try:
        # Import after setting environment
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from app.modules.auth.models import Permission, Role
        from app.modules.users.models import User
        from app.core.database import Base
        import uuid
        
        # Create engine with production URL
        engine = create_async_engine(
            PRODUCTION_DATABASE_URL,
            echo=False,
            pool_size=5,
            max_overflow=10
        )
        
        # Create session
        async_session = sessionmaker(
            engine, 
            class_=AsyncSession, 
            expire_on_commit=False
        )
        
        print("\n✅ Connected to production database")
        
        # Define comprehensive permissions
        COMPREHENSIVE_PERMISSIONS = [
            # User Management
            {"name": "USER_VIEW", "resource": "users", "action": "view", "risk_level": "LOW", "description": "View users"},
            {"name": "USER_CREATE", "resource": "users", "action": "create", "risk_level": "MEDIUM", "description": "Create new users"},
            {"name": "USER_UPDATE", "resource": "users", "action": "update", "risk_level": "MEDIUM", "description": "Update user information"},
            {"name": "USER_DELETE", "resource": "users", "action": "delete", "risk_level": "HIGH", "description": "Delete users"},
            {"name": "USER_RESET_PASSWORD", "resource": "users", "action": "reset_password", "risk_level": "HIGH", "description": "Reset user passwords"},
            
            # Role Management
            {"name": "ROLE_VIEW", "resource": "roles", "action": "view", "risk_level": "LOW", "description": "View roles"},
            {"name": "ROLE_CREATE", "resource": "roles", "action": "create", "risk_level": "HIGH", "description": "Create new roles"},
            {"name": "ROLE_UPDATE", "resource": "roles", "action": "update", "risk_level": "HIGH", "description": "Update role permissions"},
            {"name": "ROLE_DELETE", "resource": "roles", "action": "delete", "risk_level": "CRITICAL", "description": "Delete roles"},
            {"name": "ROLE_ASSIGN", "resource": "roles", "action": "assign", "risk_level": "HIGH", "description": "Assign roles to users"},
            
            # Customer Management
            {"name": "CUSTOMER_VIEW", "resource": "customers", "action": "view", "risk_level": "LOW", "description": "View customers"},
            {"name": "CUSTOMER_CREATE", "resource": "customers", "action": "create", "risk_level": "LOW", "description": "Create new customers"},
            {"name": "CUSTOMER_UPDATE", "resource": "customers", "action": "update", "risk_level": "LOW", "description": "Update customer information"},
            {"name": "CUSTOMER_DELETE", "resource": "customers", "action": "delete", "risk_level": "MEDIUM", "description": "Delete customers"},
            {"name": "CUSTOMER_EXPORT", "resource": "customers", "action": "export", "risk_level": "MEDIUM", "description": "Export customer data"},
            
            # Supplier Management
            {"name": "SUPPLIER_VIEW", "resource": "suppliers", "action": "view", "risk_level": "LOW", "description": "View suppliers"},
            {"name": "SUPPLIER_CREATE", "resource": "suppliers", "action": "create", "risk_level": "LOW", "description": "Create new suppliers"},
            {"name": "SUPPLIER_UPDATE", "resource": "suppliers", "action": "update", "risk_level": "LOW", "description": "Update supplier information"},
            {"name": "SUPPLIER_DELETE", "resource": "suppliers", "action": "delete", "risk_level": "MEDIUM", "description": "Delete suppliers"},
            
            # Inventory Management
            {"name": "INVENTORY_VIEW", "resource": "inventory", "action": "view", "risk_level": "LOW", "description": "View inventory"},
            {"name": "INVENTORY_CREATE", "resource": "inventory", "action": "create", "risk_level": "MEDIUM", "description": "Add inventory items"},
            {"name": "INVENTORY_UPDATE", "resource": "inventory", "action": "update", "risk_level": "MEDIUM", "description": "Update inventory quantities"},
            {"name": "INVENTORY_DELETE", "resource": "inventory", "action": "delete", "risk_level": "HIGH", "description": "Remove inventory items"},
            {"name": "INVENTORY_ADJUST", "resource": "inventory", "action": "adjust", "risk_level": "HIGH", "description": "Manual inventory adjustments"},
            {"name": "INVENTORY_TRANSFER", "resource": "inventory", "action": "transfer", "risk_level": "MEDIUM", "description": "Transfer between locations"},
            
            # Rental Management
            {"name": "RENTAL_VIEW", "resource": "rentals", "action": "view", "risk_level": "LOW", "description": "View rentals"},
            {"name": "RENTAL_CREATE", "resource": "rentals", "action": "create", "risk_level": "MEDIUM", "description": "Create new rentals"},
            {"name": "RENTAL_UPDATE", "resource": "rentals", "action": "update", "risk_level": "MEDIUM", "description": "Update rental information"},
            {"name": "RENTAL_DELETE", "resource": "rentals", "action": "delete", "risk_level": "HIGH", "description": "Delete rentals"},
            {"name": "RENTAL_RETURN", "resource": "rentals", "action": "return", "risk_level": "MEDIUM", "description": "Process rental returns"},
            {"name": "RENTAL_EXTEND", "resource": "rentals", "action": "extend", "risk_level": "MEDIUM", "description": "Extend rental periods"},
            
            # Sales Management
            {"name": "SALE_VIEW", "resource": "sales", "action": "view", "risk_level": "LOW", "description": "View sales"},
            {"name": "SALE_CREATE", "resource": "sales", "action": "create", "risk_level": "MEDIUM", "description": "Create new sales"},
            {"name": "SALE_UPDATE", "resource": "sales", "action": "update", "risk_level": "MEDIUM", "description": "Update sale information"},
            {"name": "SALE_DELETE", "resource": "sales", "action": "delete", "risk_level": "HIGH", "description": "Delete sales"},
            {"name": "SALE_REFUND", "resource": "sales", "action": "refund", "risk_level": "HIGH", "description": "Process sale refunds"},
            
            # Purchase Management
            {"name": "PURCHASE_VIEW", "resource": "purchases", "action": "view", "risk_level": "LOW", "description": "View purchases"},
            {"name": "PURCHASE_CREATE", "resource": "purchases", "action": "create", "risk_level": "MEDIUM", "description": "Create purchase orders"},
            {"name": "PURCHASE_UPDATE", "resource": "purchases", "action": "update", "risk_level": "MEDIUM", "description": "Update purchase orders"},
            {"name": "PURCHASE_DELETE", "resource": "purchases", "action": "delete", "risk_level": "HIGH", "description": "Delete purchase orders"},
            {"name": "PURCHASE_APPROVE", "resource": "purchases", "action": "approve", "risk_level": "HIGH", "description": "Approve purchase orders"},
            
            # Financial Management
            {"name": "FINANCE_VIEW", "resource": "finance", "action": "view", "risk_level": "MEDIUM", "description": "View financial data"},
            {"name": "FINANCE_EXPORT", "resource": "finance", "action": "export", "risk_level": "HIGH", "description": "Export financial reports"},
            {"name": "FINANCE_RECONCILE", "resource": "finance", "action": "reconcile", "risk_level": "CRITICAL", "description": "Reconcile accounts"},
            
            # Report Management
            {"name": "REPORT_VIEW", "resource": "reports", "action": "view", "risk_level": "LOW", "description": "View reports"},
            {"name": "REPORT_CREATE", "resource": "reports", "action": "create", "risk_level": "LOW", "description": "Generate reports"},
            {"name": "REPORT_EXPORT", "resource": "reports", "action": "export", "risk_level": "MEDIUM", "description": "Export reports"},
            
            # System Configuration
            {"name": "SYSTEM_VIEW", "resource": "system", "action": "view", "risk_level": "LOW", "description": "View system settings"},
            {"name": "SYSTEM_UPDATE", "resource": "system", "action": "update", "risk_level": "CRITICAL", "description": "Update system settings"},
            {"name": "SYSTEM_BACKUP", "resource": "system", "action": "backup", "risk_level": "CRITICAL", "description": "Create system backups"},
            {"name": "SYSTEM_RESTORE", "resource": "system", "action": "restore", "risk_level": "CRITICAL", "description": "Restore from backup"},
            
            # Audit Management
            {"name": "AUDIT_VIEW", "resource": "audit", "action": "view", "risk_level": "MEDIUM", "description": "View audit logs"},
            {"name": "AUDIT_EXPORT", "resource": "audit", "action": "export", "risk_level": "HIGH", "description": "Export audit logs"},
            {"name": "AUDIT_DELETE", "resource": "audit", "action": "delete", "risk_level": "CRITICAL", "description": "Delete audit logs"},
        ]
        
        # Role templates
        ROLE_TEMPLATES = {
            "SUPER_ADMIN": {
                "description": "Full system access with all permissions",
                "permissions": [p["name"] for p in COMPREHENSIVE_PERMISSIONS]
            },
            "ADMIN": {
                "description": "Administrative access without critical operations",
                "permissions": [p["name"] for p in COMPREHENSIVE_PERMISSIONS if p["risk_level"] != "CRITICAL"]
            },
            "MANAGER": {
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
                ]
            },
            "STAFF": {
                "description": "Regular staff access for daily operations",
                "permissions": [
                    "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE",
                    "INVENTORY_VIEW", "RENTAL_VIEW", "RENTAL_CREATE", "RENTAL_RETURN",
                    "SALE_VIEW", "SALE_CREATE", "REPORT_VIEW"
                ]
            },
            "VIEWER": {
                "description": "Read-only access to system data",
                "permissions": [
                    "USER_VIEW", "ROLE_VIEW", "CUSTOMER_VIEW", "SUPPLIER_VIEW",
                    "INVENTORY_VIEW", "RENTAL_VIEW", "SALE_VIEW", "PURCHASE_VIEW",
                    "FINANCE_VIEW", "REPORT_VIEW", "SYSTEM_VIEW", "AUDIT_VIEW"
                ]
            }
        }
        
        async with async_session() as session:
            try:
                # Check existing permissions
                from sqlalchemy import select
                existing_perms_result = await session.execute(select(Permission))
                existing_perms = existing_perms_result.scalars().all()
                existing_perm_names = {p.name for p in existing_perms}
                
                print(f"\n📊 Found {len(existing_perms)} existing permissions")
                
                # Create missing permissions
                created_count = 0
                for perm_data in COMPREHENSIVE_PERMISSIONS:
                    if perm_data["name"] not in existing_perm_names:
                        permission = Permission(
                            id=uuid.uuid4(),
                            name=perm_data["name"],
                            description=perm_data["description"],
                            resource=perm_data["resource"],
                            action=perm_data["action"],
                            risk_level=perm_data["risk_level"],
                            is_system_permission=True
                        )
                        session.add(permission)
                        created_count += 1
                
                if created_count > 0:
                    await session.commit()
                    print(f"✅ Created {created_count} new permissions")
                else:
                    print("ℹ️  All permissions already exist")
                
                # Check existing roles
                existing_roles_result = await session.execute(select(Role))
                existing_roles = existing_roles_result.scalars().all()
                existing_role_names = {r.name for r in existing_roles}
                
                print(f"\n📊 Found {len(existing_roles)} existing roles")
                
                # Get all permissions for role assignment
                all_perms_result = await session.execute(select(Permission))
                all_permissions = all_perms_result.scalars().all()
                perm_map = {p.name: p for p in all_permissions}
                
                # Create missing roles
                role_created_count = 0
                for role_name, role_config in ROLE_TEMPLATES.items():
                    if role_name not in existing_role_names:
                        role = Role(
                            id=uuid.uuid4(),
                            name=role_name,
                            description=role_config["description"],
                            is_active=True,
                            is_system_role=True
                        )
                        
                        # Assign permissions
                        for perm_name in role_config["permissions"]:
                            if perm_name in perm_map:
                                role.permissions.append(perm_map[perm_name])
                        
                        session.add(role)
                        role_created_count += 1
                        print(f"  • Created role: {role_name} with {len(role.permissions)} permissions")
                
                if role_created_count > 0:
                    await session.commit()
                    print(f"\n✅ Created {role_created_count} new roles")
                else:
                    print("ℹ️  All roles already exist")
                
                # Assign SUPER_ADMIN role to admin user
                admin_result = await session.execute(
                    select(User).where(User.username == "admin")
                )
                admin_user = admin_result.scalar_one_or_none()
                
                if admin_user:
                    super_admin_result = await session.execute(
                        select(Role).where(Role.name == "SUPER_ADMIN")
                    )
                    super_admin_role = super_admin_result.scalar_one_or_none()
                    
                    if super_admin_role and super_admin_role not in admin_user.roles:
                        admin_user.roles.append(super_admin_role)
                        await session.commit()
                        print(f"\n✅ Assigned SUPER_ADMIN role to admin user")
                    else:
                        print(f"\nℹ️  Admin user already has SUPER_ADMIN role")
                else:
                    print(f"\n⚠️  Admin user not found")
                
                print("\n" + "=" * 60)
                print("🎉 RBAC seeding completed successfully!")
                print("=" * 60)
                
                return True
                
            except Exception as e:
                await session.rollback()
                print(f"\n❌ Error during seeding: {e}")
                import traceback
                print(traceback.format_exc())
                return False
            
    except Exception as e:
        print(f"\n❌ Failed to connect to database: {e}")
        import traceback
        print(traceback.format_exc())
        return False

async def main():
    """Main function"""
    success = await seed_rbac()
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)