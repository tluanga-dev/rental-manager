import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  inventoryTrackingApi, 
  INVENTORY_TRACKING_QUERY_KEYS,
  type InventoryTrackingFilters,
  type InventoryUnitDetail,
  type PurchaseInventoryUnitsParams,
} from '@/services/api/inventory-tracking';

/**
 * Hook to fetch inventory units with filtering and pagination
 */
export function useInventoryUnits(filters: InventoryTrackingFilters = {}) {
  return useQuery({
    queryKey: INVENTORY_TRACKING_QUERY_KEYS.units(filters),
    queryFn: () => inventoryTrackingApi.getInventoryUnits(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch inventory units for a specific purchase
 */
export function usePurchaseInventoryUnits(params: PurchaseInventoryUnitsParams, enabled: boolean = true) {
  return useQuery({
    queryKey: INVENTORY_TRACKING_QUERY_KEYS.purchaseUnits(params.purchase_id),
    queryFn: () => inventoryTrackingApi.getPurchaseInventoryUnits(params),
    enabled: enabled && !!params.purchase_id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch inventory analytics
 */
export function useInventoryAnalytics(filters: InventoryTrackingFilters = {}) {
  return useQuery({
    queryKey: INVENTORY_TRACKING_QUERY_KEYS.analytics(filters),
    queryFn: () => inventoryTrackingApi.getInventoryAnalytics(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes for analytics
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch a single inventory unit
 */
export function useInventoryUnit(unitId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: INVENTORY_TRACKING_QUERY_KEYS.unit(unitId),
    queryFn: () => inventoryTrackingApi.getUnitById(unitId),
    enabled: enabled && !!unitId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch unit history (movements, rentals, etc.)
 */
export function useUnitHistory(unitId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: INVENTORY_TRACKING_QUERY_KEYS.unitHistory(unitId),
    queryFn: () => inventoryTrackingApi.getUnitHistory(unitId),
    enabled: enabled && !!unitId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch unit by serial number
 */
export function useUnitBySerial(serialNumber: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['inventory-tracking', 'unit-by-serial', serialNumber],
    queryFn: () => inventoryTrackingApi.getUnitBySerial(serialNumber),
    enabled: enabled && !!serialNumber && serialNumber.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch units by batch code
 */
export function useUnitsByBatch(batchCode: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['inventory-tracking', 'units-by-batch', batchCode],
    queryFn: () => inventoryTrackingApi.getUnitsByBatch(batchCode),
    enabled: enabled && !!batchCode && batchCode.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch utilization report
 */
export function useUtilizationReport(params: {
  start_date: string;
  end_date: string;
  category?: string;
  location?: string;
}, enabled: boolean = true) {
  return useQuery({
    queryKey: INVENTORY_TRACKING_QUERY_KEYS.utilization(params),
    queryFn: () => inventoryTrackingApi.getUtilizationReport(params),
    enabled: enabled && !!params.start_date && !!params.end_date,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to search inventory units with advanced filters
 */
export function useInventorySearch(
  query: {
    q: string;
    filters?: any;
    sort?: any;
    pagination?: any;
  },
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['inventory-tracking', 'search', query],
    queryFn: () => inventoryTrackingApi.searchUnits(query),
    enabled: enabled && query.q.length > 0,
    staleTime: 30 * 1000, // 30 seconds for search
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Mutation hook to update inventory unit
 */
export function useUpdateInventoryUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, updates }: { 
      unitId: string; 
      updates: Partial<{
        status: string;
        condition: string;
        location_id: string;
        notes: string;
        maintenance_cost: number;
      }>
    }) => inventoryTrackingApi.updateUnit(unitId, updates),
    onSuccess: (data, variables) => {
      toast.success('Unit updated successfully');
      
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: INVENTORY_TRACKING_QUERY_KEYS.unit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: INVENTORY_TRACKING_QUERY_KEYS.unitHistory(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: INVENTORY_TRACKING_QUERY_KEYS.units(),
      });
      queryClient.invalidateQueries({
        queryKey: INVENTORY_TRACKING_QUERY_KEYS.analytics(),
      });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update unit');
    },
  });
}

/**
 * Hook to export inventory data
 */
export function useExportInventoryData() {
  return useMutation({
    mutationFn: (filters: InventoryTrackingFilters & {
      format: 'csv' | 'xlsx' | 'pdf';
      include_history?: boolean;
    }) => inventoryTrackingApi.exportInventoryData(filters),
    onSuccess: (blob, variables) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory-tracking-${new Date().toISOString().split('T')[0]}.${variables.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Export completed successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to export data');
    },
  });
}

/**
 * Custom hook for real-time inventory unit search with debouncing
 */
export function useInventoryUnitSearch(
  searchTerm: string,
  filters: InventoryTrackingFilters = {},
  debounceMs: number = 300
) {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState(searchTerm);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  return useInventoryUnits({
    ...filters,
    search: debouncedSearchTerm,
    limit: 50, // Reasonable limit for search results
  });
}

/**
 * Hook for inventory performance metrics
 */
export function useInventoryPerformanceMetrics(filters: InventoryTrackingFilters = {}) {
  const analyticsQuery = useInventoryAnalytics(filters);
  
  const metrics = React.useMemo(() => {
    if (!analyticsQuery.data?.data) return null;
    
    const data = analyticsQuery.data.data;
    
    return {
      totalValue: data.total_value,
      currentValue: data.total_current_value,
      totalRevenue: data.total_revenue,
      depreciation: data.total_value - data.total_current_value,
      depreciationRate: data.total_value > 0 ? ((data.total_value - data.total_current_value) / data.total_value) * 100 : 0,
      roi: data.total_value > 0 ? (data.total_revenue / data.total_value) * 100 : 0,
      averageUtilization: data.average_utilization,
      totalItems: data.total_items,
      statusDistribution: data.status_distribution,
      topCategories: data.category_performance.slice(0, 5),
      maintenanceAlerts: data.maintenance_alerts,
    };
  }, [analyticsQuery.data]);

  return {
    ...analyticsQuery,
    metrics,
  };
}

/**
 * Hook for tracking individual unit lifecycle
 */
export function useUnitLifecycle(unitId: string) {
  const unitQuery = useInventoryUnit(unitId);
  const historyQuery = useUnitHistory(unitId);

  const lifecycle = React.useMemo(() => {
    if (!unitQuery.data?.data || !historyQuery.data?.data) return null;

    const unit = unitQuery.data.data;
    const history = historyQuery.data.data;

    // Calculate lifecycle metrics
    const totalRentals = history.rentals.length;
    const completedRentals = history.rentals.filter(r => r.status === 'COMPLETED').length;
    const totalRevenue = history.rentals.reduce((sum, r) => sum + r.revenue, 0);
    const averageRentalDuration = completedRentals > 0 
      ? history.rentals
          .filter(r => r.status === 'COMPLETED' && r.end_date)
          .reduce((sum, r) => {
            const days = Math.floor((new Date(r.end_date!).getTime() - new Date(r.start_date).getTime()) / (1000 * 60 * 60 * 24));
            return sum + days;
          }, 0) / completedRentals
      : 0;

    return {
      unit,
      totalRentals,
      completedRentals,
      totalRevenue,
      averageRentalDuration,
      movementsCount: history.movements.length,
      profitability: totalRevenue - unit.purchase_price - unit.maintenance_cost,
      utilizationScore: unit.utilization_rate,
      lifecycle_stage: unit.days_since_purchase < 90 ? 'NEW' : 
                      unit.days_since_purchase < 365 ? 'ACTIVE' : 
                      unit.utilization_rate > 50 ? 'MATURE' : 'DECLINING',
    };
  }, [unitQuery.data, historyQuery.data]);

  return {
    unit: unitQuery,
    history: historyQuery,
    lifecycle,
    isLoading: unitQuery.isLoading || historyQuery.isLoading,
    error: unitQuery.error || historyQuery.error,
  };
}

// Re-export for convenience
export { inventoryTrackingApi, INVENTORY_TRACKING_QUERY_KEYS };
export type { InventoryUnitDetail, InventoryTrackingFilters };