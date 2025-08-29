import { apiClient } from '@/lib/axios';
import type {
  InventoryUnit,
  StockLevel,
  InventoryTransfer,
  InventoryReservation,
  InventoryMovement,
  InventoryDashboardSummary,
  InventoryFilters,
  InventoryStatus,
  ConditionGrade,
  TransferStatus,
} from '@/types/inventory';

// Inventory Units API
export const inventoryUnitsApi = {
  // Create inventory unit
  create: async (data: {
    unit_serial: string;
    item_id: string;
    location_id: string;
    condition: ConditionGrade;
    purchase_date?: string;
    warranty_expiry?: string;
    notes?: string;
  }) => {
    const response = await apiClient.post<InventoryUnit>('/inventory/units', data);
    return response.data.success ? response.data.data : response.data;
  },

  // Get inventory unit by ID - Updated to match API_REFERENCE.md
  getById: async (unitId: string) => {
    const response = await apiClient.get<InventoryUnit>(`/inventory/units/${unitId}`);
    return response.data.success ? response.data.data : response.data;
  },

  // Get inventory unit by code
  getByCode: async (inventoryCode: string) => {
    const response = await apiClient.get<InventoryUnit>(`/inventory/units/code/${inventoryCode}`);
    return response.data;
  },

  // List inventory units with filters
  list: async (filters?: InventoryFilters) => {
    const params = new URLSearchParams();
    
    if (filters?.location_ids?.length) {
      filters.location_ids.forEach(id => params.append('location_ids', id));
    }
    if (filters?.sku_ids?.length) {
      filters.sku_ids.forEach(id => params.append('sku_ids', id));
    }
    if (filters?.statuses?.length) {
      filters.statuses.forEach(status => params.append('statuses', status));
    }
    if (filters?.condition_grades?.length) {
      filters.condition_grades.forEach(grade => params.append('condition_grades', grade));
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }
    
    const response = await apiClient.get<InventoryUnit[]>(`/inventory/units?${params.toString()}`);
    return response.data.success ? response.data.data : response.data;
  },

  // Update inventory unit status
  updateStatus: async (unitId: string, status: InventoryStatus, notes?: string) => {
    const response = await apiClient.put<InventoryUnit>(
      `/inventory/units/${unitId}/status`,
      { status, notes }
    );
    return response.data;
  },

  // Inspect inventory unit
  inspect: async (unitId: string, data: {
    condition_grade: ConditionGrade;
    inspection_notes: string;
    damage_assessment?: any;
    photos?: string[];
    next_inspection_date?: string;
  }) => {
    const response = await apiClient.post<InventoryUnit>(
      `/inventory/units/${unitId}/inspect`,
      data
    );
    return response.data;
  },

  // Transfer inventory unit
  transfer: async (unitId: string, data: {
    to_location_id: string;
    transfer_notes?: string;
  }) => {
    const response = await apiClient.post<InventoryUnit>(
      `/inventory/units/${unitId}/transfer`,
      data
    );
    return response.data;
  },

  // Bulk transfer
  bulkTransfer: async (data: {
    unit_ids: string[];
    from_location_id: string;
    to_location_id: string;
    transfer_notes?: string;
  }) => {
    const response = await apiClient.post<{
      transferred: string[];
      failed: Array<{ unit_id: string; error: string }>;
    }>('/inventory/units/transfer/bulk', data);
    return response.data;
  },

  // Transfer by SKU
  transferBySku: async (data: {
    sku_id: string;
    from_location_id: string;
    to_location_id: string;
    quantity: number;
    transfer_notes?: string;
  }) => {
    const response = await apiClient.post<{
      transferred_units: InventoryUnit[];
      transfer_count: number;
    }>('/inventory/units/transfer/by-sku', data);
    return response.data;
  },

  // Get units needing inspection
  getUnitsNeedingInspection: async (locationId?: string, daysOverdue?: number) => {
    const params = new URLSearchParams();
    if (locationId) params.append('location_id', locationId);
    if (daysOverdue) params.append('days_overdue', daysOverdue.toString());
    
    const response = await apiClient.get<InventoryUnit[]>(
      `/inventory/units/needing-inspection?${params.toString()}`
    );
    return response.data;
  },

  // Get status count
  getStatusCount: async (locationId?: string, skuId?: string) => {
    const params = new URLSearchParams();
    if (locationId) params.append('location_id', locationId);
    if (skuId) params.append('sku_id', skuId);
    
    const response = await apiClient.get<Record<InventoryStatus, number>>(
      `/inventory/units/status-count?${params.toString()}`
    );
    return response.data;
  },

  // Get condition count
  getConditionCount: async (locationId?: string, skuId?: string) => {
    const params = new URLSearchParams();
    if (locationId) params.append('location_id', locationId);
    if (skuId) params.append('sku_id', skuId);
    
    const response = await apiClient.get<Record<ConditionGrade, number>>(
      `/inventory/units/condition-count?${params.toString()}`
    );
    return response.data;
  },

  // Update rental rate for a specific inventory unit
  updateRentalRate: async (unitId: string, rentalRatePerPeriod: number) => {
    const response = await apiClient.put(
      `/inventory/units/${unitId}/rental-rate`,
      { rental_rate_per_period: rentalRatePerPeriod }
    );
    return response.data.success ? response.data.data : response.data;
  },

  // Batch update rental rate for multiple inventory units by item and location
  batchUpdateRentalRate: async (itemId: string, locationId: string, rentalRatePerPeriod: number) => {
    const response = await apiClient.put(
      '/inventory/units/batch/rental-rate',
      { 
        item_id: itemId,
        location_id: locationId,
        rental_rate_per_period: rentalRatePerPeriod 
      }
    );
    return response.data.success ? response.data.data : response.data;
  },
};

// Stock Levels API
export const stockLevelsApi = {
  // Create stock level
  create: async (data: {
    sku_id: string;
    location_id: string;
    reorder_point?: number;
    max_stock?: number;
  }) => {
    const response = await apiClient.post<StockLevel>('/inventory/stock-levels', data);
    return response.data;
  },

  // List stock levels
  list: async (filters?: {
    location_id?: string;
    item_id?: string;
    low_stock_only?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (filters?.location_id) params.append('location_id', filters.location_id);
    if (filters?.item_id) params.append('item_id', filters.item_id);
    if (filters?.low_stock_only) params.append('low_stock_only', 'true');
    
    const response = await apiClient.get<{
      items: StockLevel[];
      total: number;
      skip: number;
      limit: number;
    }>(`/inventory/stock-levels?${params.toString()}`);
    return response.data;
  },

  // Get stock level by item and location
  getByItemLocation: async (itemId: string, locationId: string) => {
    const response = await apiClient.get<StockLevel>(
      `/inventory/stock-levels/${itemId}/${locationId}`
    );
    return response.data;
  },

  // Perform stock operation
  performOperation: async (
    itemId: string,
    locationId: string,
    operation: 'receive' | 'adjust' | 'reserve' | 'release',
    quantity: number,
    notes?: string
  ) => {
    const response = await apiClient.put<StockLevel>(
      `/inventory/stock-levels/${itemId}/${locationId}/operation`,
      { operation, quantity, notes }
    );
    return response.data;
  },

  // Update stock parameters
  updateParameters: async (
    itemId: string,
    locationId: string,
    data: {
      reorder_point?: number;
      max_stock?: number;
    }
  ) => {
    const response = await apiClient.put<StockLevel>(
      `/inventory/stock-levels/${itemId}/${locationId}/parameters`,
      data
    );
    return response.data;
  },

  // Bulk receive stock
  bulkReceive: async (locationId: string, items: Array<{
    item_id: string;
    quantity: number;
    unit_cost?: number;
    notes?: string;
  }>) => {
    const response = await apiClient.post<{
      success: Array<{ item_id: string; new_quantity: number }>;
      failed: Array<{ item_id: string; error: string }>;
    }>(`/inventory/stock-levels/${locationId}/bulk-receive`, { items });
    return response.data;
  },

  // Reconcile stock
  reconcile: async (
    itemId: string,
    locationId: string,
    physicalCount: number,
    reason: string
  ) => {
    const response = await apiClient.put<{
      stock_level: StockLevel;
      adjustment: number;
      movement_id: string;
    }>(`/inventory/stock-levels/${itemId}/${locationId}/reconcile`, {
      physical_count: physicalCount,
      reason,
    });
    return response.data;
  },

  // Get low stock alerts
  getLowStockAlerts: async (filters?: {
    location_id?: string;
    threshold?: number;
    limit?: number;
  }) => {
    try {
      const response = await apiClient.get('/inventory/stock-levels/low-stock', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch low stock alerts:', error);
      // Return fallback data
      return {
        alerts: [],
        total: 0,
        summary: {
          total_low_stock_items: 0,
          critical_items: 0,
          locations_affected: 0,
        }
      };
    }
  },

  // Get stock levels for all items
  getStockLevels: async (filters?: {
    location_id?: string;
    item_id?: string;
    skip?: number;
    limit?: number;
  }) => {
    try {
      const response = await apiClient.get('/inventory/stock-levels', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch stock levels:', error);
      return {
        data: [],
        total: 0,
      };
    }
  },
};

// Stock Analysis API
export const stockAnalysisApi = {
  // Check availability
  checkAvailability: async (data: {
    item_id: string;
    location_id: string;
    quantity: number;
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await apiClient.post<{
      available: boolean;
      current_available: number;
      requested: number;
      future_available?: number;
    }>('/inventory/availability/check', data);
    return response.data;
  },

  // Check multiple SKUs availability
  checkMultipleAvailability: async (items: Array<{
    item_id: string;
    location_id: string;
    quantity: number;
  }>) => {
    const response = await apiClient.post<{
      all_available: boolean;
      results: Array<{
        item_id: string;
        location_id: string;
        available: boolean;
        current_available: number;
        requested: number;
      }>;
    }>('/inventory/availability/check-multiple', { items });
    return response.data;
  },

  // Get low stock alerts
  getLowStockAlerts: async (locationId?: string, severity?: 'all' | 'critical') => {
    const params = new URLSearchParams();
    if (locationId) params.append('location_id', locationId);
    if (severity) params.append('severity', severity);
    
    const response = await apiClient.get<Array<{
      item_id: string;
      item_name: string;
      location_id: string;
      location_name: string;
      current_stock: number;
      reorder_point: number;
      days_until_stockout?: number;
      severity: 'low' | 'critical';
    }>>(`/inventory/stock-levels/low-stock/alerts?${params.toString()}`);
    return response.data;
  },

  // Get overstock report
  getOverstockReport: async (locationId?: string, thresholdPercentage?: number) => {
    const params = new URLSearchParams();
    if (locationId) params.append('location_id', locationId);
    if (thresholdPercentage) params.append('threshold_percentage', thresholdPercentage.toString());
    
    const response = await apiClient.get<Array<{
      item_id: string;
      item_name: string;
      location_id: string;
      location_name: string;
      current_stock: number;
      max_stock: number;
      excess_quantity: number;
      excess_percentage: number;
      estimated_value: number;
    }>>(`/inventory/stock-levels/overstock/report?${params.toString()}`);
    return response.data;
  },

  // Get stock valuation
  getStockValuation: async (filters?: {
    location_id?: string;
    category_id?: string;
    include_zero_stock?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (filters?.location_id) params.append('location_id', filters.location_id);
    if (filters?.category_id) params.append('category_id', filters.category_id);
    if (filters?.include_zero_stock) params.append('include_zero_stock', 'true');
    
    const response = await apiClient.get<{
      total_value: number;
      total_units: number;
      by_location: Array<{
        location_id: string;
        location_name: string;
        total_value: number;
        total_units: number;
      }>;
      by_category: Array<{
        category_id: string;
        category_name: string;
        total_value: number;
        total_units: number;
      }>;
    }>(`/inventory/stock-levels/valuation?${params.toString()}`);
    return response.data;
  },
};

// Dashboard API
export const inventoryDashboardApi = {
  getSummary: async (locationId?: string) => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const response = await apiClient.get<InventoryDashboardSummary>(
      `/inventory/dashboard/summary${params}`
    );
    return response.data;
  },
};

// Inventory Movements API
export const inventoryMovementsApi = {
  list: async (filters?: {
    inventory_unit_id?: string;
    location_id?: string;
    movement_type?: string;
    date_range?: { start: string; end: string };
  }) => {
    const params = new URLSearchParams();
    if (filters?.inventory_unit_id) params.append('inventory_unit_id', filters.inventory_unit_id);
    if (filters?.location_id) params.append('location_id', filters.location_id);
    if (filters?.movement_type) params.append('movement_type', filters.movement_type);
    if (filters?.date_range) {
      params.append('start_date', filters.date_range.start);
      params.append('end_date', filters.date_range.end);
    }
    
    const response = await apiClient.get<InventoryMovement[]>(
      `/inventory/movements?${params.toString()}`
    );
    return response.data;
  },
};

// Inventory Transfers API
export const inventoryTransfersApi = {
  create: async (data: {
    from_location_id: string;
    to_location_id: string;
    sku_id: string;
    quantity: number;
    requested_by: string;
    notes?: string;
  }) => {
    const response = await apiClient.post<InventoryTransfer>('/inventory/transfers', data);
    return response.data;
  },

  list: async (filters?: {
    location_id?: string;
    status?: TransferStatus;
    date_range?: { start: string; end: string };
  }) => {
    const params = new URLSearchParams();
    if (filters?.location_id) params.append('location_id', filters.location_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.date_range) {
      params.append('start_date', filters.date_range.start);
      params.append('end_date', filters.date_range.end);
    }
    
    const response = await apiClient.get<InventoryTransfer[]>(
      `/inventory/transfers?${params.toString()}`
    );
    return response.data;
  },

  approve: async (transferId: string, approvedBy: string) => {
    const response = await apiClient.put<InventoryTransfer>(
      `/inventory/transfers/${transferId}/approve`,
      { approved_by: approvedBy }
    );
    return response.data;
  },

  complete: async (transferId: string) => {
    const response = await apiClient.put<InventoryTransfer>(
      `/inventory/transfers/${transferId}/complete`
    );
    return response.data;
  },

  cancel: async (transferId: string, reason: string) => {
    const response = await apiClient.put<InventoryTransfer>(
      `/inventory/transfers/${transferId}/cancel`,
      { reason }
    );
    return response.data;
  },
};

// New types for inventory overview
export interface ItemInventoryOverview {
  id: string;
  sku: string;
  item_name: string;
  item_status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  brand_name?: string;
  category_name?: string;
  rental_rate_per_period?: number;
  sale_price?: number;
  is_rentable: boolean;
  is_saleable: boolean;
  total_units: number;
  units_by_status: {
    available: number;
    rented: number;
    sold: number;
    maintenance: number;
    damaged: number;
    retired: number;
  };
  total_quantity_on_hand: number;
  total_quantity_available: number;
  total_quantity_on_rent: number;
  stock_status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  reorder_point: number;
  is_low_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemInventoryDetailed extends ItemInventoryOverview {
  brand_id?: string;
  category_id?: string;
  unit_of_measurement_id?: string;
  unit_of_measurement_name?: string;
  description?: string;
  specifications?: string;
  model_number?: string;
  serial_number_required?: boolean;
  warranty_period_days?: string;
  rental_period?: string;
  purchase_price?: number;
  security_deposit?: number;
  inventory_units: Array<{
    id: string;
    unit_code: string;
    serial_number?: string;
    status: string;
    condition: string;
    location_id: string;
    location_name: string;
    purchase_date?: string;
    purchase_price?: number;
    warranty_expiry?: string;
    last_maintenance_date?: string;
    next_maintenance_date?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
  }>;
  stock_by_location: Array<{
    location_id: string;
    location_name: string;
    quantity_on_hand: number;
    quantity_available: number;
    quantity_on_rent: number;
  }>;
  recent_movements: Array<{
    id: string;
    movement_type: string;
    quantity_change: number;
    reference_type?: string;
    location_name: string;
    created_at: string;
    created_by_name?: string;
  }>;
  is_active: boolean;
  created_by?: string;
  updated_by?: string;
}


// New Inventory Overview API - based on documentation
export const inventoryOverviewApi = {
  // Get inventory overview for multiple items
  getOverview: async (filters?: {
    skip?: number;
    limit?: number;
    item_status?: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
    brand_id?: string;
    category_id?: string;
    stock_status?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
    is_rentable?: boolean;
    is_saleable?: boolean;
    search?: string;
    sort_by?: 'item_name' | 'sku' | 'created_at' | 'total_units' | 'stock_status';
    sort_order?: 'asc' | 'desc';
  }) => {
    const params = new URLSearchParams();
    if (filters?.skip !== undefined) params.append('skip', filters.skip.toString());
    if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters?.item_status) params.append('item_status', filters.item_status);
    if (filters?.brand_id) params.append('brand_id', filters.brand_id);
    if (filters?.category_id) params.append('category_id', filters.category_id);
    if (filters?.stock_status) params.append('stock_status', filters.stock_status);
    if (filters?.is_rentable !== undefined) params.append('is_rentable', filters.is_rentable.toString());
    if (filters?.is_saleable !== undefined) params.append('is_saleable', filters.is_saleable.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const response = await apiClient.get<ItemInventoryOverview[]>(
      `/inventory/items/overview?${params.toString()}`
    );
    return response.data;
  },

  // Get detailed inventory information for a single item
  getDetailed: async (itemId: string) => {
    const response = await apiClient.get<ItemInventoryDetailed>(
      `/inventory/items/${itemId}/detailed`
    );
    return response.data;
  },
};
