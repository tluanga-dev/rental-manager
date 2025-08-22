import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  InventoryUnit,
  StockLevel,
  InventoryFilters,
  InventoryDashboardSummary,
  InventoryAlert,
  InventoryStatus,
  ConditionGrade,
} from '@/types/inventory';

interface InventoryState {
  // Current filters
  filters: InventoryFilters;
  
  // Selected items
  selectedUnits: string[];
  selectedLocation: string | null;
  
  // Dashboard data
  dashboardSummary: InventoryDashboardSummary | null;
  
  // Alerts
  alerts: InventoryAlert[];
  unreadAlertCount: number;
  
  // Quick stats
  statusCounts: Record<InventoryStatus, number> | null;
  conditionCounts: Record<ConditionGrade, number> | null;
  
  // Loading states
  isLoadingDashboard: boolean;
  isLoadingUnits: boolean;
  isLoadingAlerts: boolean;
  
  // Actions
  setFilters: (filters: Partial<InventoryFilters>) => void;
  resetFilters: () => void;
  
  setSelectedUnits: (units: string[]) => void;
  toggleUnitSelection: (unitId: string) => void;
  clearSelectedUnits: () => void;
  
  setSelectedLocation: (locationId: string | null) => void;
  
  setDashboardSummary: (summary: InventoryDashboardSummary) => void;
  
  setAlerts: (alerts: InventoryAlert[]) => void;
  markAlertAsRead: (alertId: string) => void;
  clearAlert: (alertId: string) => void;
  
  setStatusCounts: (counts: Record<InventoryStatus, number>) => void;
  setConditionCounts: (counts: Record<ConditionGrade, number>) => void;
  
  setLoadingState: (key: 'dashboard' | 'units' | 'alerts', loading: boolean) => void;
}

const initialFilters: InventoryFilters = {
  location_ids: [],
  sku_ids: [],
  statuses: [],
  condition_grades: [],
  search: '',
};

export const useInventoryStore = create<InventoryState>()(
  devtools(
    (set, get) => ({
      // Initial state
      filters: initialFilters,
      selectedUnits: [],
      selectedLocation: null,
      dashboardSummary: null,
      alerts: [],
      unreadAlertCount: 0,
      statusCounts: null,
      conditionCounts: null,
      isLoadingDashboard: false,
      isLoadingUnits: false,
      isLoadingAlerts: false,
      
      // Filter actions
      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),
      
      resetFilters: () => set({ filters: initialFilters }),
      
      // Selection actions
      setSelectedUnits: (units) => set({ selectedUnits: units }),
      
      toggleUnitSelection: (unitId) =>
        set((state) => ({
          selectedUnits: state.selectedUnits.includes(unitId)
            ? state.selectedUnits.filter((id) => id !== unitId)
            : [...state.selectedUnits, unitId],
        })),
      
      clearSelectedUnits: () => set({ selectedUnits: [] }),
      
      setSelectedLocation: (locationId) => set({ selectedLocation: locationId }),
      
      // Dashboard actions
      setDashboardSummary: (summary) => set({ dashboardSummary: summary }),
      
      // Alert actions
      setAlerts: (alerts) =>
        set({
          alerts,
          unreadAlertCount: alerts.filter((a) => !a.is_acknowledged).length,
        }),
      
      markAlertAsRead: (alertId) =>
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === alertId ? { ...alert, is_acknowledged: true } : alert
          ),
          unreadAlertCount: state.alerts.filter(
            (a) => !a.is_acknowledged && a.id !== alertId
          ).length,
        })),
      
      clearAlert: (alertId) =>
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== alertId),
          unreadAlertCount: state.alerts.filter(
            (a) => !a.is_acknowledged && a.id !== alertId
          ).length,
        })),
      
      // Stats actions
      setStatusCounts: (counts) => set({ statusCounts: counts }),
      setConditionCounts: (counts) => set({ conditionCounts: counts }),
      
      // Loading actions
      setLoadingState: (key, loading) =>
        set({
          [`isLoading${key.charAt(0).toUpperCase() + key.slice(1)}`]: loading,
        }),
    }),
    {
      name: 'inventory-store',
    }
  )
);

// Selectors
export const selectFilteredLocation = (state: InventoryState) =>
  state.selectedLocation || state.filters.location_ids?.[0];

export const selectHasActiveFilters = (state: InventoryState) => {
  const { filters } = state;
  return (
    (filters.location_ids?.length || 0) > 0 ||
    (filters.sku_ids?.length || 0) > 0 ||
    (filters.statuses?.length || 0) > 0 ||
    (filters.condition_grades?.length || 0) > 0 ||
    !!filters.search ||
    !!filters.date_range
  );
};

export const selectCriticalAlerts = (state: InventoryState) =>
  state.alerts.filter((alert) => alert.severity === 'CRITICAL');

export const selectAlertsByType = (state: InventoryState, type: string) =>
  state.alerts.filter((alert) => alert.type === type);