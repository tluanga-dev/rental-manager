// RBAC (Role-Based Access Control) Types and Interfaces

export interface Permission {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  template?: string;
  is_system: boolean;
  can_be_deleted: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  permissions?: Permission[];
  permission_count?: number;
  user_count?: number;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string;
  assigned_at: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role?: Role;
  user?: {
    id: string;
    username: string;
    email: string;
    full_name: string;
  };
  assigned_by_user?: {
    id: string;
    username: string;
    full_name: string;
  };
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  granted_by: string;
  granted_at: string;
  created_at: string;
  updated_at: string;
  permission?: Permission;
  role?: Role;
}

// API Request/Response Types
export interface CreateRoleRequest {
  name: string;
  description?: string;
  template?: string;
  permission_ids?: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  template?: string;
  is_active?: boolean;
}

export interface CreatePermissionRequest {
  name: string;
  description?: string;
  resource: string;
  action: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface UpdatePermissionRequest {
  name?: string;
  description?: string;
  resource?: string;
  action?: string;
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_active?: boolean;
}

export interface AssignRoleRequest {
  user_id: string;
  role_id: string;
  expires_at?: string;
}

export interface AssignPermissionToRoleRequest {
  role_id: string;
  permission_ids: string[];
}

export interface RemovePermissionFromRoleRequest {
  role_id: string;
  permission_ids: string[];
}

// Filter and Search Types
export interface RoleFilters {
  search?: string;
  is_active?: boolean;
  is_system?: boolean;
  can_be_deleted?: boolean;
  template?: string;
  has_permissions?: boolean;
  has_users?: boolean;
  created_after?: string;
  created_before?: string;
}

export interface PermissionFilters {
  search?: string;
  resource?: string;
  action?: string;
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_active?: boolean;
  assigned_to_role?: string;
  not_assigned_to_role?: string;
  created_after?: string;
  created_before?: string;
}

export interface UserRoleFilters {
  search?: string;
  user_id?: string;
  role_id?: string;
  assigned_by?: string;
  is_active?: boolean;
  expires_after?: string;
  expires_before?: string;
  assigned_after?: string;
  assigned_before?: string;
}

// Analytics and Statistics Types
export interface RBACStats {
  total_roles: number;
  active_roles: number;
  system_roles: number;
  custom_roles: number;
  total_permissions: number;
  active_permissions: number;
  total_user_roles: number;
  active_user_roles: number;
  expired_user_roles: number;
  permissions_by_risk_level: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
  roles_by_template: Record<string, number>;
  permissions_by_resource: Record<string, number>;
  top_assigned_roles: Array<{
    role_id: string;
    role_name: string;
    user_count: number;
  }>;
  recently_created_roles: Role[];
  recently_assigned_roles: UserRole[];
}

export interface UserPermissionsSummary {
  user_id: string;
  total_permissions: number;
  direct_permissions: Permission[];
  role_permissions: Array<{
    role: Role;
    permissions: Permission[];
  }>;
  effective_permissions: Permission[];
  risk_summary: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
}

// UI Component Props Types
export interface RoleFormData {
  name: string;
  description: string;
  template: string;
  permission_ids: string[];
}

export interface PermissionFormData {
  name: string;
  description: string;
  resource: string;
  action: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface UserRoleAssignmentData {
  user_id: string;
  role_ids: string[];
  expires_at?: string;
}

// Bulk Operations Types
export interface BulkRoleOperation {
  operation: 'activate' | 'deactivate' | 'delete';
  role_ids: string[];
  confirmation_required?: boolean;
}

export interface BulkPermissionOperation {
  operation: 'activate' | 'deactivate' | 'delete' | 'change_risk_level';
  permission_ids: string[];
  new_risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confirmation_required?: boolean;
}

export interface BulkUserRoleOperation {
  operation: 'assign' | 'revoke' | 'extend' | 'activate' | 'deactivate';
  user_role_ids?: string[];
  user_ids?: string[];
  role_ids?: string[];
  new_expires_at?: string;
  confirmation_required?: boolean;
}

// Validation and Business Rules Types
export interface RoleValidationRules {
  name_min_length: number;
  name_max_length: number;
  description_max_length: number;
  max_permissions_per_role: number;
  required_fields: string[];
  forbidden_names: string[];
}

export interface PermissionValidationRules {
  name_min_length: number;
  name_max_length: number;
  description_max_length: number;
  valid_resources: string[];
  valid_actions: string[];
  required_fields: string[];
  name_pattern: string;
}

// Audit and History Types
export interface RBACEventLog {
  id: string;
  event_type: 'ROLE_CREATED' | 'ROLE_UPDATED' | 'ROLE_DELETED' | 
              'PERMISSION_CREATED' | 'PERMISSION_UPDATED' | 'PERMISSION_DELETED' |
              'ROLE_ASSIGNED' | 'ROLE_REVOKED' | 'PERMISSION_GRANTED' | 'PERMISSION_REVOKED';
  entity_type: 'ROLE' | 'PERMISSION' | 'USER_ROLE' | 'ROLE_PERMISSION';
  entity_id: string;
  entity_name?: string;
  user_id: string;
  user_name: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Error Types
export interface RBACError {
  code: string;
  message: string;
  details?: Record<string, any>;
  field?: string;
}

// Export utility types
export type RiskLevel = Permission['risk_level'];
export type RoleTemplate = string;
export type ResourceType = string;
export type ActionType = string;

// Constants
export const RISK_LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const RISK_LEVEL_COLORS = {
  LOW: 'text-green-600 bg-green-50',
  MEDIUM: 'text-yellow-600 bg-yellow-50',
  HIGH: 'text-orange-600 bg-orange-50',
  CRITICAL: 'text-red-600 bg-red-50'
} as const;

export const RISK_LEVEL_DESCRIPTIONS = {
  LOW: 'Basic operations with minimal security impact',
  MEDIUM: 'Standard operations that may affect user data',
  HIGH: 'Sensitive operations that can impact system security',
  CRITICAL: 'Critical operations that can compromise system integrity'
} as const;