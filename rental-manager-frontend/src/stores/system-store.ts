import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  SystemSetting,
  CompanyInfo,
  SystemBackup,
  AuditLog,
  SystemInfo,
  CurrencyConfig,
  SettingCategory,
  BackupFilters,
  AuditLogFilters,
  SystemSettingsFilters,
} from '@/types/system';
import { systemApi } from '@/services/api/system';

// System Settings Store
interface SystemSettingsStore {
  settings: SystemSetting[];
  currentCategory: SettingCategory | 'ALL';
  searchTerm: string;
  loading: boolean;
  error: string | null;
  
  // Actions
  setCurrentCategory: (category: SettingCategory | 'ALL') => void;
  setSearchTerm: (term: string) => void;
  loadSettings: (filters?: SystemSettingsFilters) => Promise<void>;
  updateSetting: (key: string, value: string, updatedBy: string) => Promise<void>;
  resetSetting: (key: string, updatedBy: string) => Promise<void>;
  clearError: () => void;
  
  // Computed
  getFilteredSettings: () => SystemSetting[];
  getSettingByKey: (key: string) => SystemSetting | undefined;
}

export const useSystemSettingsStore = create<SystemSettingsStore>()(
  devtools(
    immer((set, get) => ({
      settings: [],
      currentCategory: 'ALL',
      searchTerm: '',
      loading: false,
      error: null,

      setCurrentCategory: (category) => {
        set((state) => {
          state.currentCategory = category;
        });
      },

      setSearchTerm: (term) => {
        set((state) => {
          state.searchTerm = term;
        });
      },

      loadSettings: async (filters) => {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        try {
          const settings = await systemApi.getSettings(filters);
          set((state) => {
            state.settings = settings;
            state.loading = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to load settings';
            state.loading = false;
          });
        }
      },

      updateSetting: async (key, value, updatedBy) => {
        try {
          const updatedSetting = await systemApi.updateSetting(key, value, updatedBy);
          set((state) => {
            const index = state.settings.findIndex(s => s.setting_key === key);
            if (index !== -1) {
              state.settings[index] = updatedSetting;
            }
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to update setting';
          });
          throw error;
        }
      },

      resetSetting: async (key, updatedBy) => {
        try {
          const resetSetting = await systemApi.resetSetting(key, updatedBy);
          set((state) => {
            const index = state.settings.findIndex(s => s.setting_key === key);
            if (index !== -1) {
              state.settings[index] = resetSetting;
            }
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to reset setting';
          });
          throw error;
        }
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      getFilteredSettings: () => {
        const { settings, currentCategory, searchTerm } = get();
        let filtered = settings || [];

        if (currentCategory !== 'ALL') {
          filtered = filtered.filter(s => s?.setting_category === currentCategory);
        }

        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          filtered = filtered.filter(s => 
            s?.setting_name?.toLowerCase().includes(term) ||
            s?.setting_key?.toLowerCase().includes(term) ||
            s?.description?.toLowerCase().includes(term)
          );
        }

        // Create a copy of the array before sorting to avoid mutating the immer draft
        return [...filtered].sort((a, b) => parseInt(a?.display_order || '0') - parseInt(b?.display_order || '0'));
      },

      getSettingByKey: (key) => {
        return (get().settings || []).find(s => s?.setting_key === key);
      },
    })),
    { name: 'system-settings-store' }
  )
);

// Company Info Store
interface CompanyInfoStore {
  companyInfo: CompanyInfo | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  loadCompanyInfo: () => Promise<void>;
  updateCompanyInfo: (data: Partial<CompanyInfo>, updatedBy: string) => Promise<void>;
  clearError: () => void;
}

export const useCompanyInfoStore = create<CompanyInfoStore>()(
  devtools(
    immer((set, get) => ({
      companyInfo: null,
      loading: false,
      error: null,

      loadCompanyInfo: async () => {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        try {
          const companyInfo = await systemApi.getCompanyInfo();
          set((state) => {
            state.companyInfo = companyInfo;
            state.loading = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to load company info';
            state.loading = false;
          });
        }
      },

      updateCompanyInfo: async (data, updatedBy) => {
        try {
          console.log('🏪 Store: Starting company info update...', {
            data,
            updatedBy,
            currentState: get().companyInfo,
            timestamp: new Date().toISOString()
          });
          
          // Clear any existing errors
          set((state) => {
            state.error = null;
          });
          
          const updatedInfo = await systemApi.updateCompanyInfo(data, updatedBy);
          
          console.log('✅ Store: Company info update successful', {
            updatedInfo,
            timestamp: new Date().toISOString()
          });
          
          set((state) => {
            state.companyInfo = updatedInfo;
            state.error = null;
          });
          
        } catch (error: any) {
          console.error('❌ Store: Company info update failed', {
            error: error.message,
            data,
            updatedBy,
            timestamp: new Date().toISOString()
          });
          
          const errorMessage = error instanceof Error ? error.message : 'Failed to update company info';
          
          set((state) => {
            state.error = errorMessage;
          });
          
          // Re-throw the error so the component can handle it
          throw error;
        }
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },
    })),
    { name: 'company-info-store' }
  )
);

// Backup Store
interface BackupStore {
  backups: SystemBackup[];
  loading: boolean;
  error: string | null;
  filters: BackupFilters;
  
  // Actions
  setFilters: (filters: Partial<BackupFilters>) => void;
  loadBackups: () => Promise<void>;
  createBackup: (data: { backup_name: string; backup_type: string; description?: string; retention_days: string }, startedBy: string) => Promise<void>;
  startBackup: (backupId: string) => Promise<void>;
  clearError: () => void;
}

export const useBackupStore = create<BackupStore>()(
  devtools(
    immer((set, get) => ({
      backups: [],
      loading: false,
      error: null,
      filters: {
        skip: 0,
        limit: 50,
      },

      setFilters: (newFilters) => {
        set((state) => {
          state.filters = { ...state.filters, ...newFilters };
        });
      },

      loadBackups: async () => {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        try {
          const backups = await systemApi.getBackups(get().filters);
          set((state) => {
            state.backups = backups;
            state.loading = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to load backups';
            state.loading = false;
          });
        }
      },

      createBackup: async (data, startedBy) => {
        try {
          const newBackup = await systemApi.createBackup(data, startedBy);
          set((state) => {
            state.backups.unshift(newBackup);
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to create backup';
          });
          throw error;
        }
      },

      startBackup: async (backupId) => {
        try {
          const updatedBackup = await systemApi.startBackup(backupId);
          set((state) => {
            const index = state.backups.findIndex(b => b.id === backupId);
            if (index !== -1) {
              state.backups[index] = updatedBackup;
            }
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to start backup';
          });
          throw error;
        }
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },
    })),
    { name: 'backup-store' }
  )
);

// Audit Log Store
interface AuditLogStore {
  auditLogs: AuditLog[];
  loading: boolean;
  error: string | null;
  filters: AuditLogFilters;
  total: number;
  
  // Actions
  setFilters: (filters: Partial<AuditLogFilters>) => void;
  loadAuditLogs: () => Promise<void>;
  clearError: () => void;
}

export const useAuditLogStore = create<AuditLogStore>()(
  devtools(
    immer((set, get) => ({
      auditLogs: [],
      loading: false,
      error: null,
      total: 0,
      filters: {
        skip: 0,
        limit: 50,
      },

      setFilters: (newFilters) => {
        set((state) => {
          state.filters = { ...state.filters, ...newFilters };
        });
      },

      loadAuditLogs: async () => {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        try {
          const auditLogs = await systemApi.getAuditLogs(get().filters);
          set((state) => {
            state.auditLogs = auditLogs;
            state.total = auditLogs.length;
            state.loading = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to load audit logs';
            state.loading = false;
          });
        }
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },
    })),
    { name: 'audit-log-store' }
  )
);

// System Info Store
interface SystemInfoStore {
  systemInfo: SystemInfo | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  loadSystemInfo: () => Promise<void>;
  performMaintenance: (userId: string) => Promise<{ message: string; results: any }>;
  clearError: () => void;
}

export const useSystemInfoStore = create<SystemInfoStore>()(
  devtools(
    immer((set, get) => ({
      systemInfo: null,
      loading: false,
      error: null,

      loadSystemInfo: async () => {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        try {
          const systemInfo = await systemApi.getSystemInfo();
          set((state) => {
            state.systemInfo = systemInfo;
            state.loading = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to load system info';
            state.loading = false;
          });
        }
      },

      performMaintenance: async (userId) => {
        try {
          const result = await systemApi.performMaintenance(userId);
          // Refresh system info after maintenance
          await get().loadSystemInfo();
          return result;
        } catch (error) {
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to perform maintenance';
          });
          throw error;
        }
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },
    })),
    { name: 'system-info-store' }
  )
);