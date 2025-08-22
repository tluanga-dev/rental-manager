/**
 * Audit and compliance API service
 */

import { apiClient } from '@/lib/api-client';
import { AuditLog, AuditLogFilter } from '@/types/auth';

export const auditApi = {
  // Audit log retrieval
  async getAuditLogs(filters?: AuditLogFilter & {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    logs: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await apiClient.get('/audit/logs', { params: filters });
    return response.data;
  },

  async getAuditLog(id: string): Promise<AuditLog> {
    const response = await api.get(`/audit/logs/${id}`);
    return response.data;
  },

  // Security events
  async getSecurityEvents(filters?: {
    startDate?: string;
    endDate?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    events: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await api.get('/audit/security-events', { params: filters });
    return response.data;
  },

  // High-risk activities
  async getHighRiskActivities(filters?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    activities: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await api.get('/audit/high-risk-activities', { params: filters });
    return response.data;
  },

  // Access logs
  async getAccessLogs(filters?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    ipAddress?: string;
    successful?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    logs: Array<{
      id: string;
      userId?: string;
      userName?: string;
      action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED';
      ipAddress?: string;
      userAgent?: string;
      successful: boolean;
      failureReason?: string;
      createdAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await api.get('/audit/access-logs', { params: filters });
    return response.data;
  },

  // Permission changes
  async getPermissionChanges(filters?: {
    userId?: string;
    targetUserId?: string;
    permissionCode?: string;
    action?: 'GRANT' | 'REVOKE';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    changes: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await api.get('/audit/permission-changes', { params: filters });
    return response.data;
  },

  // User management activities
  async getUserManagementActivities(filters?: {
    actorUserId?: string;
    targetUserId?: string;
    action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'ACTIVATE' | 'DEACTIVATE';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    activities: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await api.get('/audit/user-management', { params: filters });
    return response.data;
  },

  // Audit statistics and analytics
  async getAuditStats(period?: '24h' | '7d' | '30d' | '90d'): Promise<{
    totalEvents: number;
    securityEvents: number;
    highRiskEvents: number;
    failedLogins: number;
    permissionChanges: number;
    userChanges: number;
    topActions: Array<{ action: string; count: number }>;
    topUsers: Array<{ userId: string; userName: string; eventCount: number }>;
    eventsByDay: Array<{ date: string; count: number }>;
    riskDistribution: Record<string, number>;
  }> {
    const response = await api.get('/audit/stats', { params: { period } });
    return response.data;
  },

  // Compliance reports
  async generateComplianceReport(params: {
    startDate: string;
    endDate: string;
    includeUserAccess?: boolean;
    includePermissionChanges?: boolean;
    includeSecurityEvents?: boolean;
    format?: 'pdf' | 'excel' | 'csv';
  }): Promise<{
    reportId: string;
    downloadUrl: string;
    generatedAt: string;
    expiresAt: string;
  }> {
    const response = await api.post('/audit/compliance-report', params);
    return response.data;
  },

  async getComplianceReportStatus(reportId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    downloadUrl?: string;
    error?: string;
  }> {
    const response = await api.get(`/audit/compliance-report/${reportId}/status`);
    return response.data;
  },

  // Export audit data
  async exportAuditLogs(filters: AuditLogFilter & {
    format: 'csv' | 'excel' | 'json';
    includeMetadata?: boolean;
  }): Promise<{
    exportId: string;
    downloadUrl: string;
    expiresAt: string;
  }> {
    const response = await api.post('/audit/export', filters);
    return response.data;
  },

  // Real-time audit events (for dashboards)
  async getRecentEvents(limit = 50): Promise<AuditLog[]> {
    const response = await api.get('/audit/recent', { params: { limit } });
    return response.data;
  },

  // Audit search
  async searchAuditLogs(query: string, filters?: AuditLogFilter): Promise<{
    logs: AuditLog[];
    total: number;
    highlights: Record<string, string[]>;
  }> {
    const response = await api.get('/audit/search', { 
      params: { q: query, ...filters } 
    });
    return response.data;
  },

  // Audit alert configuration
  async getAuditAlerts(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    conditions: Record<string, any>;
    isActive: boolean;
    notificationChannels: string[];
    createdBy: string;
    createdAt: string;
  }>> {
    const response = await api.get('/audit/alerts');
    return response.data;
  },

  async createAuditAlert(alert: {
    name: string;
    description: string;
    conditions: Record<string, any>;
    notificationChannels: string[];
  }): Promise<{ id: string }> {
    const response = await api.post('/audit/alerts', alert);
    return response.data;
  },

  async updateAuditAlert(id: string, updates: {
    name?: string;
    description?: string;
    conditions?: Record<string, any>;
    isActive?: boolean;
    notificationChannels?: string[];
  }): Promise<void> {
    await api.put(`/audit/alerts/${id}`, updates);
  },

  async deleteAuditAlert(id: string): Promise<void> {
    await api.delete(`/audit/alerts/${id}`);
  },

  // User activity timeline
  async getUserActivityTimeline(userId: string, filters?: {
    startDate?: string;
    endDate?: string;
    eventTypes?: string[];
    limit?: number;
  }): Promise<{
    timeline: Array<{
      timestamp: string;
      event: AuditLog;
      relatedEvents: AuditLog[];
    }>;
    summary: {
      totalEvents: number;
      period: string;
      mostActiveDay: string;
      eventBreakdown: Record<string, number>;
    };
  }> {
    const response = await api.get(`/audit/users/${userId}/timeline`, { params: filters });
    return response.data;
  },

  // Anomaly detection
  async getAnomalies(filters?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  }): Promise<Array<{
    id: string;
    type: string;
    description: string;
    severity: string;
    userId?: string;
    userName?: string;
    detectedAt: string;
    relatedEvents: AuditLog[];
    confidence: number;
    isResolved: boolean;
  }>> {
    const response = await api.get('/audit/anomalies', { params: filters });
    return response.data;
  },

  async markAnomalyResolved(anomalyId: string, resolution: string): Promise<void> {
    await api.post(`/audit/anomalies/${anomalyId}/resolve`, { resolution });
  },
};

export default auditApi;