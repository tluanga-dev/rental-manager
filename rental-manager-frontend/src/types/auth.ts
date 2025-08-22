// Authentication and authorization types
export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  name: string;
  userType: UserType;
  role?: UserRole;
  locationId?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt?: string;
  isSuperuser: boolean;
  directPermissions: string[];
  effectivePermissions: UserPermissions;
}

// User hierarchy types
export type UserType = 'SUPERADMIN' | 'ADMIN' | 'USER' | 'CUSTOMER';

export interface UserRole {
  id: string;
  name: string;
  description: string;
  template?: string;
  isSystem: boolean;
  canBeDeleted: boolean;
  permissions: Permission[];
  parentRoles?: UserRole[];
  childRoles?: UserRole[];
  effectivePermissions?: Permission[];
}

export interface UserPermissions {
  userType: UserType;
  isSuperuser: boolean;
  rolePermissions: string[];
  directPermissions: string[];
  allPermissions: string[];
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string;
  category?: PermissionCategory;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiresApproval?: boolean;
  dependencies?: string[];
}

export interface PermissionCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  displayOrder: number;
}

// Comprehensive permission types matching backend
export type PermissionType = 
  // System Administration
  | 'SYSTEM_FULL_ACCESS'
  | 'SYSTEM_CONFIG_VIEW'
  | 'SYSTEM_CONFIG_UPDATE'
  | 'SYSTEM_MAINTENANCE'
  
  // User Management
  | 'USER_VIEW'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_ACTIVATE'
  | 'USER_DEACTIVATE'
  | 'USER_RESET_PASSWORD'
  | 'USER_IMPERSONATE'
  | 'USER_VIEW_SESSIONS'
  | 'USER_TERMINATE_SESSIONS'
  
  // Role & Permission Management
  | 'ROLE_VIEW'
  | 'ROLE_CREATE'
  | 'ROLE_UPDATE'
  | 'ROLE_DELETE'
  | 'ROLE_ASSIGN'
  | 'PERMISSION_VIEW'
  | 'PERMISSION_ASSIGN'
  | 'PERMISSION_REVOKE'
  
  // Customer Management
  | 'CUSTOMER_VIEW'
  | 'CUSTOMER_CREATE'
  | 'CUSTOMER_UPDATE'
  | 'CUSTOMER_DELETE'
  | 'CUSTOMER_VIEW_SENSITIVE'
  | 'CUSTOMER_BLACKLIST'
  | 'CUSTOMER_SET_CREDIT_LIMIT'
  | 'CUSTOMER_VIEW_HISTORY'
  
  // Inventory Management
  | 'INVENTORY_VIEW'
  | 'INVENTORY_CREATE'
  | 'INVENTORY_UPDATE'
  | 'INVENTORY_DELETE'
  | 'INVENTORY_ADJUST'
  | 'INVENTORY_TRANSFER'
  | 'INVENTORY_COUNT'
  | 'INVENTORY_VIEW_COST'
  | 'INVENTORY_SET_LOCATION'
  | 'INVENTORY_VIEW_SERIAL'
  
  // Product/SKU Management
  | 'PRODUCT_VIEW'
  | 'PRODUCT_CREATE'
  | 'PRODUCT_UPDATE'
  | 'PRODUCT_DELETE'
  | 'SKU_VIEW'
  | 'SKU_CREATE'
  | 'SKU_UPDATE'
  | 'SKU_DELETE'
  | 'SKU_SET_PRICING'
  | 'CATEGORY_VIEW'
  | 'CATEGORY_CREATE'
  | 'CATEGORY_UPDATE'
  | 'CATEGORY_DELETE'
  
  // Sales Management
  | 'SALE_VIEW'
  | 'SALE_CREATE'
  | 'SALE_UPDATE'
  | 'SALE_DELETE'
  | 'SALE_CANCEL'
  | 'SALE_APPLY_DISCOUNT'
  | 'SALE_OVERRIDE_PRICE'
  | 'SALE_VIEW_PROFIT'
  | 'SALE_PROCESS_PAYMENT'
  | 'SALE_REFUND'
  
  // Rental Management
  | 'RENTAL_VIEW'
  | 'RENTAL_CREATE'
  | 'RENTAL_UPDATE'
  | 'RENTAL_DELETE'
  | 'RENTAL_CANCEL'
  | 'RENTAL_EXTEND'
  | 'RENTAL_OVERRIDE_RATE'
  | 'RENTAL_WAIVE_FEES'
  | 'RENTAL_PROCESS_DEPOSIT'
  | 'RENTAL_RELEASE_DEPOSIT'
  | 'RENTAL_APPROVE_DAMAGE'
  
  // Purchase Management
  | 'PURCHASE_VIEW'
  | 'PURCHASE_CREATE'
  | 'PURCHASE_UPDATE'
  | 'PURCHASE_DELETE'
  | 'PURCHASE_CANCEL'
  | 'PURCHASE_APPROVE'
  | 'PURCHASE_RECEIVE'
  | 'PURCHASE_VIEW_COST'
  | 'SUPPLIER_VIEW'
  | 'SUPPLIER_CREATE'
  | 'SUPPLIER_UPDATE'
  | 'SUPPLIER_DELETE'
  
  // Returns Management
  | 'RETURN_VIEW'
  | 'RETURN_CREATE'
  | 'RETURN_UPDATE'
  | 'RETURN_DELETE'
  | 'RETURN_PROCESS'
  | 'RETURN_APPROVE'
  | 'RETURN_REJECT'
  
  // Inspection Management
  | 'INSPECTION_VIEW'
  | 'INSPECTION_CREATE'
  | 'INSPECTION_UPDATE'
  | 'INSPECTION_DELETE'
  | 'INSPECTION_APPROVE'
  | 'INSPECTION_UPLOAD_PHOTOS'
  
  // Financial Management
  | 'FINANCE_VIEW_TRANSACTIONS'
  | 'FINANCE_VIEW_REPORTS'
  | 'FINANCE_EXPORT_DATA'
  | 'FINANCE_VIEW_PROFIT_LOSS'
  | 'FINANCE_VIEW_CASH_FLOW'
  | 'FINANCE_MANAGE_TAXES'
  | 'FINANCE_PROCESS_REFUNDS'
  
  // Reports
  | 'REPORT_VIEW_BASIC'
  | 'REPORT_VIEW_ADVANCED'
  | 'REPORT_CREATE'
  | 'REPORT_EXPORT'
  | 'REPORT_SCHEDULE'
  | 'REPORT_VIEW_ANALYTICS'
  
  // Settings
  | 'SETTINGS_VIEW'
  | 'SETTINGS_UPDATE'
  | 'SETTINGS_VIEW_SECURITY'
  | 'SETTINGS_UPDATE_SECURITY'
  | 'SETTINGS_VIEW_INTEGRATIONS'
  | 'SETTINGS_MANAGE_INTEGRATIONS'
  
  // Audit
  | 'AUDIT_VIEW_LOGS'
  | 'AUDIT_EXPORT_LOGS'
  | 'AUDIT_VIEW_SECURITY_EVENTS'
  | 'AUDIT_VIEW_ACCESS_LOGS';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[];
  sessionId?: string;
  deviceId?: string;
}

// User Management Types
export interface CreateUserRequest {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  roleId?: string;
  locationId?: string;
  directPermissions?: string[];
  password: string;
}

export interface UpdateUserRequest {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  userType?: UserType;
  roleId?: string;
  locationId?: string;
  isActive?: boolean;
  directPermissions?: string[];
}

export interface UserSession {
  id: string;
  userId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActivity: string;
  isActive: boolean;
  location?: string;
}

// Permission Management Types
export interface DirectPermissionGrant {
  id: string;
  userId: string;
  permissionCode: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  reason?: string;
  isActive: boolean;
}

// Audit Types
export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, { old: any; new: any }>;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  createdAt: string;
  isSecurityEvent: boolean;
  isHighRisk: boolean;
}

export interface AuditLogFilter {
  userId?: string;
  entityType?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  securityEventsOnly?: boolean;
  highRiskOnly?: boolean;
}

// Role Hierarchy Types
export interface RoleHierarchy {
  parentRoleId: string;
  childRoleId: string;
  inheritPermissions: boolean;
  createdAt: string;
}

export interface RoleTree {
  role: UserRole;
  children: RoleTree[];
}

// Role-based menu configuration
export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  permissions: string[];
  children?: MenuItem[];
}

// User type hierarchy levels
export const USER_TYPE_HIERARCHY: Record<UserType, number> = {
  SUPERADMIN: 1,
  ADMIN: 2,
  USER: 3,
  CUSTOMER: 4,
} as const;

// Helper functions for user type hierarchy
export const canManageUserType = (managerType: UserType, targetType: UserType): boolean => {
  if (managerType === 'SUPERADMIN') return true;
  if (managerType === 'ADMIN' && (targetType === 'USER' || targetType === 'CUSTOMER')) return true;
  return false;
};

export const getUserTypeDisplayName = (userType: UserType): string => {
  const names = {
    SUPERADMIN: 'Super Administrator',
    ADMIN: 'Administrator',
    USER: 'User',
    CUSTOMER: 'Customer',
  };
  return names[userType];
};

// Enhanced role permission templates
export const ROLE_PERMISSION_TEMPLATES = {
  SUPERADMIN: [] as PermissionType[], // Gets all permissions
  ADMIN: [
    // User management
    'USER_VIEW', 'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_ACTIVATE', 'USER_DEACTIVATE',
    'USER_RESET_PASSWORD', 'USER_VIEW_SESSIONS', 'USER_TERMINATE_SESSIONS',
    
    // Role management
    'ROLE_VIEW', 'ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE', 'ROLE_ASSIGN',
    'PERMISSION_VIEW', 'PERMISSION_ASSIGN', 'PERMISSION_REVOKE',
    
    // Full operational access
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE',
    'CUSTOMER_VIEW_SENSITIVE', 'CUSTOMER_BLACKLIST', 'CUSTOMER_SET_CREDIT_LIMIT',
    'SALE_VIEW', 'SALE_CREATE', 'SALE_UPDATE', 'SALE_DELETE', 'SALE_CANCEL',
    'RENTAL_VIEW', 'RENTAL_CREATE', 'RENTAL_UPDATE', 'RENTAL_DELETE', 'RENTAL_CANCEL',
    'INVENTORY_VIEW', 'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_DELETE',
    'RETURN_VIEW', 'RETURN_CREATE', 'RETURN_PROCESS', 'RETURN_APPROVE',
    'REPORT_VIEW_BASIC', 'REPORT_VIEW_ADVANCED', 'REPORT_EXPORT',
    'SETTINGS_VIEW', 'SETTINGS_UPDATE',
  ] as PermissionType[],
  
  MANAGER: [
    // Limited user management
    'USER_VIEW', 'USER_UPDATE', 'USER_ACTIVATE', 'USER_DEACTIVATE',
    
    // Customer management
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_VIEW_HISTORY',
    
    // Sales management
    'SALE_VIEW', 'SALE_CREATE', 'SALE_UPDATE', 'SALE_CANCEL', 'SALE_APPLY_DISCOUNT',
    'SALE_PROCESS_PAYMENT',
    
    // Rental management
    'RENTAL_VIEW', 'RENTAL_CREATE', 'RENTAL_UPDATE', 'RENTAL_EXTEND',
    'RENTAL_PROCESS_DEPOSIT',
    
    // Inventory
    'INVENTORY_VIEW', 'INVENTORY_UPDATE', 'INVENTORY_ADJUST', 'INVENTORY_TRANSFER',
    
    // Reports
    'REPORT_VIEW_BASIC', 'REPORT_VIEW_ADVANCED', 'REPORT_EXPORT',
  ] as PermissionType[],
  
  STAFF: [
    // Basic permissions
    'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE',
    'SALE_VIEW', 'SALE_CREATE', 'SALE_PROCESS_PAYMENT',
    'RENTAL_VIEW', 'RENTAL_CREATE', 'RENTAL_PROCESS_DEPOSIT',
    'INVENTORY_VIEW', 'PRODUCT_VIEW', 'SKU_VIEW',
    'REPORT_VIEW_BASIC',
  ] as PermissionType[],
  
  CUSTOMER: [
    // Very limited permissions - customer portal access
    'CUSTOMER_VIEW', 'RENTAL_VIEW', 'SALE_VIEW',
  ] as PermissionType[],
  
  AUDITOR: [
    // Read-only access to audit and financial data
    'AUDIT_VIEW_LOGS', 'AUDIT_EXPORT_LOGS', 'AUDIT_VIEW_SECURITY_EVENTS',
    'AUDIT_VIEW_ACCESS_LOGS', 'FINANCE_VIEW_TRANSACTIONS', 'FINANCE_VIEW_REPORTS',
    'FINANCE_EXPORT_DATA', 'REPORT_VIEW_ADVANCED', 'USER_VIEW', 'ROLE_VIEW',
    'PERMISSION_VIEW',
  ] as PermissionType[],
  
  ACCOUNTANT: [
    // Financial management permissions
    'FINANCE_VIEW_TRANSACTIONS', 'FINANCE_VIEW_REPORTS', 'FINANCE_EXPORT_DATA',
    'FINANCE_VIEW_PROFIT_LOSS', 'FINANCE_VIEW_CASH_FLOW', 'FINANCE_MANAGE_TAXES',
    'FINANCE_PROCESS_REFUNDS', 'PURCHASE_VIEW', 'PURCHASE_VIEW_COST',
    'SALE_VIEW', 'SALE_VIEW_PROFIT', 'INVENTORY_VIEW_COST',
    'REPORT_VIEW_ADVANCED', 'REPORT_CREATE', 'REPORT_EXPORT',
  ] as PermissionType[],
} as const;

// Permission categories for UI organization
export const PERMISSION_CATEGORIES = [
  { code: 'SYSTEM', name: 'System Administration', order: 1 },
  { code: 'USER_MANAGEMENT', name: 'User Management', order: 2 },
  { code: 'ROLE_MANAGEMENT', name: 'Role Management', order: 3 },
  { code: 'CUSTOMER', name: 'Customer Management', order: 4 },
  { code: 'INVENTORY', name: 'Inventory Management', order: 5 },
  { code: 'PRODUCT', name: 'Product Management', order: 6 },
  { code: 'SALES', name: 'Sales Management', order: 7 },
  { code: 'RENTAL', name: 'Rental Management', order: 8 },
  { code: 'PURCHASE', name: 'Purchase Management', order: 9 },
  { code: 'RETURNS', name: 'Returns Management', order: 10 },
  { code: 'INSPECTION', name: 'Inspection Management', order: 11 },
  { code: 'FINANCE', name: 'Financial Management', order: 12 },
  { code: 'REPORTS', name: 'Reports & Analytics', order: 13 },
  { code: 'SETTINGS', name: 'Settings', order: 14 },
  { code: 'AUDIT', name: 'Audit & Compliance', order: 15 },
] as const;