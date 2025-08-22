/**
 * Database Management API Service
 * Handles database operations like reset, backup, and monitoring
 */

import { apiClient } from '@/lib/axios';

export interface DatabaseStatus {
  connected: boolean;
  tables: number;
  total_records: number;
  size_mb: number;
  last_backup?: string;
  uptime?: string;
}

export interface ResetProgress {
  status: 'idle' | 'starting' | 'clearing' | 'initializing' | 'completed' | 'error';
  current_step: string;
  progress: number;
  message: string;
  details?: string[];
  timestamp: string;
}

export interface DatabaseLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: any;
}

export interface TableInfo {
  name: string;
  record_count: number;
  size_kb: number;
  last_modified?: string;
}

export const databaseManagementApi = {
  // Get current database status
  getStatus: async (): Promise<DatabaseStatus> => {
    try {
      const response = await apiClient.get('/admin/database/status');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch database status:', error);
      // Return disconnected status on error
      return {
        connected: false,
        tables: 0,
        total_records: 0,
        size_mb: 0
      };
    }
  },

  // Get list of all tables with counts
  getTables: async (): Promise<TableInfo[]> => {
    try {
      const response = await apiClient.get('/admin/database/tables');
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch tables:', error);
      // Return empty array on error
      return [];
    }
  },

  // Initiate database reset
  resetDatabase: async (options: {
    confirm: string;
    seed_master_data?: boolean;
    clear_auth?: boolean;
  }) => {
    const response = await apiClient.post('/admin/database/reset', options);
    return response.data;
  },

  // Get reset progress (for polling)
  getResetProgress: async (): Promise<ResetProgress> => {
    const response = await apiClient.get('/admin/database/reset/progress');
    return response.data;
  },

  // Get database logs
  getLogs: async (limit: number = 100): Promise<DatabaseLog[]> => {
    try {
      const response = await apiClient.get(`/admin/database/logs?limit=${limit}`);
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      // Return empty array on error
      return [];
    }
  },

  // Clear specific tables
  clearTables: async (tables: string[]) => {
    const response = await apiClient.post('/admin/database/clear-tables', { tables });
    return response.data;
  },

  // Backup database
  backupDatabase: async () => {
    const response = await apiClient.post('/admin/database/backup');
    return response.data;
  },

  // Test database connection
  testConnection: async () => {
    const response = await apiClient.get('/admin/database/test-connection');
    return response.data;
  },

  // Get real-time statistics
  getStatistics: async () => {
    const response = await apiClient.get('/admin/database/statistics');
    return response.data;
  }
};