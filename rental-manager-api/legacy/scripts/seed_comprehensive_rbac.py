"""
Comprehensive RBAC seeding script with all system permissions
Maps frontend permission requirements to backend implementation
"""
import asyncio
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_db
from app.core.security import get_password_hash
from app.modules.auth.models import Role, Permission
from app.modules.auth.enums import UserType
from app.modules.users.models import User
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload


# Comprehensive permissions mapping all system modules
COMPREHENSIVE_PERMISSIONS = [
    # User Management
    {"name": "USER_VIEW", "resource": "users", "action": "view", "risk_level": "LOW", "description": "View users"},
    {"name": "USER_CREATE", "resource": "users", "action": "create", "risk_level": "MEDIUM", "description": "Create users"},
    {"name": "USER_UPDATE", "resource": "users", "action": "update", "risk_level": "MEDIUM", "description": "Update users"},
    {"name": "USER_DELETE", "resource": "users", "action": "delete", "risk_level": "HIGH", "description": "Delete users"},
    {"name": "USER_ACTIVATE", "resource": "users", "action": "activate", "risk_level": "MEDIUM", "description": "Activate/deactivate users"},
    {"name": "USER_RESET_PASSWORD", "resource": "users", "action": "reset_password", "risk_level": "HIGH", "description": "Reset user passwords"},
    {"name": "USER_ASSIGN_ROLE", "resource": "users", "action": "assign_role", "risk_level": "HIGH", "description": "Assign roles to users"},
    {"name": "USER_VIEW_PERMISSIONS", "resource": "users", "action": "view_permissions", "risk_level": "LOW", "description": "View user permissions"},
    {"name": "USER_EXPORT", "resource": "users", "action": "export", "risk_level": "MEDIUM", "description": "Export user data"},
    
    # Role Management
    {"name": "ROLE_VIEW", "resource": "roles", "action": "view", "risk_level": "LOW", "description": "View roles"},
    {"name": "ROLE_CREATE", "resource": "roles", "action": "create", "risk_level": "HIGH", "description": "Create roles"},
    {"name": "ROLE_UPDATE", "resource": "roles", "action": "update", "risk_level": "HIGH", "description": "Update roles"},
    {"name": "ROLE_DELETE", "resource": "roles", "action": "delete", "risk_level": "CRITICAL", "description": "Delete roles"},
    {"name": "ROLE_ASSIGN_PERMISSION", "resource": "roles", "action": "assign_permission", "risk_level": "CRITICAL", "description": "Assign permissions to roles"},
    {"name": "ROLE_VIEW_USERS", "resource": "roles", "action": "view_users", "risk_level": "LOW", "description": "View users assigned to roles"},
    {"name": "ROLE_CLONE", "resource": "roles", "action": "clone", "risk_level": "HIGH", "description": "Clone existing roles"},
    
    # Permission Management
    {"name": "PERMISSION_VIEW", "resource": "permissions", "action": "view", "risk_level": "LOW", "description": "View permissions"},
    {"name": "PERMISSION_CREATE", "resource": "permissions", "action": "create", "risk_level": "CRITICAL", "description": "Create permissions"},
    {"name": "PERMISSION_UPDATE", "resource": "permissions", "action": "update", "risk_level": "CRITICAL", "description": "Update permissions"},
    {"name": "PERMISSION_DELETE", "resource": "permissions", "action": "delete", "risk_level": "CRITICAL", "description": "Delete permissions"},
    
    # Customer Management
    {"name": "CUSTOMER_VIEW", "resource": "customers", "action": "view", "risk_level": "LOW", "description": "View customers"},
    {"name": "CUSTOMER_CREATE", "resource": "customers", "action": "create", "risk_level": "LOW", "description": "Create customers"},
    {"name": "CUSTOMER_UPDATE", "resource": "customers", "action": "update", "risk_level": "LOW", "description": "Update customers"},
    {"name": "CUSTOMER_DELETE", "resource": "customers", "action": "delete", "risk_level": "MEDIUM", "description": "Delete customers"},
    {"name": "CUSTOMER_BLACKLIST", "resource": "customers", "action": "blacklist", "risk_level": "HIGH", "description": "Blacklist customers"},
    {"name": "CUSTOMER_VIEW_TRANSACTIONS", "resource": "customers", "action": "view_transactions", "risk_level": "LOW", "description": "View customer transactions"},
    {"name": "CUSTOMER_VIEW_RENTALS", "resource": "customers", "action": "view_rentals", "risk_level": "LOW", "description": "View customer rentals"},
    {"name": "CUSTOMER_UPDATE_CREDIT", "resource": "customers", "action": "update_credit", "risk_level": "MEDIUM", "description": "Update customer credit"},
    {"name": "CUSTOMER_EXPORT", "resource": "customers", "action": "export", "risk_level": "LOW", "description": "Export customer data"},
    
    # Supplier Management
    {"name": "SUPPLIER_VIEW", "resource": "suppliers", "action": "view", "risk_level": "LOW", "description": "View suppliers"},
    {"name": "SUPPLIER_CREATE", "resource": "suppliers", "action": "create", "risk_level": "LOW", "description": "Create suppliers"},
    {"name": "SUPPLIER_UPDATE", "resource": "suppliers", "action": "update", "risk_level": "LOW", "description": "Update suppliers"},
    {"name": "SUPPLIER_DELETE", "resource": "suppliers", "action": "delete", "risk_level": "MEDIUM", "description": "Delete suppliers"},
    {"name": "SUPPLIER_VIEW_TRANSACTIONS", "resource": "suppliers", "action": "view_transactions", "risk_level": "LOW", "description": "View supplier transactions"},
    {"name": "SUPPLIER_VIEW_PRODUCTS", "resource": "suppliers", "action": "view_products", "risk_level": "LOW", "description": "View supplier products"},
    {"name": "SUPPLIER_UPDATE_STATUS", "resource": "suppliers", "action": "update_status", "risk_level": "MEDIUM", "description": "Update supplier status"},
    {"name": "SUPPLIER_EXPORT", "resource": "suppliers", "action": "export", "risk_level": "LOW", "description": "Export supplier data"},
    
    # Inventory Management
    {"name": "INVENTORY_VIEW", "resource": "inventory", "action": "view", "risk_level": "LOW", "description": "View inventory"},
    {"name": "INVENTORY_CREATE", "resource": "inventory", "action": "create", "risk_level": "MEDIUM", "description": "Create inventory items"},
    {"name": "INVENTORY_UPDATE", "resource": "inventory", "action": "update", "risk_level": "MEDIUM", "description": "Update inventory"},
    {"name": "INVENTORY_DELETE", "resource": "inventory", "action": "delete", "risk_level": "HIGH", "description": "Delete inventory"},
    {"name": "INVENTORY_ADJUST", "resource": "inventory", "action": "adjust", "risk_level": "HIGH", "description": "Adjust inventory levels"},
    {"name": "INVENTORY_TRANSFER", "resource": "inventory", "action": "transfer", "risk_level": "MEDIUM", "description": "Transfer inventory between locations"},
    {"name": "INVENTORY_VIEW_HISTORY", "resource": "inventory", "action": "view_history", "risk_level": "LOW", "description": "View inventory history"},
    {"name": "INVENTORY_STOCK_TAKE", "resource": "inventory", "action": "stock_take", "risk_level": "HIGH", "description": "Perform stock take"},
    {"name": "INVENTORY_EXPORT", "resource": "inventory", "action": "export", "risk_level": "LOW", "description": "Export inventory data"},
    
    # Item Management
    {"name": "ITEM_VIEW", "resource": "items", "action": "view", "risk_level": "LOW", "description": "View items"},
    {"name": "ITEM_CREATE", "resource": "items", "action": "create", "risk_level": "MEDIUM", "description": "Create items"},
    {"name": "ITEM_UPDATE", "resource": "items", "action": "update", "risk_level": "MEDIUM", "description": "Update items"},
    {"name": "ITEM_DELETE", "resource": "items", "action": "delete", "risk_level": "HIGH", "description": "Delete items"},
    {"name": "ITEM_UPDATE_PRICE", "resource": "items", "action": "update_price", "risk_level": "MEDIUM", "description": "Update item prices"},
    {"name": "ITEM_UPDATE_STATUS", "resource": "items", "action": "update_status", "risk_level": "MEDIUM", "description": "Update item status"},
    {"name": "ITEM_VIEW_HISTORY", "resource": "items", "action": "view_history", "risk_level": "LOW", "description": "View item history"},
    {"name": "ITEM_EXPORT", "resource": "items", "action": "export", "risk_level": "LOW", "description": "Export item data"},
    
    # Rental Management
    {"name": "RENTAL_VIEW", "resource": "rentals", "action": "view", "risk_level": "LOW", "description": "View rentals"},
    {"name": "RENTAL_CREATE", "resource": "rentals", "action": "create", "risk_level": "MEDIUM", "description": "Create rentals"},
    {"name": "RENTAL_UPDATE", "resource": "rentals", "action": "update", "risk_level": "MEDIUM", "description": "Update rentals"},
    {"name": "RENTAL_DELETE", "resource": "rentals", "action": "delete", "risk_level": "HIGH", "description": "Delete rentals"},
    {"name": "RENTAL_RETURN", "resource": "rentals", "action": "return", "risk_level": "MEDIUM", "description": "Process rental returns"},
    {"name": "RENTAL_EXTEND", "resource": "rentals", "action": "extend", "risk_level": "MEDIUM", "description": "Extend rental periods"},
    {"name": "RENTAL_CANCEL", "resource": "rentals", "action": "cancel", "risk_level": "HIGH", "description": "Cancel rentals"},
    {"name": "RENTAL_VIEW_HISTORY", "resource": "rentals", "action": "view_history", "risk_level": "LOW", "description": "View rental history"},
    {"name": "RENTAL_APPLY_PENALTY", "resource": "rentals", "action": "apply_penalty", "risk_level": "HIGH", "description": "Apply rental penalties"},
    {"name": "RENTAL_WAIVE_PENALTY", "resource": "rentals", "action": "waive_penalty", "risk_level": "HIGH", "description": "Waive rental penalties"},
    {"name": "RENTAL_EXPORT", "resource": "rentals", "action": "export", "risk_level": "LOW", "description": "Export rental data"},
    
    # Purchase Management
    {"name": "PURCHASE_VIEW", "resource": "purchases", "action": "view", "risk_level": "LOW", "description": "View purchases"},
    {"name": "PURCHASE_CREATE", "resource": "purchases", "action": "create", "risk_level": "MEDIUM", "description": "Create purchases"},
    {"name": "PURCHASE_UPDATE", "resource": "purchases", "action": "update", "risk_level": "MEDIUM", "description": "Update purchases"},
    {"name": "PURCHASE_DELETE", "resource": "purchases", "action": "delete", "risk_level": "HIGH", "description": "Delete purchases"},
    {"name": "PURCHASE_APPROVE", "resource": "purchases", "action": "approve", "risk_level": "HIGH", "description": "Approve purchases"},
    {"name": "PURCHASE_REJECT", "resource": "purchases", "action": "reject", "risk_level": "HIGH", "description": "Reject purchases"},
    {"name": "PURCHASE_RETURN", "resource": "purchases", "action": "return", "risk_level": "MEDIUM", "description": "Process purchase returns"},
    {"name": "PURCHASE_VIEW_HISTORY", "resource": "purchases", "action": "view_history", "risk_level": "LOW", "description": "View purchase history"},
    {"name": "PURCHASE_EXPORT", "resource": "purchases", "action": "export", "risk_level": "LOW", "description": "Export purchase data"},
    
    # Sales Management
    {"name": "SALES_VIEW", "resource": "sales", "action": "view", "risk_level": "LOW", "description": "View sales"},
    {"name": "SALES_CREATE", "resource": "sales", "action": "create", "risk_level": "MEDIUM", "description": "Create sales"},
    {"name": "SALES_UPDATE", "resource": "sales", "action": "update", "risk_level": "MEDIUM", "description": "Update sales"},
    {"name": "SALES_DELETE", "resource": "sales", "action": "delete", "risk_level": "HIGH", "description": "Delete sales"},
    {"name": "SALES_RETURN", "resource": "sales", "action": "return", "risk_level": "MEDIUM", "description": "Process sales returns"},
    {"name": "SALES_APPLY_DISCOUNT", "resource": "sales", "action": "apply_discount", "risk_level": "MEDIUM", "description": "Apply sales discounts"},
    {"name": "SALES_VIEW_HISTORY", "resource": "sales", "action": "view_history", "risk_level": "LOW", "description": "View sales history"},
    {"name": "SALES_EXPORT", "resource": "sales", "action": "export", "risk_level": "LOW", "description": "Export sales data"},
    
    # Transaction Management
    {"name": "TRANSACTION_VIEW", "resource": "transactions", "action": "view", "risk_level": "LOW", "description": "View transactions"},
    {"name": "TRANSACTION_CREATE", "resource": "transactions", "action": "create", "risk_level": "MEDIUM", "description": "Create transactions"},
    {"name": "TRANSACTION_UPDATE", "resource": "transactions", "action": "update", "risk_level": "MEDIUM", "description": "Update transactions"},
    {"name": "TRANSACTION_DELETE", "resource": "transactions", "action": "delete", "risk_level": "CRITICAL", "description": "Delete transactions"},
    {"name": "TRANSACTION_VOID", "resource": "transactions", "action": "void", "risk_level": "HIGH", "description": "Void transactions"},
    {"name": "TRANSACTION_VIEW_DETAILS", "resource": "transactions", "action": "view_details", "risk_level": "LOW", "description": "View transaction details"},
    {"name": "TRANSACTION_EXPORT", "resource": "transactions", "action": "export", "risk_level": "LOW", "description": "Export transaction data"},
    
    # Master Data Management
    {"name": "MASTER_DATA_VIEW", "resource": "master_data", "action": "view", "risk_level": "LOW", "description": "View master data"},
    {"name": "MASTER_DATA_CREATE", "resource": "master_data", "action": "create", "risk_level": "MEDIUM", "description": "Create master data"},
    {"name": "MASTER_DATA_UPDATE", "resource": "master_data", "action": "update", "risk_level": "MEDIUM", "description": "Update master data"},
    {"name": "MASTER_DATA_DELETE", "resource": "master_data", "action": "delete", "risk_level": "HIGH", "description": "Delete master data"},
    {"name": "MASTER_DATA_IMPORT", "resource": "master_data", "action": "import", "risk_level": "HIGH", "description": "Import master data"},
    {"name": "MASTER_DATA_EXPORT", "resource": "master_data", "action": "export", "risk_level": "LOW", "description": "Export master data"},
    
    # Brand Management
    {"name": "BRAND_VIEW", "resource": "brands", "action": "view", "risk_level": "LOW", "description": "View brands"},
    {"name": "BRAND_CREATE", "resource": "brands", "action": "create", "risk_level": "LOW", "description": "Create brands"},
    {"name": "BRAND_UPDATE", "resource": "brands", "action": "update", "risk_level": "LOW", "description": "Update brands"},
    {"name": "BRAND_DELETE", "resource": "brands", "action": "delete", "risk_level": "MEDIUM", "description": "Delete brands"},
    
    # Category Management
    {"name": "CATEGORY_VIEW", "resource": "categories", "action": "view", "risk_level": "LOW", "description": "View categories"},
    {"name": "CATEGORY_CREATE", "resource": "categories", "action": "create", "risk_level": "LOW", "description": "Create categories"},
    {"name": "CATEGORY_UPDATE", "resource": "categories", "action": "update", "risk_level": "LOW", "description": "Update categories"},
    {"name": "CATEGORY_DELETE", "resource": "categories", "action": "delete", "risk_level": "MEDIUM", "description": "Delete categories"},
    
    # Location Management
    {"name": "LOCATION_VIEW", "resource": "locations", "action": "view", "risk_level": "LOW", "description": "View locations"},
    {"name": "LOCATION_CREATE", "resource": "locations", "action": "create", "risk_level": "MEDIUM", "description": "Create locations"},
    {"name": "LOCATION_UPDATE", "resource": "locations", "action": "update", "risk_level": "MEDIUM", "description": "Update locations"},
    {"name": "LOCATION_DELETE", "resource": "locations", "action": "delete", "risk_level": "HIGH", "description": "Delete locations"},
    
    # Unit Management
    {"name": "UNIT_VIEW", "resource": "units", "action": "view", "risk_level": "LOW", "description": "View units"},
    {"name": "UNIT_CREATE", "resource": "units", "action": "create", "risk_level": "LOW", "description": "Create units"},
    {"name": "UNIT_UPDATE", "resource": "units", "action": "update", "risk_level": "LOW", "description": "Update units"},
    {"name": "UNIT_DELETE", "resource": "units", "action": "delete", "risk_level": "MEDIUM", "description": "Delete units"},
    
    # Analytics & Reporting
    {"name": "ANALYTICS_VIEW", "resource": "analytics", "action": "view", "risk_level": "LOW", "description": "View analytics"},
    {"name": "ANALYTICS_EXPORT", "resource": "analytics", "action": "export", "risk_level": "LOW", "description": "Export analytics data"},
    {"name": "REPORT_VIEW", "resource": "reports", "action": "view", "risk_level": "LOW", "description": "View reports"},
    {"name": "REPORT_CREATE", "resource": "reports", "action": "create", "risk_level": "LOW", "description": "Create reports"},
    {"name": "REPORT_UPDATE", "resource": "reports", "action": "update", "risk_level": "LOW", "description": "Update reports"},
    {"name": "REPORT_DELETE", "resource": "reports", "action": "delete", "risk_level": "MEDIUM", "description": "Delete reports"},
    {"name": "REPORT_SCHEDULE", "resource": "reports", "action": "schedule", "risk_level": "MEDIUM", "description": "Schedule reports"},
    {"name": "REPORT_EXPORT", "resource": "reports", "action": "export", "risk_level": "LOW", "description": "Export reports"},
    
    # System Administration
    {"name": "SYSTEM_CONFIG", "resource": "system", "action": "config", "risk_level": "CRITICAL", "description": "Configure system settings"},
    {"name": "SYSTEM_VIEW_LOGS", "resource": "system", "action": "view_logs", "risk_level": "MEDIUM", "description": "View system logs"},
    {"name": "SYSTEM_CLEAR_CACHE", "resource": "system", "action": "clear_cache", "risk_level": "MEDIUM", "description": "Clear system cache"},
    {"name": "SYSTEM_MAINTENANCE", "resource": "system", "action": "maintenance", "risk_level": "CRITICAL", "description": "Perform system maintenance"},
    {"name": "SYSTEM_BACKUP", "resource": "system", "action": "backup", "risk_level": "CRITICAL", "description": "Create system backups"},
    {"name": "SYSTEM_RESTORE", "resource": "system", "action": "restore", "risk_level": "CRITICAL", "description": "Restore system from backup"},
    
    # Audit & Compliance
    {"name": "AUDIT_VIEW", "resource": "audit", "action": "view", "risk_level": "MEDIUM", "description": "View audit logs"},
    {"name": "AUDIT_EXPORT", "resource": "audit", "action": "export", "risk_level": "MEDIUM", "description": "Export audit logs"},
    {"name": "AUDIT_DELETE", "resource": "audit", "action": "delete", "risk_level": "CRITICAL", "description": "Delete audit logs"},
    
    # Company Management
    {"name": "COMPANY_VIEW", "resource": "company", "action": "view", "risk_level": "LOW", "description": "View company information"},
    {"name": "COMPANY_UPDATE", "resource": "company", "action": "update", "risk_level": "HIGH", "description": "Update company information"},
    {"name": "COMPANY_SETTINGS", "resource": "company", "action": "settings", "risk_level": "HIGH", "description": "Manage company settings"},
    
    # Notification Management
    {"name": "NOTIFICATION_VIEW", "resource": "notifications", "action": "view", "risk_level": "LOW", "description": "View notifications"},
    {"name": "NOTIFICATION_CREATE", "resource": "notifications", "action": "create", "risk_level": "LOW", "description": "Create notifications"},
    {"name": "NOTIFICATION_UPDATE", "resource": "notifications", "action": "update", "risk_level": "LOW", "description": "Update notifications"},
    {"name": "NOTIFICATION_DELETE", "resource": "notifications", "action": "delete", "risk_level": "LOW", "description": "Delete notifications"},
    {"name": "NOTIFICATION_SEND", "resource": "notifications", "action": "send", "risk_level": "MEDIUM", "description": "Send notifications"},
]

# Enhanced role configurations with comprehensive permissions
ENHANCED_ROLES = {
    "SUPER_ADMIN": {
        "description": "Super Administrator with full system access",
        "permissions": [p["name"] for p in COMPREHENSIVE_PERMISSIONS],  # All permissions
        "is_system_role": True,
        "template": "system"
    },
    "ADMIN": {
        "description": "Administrator with extensive system access",
        "permissions": [p["name"] for p in COMPREHENSIVE_PERMISSIONS if p["risk_level"] in ["LOW", "MEDIUM", "HIGH"]],
        "is_system_role": True,
        "template": "system"
    },
    "MANAGER": {
        "description": "Operations Manager with business management permissions",
        "permissions": [
            # Users (limited)
            "USER_VIEW", "USER_CREATE", "USER_UPDATE", "USER_ACTIVATE",
            # Customers (full)
            "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE", "CUSTOMER_DELETE",
            "CUSTOMER_BLACKLIST", "CUSTOMER_VIEW_TRANSACTIONS", "CUSTOMER_VIEW_RENTALS",
            "CUSTOMER_UPDATE_CREDIT", "CUSTOMER_EXPORT",
            # Suppliers (full)
            "SUPPLIER_VIEW", "SUPPLIER_CREATE", "SUPPLIER_UPDATE", "SUPPLIER_DELETE",
            "SUPPLIER_VIEW_TRANSACTIONS", "SUPPLIER_VIEW_PRODUCTS", "SUPPLIER_UPDATE_STATUS", "SUPPLIER_EXPORT",
            # Inventory (full)
            "INVENTORY_VIEW", "INVENTORY_CREATE", "INVENTORY_UPDATE", "INVENTORY_DELETE",
            "INVENTORY_ADJUST", "INVENTORY_TRANSFER", "INVENTORY_VIEW_HISTORY", "INVENTORY_STOCK_TAKE", "INVENTORY_EXPORT",
            # Items (full)
            "ITEM_VIEW", "ITEM_CREATE", "ITEM_UPDATE", "ITEM_DELETE",
            "ITEM_UPDATE_PRICE", "ITEM_UPDATE_STATUS", "ITEM_VIEW_HISTORY", "ITEM_EXPORT",
            # Rentals (full)
            "RENTAL_VIEW", "RENTAL_CREATE", "RENTAL_UPDATE", "RENTAL_DELETE",
            "RENTAL_RETURN", "RENTAL_EXTEND", "RENTAL_CANCEL", "RENTAL_VIEW_HISTORY",
            "RENTAL_APPLY_PENALTY", "RENTAL_WAIVE_PENALTY", "RENTAL_EXPORT",
            # Purchases (full)
            "PURCHASE_VIEW", "PURCHASE_CREATE", "PURCHASE_UPDATE", "PURCHASE_DELETE",
            "PURCHASE_APPROVE", "PURCHASE_REJECT", "PURCHASE_RETURN", "PURCHASE_VIEW_HISTORY", "PURCHASE_EXPORT",
            # Sales (full)
            "SALES_VIEW", "SALES_CREATE", "SALES_UPDATE", "SALES_DELETE",
            "SALES_RETURN", "SALES_APPLY_DISCOUNT", "SALES_VIEW_HISTORY", "SALES_EXPORT",
            # Transactions (view only)
            "TRANSACTION_VIEW", "TRANSACTION_VIEW_DETAILS", "TRANSACTION_EXPORT",
            # Master Data (full)
            "MASTER_DATA_VIEW", "MASTER_DATA_CREATE", "MASTER_DATA_UPDATE", "MASTER_DATA_DELETE",
            "MASTER_DATA_IMPORT", "MASTER_DATA_EXPORT",
            # Brands, Categories, Locations, Units (full)
            "BRAND_VIEW", "BRAND_CREATE", "BRAND_UPDATE", "BRAND_DELETE",
            "CATEGORY_VIEW", "CATEGORY_CREATE", "CATEGORY_UPDATE", "CATEGORY_DELETE",
            "LOCATION_VIEW", "LOCATION_CREATE", "LOCATION_UPDATE", "LOCATION_DELETE",
            "UNIT_VIEW", "UNIT_CREATE", "UNIT_UPDATE", "UNIT_DELETE",
            # Analytics & Reports (full)
            "ANALYTICS_VIEW", "ANALYTICS_EXPORT",
            "REPORT_VIEW", "REPORT_CREATE", "REPORT_UPDATE", "REPORT_DELETE", "REPORT_SCHEDULE", "REPORT_EXPORT",
            # Audit (view only)
            "AUDIT_VIEW", "AUDIT_EXPORT",
            # Company (view and update)
            "COMPANY_VIEW", "COMPANY_UPDATE",
            # Notifications (full)
            "NOTIFICATION_VIEW", "NOTIFICATION_CREATE", "NOTIFICATION_UPDATE", "NOTIFICATION_DELETE", "NOTIFICATION_SEND",
        ],
        "is_system_role": True,
        "template": "management"
    },
    "SUPERVISOR": {
        "description": "Supervisor with team management permissions",
        "permissions": [
            # Users (view only)
            "USER_VIEW",
            # Customers (manage)
            "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE",
            "CUSTOMER_VIEW_TRANSACTIONS", "CUSTOMER_VIEW_RENTALS", "CUSTOMER_EXPORT",
            # Suppliers (view)
            "SUPPLIER_VIEW", "SUPPLIER_VIEW_TRANSACTIONS", "SUPPLIER_VIEW_PRODUCTS",
            # Inventory (manage)
            "INVENTORY_VIEW", "INVENTORY_UPDATE", "INVENTORY_TRANSFER", "INVENTORY_VIEW_HISTORY", "INVENTORY_EXPORT",
            # Items (view and update)
            "ITEM_VIEW", "ITEM_UPDATE", "ITEM_UPDATE_PRICE", "ITEM_VIEW_HISTORY", "ITEM_EXPORT",
            # Rentals (manage)
            "RENTAL_VIEW", "RENTAL_CREATE", "RENTAL_UPDATE",
            "RENTAL_RETURN", "RENTAL_EXTEND", "RENTAL_VIEW_HISTORY", "RENTAL_EXPORT",
            # Purchases (create and view)
            "PURCHASE_VIEW", "PURCHASE_CREATE", "PURCHASE_VIEW_HISTORY", "PURCHASE_EXPORT",
            # Sales (manage)
            "SALES_VIEW", "SALES_CREATE", "SALES_UPDATE",
            "SALES_APPLY_DISCOUNT", "SALES_VIEW_HISTORY", "SALES_EXPORT",
            # Transactions (view)
            "TRANSACTION_VIEW", "TRANSACTION_VIEW_DETAILS",
            # Master Data (view)
            "MASTER_DATA_VIEW", "MASTER_DATA_EXPORT",
            # Basic data (view)
            "BRAND_VIEW", "CATEGORY_VIEW", "LOCATION_VIEW", "UNIT_VIEW",
            # Analytics & Reports (view)
            "ANALYTICS_VIEW", "REPORT_VIEW", "REPORT_EXPORT",
            # Company (view)
            "COMPANY_VIEW",
            # Notifications (manage own)
            "NOTIFICATION_VIEW", "NOTIFICATION_CREATE", "NOTIFICATION_UPDATE",
        ],
        "is_system_role": True,
        "template": "supervisor"
    },
    "STAFF": {
        "description": "Staff member with operational permissions",
        "permissions": [
            # Customers (basic)
            "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE",
            "CUSTOMER_VIEW_TRANSACTIONS", "CUSTOMER_VIEW_RENTALS",
            # Suppliers (view)
            "SUPPLIER_VIEW",
            # Inventory (view and update)
            "INVENTORY_VIEW", "INVENTORY_UPDATE", "INVENTORY_VIEW_HISTORY",
            # Items (view)
            "ITEM_VIEW", "ITEM_VIEW_HISTORY",
            # Rentals (basic)
            "RENTAL_VIEW", "RENTAL_CREATE", "RENTAL_UPDATE",
            "RENTAL_RETURN", "RENTAL_VIEW_HISTORY",
            # Purchases (view)
            "PURCHASE_VIEW", "PURCHASE_VIEW_HISTORY",
            # Sales (basic)
            "SALES_VIEW", "SALES_CREATE", "SALES_VIEW_HISTORY",
            # Transactions (view)
            "TRANSACTION_VIEW",
            # Master Data (view)
            "MASTER_DATA_VIEW",
            # Basic data (view)
            "BRAND_VIEW", "CATEGORY_VIEW", "LOCATION_VIEW", "UNIT_VIEW",
            # Analytics (view)
            "ANALYTICS_VIEW", "REPORT_VIEW",
            # Notifications (view own)
            "NOTIFICATION_VIEW",
        ],
        "is_system_role": True,
        "template": "operational"
    },
    "ACCOUNTANT": {
        "description": "Accountant with financial permissions",
        "permissions": [
            # Customers (financial view)
            "CUSTOMER_VIEW", "CUSTOMER_VIEW_TRANSACTIONS", "CUSTOMER_UPDATE_CREDIT",
            # Suppliers (financial view)
            "SUPPLIER_VIEW", "SUPPLIER_VIEW_TRANSACTIONS",
            # Inventory (financial view)
            "INVENTORY_VIEW", "INVENTORY_VIEW_HISTORY", "INVENTORY_EXPORT",
            # Rentals (financial)
            "RENTAL_VIEW", "RENTAL_VIEW_HISTORY", "RENTAL_APPLY_PENALTY", "RENTAL_EXPORT",
            # Purchases (full financial)
            "PURCHASE_VIEW", "PURCHASE_APPROVE", "PURCHASE_REJECT", "PURCHASE_VIEW_HISTORY", "PURCHASE_EXPORT",
            # Sales (financial)
            "SALES_VIEW", "SALES_VIEW_HISTORY", "SALES_EXPORT",
            # Transactions (full)
            "TRANSACTION_VIEW", "TRANSACTION_CREATE", "TRANSACTION_UPDATE",
            "TRANSACTION_VIEW_DETAILS", "TRANSACTION_EXPORT",
            # Analytics & Reports (financial)
            "ANALYTICS_VIEW", "ANALYTICS_EXPORT",
            "REPORT_VIEW", "REPORT_CREATE", "REPORT_UPDATE", "REPORT_EXPORT",
            # Audit (view)
            "AUDIT_VIEW", "AUDIT_EXPORT",
            # Company (view)
            "COMPANY_VIEW",
        ],
        "is_system_role": True,
        "template": "financial"
    },
    "WAREHOUSE": {
        "description": "Warehouse staff with inventory permissions",
        "permissions": [
            # Inventory (full)
            "INVENTORY_VIEW", "INVENTORY_CREATE", "INVENTORY_UPDATE",
            "INVENTORY_ADJUST", "INVENTORY_TRANSFER", "INVENTORY_VIEW_HISTORY",
            "INVENTORY_STOCK_TAKE", "INVENTORY_EXPORT",
            # Items (manage)
            "ITEM_VIEW", "ITEM_CREATE", "ITEM_UPDATE", "ITEM_UPDATE_STATUS", "ITEM_VIEW_HISTORY",
            # Purchases (receive)
            "PURCHASE_VIEW", "PURCHASE_UPDATE", "PURCHASE_VIEW_HISTORY",
            # Master Data (view)
            "MASTER_DATA_VIEW",
            # Basic data (view)
            "BRAND_VIEW", "CATEGORY_VIEW", "LOCATION_VIEW", "UNIT_VIEW",
            # Reports (inventory)
            "REPORT_VIEW", "REPORT_CREATE",
        ],
        "is_system_role": True,
        "template": "warehouse"
    },
    "CUSTOMER_SERVICE": {
        "description": "Customer service representative",
        "permissions": [
            # Customers (full service)
            "CUSTOMER_VIEW", "CUSTOMER_CREATE", "CUSTOMER_UPDATE",
            "CUSTOMER_VIEW_TRANSACTIONS", "CUSTOMER_VIEW_RENTALS",
            # Rentals (service)
            "RENTAL_VIEW", "RENTAL_CREATE", "RENTAL_UPDATE",
            "RENTAL_RETURN", "RENTAL_EXTEND", "RENTAL_VIEW_HISTORY",
            # Sales (basic)
            "SALES_VIEW", "SALES_CREATE",
            # Items (view)
            "ITEM_VIEW",
            # Inventory (view availability)
            "INVENTORY_VIEW",
            # Master Data (view)
            "MASTER_DATA_VIEW",
            # Basic data (view)
            "BRAND_VIEW", "CATEGORY_VIEW", "LOCATION_VIEW", "UNIT_VIEW",
            # Notifications (customer service)
            "NOTIFICATION_VIEW", "NOTIFICATION_CREATE", "NOTIFICATION_SEND",
        ],
        "is_system_role": True,
        "template": "service"
    },
    "AUDITOR": {
        "description": "Internal auditor with read-only access",
        "permissions": [
            # All view permissions
            "USER_VIEW", "USER_VIEW_PERMISSIONS",
            "ROLE_VIEW", "ROLE_VIEW_USERS",
            "PERMISSION_VIEW",
            "CUSTOMER_VIEW", "CUSTOMER_VIEW_TRANSACTIONS", "CUSTOMER_VIEW_RENTALS",
            "SUPPLIER_VIEW", "SUPPLIER_VIEW_TRANSACTIONS", "SUPPLIER_VIEW_PRODUCTS",
            "INVENTORY_VIEW", "INVENTORY_VIEW_HISTORY",
            "ITEM_VIEW", "ITEM_VIEW_HISTORY",
            "RENTAL_VIEW", "RENTAL_VIEW_HISTORY",
            "PURCHASE_VIEW", "PURCHASE_VIEW_HISTORY",
            "SALES_VIEW", "SALES_VIEW_HISTORY",
            "TRANSACTION_VIEW", "TRANSACTION_VIEW_DETAILS",
            "MASTER_DATA_VIEW",
            "BRAND_VIEW", "CATEGORY_VIEW", "LOCATION_VIEW", "UNIT_VIEW",
            "ANALYTICS_VIEW", "REPORT_VIEW",
            "AUDIT_VIEW", "AUDIT_EXPORT",
            "COMPANY_VIEW",
            "SYSTEM_VIEW_LOGS",
            # Export permissions for audit
            "CUSTOMER_EXPORT", "SUPPLIER_EXPORT", "INVENTORY_EXPORT",
            "ITEM_EXPORT", "RENTAL_EXPORT", "PURCHASE_EXPORT",
            "SALES_EXPORT", "TRANSACTION_EXPORT", "MASTER_DATA_EXPORT",
            "ANALYTICS_EXPORT", "REPORT_EXPORT",
        ],
        "is_system_role": True,
        "template": "audit"
    },
    "GUEST": {
        "description": "Guest with minimal view permissions",
        "permissions": [
            "ITEM_VIEW",
            "BRAND_VIEW",
            "CATEGORY_VIEW",
            "LOCATION_VIEW",
        ],
        "is_system_role": True,
        "template": "guest"
    }
}


async def clear_existing_rbac(db):
    """Clear existing RBAC data (optional - use with caution)"""
    print("⚠️  Clearing existing RBAC data...")
    
    # Clear role_permissions association
    await db.execute("DELETE FROM role_permissions")
    
    # Clear user_roles association
    await db.execute("DELETE FROM user_roles")
    
    # Delete non-system permissions
    stmt = delete(Permission).where(Permission.is_system_permission == False)
    await db.execute(stmt)
    
    # Delete non-system roles
    stmt = delete(Role).where(Role.is_system_role == False)
    await db.execute(stmt)
    
    await db.commit()
    print("✅ Existing RBAC data cleared")


async def seed_permissions(db, clear_existing: bool = False):
    """Seed comprehensive permissions into the database"""
    print("🔧 Seeding comprehensive permissions...")
    
    permissions_created = 0
    permissions_updated = 0
    
    for perm_data in COMPREHENSIVE_PERMISSIONS:
        # Check if permission already exists
        stmt = select(Permission).where(Permission.name == perm_data["name"])
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update existing permission
            existing.resource = perm_data["resource"]
            existing.action = perm_data["action"]
            existing.description = perm_data["description"]
            existing.risk_level = perm_data.get("risk_level", "LOW")
            existing.is_system_permission = True
            permissions_updated += 1
        else:
            # Create new permission
            permission = Permission(
                name=perm_data["name"],
                resource=perm_data["resource"],
                action=perm_data["action"],
                description=perm_data["description"],
                risk_level=perm_data.get("risk_level", "LOW"),
                is_system_permission=True,
                is_active=True
            )
            db.add(permission)
            permissions_created += 1
    
    await db.commit()
    print(f"✅ Created {permissions_created} new permissions")
    print(f"✅ Updated {permissions_updated} existing permissions")
    print(f"✅ Total permissions: {len(COMPREHENSIVE_PERMISSIONS)}")


async def seed_roles(db):
    """Seed enhanced roles into the database"""
    print("👥 Seeding enhanced roles...")
    
    # Get all permissions for mapping
    stmt = select(Permission)
    result = await db.execute(stmt)
    permissions = {p.name: p for p in result.scalars().all()}
    
    roles_created = 0
    roles_updated = 0
    
    for role_name, role_config in ENHANCED_ROLES.items():
        # Check if role already exists
        stmt = select(Role).where(Role.name == role_name).options(selectinload(Role.permissions))
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update existing role
            existing.description = role_config["description"]
            existing.template = role_config.get("template")
            existing.is_system_role = role_config["is_system_role"]
            
            # Clear and re-add permissions
            existing.permissions.clear()
            for perm_name in role_config["permissions"]:
                if perm_name in permissions:
                    existing.permissions.append(permissions[perm_name])
                else:
                    print(f"  ⚠️  Permission {perm_name} not found for role {role_name}")
            
            roles_updated += 1
        else:
            # Create new role
            role = Role(
                name=role_name,
                description=role_config["description"],
                template=role_config.get("template"),
                is_system_role=role_config["is_system_role"],
                can_be_deleted=not role_config["is_system_role"],
                is_active=True
            )
            
            # Add permissions to role
            for perm_name in role_config["permissions"]:
                if perm_name in permissions:
                    role.permissions.append(permissions[perm_name])
                else:
                    print(f"  ⚠️  Permission {perm_name} not found for role {role_name}")
            
            db.add(role)
            roles_created += 1
    
    await db.commit()
    print(f"✅ Created {roles_created} new roles")
    print(f"✅ Updated {roles_updated} existing roles")
    print(f"✅ Total roles: {len(ENHANCED_ROLES)}")


async def update_admin_users(db):
    """Update existing admin users with appropriate roles"""
    print("👤 Updating admin users with roles...")
    
    # Get roles
    stmt = select(Role).options(selectinload(Role.permissions))
    result = await db.execute(stmt)
    roles = {r.name: r for r in result.scalars().all()}
    
    # Update superuser accounts
    stmt = select(User).where(User.is_superuser == True).options(selectinload(User.roles))
    result = await db.execute(stmt)
    superusers = result.scalars().all()
    
    for user in superusers:
        if "SUPER_ADMIN" in roles and roles["SUPER_ADMIN"] not in user.roles:
            user.roles.append(roles["SUPER_ADMIN"])
            print(f"  ✅ Assigned SUPER_ADMIN role to {user.username}")
    
    # Update admin type users
    stmt = select(User).where(User.user_type == "ADMIN").options(selectinload(User.roles))
    result = await db.execute(stmt)
    admins = result.scalars().all()
    
    for user in admins:
        if not user.is_superuser and "ADMIN" in roles and roles["ADMIN"] not in user.roles:
            user.roles.append(roles["ADMIN"])
            print(f"  ✅ Assigned ADMIN role to {user.username}")
    
    # Update manager type users
    stmt = select(User).where(User.user_type == "MANAGER").options(selectinload(User.roles))
    result = await db.execute(stmt)
    managers = result.scalars().all()
    
    for user in managers:
        if "MANAGER" in roles and roles["MANAGER"] not in user.roles:
            user.roles.append(roles["MANAGER"])
            print(f"  ✅ Assigned MANAGER role to {user.username}")
    
    await db.commit()
    print("✅ Admin users updated with appropriate roles")


async def display_summary(db):
    """Display summary of RBAC configuration"""
    print("\n" + "="*60)
    print("📊 RBAC CONFIGURATION SUMMARY")
    print("="*60)
    
    # Count permissions
    stmt = select(Permission)
    result = await db.execute(stmt)
    permissions = result.scalars().all()
    
    # Group permissions by resource
    resources = {}
    for perm in permissions:
        if perm.resource not in resources:
            resources[perm.resource] = []
        resources[perm.resource].append(perm.action)
    
    print(f"\n📋 Total Permissions: {len(permissions)}")
    print("\nPermissions by Resource:")
    for resource, actions in sorted(resources.items()):
        print(f"  • {resource}: {len(actions)} actions ({', '.join(sorted(actions)[:5])}{'...' if len(actions) > 5 else ''})")
    
    # Count roles
    stmt = select(Role).options(selectinload(Role.permissions))
    result = await db.execute(stmt)
    roles = result.scalars().all()
    
    print(f"\n👥 Total Roles: {len(roles)}")
    print("\nRoles and Permission Counts:")
    for role in sorted(roles, key=lambda r: len(r.permissions), reverse=True):
        print(f"  • {role.name}: {len(role.permissions)} permissions")
        print(f"    Template: {role.template or 'none'}, System: {role.is_system_role}")
    
    print("\n" + "="*60)


async def main():
    """Main seeding function"""
    print("🚀 Starting Comprehensive RBAC Seeding...")
    print("="*60)
    
    # Get database session
    async for db in get_db():
        try:
            # Optional: Clear existing RBAC data (uncomment if needed)
            # await clear_existing_rbac(db)
            
            # Seed permissions and roles
            await seed_permissions(db)
            await seed_roles(db)
            await update_admin_users(db)
            
            # Display summary
            await display_summary(db)
            
            print("\n✅ Comprehensive RBAC seeding completed successfully!")
            print("\n🔐 Security Notes:")
            print("  1. Review and adjust role permissions based on your security requirements")
            print("  2. Implement audit logging for all permission changes")
            print("  3. Regularly review user role assignments")
            print("  4. Consider implementing time-based role expiration")
            print("  5. Enable multi-factor authentication for high-privilege roles")
            
        except Exception as e:
            print(f"\n❌ Error seeding RBAC data: {e}")
            await db.rollback()
            raise
        finally:
            await db.close()
            break


if __name__ == "__main__":
    asyncio.run(main())