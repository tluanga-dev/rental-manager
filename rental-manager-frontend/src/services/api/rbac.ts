import { apiClient } from '@/lib/api-client';
import {
  Role,
  Permission,
  UserRole,
  RolePermission,
  CreateRoleRequest,
  UpdateRoleRequest,
  CreatePermissionRequest,
  UpdatePermissionRequest,
  AssignRoleRequest,
  AssignPermissionToRoleRequest,
  RemovePermissionFromRoleRequest,
  RoleFilters,
  PermissionFilters,
  UserRoleFilters,
  RBACStats,
  UserPermissionsSummary,
  BulkRoleOperation,
  BulkPermissionOperation,
  BulkUserRoleOperation,
  RBACEventLog
} from '@/types/rbac';

// Roles API
export const rolesApi = {
  // Get all roles with filtering and pagination
  list: async (filters?: RoleFilters & { page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await apiClient.get(`/auth/roles?${params.toString()}`);
    return response.data;
  },

  // Get role by ID with permissions
  getById: async (id: string): Promise<Role> => {
    const response = await apiClient.get(`/auth/roles/${id}`);
    return response.data;
  },

  // Create new role
  create: async (data: CreateRoleRequest): Promise<Role> => {
    const response = await apiClient.post('/auth/roles', data);
    return response.data;
  },

  // Update role
  update: async (id: string, data: UpdateRoleRequest): Promise<Role> => {
    const response = await apiClient.put(`/auth/roles/${id}`, data);
    return response.data;
  },

  // Delete role
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/auth/roles/${id}`);
  },

  // Get role permissions
  getPermissions: async (id: string): Promise<Permission[]> => {
    const response = await apiClient.get(`/auth/roles/${id}/permissions`);
    return response.data;
  },

  // Assign permissions to role
  assignPermissions: async (data: AssignPermissionToRoleRequest): Promise<void> => {
    await apiClient.post(`/auth/roles/${data.role_id}/permissions`, {
      permission_ids: data.permission_ids
    });
  },

  // Remove permissions from role
  removePermissions: async (data: RemovePermissionFromRoleRequest): Promise<void> => {
    await apiClient.delete(`/auth/roles/${data.role_id}/permissions`, {
      data: { permission_ids: data.permission_ids }
    });
  },

  // Get users assigned to role
  getUsers: async (id: string): Promise<UserRole[]> => {
    const response = await apiClient.get(`/auth/roles/${id}/users`);
    return response.data;
  },

  // Bulk operations on roles
  bulkOperation: async (operation: BulkRoleOperation): Promise<void> => {
    await apiClient.post('/api/auth/roles/bulk', operation);
  },

  // Clone role
  clone: async (id: string, name: string): Promise<Role> => {
    const response = await apiClient.post(`/auth/roles/${id}/clone`, { name });
    return response.data;
  },

  // Get role templates
  getTemplates: async (): Promise<string[]> => {
    const response = await apiClient.get('/api/auth/roles/templates');
    return response.data;
  }
};

// Permissions API
export const permissionsApi = {
  // Get all permissions with filtering and pagination
  list: async (filters?: PermissionFilters & { page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await apiClient.get(`/auth/permissions?${params.toString()}`);
    return response.data;
  },

  // Get permission by ID
  getById: async (id: string): Promise<Permission> => {
    const response = await apiClient.get(`/auth/permissions/${id}`);
    return response.data;
  },

  // Create new permission
  create: async (data: CreatePermissionRequest): Promise<Permission> => {
    const response = await apiClient.post('/api/auth/permissions', data);
    return response.data;
  },

  // Update permission
  update: async (id: string, data: UpdatePermissionRequest): Promise<Permission> => {
    const response = await apiClient.put(`/auth/permissions/${id}`, data);
    return response.data;
  },

  // Delete permission
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/auth/permissions/${id}`);
  },

  // Get roles that have this permission
  getRoles: async (id: string): Promise<Role[]> => {
    const response = await apiClient.get(`/auth/permissions/${id}/roles`);
    return response.data;
  },

  // Bulk operations on permissions
  bulkOperation: async (operation: BulkPermissionOperation): Promise<void> => {
    await apiClient.post('/api/auth/permissions/bulk', operation);
  },

  // Get available resources
  getResources: async (): Promise<string[]> => {
    const response = await apiClient.get('/api/auth/permissions/resources');
    return response.data;
  },

  // Get available actions for a resource
  getActions: async (resource?: string): Promise<string[]> => {
    const params = resource ? `?resource=${resource}` : '';
    const response = await apiClient.get(`/auth/permissions/actions${params}`);
    return response.data;
  }
};

// User Roles API
export const userRolesApi = {
  // Get all user role assignments with filtering and pagination
  list: async (filters?: UserRoleFilters & { page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await apiClient.get(`/auth/user-roles?${params.toString()}`);
    return response.data;
  },

  // Get user role assignment by ID
  getById: async (id: string): Promise<UserRole> => {
    const response = await apiClient.get(`/auth/user-roles/${id}`);
    return response.data;
  },

  // Assign role to user
  assign: async (data: AssignRoleRequest): Promise<UserRole> => {
    const response = await apiClient.post('/api/auth/user-roles', data);
    return response.data;
  },

  // Revoke role from user
  revoke: async (id: string): Promise<void> => {
    await apiClient.delete(`/auth/user-roles/${id}`);
  },

  // Update user role assignment (e.g., extend expiration)
  update: async (id: string, data: { expires_at?: string; is_active?: boolean }): Promise<UserRole> => {
    const response = await apiClient.put(`/auth/user-roles/${id}`, data);
    return response.data;
  },

  // Get user's roles
  getUserRoles: async (userId: string): Promise<UserRole[]> => {
    const response = await apiClient.get(`/api/users/${userId}/roles`);
    return response.data;
  },

  // Get user's effective permissions
  getUserPermissions: async (userId: string): Promise<UserPermissionsSummary> => {
    const response = await apiClient.get(`/api/users/${userId}/permissions`);
    return response.data;
  },

  // Bulk operations on user roles
  bulkOperation: async (operation: BulkUserRoleOperation): Promise<void> => {
    await apiClient.post('/api/auth/user-roles/bulk', operation);
  },

  // Check if user has specific permission
  checkPermission: async (userId: string, permission: string): Promise<boolean> => {
    const response = await apiClient.get(`/api/users/${userId}/check-permission/${permission}`);
    return response.data.has_permission;
  },

  // Check if user has specific role
  checkRole: async (userId: string, roleId: string): Promise<boolean> => {
    const response = await apiClient.get(`/api/users/${userId}/check-role/${roleId}`);
    return response.data.has_role;
  }
};

// RBAC Analytics and Statistics API
export const rbacAnalyticsApi = {
  // Get overall RBAC statistics
  getStats: async (): Promise<RBACStats> => {
    const response = await apiClient.get('/api/auth/rbac/stats');
    return response.data;
  },

  // Get role usage analytics
  getRoleAnalytics: async (roleId?: string) => {
    const params = roleId ? `?role_id=${roleId}` : '';
    const response = await apiClient.get(`/auth/rbac/role-analytics${params}`);
    return response.data;
  },

  // Get permission usage analytics
  getPermissionAnalytics: async (permissionId?: string) => {
    const params = permissionId ? `?permission_id=${permissionId}` : '';
    const response = await apiClient.get(`/auth/rbac/permission-analytics${params}`);
    return response.data;
  },

  // Get user permissions distribution
  getUserPermissionsDistribution: async () => {
    const response = await apiClient.get('/api/auth/rbac/user-permissions-distribution');
    return response.data;
  },

  // Get risk level analysis
  getRiskAnalysis: async () => {
    const response = await apiClient.get('/api/auth/rbac/risk-analysis');
    return response.data;
  },

  // Get audit trail
  getAuditTrail: async (filters?: {
    entity_type?: string;
    entity_id?: string;
    user_id?: string;
    event_type?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: RBACEventLog[], total: number }> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await apiClient.get(`/auth/rbac/audit-trail?${params.toString()}`);
    return response.data;
  }
};

// RBAC Validation API
export const rbacValidationApi = {
  // Validate role name availability
  validateRoleName: async (name: string, excludeId?: string): Promise<{ available: boolean; suggestions?: string[] }> => {
    const params = new URLSearchParams({ name });
    if (excludeId) params.append('exclude_id', excludeId);
    
    const response = await apiClient.get(`/auth/roles/validate-name?${params.toString()}`);
    return response.data;
  },

  // Validate permission name availability
  validatePermissionName: async (name: string, excludeId?: string): Promise<{ available: boolean; suggestions?: string[] }> => {
    const params = new URLSearchParams({ name });
    if (excludeId) params.append('exclude_id', excludeId);
    
    const response = await apiClient.get(`/auth/permissions/validate-name?${params.toString()}`);
    return response.data;
  },

  // Check role deletion impact
  checkRoleDeletionImpact: async (roleId: string): Promise<{
    can_delete: boolean;
    user_count: number;
    affected_users: Array<{ id: string; username: string; email: string }>;
    system_role: boolean;
    warnings: string[];
  }> => {
    const response = await apiClient.get(`/auth/roles/${roleId}/deletion-impact`);
    return response.data;
  },

  // Check permission deletion impact
  checkPermissionDeletionImpact: async (permissionId: string): Promise<{
    can_delete: boolean;
    role_count: number;
    affected_roles: Array<{ id: string; name: string; user_count: number }>;
    warnings: string[];
  }> => {
    const response = await apiClient.get(`/auth/permissions/${permissionId}/deletion-impact`);
    return response.data;
  }
};

// Export all APIs as a single object for convenience
export const rbacApi = {
  roles: rolesApi,
  permissions: permissionsApi,
  userRoles: userRolesApi,
  analytics: rbacAnalyticsApi,
  validation: rbacValidationApi
};