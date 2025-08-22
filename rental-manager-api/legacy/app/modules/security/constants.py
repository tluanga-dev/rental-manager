"""
Security constants and core permissions
"""

# Define core permissions
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

# Security action types for audit logging
SECURITY_ACTIONS = {
    "LOGIN_ATTEMPT": "Login Attempt",
    "LOGIN_SUCCESS": "Login Success",
    "LOGIN_FAILED": "Login Failed",
    "LOGOUT": "Logout",
    "PASSWORD_CHANGE": "Password Change",
    "PASSWORD_RESET": "Password Reset",
    "ROLE_ASSIGNED": "Role Assigned",
    "ROLE_REMOVED": "Role Removed",
    "PERMISSION_GRANTED": "Permission Granted",
    "PERMISSION_REVOKED": "Permission Revoked",
    "USER_CREATED": "User Created",
    "USER_UPDATED": "User Updated",
    "USER_DELETED": "User Deleted",
    "ROLE_CREATED": "Role Created",
    "ROLE_UPDATED": "Role Updated",
    "ROLE_DELETED": "Role Deleted",
    "SESSION_REVOKED": "Session Revoked",
    "IP_WHITELISTED": "IP Whitelisted",
    "IP_BLACKLISTED": "IP Blacklisted",
    "2FA_ENABLED": "2FA Enabled",
    "2FA_DISABLED": "2FA Disabled",
    "API_KEY_CREATED": "API Key Created",
    "API_KEY_REVOKED": "API Key Revoked",
}

# Risk levels for permissions
RISK_LEVELS = {
    "LOW": "Low Risk",
    "MEDIUM": "Medium Risk",
    "HIGH": "High Risk",
    "CRITICAL": "Critical Risk"
}

# Default role templates
DEFAULT_ROLE_TEMPLATES = {
    "ADMIN": {
        "description": "Full system administrator",
        "permissions": [p["name"] for p in CORE_PERMISSIONS],
        "is_system_role": True
    },
    "MANAGER": {
        "description": "Operations manager",
        "permissions": [
            "USER_VIEW", "USER_CREATE", "USER_UPDATE",
            "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE", "CUSTOMER_DELETE",
            "SUPPLIER_VIEW", "SUPPLIER_CREATE", "SUPPLIER_UPDATE", "SUPPLIER_DELETE",
            "INVENTORY_VIEW", "INVENTORY_CREATE", "INVENTORY_UPDATE", "INVENTORY_DELETE",
            "RENTAL_VIEW", "RENTAL_CREATE", "RENTAL_UPDATE", "RENTAL_DELETE",
            "TRANSACTION_VIEW", "TRANSACTION_CREATE", "TRANSACTION_UPDATE",
            "MASTER_DATA_VIEW", "MASTER_DATA_CREATE", "MASTER_DATA_UPDATE",
            "ANALYTICS_VIEW", "REPORT_VIEW", "REPORT_CREATE",
        ],
        "is_system_role": True
    },
    "STAFF": {
        "description": "Regular staff member",
        "permissions": [
            "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE",
            "SUPPLIER_VIEW",
            "INVENTORY_VIEW", "INVENTORY_UPDATE",
            "RENTAL_VIEW", "RENTAL_CREATE", "RENTAL_UPDATE",
            "TRANSACTION_VIEW", "TRANSACTION_CREATE",
            "MASTER_DATA_VIEW",
            "ANALYTICS_VIEW", "REPORT_VIEW",
        ],
        "is_system_role": True
    },
    "CUSTOMER": {
        "description": "Customer role",
        "permissions": [
            "RENTAL_VIEW",
            "CUSTOMER_VIEW"
        ],
        "is_system_role": True
    }
}