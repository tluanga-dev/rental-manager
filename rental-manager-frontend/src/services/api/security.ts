/**
 * Security Management API Service
 */

import { apiClient } from '@/lib/axios';

// Types
export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_system_permission: boolean;
  usage_count?: number;
  created_at: string;
  updated_at: string;
}

export interface PermissionCategory {
  name: string;
  description: string;
  resource: string;
  permissions: Permission[];
  total_permissions: number;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  is_system_role: boolean;
  permissions: string[];
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface RoleWithPermissions extends Role {
  permission_details: Permission[];
}

export interface RoleTemplate {
  name: string;
  description: string;
  category: string;
  permissions: string[];
  recommended_for: string[];
}

export interface SecurityStats {
  total_users: number;
  total_roles: number;
  total_permissions: number;
  active_sessions: number;
  failed_login_attempts_today: number;
  security_score: number;
  most_used_roles: Array<{
    role: string;
    user_count: number;
  }>;
  recent_security_events: Array<{
    timestamp: string;
    user: string;
    action: string;
    resource: string;
    success: boolean;
  }>;
  permission_coverage: Record<string, number>;
  role_distribution: Record<string, number>;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  action: string;
  resource: string;
  resource_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string;
}

export interface UserSecurityInfo {
  user_id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  effective_permissions: string[];
  last_login?: string;
  failed_login_attempts: number;
  is_locked: boolean;
  two_factor_enabled: boolean;
  active_sessions: number;
}

export interface CreateRoleRequest {
  name: string;
  description: string;
  permissions: string[];
  is_system_role?: boolean;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: string[];
  is_active?: boolean;
}

export interface BulkRoleAssignment {
  user_ids: string[];
  role_ids: string[];
  action: 'add' | 'remove' | 'replace';
}

export interface PermissionCheckRequest {
  user_id: string;
  permissions: string[];
  resource?: string;
}

export interface PermissionCheckResponse {
  user_id: string;
  has_all_permissions: boolean;
  permissions_status: Record<string, boolean>;
  missing_permissions: string[];
  effective_roles: string[];
}

// API Service
export const securityApi = {
  // Security Statistics
  async getStats(): Promise<SecurityStats> {
    const response = await apiClient.get('/security/stats');
    return response.data;
  },

  // Permissions
  async getAllPermissions(): Promise<Permission[]> {
    const response = await apiClient.get('/security/permissions');
    return response.data;
  },

  async getPermissionCategories(): Promise<PermissionCategory[]> {
    const response = await apiClient.get('/security/permissions/categories');
    return response.data;
  },

  async checkUserPermissions(request: PermissionCheckRequest): Promise<PermissionCheckResponse> {
    const response = await apiClient.post('/security/permissions/check', request);
    return response.data;
  },

  // Roles
  async getAllRoles(includeSystem = true): Promise<Role[]> {
    const response = await apiClient.get('/security/roles', {
      params: { include_system: includeSystem }
    });
    return response.data;
  },

  async getRoleById(roleId: string): Promise<RoleWithPermissions> {
    const response = await apiClient.get(`/security/roles/${roleId}`);
    return response.data;
  },

  async getRoleTemplates(): Promise<RoleTemplate[]> {
    const response = await apiClient.get('/security/roles/templates');
    return response.data;
  },

  async createRole(data: CreateRoleRequest): Promise<Role> {
    const response = await apiClient.post('/security/roles', data);
    return response.data;
  },

  async updateRole(roleId: string, data: UpdateRoleRequest): Promise<Role> {
    const response = await apiClient.put(`/security/roles/${roleId}`, data);
    return response.data;
  },

  async deleteRole(roleId: string): Promise<void> {
    await apiClient.delete(`/security/roles/${roleId}`);
  },

  async bulkAssignRoles(assignment: BulkRoleAssignment): Promise<void> {
    await apiClient.post('/security/roles/bulk-assign', assignment);
  },

  // Audit Logs
  async getAuditLogs(params?: {
    limit?: number;
    user_id?: string;
    action?: string;
    resource?: string;
    success_only?: boolean;
  }): Promise<SecurityAuditLog[]> {
    const response = await apiClient.get('/security/audit-logs', { params });
    return response.data;
  },

  // User Security
  async getUserSecurityInfo(userId: string): Promise<UserSecurityInfo> {
    const response = await apiClient.get(`/security/users/${userId}/security`);
    return response.data;
  },

  // Helper functions
  getRiskLevelColor(level: string): string {
    switch (level) {
      case 'LOW':
        return 'text-green-600 bg-green-100';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-100';
      case 'HIGH':
        return 'text-orange-600 bg-orange-100';
      case 'CRITICAL':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  },

  getActionIcon(action: string): string {
    const actionIcons: Record<string, string> = {
      'view': '👁️',
      'create': '➕',
      'update': '✏️',
      'delete': '🗑️',
      'config': '⚙️',
      'manage': '🔧',
    };
    return actionIcons[action.toLowerCase()] || '📋';
  },

  getResourceIcon(resource: string): string {
    const resourceIcons: Record<string, string> = {
      'users': '👥',
      'roles': '🎭',
      'customers': '🛍️',
      'suppliers': '📦',
      'inventory': '📊',
      'rentals': '🔄',
      'transactions': '💰',
      'master_data': '📚',
      'analytics': '📈',
      'reports': '📑',
      'system': '💻',
      'audit': '🔍',
      'backup': '💾',
    };
    return resourceIcons[resource.toLowerCase()] || '📁';
  },
};

export default securityApi;