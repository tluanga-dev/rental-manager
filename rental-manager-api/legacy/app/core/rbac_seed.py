"""
RBAC seeding for production startup
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.auth.models import Role, Permission
from app.modules.users.models import User
import uuid


# Define core permissions needed for basic operation
CORE_PERMISSIONS = [
    # User Management
    {"name": "USER_VIEW", "resource": "users", "action": "view", "description": "View users"},
    {"name": "USER_CREATE", "resource": "users", "action": "create", "description": "Create users"},
    {"name": "USER_UPDATE", "resource": "users", "action": "update", "description": "Update users"},
    {"name": "USER_DELETE", "resource": "users", "action": "delete", "description": "Delete users"},
    
    # Role Management
    {"name": "ROLE_VIEW", "resource": "roles", "action": "view", "description": "View roles"},
    {"name": "ROLE_CREATE", "resource": "roles", "action": "create", "description": "Create roles"},
    {"name": "ROLE_UPDATE", "resource": "roles", "action": "update", "description": "Update roles"},
    {"name": "ROLE_DELETE", "resource": "roles", "action": "delete", "description": "Delete roles"},
    
    # Customer Management
    {"name": "CUSTOMER_VIEW", "resource": "customers", "action": "view", "description": "View customers"},
    {"name": "CUSTOMER_CREATE", "resource": "customers", "action": "create", "description": "Create customers"},
    {"name": "CUSTOMER_UPDATE", "resource": "customers", "action": "update", "description": "Update customers"},
    {"name": "CUSTOMER_DELETE", "resource": "customers", "action": "delete", "description": "Delete customers"},
    
    # Supplier Management
    {"name": "SUPPLIER_VIEW", "resource": "suppliers", "action": "view", "description": "View suppliers"},
    {"name": "SUPPLIER_CREATE", "resource": "suppliers", "action": "create", "description": "Create suppliers"},
    {"name": "SUPPLIER_UPDATE", "resource": "suppliers", "action": "update", "description": "Update suppliers"},
    {"name": "SUPPLIER_DELETE", "resource": "suppliers", "action": "delete", "description": "Delete suppliers"},
    
    # Inventory Management
    {"name": "INVENTORY_VIEW", "resource": "inventory", "action": "view", "description": "View inventory"},
    {"name": "INVENTORY_CREATE", "resource": "inventory", "action": "create", "description": "Create inventory items"},
    {"name": "INVENTORY_UPDATE", "resource": "inventory", "action": "update", "description": "Update inventory"},
    {"name": "INVENTORY_DELETE", "resource": "inventory", "action": "delete", "description": "Delete inventory"},
    
    # Rental Management
    {"name": "RENTAL_VIEW", "resource": "rentals", "action": "view", "description": "View rentals"},
    {"name": "RENTAL_CREATE", "resource": "rentals", "action": "create", "description": "Create rentals"},
    {"name": "RENTAL_UPDATE", "resource": "rentals", "action": "update", "description": "Update rentals"},
    {"name": "RENTAL_DELETE", "resource": "rentals", "action": "delete", "description": "Delete rentals"},
    
    # Sale Management
    {"name": "SALE_VIEW", "resource": "sales", "action": "view", "description": "View sales"},
    {"name": "SALE_CREATE", "resource": "sales", "action": "create", "description": "Create sales"},
    {"name": "SALE_UPDATE", "resource": "sales", "action": "update", "description": "Update sales"},
    {"name": "SALE_DELETE", "resource": "sales", "action": "delete", "description": "Delete sales"},
    
    # Transaction Management
    {"name": "TRANSACTION_VIEW", "resource": "transactions", "action": "view", "description": "View transactions"},
    {"name": "TRANSACTION_CREATE", "resource": "transactions", "action": "create", "description": "Create transactions"},
    {"name": "TRANSACTION_UPDATE", "resource": "transactions", "action": "update", "description": "Update transactions"},
    {"name": "TRANSACTION_DELETE", "resource": "transactions", "action": "delete", "description": "Delete transactions"},
    
    # Master Data Management
    {"name": "MASTER_DATA_VIEW", "resource": "master_data", "action": "view", "description": "View master data"},
    {"name": "MASTER_DATA_CREATE", "resource": "master_data", "action": "create", "description": "Create master data"},
    {"name": "MASTER_DATA_UPDATE", "resource": "master_data", "action": "update", "description": "Update master data"},
    {"name": "MASTER_DATA_DELETE", "resource": "master_data", "action": "delete", "description": "Delete master data"},
    
    # Analytics & Reporting
    {"name": "ANALYTICS_VIEW", "resource": "analytics", "action": "view", "description": "View analytics"},
    {"name": "REPORT_VIEW", "resource": "reports", "action": "view", "description": "View reports"},
    {"name": "REPORT_CREATE", "resource": "reports", "action": "create", "description": "Create reports"},
    
    # System Administration
    {"name": "SYSTEM_CONFIG", "resource": "system", "action": "config", "description": "Configure system settings"},
    {"name": "AUDIT_VIEW", "resource": "audit", "action": "view", "description": "View audit logs"},
    {"name": "BACKUP_MANAGE", "resource": "backup", "action": "manage", "description": "Manage backups"},
]


async def seed_basic_rbac(db: AsyncSession) -> bool:
    """Seed basic RBAC data if not exists"""
    try:
        # First, ensure permissions exist
        print("Checking and creating permissions...")
        permissions_created = 0
        for perm_data in CORE_PERMISSIONS:
            # Check if permission already exists
            stmt = select(Permission).where(Permission.name == perm_data["name"])
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if not existing:
                permission = Permission(
                    id=uuid.uuid4(),
                    name=perm_data["name"],
                    resource=perm_data["resource"],
                    action=perm_data["action"],
                    description=perm_data["description"],
                    is_system_permission=True
                )
                db.add(permission)
                permissions_created += 1
        
        if permissions_created > 0:
            await db.commit()
            print(f"✅ Created {permissions_created} permissions")
        
        # Check if roles already exist
        result = await db.execute(select(Role).limit(1))
        existing_roles = result.scalars().first()
        
        if existing_roles:
            print("✅ Roles already exist")
            return True  # Already seeded
        
        # Get all permissions for mapping
        perm_result = await db.execute(select(Permission))
        all_permissions = perm_result.scalars().all()
        perm_map = {p.name: p for p in all_permissions}
        
        # Create basic roles
        roles_data = [
            {
                "name": "SUPER_ADMIN",
                "description": "Full system access with all permissions",
                "permissions": list(perm_map.keys())
            },
            {
                "name": "ADMIN",
                "description": "Administrative access without critical operations",
                "permissions": [p for p in perm_map.keys() if "DELETE" not in p and "SYSTEM" not in p]
            },
            {
                "name": "MANAGER",
                "description": "Management access for business operations",
                "permissions": [
                    "USER_VIEW", "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE",
                    "SUPPLIER_VIEW", "SUPPLIER_CREATE", "SUPPLIER_UPDATE",
                    "INVENTORY_VIEW", "INVENTORY_CREATE", "INVENTORY_UPDATE",
                    "RENTAL_VIEW", "RENTAL_CREATE", "RENTAL_UPDATE",
                    "SALE_VIEW", "SALE_CREATE", "SALE_UPDATE"
                ]
            },
            {
                "name": "STAFF",
                "description": "Regular staff access for daily operations",
                "permissions": [
                    "CUSTOMER_VIEW", "CUSTOMER_CREATE",
                    "INVENTORY_VIEW", "RENTAL_VIEW", "RENTAL_CREATE",
                    "SALE_VIEW", "SALE_CREATE"
                ]
            }
        ]
        
        created_roles = []
        for role_data in roles_data:
            # Check if role exists
            existing = await db.execute(select(Role).where(Role.name == role_data["name"]))
            if existing.scalar_one_or_none():
                continue
                
            role = Role(
                id=uuid.uuid4(),
                name=role_data["name"],
                description=role_data["description"],
                is_system_role=True,
                is_active=True
            )
            
            # Add permissions
            for perm_name in role_data["permissions"]:
                if perm_name in perm_map:
                    role.permissions.append(perm_map[perm_name])
            
            db.add(role)
            created_roles.append(role.name)
        
        if created_roles:
            await db.commit()
            print(f"✅ Created {len(created_roles)} roles: {', '.join(created_roles)}")
        
        # Assign SUPER_ADMIN to admin user
        admin_result = await db.execute(
            select(User).where(User.username == "admin")
        )
        admin_user = admin_result.scalar_one_or_none()
        
        if admin_user and not admin_user.roles:
            super_admin_result = await db.execute(
                select(Role).where(Role.name == "SUPER_ADMIN")
            )
            super_admin_role = super_admin_result.scalar_one_or_none()
            
            if super_admin_role:
                admin_user.roles.append(super_admin_role)
                await db.commit()
                print("✅ Assigned SUPER_ADMIN role to admin user")
        
        return True
        
    except Exception as e:
        print(f"⚠️ RBAC seeding error (non-critical): {e}")
        await db.rollback()
        return False