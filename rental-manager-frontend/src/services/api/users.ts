/**
 * User management API service
 */

import { apiClient } from '@/lib/axios';
import { 
  User, 
  CreateUserRequest, 
  UpdateUserRequest,
  UserSession,
  DirectPermissionGrant,
  AuditLog,
  AuditLogFilter
} from '@/types/auth';

export const usersApi = {
  // User CRUD operations
  // Updated to match API_REFERENCE.md
  async getUsers(params?: {
    page?: number;
    size?: number;
    search?: string;
  }): Promise<{ items: User[]; total: number; page: number; size: number; pages: number }> {
    const response = await apiClient.get('/users/', { params });
    return response.data.success ? response.data.data : response.data;
  },

  async getUser(id: string): Promise<User> {
    const response = await apiClient.get(`/users/${id}`);
    return response.data.success ? response.data.data : response.data;
  },

  async createUser(userData: CreateUserRequest): Promise<User> {
    const response = await apiClient.post('/users/', userData);
    return response.data.success ? response.data.data : response.data;
  },

  async updateUser(id: string, userData: Partial<UpdateUserRequest>): Promise<User> {
    const response = await apiClient.put(`/users/${id}`, userData);
    return response.data.success ? response.data.data : response.data;
  },

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },

  async activateUser(id: string): Promise<User> {
    const response = await apiClient.patch(`/users/${id}/status`, { is_active: true });
    return response.data.success ? response.data.data : response.data;
  },

  async deactivateUser(id: string): Promise<User> {
    const response = await apiClient.patch(`/users/${id}/status`, { is_active: false });
    return response.data.success ? response.data.data : response.data;
  },

  async resetUserPassword(id: string, newPassword: string): Promise<void> {
    await apiClient.post(`/users/${id}/reset-password`, { password: newPassword });
  },

  // User type management
  async updateUserType(id: string, userType: string): Promise<User> {
    const response = await apiClient.put(`/users/${id}`, { user_type: userType });
    return response.data.success ? response.data.data : response.data;
  },

  // Role assignment
  async assignRole(userId: string, roleId: string, reason?: string): Promise<User> {
    const response = await apiClient.post(`/users/${userId}/roles/${roleId}`, { reason });
    return response.data.success ? response.data.data : response.data;
  },

  async unassignRole(userId: string, roleId: string, reason?: string): Promise<User> {
    const response = await apiClient.delete(`/users/${userId}/roles/${roleId}`, { data: { reason } });
    return response.data.success ? response.data.data : response.data;
  },

  // Direct permission management
  async getUserDirectPermissions(userId: string): Promise<DirectPermissionGrant[]> {
    const response = await apiClient.get(`/users/${userId}/permissions`);
    return response.data.success ? response.data.data : response.data;
  },

  async grantDirectPermission(
    userId: string, 
    permissionCode: string, 
    reason?: string,
    expiresAt?: string
  ): Promise<DirectPermissionGrant> {
    const response = await apiClient.post(`/users/${userId}/permissions`, {
      permissionCode,
      reason,
      expiresAt,
    });
    return response.data.success ? response.data.data : response.data;
  },

  async revokeDirectPermission(userId: string, permissionCode: string, reason?: string): Promise<void> {
    await apiClient.delete(`/users/${userId}/permissions/${permissionCode}`, {
      data: { reason }
    });
  },

  // User sessions
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const response = await apiClient.get(`/users/${userId}/sessions`);
    return response.data.success ? response.data.data : response.data;
  },

  async terminateUserSession(userId: string, sessionId: string): Promise<void> {
    await apiClient.delete(`/users/${userId}/sessions/${sessionId}`);
  },

  async terminateAllUserSessions(userId: string): Promise<void> {
    await apiClient.delete(`/users/${userId}/sessions`);
  },

  // User impersonation (admin only)
  async impersonateUser(userId: string, reason?: string): Promise<{ accessToken: string; user: User }> {
    const response = await apiClient.post(`/users/${userId}/impersonate`, { reason });
    return response.data.success ? response.data.data : response.data;
  },

  async stopImpersonation(): Promise<{ accessToken: string; user: User }> {
    const response = await apiClient.post('/api/auth/stop-impersonation');
    return response.data.success ? response.data.data : response.data;
  },

  // User statistics and analytics
  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    usersByType: Record<string, number>;
    newUsersThisMonth: number;
    lastLoginStats: Array<{ date: string; count: number }>;
  }> {
    const response = await apiClient.get('/api/users/stats');
    return response.data.success ? response.data.data : response.data;
  },

  // Bulk operations
  async bulkUpdateUsers(userIds: string[], updates: Partial<UpdateUserRequest>): Promise<User[]> {
    const response = await apiClient.put('/api/users/bulk', { userIds, updates });
    return response.data.success ? response.data.data : response.data;
  },

  async bulkActivateUsers(userIds: string[]): Promise<User[]> {
    const response = await apiClient.post('/api/users/bulk/activate', { userIds });
    return response.data.success ? response.data.data : response.data;
  },

  async bulkDeactivateUsers(userIds: string[]): Promise<User[]> {
    const response = await apiClient.post('/api/users/bulk/deactivate', { userIds });
    return response.data.success ? response.data.data : response.data;
  },

  // User audit logs
  async getUserAuditLogs(userId: string, filters?: AuditLogFilter): Promise<{
    logs: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await apiClient.get(`/users/${userId}/audit-logs`, { params: filters });
    return response.data.success ? response.data.data : response.data;
  },

  // User permissions validation
  async validateUserPermissions(userId: string): Promise<{
    isValid: boolean;
    conflicts: Array<{ permission: string; source: string; conflict: string }>;
    suggestions: Array<{ action: string; reason: string }>;
  }> {
    const response = await apiClient.get(`/users/${userId}/validate-permissions`);
    return response.data.success ? response.data.data : response.data;
  },

  // User effective permissions
  async getUserEffectivePermissions(userId: string): Promise<{
    userType: string;
    isSuperuser: boolean;
    rolePermissions: string[];
    directPermissions: string[];
    allPermissions: string[];
    inheritedPermissions: string[];
  }> {
    const response = await apiClient.get(`/users/${userId}/effective-permissions`);
    return response.data.success ? response.data.data : response.data;
  },
};

export default usersApi;