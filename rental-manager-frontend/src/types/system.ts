// System Module Types
// Based on SystemModuleImplementation160125.md

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_name: string;
  setting_type: SettingType;
  setting_category: SettingCategory;
  setting_value: string;
  default_value: string;
  description: string;
  is_system: boolean;
  is_sensitive: boolean;
  validation_rules: Record<string, any>;
  display_order: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyInfo {
  company_name: string;
  company_address?: string;
  company_email?: string;
  company_phone?: string;
  company_gst_no?: string;
  company_registration_number?: string;
}

export interface SystemBackup {
  id: string;
  backup_name: string;
  backup_type: BackupType;
  backup_status: BackupStatus;
  backup_path?: string;
  backup_size?: number;
  started_by: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  retention_days: string;
  description?: string;
  backup_metadata: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  ip_address: string;
  user_agent: string;
  session_id: string;
  success: boolean;
  error_message?: string;
  audit_metadata: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemInfo {
  system_name: string;
  system_version: string;
  company_name: string;
  timezone: string;
  settings_count: number;
  backups_count: number;
  recent_activity_count: number;
  last_backup?: {
    backup_name: string;
    backup_type: BackupType;
    backup_status: BackupStatus;
    started_at: string;
    completed_at?: string;
  };
  system_health: SystemHealth;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: string;
  response_time: string;
  memory_usage: string;
  cpu_usage: string;
  disk_usage: string;
}

export interface CurrencyConfig {
  currency_code: string;
  symbol: string;
  description: string;
  is_default: boolean;
}

export interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
}

// Enums
export type SettingType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE' | 'EMAIL' | 'URL';

export type SettingCategory = 
  | 'GENERAL'
  | 'BUSINESS'
  | 'FINANCIAL'
  | 'INVENTORY'
  | 'RENTAL'
  | 'NOTIFICATION'
  | 'SECURITY'
  | 'INTEGRATION'
  | 'REPORTING'
  | 'SYSTEM';

export type BackupType = 'FULL' | 'INCREMENTAL' | 'DIFFERENTIAL';

export type BackupStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW';

// Request/Response Types
export interface SettingValueRequest {
  setting_value: string;
}

export interface SettingValueResponse {
  setting_key: string;
  value: string;
}

export interface CreateBackupRequest {
  backup_name: string;
  backup_type: BackupType;
  description?: string;
  retention_days: string;
}

export interface UpdateCompanyRequest extends Partial<CompanyInfo> {}

export interface CurrencyUpdateRequest {
  currency_code: string;
  description?: string;
}

export interface SystemMaintenanceResponse {
  message: string;
  results: {
    expired_backups_cleaned: number;
    old_audit_logs_cleaned: number;
  };
}

// Filter Types
export interface SystemSettingsFilters {
  category?: SettingCategory;
  include_system?: boolean;
  search?: string;
}

export interface BackupFilters {
  skip?: number;
  limit?: number;
  backup_type?: BackupType;
  backup_status?: BackupStatus;
  started_by?: string;
}

export interface AuditLogFilters {
  skip?: number;
  limit?: number;
  user_id?: string;
  action?: AuditAction;
  entity_type?: string;
  entity_id?: string;
  success?: boolean;
  start_date?: string;
  end_date?: string;
}

// UI State Types
export interface SystemSettingsState {
  settings: SystemSetting[];
  currentCategory: SettingCategory | 'ALL';
  searchTerm: string;
  loading: boolean;
  error: string | null;
}

export interface CompanyInfoState {
  companyInfo: CompanyInfo | null;
  loading: boolean;
  error: string | null;
}

export interface BackupState {
  backups: SystemBackup[];
  loading: boolean;
  error: string | null;
  filters: BackupFilters;
}

export interface AuditLogState {
  auditLogs: AuditLog[];
  loading: boolean;
  error: string | null;
  filters: AuditLogFilters;
  total: number;
}

export interface SystemInfoState {
  systemInfo: SystemInfo | null;
  loading: boolean;
  error: string | null;
}

// Constants
export const SETTING_CATEGORIES: { value: SettingCategory; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'RENTAL', label: 'Rental' },
  { value: 'NOTIFICATION', label: 'Notification' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'INTEGRATION', label: 'Integration' },
  { value: 'REPORTING', label: 'Reporting' },
  { value: 'SYSTEM', label: 'System' },
];

export const BACKUP_TYPES: { value: BackupType; label: string }[] = [
  { value: 'FULL', label: 'Full Backup' },
  { value: 'INCREMENTAL', label: 'Incremental' },
  { value: 'DIFFERENTIAL', label: 'Differential' },
];

export const BACKUP_STATUSES: { value: BackupStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const AUDIT_ACTIONS: { value: AuditAction; label: string }[] = [
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'VIEW', label: 'View' },
];