import { apiClient } from '@/lib/api-client';
import type {
  SystemSetting,
  CompanyInfo,
  SystemBackup,
  AuditLog,
  SystemInfo,
  CurrencyConfig,
  SupportedCurrency,
  SettingValueRequest,
  SettingValueResponse,
  CreateBackupRequest,
  UpdateCompanyRequest,
  CurrencyUpdateRequest,
  SystemMaintenanceResponse,
  SystemSettingsFilters,
  BackupFilters,
  AuditLogFilters,
  SettingCategory,
} from '@/types/system';

/**
 * System API Service
 * Implements all endpoints from SystemModuleImplementation160125.md
 */
export const systemApi = {
  // ============= SETTINGS MANAGEMENT =============

  /**
   * Get all system settings with optional filtering
   */
  getSettings: async (filters?: SystemSettingsFilters): Promise<SystemSetting[]> => {
    const params = new URLSearchParams();
    
    if (filters?.category) {
      params.append('category', filters.category);
    }
    if (filters?.include_system !== undefined) {
      params.append('include_system', filters.include_system.toString());
    }

    const response = await apiClient.get<SystemSetting[]>(`/system/settings?${params}`);
    return (response.data as any)?.data || response.data;
  },

  /**
   * Get setting by key
   */
  getSettingByKey: async (settingKey: string): Promise<SystemSetting> => {
    const response = await apiClient.get<SystemSetting>(`/system/settings/${settingKey}`);
    return (response.data as any)?.data || response.data;
  },

  /**
   * Get setting value only
   */
  getSettingValue: async (settingKey: string): Promise<SettingValueResponse> => {
    const response = await apiClient.get<SettingValueResponse>(`/system/settings/${settingKey}/value`);
    return (response.data as any)?.data || response.data;
  },

  /**
   * Update setting value
   */
  updateSetting: async (
    settingKey: string,
    value: string,
    updatedBy: string
  ): Promise<SystemSetting> => {
    const response = await apiClient.put<SystemSetting>(
      `/system/settings/${settingKey}?updated_by=${updatedBy}`,
      { setting_value: value }
    );
    return (response.data as any)?.data || response.data;
  },

  /**
   * Reset setting to default value
   */
  resetSetting: async (settingKey: string, updatedBy: string): Promise<SystemSetting> => {
    const response = await apiClient.post<SystemSetting>(
      `/system/settings/${settingKey}/reset?updated_by=${updatedBy}`
    );
    return (response.data as any)?.data || response.data;
  },

  /**
   * Get settings by category
   */
  getSettingsByCategory: async (category: SettingCategory): Promise<SystemSetting[]> => {
    const response = await apiClient.get<SystemSetting[]>(`/system/settings/categories/${category}`);
    return (response.data as any)?.data || response.data;
  },

  // ============= COMPANY INFORMATION =============

  /**
   * Get company information
   */
  getCompanyInfo: async (): Promise<CompanyInfo> => {
    const response = await apiClient.get<CompanyInfo>('/system/company');
    return (response.data as any)?.data || response.data;
  },

  /**
   * Update company information
   */
  updateCompanyInfo: async (
    data: UpdateCompanyRequest,
    updatedBy: string
  ): Promise<CompanyInfo> => {
    try {
      console.log('📡 API: Starting company info update...', {
        originalData: data,
        updatedBy,
        timestamp: new Date().toISOString()
      });

      // Enhanced data filtering - remove empty strings and null values
      const filteredData: UpdateCompanyRequest = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          filteredData[key as keyof UpdateCompanyRequest] = value;
        }
      });
      
      console.log('📦 API: Filtered data to send:', filteredData);
      
      // Validate required fields
      if (!filteredData.company_name || filteredData.company_name.trim() === '') {
        throw new Error('Company name is required');
      }
      
      // Validate email format if provided
      if (filteredData.company_email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(filteredData.company_email)) {
          throw new Error('Invalid email format');
        }
      }
      
      console.log('📮 API: Making PUT request to /system/company...');
      
      const response = await apiClient.put<CompanyInfo>(
        `/system/company?updated_by=${encodeURIComponent(updatedBy)}`,
        filteredData
      );
      
      console.log('✅ API: Company info update successful', {
        response: response.data,
        status: response.status,
        timestamp: new Date().toISOString()
      });
      
      // Handle different response formats from backend
      const result = (response.data as any)?.data || response.data;
      
      console.log('📋 API: Processed result:', result);
      return result;
      
    } catch (error: any) {
      console.error('❌ API: Company info update failed', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config,
        timestamp: new Date().toISOString()
      });
      
      // Enhanced error handling
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        if (status === 404) {
          throw new Error('Company settings endpoint not found');
        } else if (status === 401) {
          throw new Error('Authentication required');
        } else if (status === 403) {
          throw new Error('Permission denied');
        } else if (status === 422) {
          const validationMessage = errorData?.message || 'Validation failed';
          throw new Error(validationMessage);
        } else if (status >= 500) {
          throw new Error('Server error occurred');
        }
      }
      
      // Network or other errors
      if (error.code === 'NETWORK_ERROR') {
        throw new Error('Network connection failed');
      }
      
      throw error;
    }
  },

  // ============= BACKUP MANAGEMENT =============

  /**
   * Create new backup
   */
  createBackup: async (data: CreateBackupRequest, startedBy: string): Promise<SystemBackup> => {
    const response = await apiClient.post<SystemBackup>(
      `/system/backups?started_by=${startedBy}`,
      data
    );
    return (response.data as any)?.data || response.data;
  },

  /**
   * Get all backups with filtering
   */
  getBackups: async (filters?: BackupFilters): Promise<SystemBackup[]> => {
    const params = new URLSearchParams();
    
    if (filters?.skip !== undefined) {
      params.append('skip', filters.skip.toString());
    }
    if (filters?.limit !== undefined) {
      params.append('limit', filters.limit.toString());
    }
    if (filters?.backup_type) {
      params.append('backup_type', filters.backup_type);
    }
    if (filters?.backup_status) {
      params.append('backup_status', filters.backup_status);
    }
    if (filters?.started_by) {
      params.append('started_by', filters.started_by);
    }

    const response = await apiClient.get<SystemBackup[]>(`/system/backups?${params}`);
    return (response.data as any)?.data || response.data;
  },

  /**
   * Get backup by ID
   */
  getBackupById: async (backupId: string): Promise<SystemBackup> => {
    const response = await apiClient.get<SystemBackup>(`/system/backups/${backupId}`);
    return (response.data as any)?.data || response.data;
  },

  /**
   * Start backup
   */
  startBackup: async (backupId: string): Promise<SystemBackup> => {
    const response = await apiClient.post<SystemBackup>(`/system/backups/${backupId}/start`);
    return (response.data as any)?.data || response.data;
  },

  /**
   * Complete backup
   */
  completeBackup: async (
    backupId: string,
    backupPath: string,
    backupSize: number
  ): Promise<SystemBackup> => {
    const response = await apiClient.post<SystemBackup>(
      `/system/backups/${backupId}/complete?backup_path=${backupPath}&backup_size=${backupSize}`
    );
    return (response.data as any)?.data || response.data;
  },

  /**
   * Fail backup
   */
  failBackup: async (backupId: string, errorMessage: string): Promise<SystemBackup> => {
    const response = await apiClient.post<SystemBackup>(
      `/system/backups/${backupId}/fail?error_message=${errorMessage}`
    );
    return (response.data as any)?.data || response.data;
  },

  // ============= AUDIT LOGS =============

  /**
   * Get audit logs with filtering
   */
  getAuditLogs: async (filters?: AuditLogFilters): Promise<AuditLog[]> => {
    const params = new URLSearchParams();
    
    if (filters?.skip !== undefined) {
      params.append('skip', filters.skip.toString());
    }
    if (filters?.limit !== undefined) {
      params.append('limit', filters.limit.toString());
    }
    if (filters?.user_id) {
      params.append('user_id', filters.user_id);
    }
    if (filters?.action) {
      params.append('action', filters.action);
    }
    if (filters?.entity_type) {
      params.append('entity_type', filters.entity_type);
    }
    if (filters?.entity_id) {
      params.append('entity_id', filters.entity_id);
    }
    if (filters?.success !== undefined) {
      params.append('success', filters.success.toString());
    }
    if (filters?.start_date) {
      params.append('start_date', filters.start_date);
    }
    if (filters?.end_date) {
      params.append('end_date', filters.end_date);
    }

    const response = await apiClient.get<AuditLog[]>(`/system/audit-logs?${params}`);
    return (response.data as any)?.data || response.data;
  },

  /**
   * Get audit log by ID
   */
  getAuditLogById: async (auditLogId: string): Promise<AuditLog> => {
    const response = await apiClient.get<AuditLog>(`/system/audit-logs/${auditLogId}`);
    return (response.data as any)?.data || response.data;
  },

  // ============= SYSTEM INFO & MAINTENANCE =============

  /**
   * Get system information
   */
  getSystemInfo: async (): Promise<SystemInfo> => {
    const response = await apiClient.get<SystemInfo>('/system/info');
    return (response.data as any)?.data || response.data;
  },

  /**
   * Perform system maintenance
   */
  performMaintenance: async (userId: string): Promise<SystemMaintenanceResponse> => {
    const response = await apiClient.post<SystemMaintenanceResponse>(
      `/system/maintenance?user_id=${userId}`
    );
    return (response.data as any)?.data || response.data;
  },

  // ============= CURRENCY MANAGEMENT =============

  /**
   * Get current currency configuration
   */
  getCurrentCurrency: async (): Promise<CurrencyConfig> => {
    const response = await apiClient.get<CurrencyConfig>('/system/currency');
    return (response.data as any)?.data || response.data;
  },

  /**
   * Update currency configuration
   */
  updateCurrency: async (data: CurrencyUpdateRequest): Promise<CurrencyConfig> => {
    const response = await apiClient.put<CurrencyConfig>('/system/currency', data);
    return (response.data as any)?.data || response.data;
  },

  /**
   * Get supported currencies
   */
  getSupportedCurrencies: async (): Promise<SupportedCurrency[]> => {
    const response = await apiClient.get<SupportedCurrency[]>('/system/currency/supported');
    return (response.data as any)?.data || response.data;
  },

  // ============= RENTAL STATUS SETTINGS =============

  /**
   * Get rental status settings
   */
  getRentalStatusSettings: async (): Promise<{
    rental_status_check_enabled: string;
    rental_status_check_time: string;
    rental_status_log_retention_days: string;
    task_scheduler_timezone: string;
  }> => {
    const rentalSettings = await systemApi.getSettingsByCategory('RENTAL');
    const settings = {
      rental_status_check_enabled: 'false',
      rental_status_check_time: '00:00',
      rental_status_log_retention_days: '365',
      task_scheduler_timezone: 'UTC'
    };

    rentalSettings.forEach(setting => {
      if (setting.setting_key in settings) {
        (settings as any)[setting.setting_key] = setting.setting_value;
      }
    });

    return settings;
  },

  /**
   * Update rental status settings
   */
  updateRentalStatusSettings: async (
    settings: {
      enabled: boolean;
      checkTime: string;
      retentionDays: number;
      timezone: string;
    },
    updatedBy: string
  ): Promise<void> => {
    const updates = [
      {
        setting_key: 'rental_status_check_enabled',
        setting_value: settings.enabled ? 'true' : 'false'
      },
      {
        setting_key: 'rental_status_check_time',
        setting_value: settings.checkTime
      },
      {
        setting_key: 'rental_status_log_retention_days',
        setting_value: settings.retentionDays.toString()
      },
      {
        setting_key: 'task_scheduler_timezone',
        setting_value: settings.timezone
      }
    ];

    // Update each setting
    for (const update of updates) {
      await systemApi.updateSetting(update.setting_key, update.setting_value, updatedBy);
    }
  },

  /**
   * Get available timezones for rental status scheduling
   */
  getAvailableTimezones: (): Array<{ value: string; label: string }> => {
    return [
      { value: 'UTC', label: 'UTC' },
      { value: 'America/New_York', label: 'Eastern Time (UTC-5/-4)' },
      { value: 'America/Chicago', label: 'Central Time (UTC-6/-5)' },
      { value: 'America/Denver', label: 'Mountain Time (UTC-7/-6)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (UTC-8/-7)' },
      { value: 'Europe/London', label: 'London (UTC+0/+1)' },
      { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)' },
      { value: 'Europe/Berlin', label: 'Berlin (UTC+1/+2)' },
      { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
      { value: 'Asia/Shanghai', label: 'Shanghai (UTC+8)' },
      { value: 'Asia/Kolkata', label: 'Mumbai/Delhi (UTC+5:30)' },
      { value: 'Australia/Sydney', label: 'Sydney (UTC+10/+11)' },
      { value: 'Pacific/Auckland', label: 'Auckland (UTC+12/+13)' },
    ];
  },

  /**
   * Validate rental status settings
   */
  validateRentalStatusSettings: (settings: {
    enabled: boolean;
    checkTime: string;
    retentionDays: number;
    timezone: string;
  }): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate check time format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(settings.checkTime)) {
      errors.push('Check time must be in HH:MM format (24-hour)');
    }

    // Validate retention days
    if (settings.retentionDays < 30 || settings.retentionDays > 3650) {
      errors.push('Retention days must be between 30 and 3650');
    }

    // Validate timezone
    const validTimezones = systemApi.getAvailableTimezones().map(tz => tz.value);
    if (!validTimezones.includes(settings.timezone)) {
      errors.push('Invalid timezone selected');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // ============= UTILITY METHODS =============

  /**
   * Search settings across all categories
   */
  searchSettings: async (query: string): Promise<SystemSetting[]> => {
    const allSettings = await systemApi.getSettings();
    return allSettings.filter(setting => 
      setting.setting_name.toLowerCase().includes(query.toLowerCase()) ||
      setting.setting_key.toLowerCase().includes(query.toLowerCase()) ||
      setting.description.toLowerCase().includes(query.toLowerCase())
    );
  },

  /**
   * Get settings count by category
   */
  getSettingsCountByCategory: async (): Promise<Record<SettingCategory, number>> => {
    const allSettings = await systemApi.getSettings();
    const counts: Record<SettingCategory, number> = {
      GENERAL: 0,
      BUSINESS: 0,
      FINANCIAL: 0,
      INVENTORY: 0,
      RENTAL: 0,
      NOTIFICATION: 0,
      SECURITY: 0,
      INTEGRATION: 0,
      REPORTING: 0,
      SYSTEM: 0,
    };

    allSettings.forEach(setting => {
      counts[setting.setting_category]++;
    });

    return counts;
  },

  /**
   * Validate setting value against rules
   */
  validateSettingValue: (setting: SystemSetting, value: string): { isValid: boolean; error?: string } => {
    const rules = setting.validation_rules;
    
    // Basic type validation
    switch (setting.setting_type) {
      case 'NUMBER':
        if (isNaN(Number(value))) {
          return { isValid: false, error: 'Value must be a valid number' };
        }
        if (rules.min !== undefined && Number(value) < rules.min) {
          return { isValid: false, error: `Value must be at least ${rules.min}` };
        }
        if (rules.max !== undefined && Number(value) > rules.max) {
          return { isValid: false, error: `Value must be at most ${rules.max}` };
        }
        break;
      
      case 'EMAIL':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return { isValid: false, error: 'Value must be a valid email address' };
        }
        break;
      
      case 'URL':
        try {
          new URL(value);
        } catch {
          return { isValid: false, error: 'Value must be a valid URL' };
        }
        break;
      
      case 'BOOLEAN':
        if (!['true', 'false'].includes(value.toLowerCase())) {
          return { isValid: false, error: 'Value must be true or false' };
        }
        break;
      
      case 'JSON':
        try {
          JSON.parse(value);
        } catch {
          return { isValid: false, error: 'Value must be valid JSON' };
        }
        break;
    }

    // Length validation
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      return { isValid: false, error: `Value must be at least ${rules.minLength} characters` };
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      return { isValid: false, error: `Value must be at most ${rules.maxLength} characters` };
    }

    // Pattern validation
    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      return { isValid: false, error: rules.patternMessage || 'Value does not match required pattern' };
    }

    return { isValid: true };
  },
};

// Export individual functions for easier imports
export const {
  getSettings,
  getSettingByKey,
  getSettingValue,
  updateSetting,
  resetSetting,
  getSettingsByCategory,
  getCompanyInfo,
  updateCompanyInfo,
  createBackup,
  getBackups,
  getBackupById,
  startBackup,
  completeBackup,
  failBackup,
  getAuditLogs,
  getAuditLogById,
  getSystemInfo,
  performMaintenance,
  getCurrentCurrency,
  updateCurrency,
  getSupportedCurrencies,
  getRentalStatusSettings,
  updateRentalStatusSettings,
  getAvailableTimezones,
  validateRentalStatusSettings,
  searchSettings,
  getSettingsCountByCategory,
  validateSettingValue,
} = systemApi;

export default systemApi;