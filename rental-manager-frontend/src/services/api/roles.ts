/**
 * Role management API service
 */

import { apiClient as api } from '@/lib/axios';
const apiClient = api; // Keep both for compatibility
import { 
  UserRole, 
  Permission,
  PermissionCategory,
  RoleHierarchy,
  RoleTree
} from '@/types/auth';

export interface CreateRoleRequest {
  name: string;
  description: string;
  template?: string;
  permissionCodes?: string[];
  parentRoleIds?: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissionCodes?: string[];
  parentRoleIds?: string[];
}

export const rolesApi = {
  // Role CRUD operations
  async getRoles(params?: {
    page?: number;
    limit?: number;
    search?: string;
    template?: string;
    includeSystem?: boolean;
  }): Promise<{ roles: UserRole[]; total: number; page: number; limit: number }> {
    const response = await apiClient.get('/users/roles/', { params });
    // Handle both response formats
    if (response.data.success) {
      return response.data.data;
    } else if (Array.isArray(response.data)) {
      // If it's a direct array, wrap it in the expected format
      return {
        roles: response.data,
        total: response.data.length,
        page: 1,
        limit: 100
      };
    } else {
      return response.data;
    }
  },

  async getRole(id: string): Promise<UserRole> {
    const response = await apiClient.get(`/security/roles/${id}`);
    return response.data.success ? response.data.data : response.data;
  },

  async createRole(roleData: CreateRoleRequest): Promise<UserRole> {
    const response = await apiClient.post('/security/roles', roleData);
    return response.data.success ? response.data.data : response.data;
  },

  async updateRole(id: string, roleData: UpdateRoleRequest): Promise<UserRole> {
    const response = await apiClient.put(`/security/roles/${id}`, roleData);
    return response.data.success ? response.data.data : response.data;
  },

  async deleteRole(id: string): Promise<void> {
    await apiClient.delete(`/security/roles/${id}`);
  },

  // Role permission management
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const response = await apiClient.get(`/security/roles/${roleId}/permissions`);
    return response.data.success ? response.data.data : response.data;
  },

  async addPermissionToRole(roleId: string, permissionCode: string): Promise<UserRole> {
    const response = await api.post(`/users/roles/${roleId}/permissions/${permissionCode}`);
    return response.data;
  },

  async removePermissionFromRole(roleId: string, permissionCode: string): Promise<UserRole> {
    const response = await api.delete(`/users/roles/${roleId}/permissions/${permissionCode}`);
    return response.data;
  },

  async setRolePermissions(roleId: string, permissionCodes: string[]): Promise<UserRole> {
    const response = await api.put(`/users/roles/${roleId}/permissions`, { permissionCodes });
    return response.data;
  },

  // Role hierarchy management
  async getRoleHierarchy(roleId?: string): Promise<RoleTree[]> {
    const response = await api.get('/users/roles/hierarchy', { 
      params: roleId ? { rootRoleId: roleId } : undefined 
    });
    return response.data;
  },

  async addParentRole(childRoleId: string, parentRoleId: string, inheritPermissions = true): Promise<RoleHierarchy> {
    const response = await api.post(`/users/roles/${childRoleId}/parents/${parentRoleId}`, { 
      inheritPermissions 
    });
    return response.data;
  },

  async removeParentRole(childRoleId: string, parentRoleId: string): Promise<void> {
    await api.delete(`/users/roles/${childRoleId}/parents/${parentRoleId}`);
  },

  async getParentRoles(roleId: string): Promise<UserRole[]> {
    const response = await api.get(`/users/roles/${roleId}/parents`);
    return response.data;
  },

  async getChildRoles(roleId: string): Promise<UserRole[]> {
    const response = await api.get(`/users/roles/${roleId}/children`);
    return response.data;
  },

  // Effective permissions (including inherited)
  async getRoleEffectivePermissions(roleId: string): Promise<Permission[]> {
    const response = await api.get(`/users/roles/${roleId}/effective-permissions`);
    return response.data;
  },

  // Role templates
  async getRoleTemplates(): Promise<Array<{ name: string; description: string; permissions: string[] }>> {
    const response = await api.get('/users/roles/templates');
    return response.data;
  },

  async createRoleFromTemplate(templateName: string, roleName: string, description?: string): Promise<UserRole> {
    const response = await api.post('/users/roles/from-template', {
      templateName,
      roleName,
      description,
    });
    return response.data;
  },

  // Role usage and statistics
  async getRoleUsage(roleId: string): Promise<{
    userCount: number;
    activeUserCount: number;
    users: Array<{ id: string; name: string; email: string; isActive: boolean }>;
  }> {
    const response = await api.get(`/users/roles/${roleId}/usage`);
    return response.data;
  },

  async getRoleStats(): Promise<{
    totalRoles: number;
    systemRoles: number;
    customRoles: number;
    mostUsedRoles: Array<{ role: UserRole; userCount: number }>;
    roleDistribution: Record<string, number>;
  }> {
    const response = await api.get('/users/roles/stats');
    return response.data;
  },

  // Role validation
  async validateRole(roleData: CreateRoleRequest | UpdateRoleRequest): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  }> {
    const response = await api.post('/users/roles/validate', roleData);
    return response.data;
  },

  // Permission dependencies
  async getPermissionDependencies(permissionCodes: string[]): Promise<{
    required: string[];
    suggested: string[];
    conflicts: Array<{ permission: string; conflictsWith: string; reason: string }>;
  }> {
    const response = await api.post('/permissions/dependencies', { permissionCodes });
    return response.data;
  },

  // Bulk operations
  async bulkUpdateRoles(roleIds: string[], updates: Partial<UpdateRoleRequest>): Promise<UserRole[]> {
    const response = await api.put('/users/roles/bulk', { roleIds, updates });
    return response.data;
  },

  async bulkDeleteRoles(roleIds: string[]): Promise<void> {
    await api.delete('/users/roles/bulk', { data: { roleIds } });
  },

  // Role comparison
  async compareRoles(roleIds: string[]): Promise<{
    roles: UserRole[];
    commonPermissions: string[];
    uniquePermissions: Record<string, string[]>;
    permissionMatrix: Record<string, Record<string, boolean>>;
  }> {
    const response = await api.post('/users/roles/compare', { roleIds });
    return response.data;
  },

  // Role assignment recommendations
  async getRecommendedRoles(userId: string): Promise<{
    recommended: Array<{ role: UserRole; score: number; reason: string }>;
    current: UserRole | null;
    alternatives: Array<{ role: UserRole; advantages: string[]; disadvantages: string[] }>;
  }> {
    const response = await api.get(`/users/roles/recommendations/${userId}`);
    return response.data;
  },
};

// Permissions API
export const permissionsApi = {
  async getAllPermissions(): Promise<Permission[]> {
    const response = await api.get('/permissions');
    return response.data;
  },

  async getPermissionsByCategory(categoryCode: string): Promise<Permission[]> {
    const response = await api.get(`/permissions/category/${categoryCode}`);
    return response.data;
  },

  async getPermissionCategories(): Promise<PermissionCategory[]> {
    const response = await api.get('/permissions/categories');
    return response.data;
  },

  async getPermissionDetails(permissionCode: string): Promise<Permission> {
    const response = await api.get(`/permissions/${permissionCode}`);
    return response.data;
  },

  async searchPermissions(query: string): Promise<Permission[]> {
    const response = await api.get('/permissions/search', { params: { q: query } });
    return response.data;
  },
};

export default rolesApi;