import { apiClient } from '@/lib/axios';

export interface InventoryUnitDetail {
  id: string;
  sku: string;
  serial_number?: string;
  batch_code?: string;
  item_id: string;
  item_name: string;
  category: string;
  purchase_price: number;
  purchase_date: string;
  warranty_expiry?: string;
  current_status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'DAMAGED' | 'SOLD' | 'RETIRED';
  condition: 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
  location_id: string;
  location_name: string;
  tracking_type: 'INDIVIDUAL' | 'BATCH';
  quantity: number;
  notes?: string;
  rental_count: number;
  total_rental_revenue: number;
  utilization_rate: number;
  days_since_purchase: number;
  warranty_status: 'ACTIVE' | 'EXPIRED' | 'NONE';
  maintenance_cost: number;
  depreciated_value: number;
  last_movement_date?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryTrackingFilters {
  search?: string;
  status?: string;
  category?: string;
  location?: string;
  tracking_type?: 'INDIVIDUAL' | 'BATCH';
  purchase_date_from?: string;
  purchase_date_to?: string;
  warranty_status?: 'ACTIVE' | 'EXPIRED' | 'NONE';
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}

export interface PurchaseInventoryUnitsParams {
  purchase_id: string;
  include_analytics?: boolean;
}

export interface InventoryAnalytics {
  total_items: number;
  total_value: number;
  total_current_value: number;
  total_revenue: number;
  average_utilization: number;
  status_distribution: Record<string, number>;
  category_performance: Array<{
    category: string;
    count: number;
    total_value: number;
    total_revenue: number;
    avg_utilization: number;
  }>;
  monthly_trends: Array<{
    month: string;
    purchases_count: number;
    purchases_value: number;
    revenue: number;
  }>;
  top_performers: InventoryUnitDetail[];
  maintenance_alerts: Array<{
    unit_id: string;
    unit_sku: string;
    item_name: string;
    alert_type: 'WARRANTY_EXPIRING' | 'HIGH_MAINTENANCE_COST' | 'LOW_UTILIZATION';
    message: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  total?: number;
  errors?: Record<string, string[]>;
}

export const inventoryTrackingApi = {
  /**
   * Get all inventory units with filtering and pagination
   */
  async getInventoryUnits(filters: InventoryTrackingFilters = {}): Promise<ApiResponse<InventoryUnitDetail[]>> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await apiClient.get(`/inventory/units?${params.toString()}`);
    return response.data;
  },

  /**
   * Get inventory units for a specific purchase transaction
   */
  async getPurchaseInventoryUnits(params: PurchaseInventoryUnitsParams): Promise<ApiResponse<InventoryUnitDetail[]>> {
    const response = await apiClient.get(`/purchases/${params.purchase_id}/inventory-units`, {
      params: {
        include_analytics: params.include_analytics || false,
      },
    });
    return response.data;
  },

  /**
   * Get detailed inventory tracking analytics
   */
  async getInventoryAnalytics(filters: InventoryTrackingFilters = {}): Promise<ApiResponse<InventoryAnalytics>> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await apiClient.get(`/inventory/analytics?${params.toString()}`);
    return response.data;
  },

  /**
   * Get individual unit details by ID
   */
  async getUnitById(unitId: string): Promise<ApiResponse<InventoryUnitDetail>> {
    const response = await apiClient.get(`/inventory/units/${unitId}`);
    return response.data;
  },

  /**
   * Get unit history including all movements and transactions
   */
  async getUnitHistory(unitId: string): Promise<ApiResponse<{
    unit: InventoryUnitDetail;
    movements: Array<{
      id: string;
      movement_type: string;
      quantity_change: number;
      transaction_id?: string;
      transaction_type?: string;
      notes?: string;
      created_at: string;
    }>;
    rentals: Array<{
      id: string;
      rental_number: string;
      customer_name: string;
      start_date: string;
      end_date?: string;
      status: string;
      revenue: number;
    }>;
  }>> {
    const response = await apiClient.get(`/inventory/units/${unitId}/history`);
    return response.data;
  },

  /**
   * Get units by serial number (for quick lookup)
   */
  async getUnitBySerial(serialNumber: string): Promise<ApiResponse<InventoryUnitDetail>> {
    const response = await apiClient.get(`/inventory/units/by-serial/${encodeURIComponent(serialNumber)}`);
    return response.data;
  },

  /**
   * Get units by batch code
   */
  async getUnitsByBatch(batchCode: string): Promise<ApiResponse<InventoryUnitDetail[]>> {
    const response = await apiClient.get(`/inventory/units/by-batch/${encodeURIComponent(batchCode)}`);
    return response.data;
  },

  /**
   * Update unit details (status, condition, notes, etc.)
   */
  async updateUnit(unitId: string, updates: Partial<{
    status: string;
    condition: string;
    location_id: string;
    notes: string;
    maintenance_cost: number;
  }>): Promise<ApiResponse<InventoryUnitDetail>> {
    const response = await apiClient.put(`/inventory/units/${unitId}`, updates);
    return response.data;
  },

  /**
   * Get utilization report for date range
   */
  async getUtilizationReport(params: {
    start_date: string;
    end_date: string;
    category?: string;
    location?: string;
  }): Promise<ApiResponse<{
    period: string;
    total_units: number;
    rented_units: number;
    utilization_rate: number;
    revenue: number;
    top_items: Array<{
      item_name: string;
      units_count: number;
      rentals_count: number;
      utilization_rate: number;
      revenue: number;
    }>;
  }>> {
    const response = await apiClient.get('/inventory/utilization-report', { params });
    return response.data;
  },

  /**
   * Export inventory tracking data
   */
  async exportInventoryData(filters: InventoryTrackingFilters & {
    format: 'csv' | 'xlsx' | 'pdf';
    include_history?: boolean;
  }): Promise<Blob> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await apiClient.get(`/inventory/export?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Search inventory units with advanced filters
   */
  async searchUnits(query: {
    q: string; // Search term
    filters?: {
      item_category?: string[];
      status?: string[];
      location?: string[];
      price_range?: [number, number];
      purchase_date_range?: [string, string];
      warranty_status?: string[];
    };
    sort?: {
      field: string;
      order: 'asc' | 'desc';
    };
    pagination?: {
      page: number;
      per_page: number;
    };
  }): Promise<ApiResponse<{
    units: InventoryUnitDetail[];
    facets: {
      categories: Array<{ name: string; count: number }>;
      statuses: Array<{ name: string; count: number }>;
      locations: Array<{ name: string; count: number }>;
    };
    suggestions: string[];
  }>> {
    const response = await apiClient.post('/inventory/search', query);
    return response.data;
  },
};

// React Query hooks for the API calls
export const INVENTORY_TRACKING_QUERY_KEYS = {
  all: ['inventory-tracking'] as const,
  units: (filters?: InventoryTrackingFilters) => ['inventory-tracking', 'units', filters] as const,
  unit: (id: string) => ['inventory-tracking', 'unit', id] as const,
  unitHistory: (id: string) => ['inventory-tracking', 'unit-history', id] as const,
  purchaseUnits: (purchaseId: string) => ['inventory-tracking', 'purchase-units', purchaseId] as const,
  analytics: (filters?: InventoryTrackingFilters) => ['inventory-tracking', 'analytics', filters] as const,
  utilization: (params: any) => ['inventory-tracking', 'utilization', params] as const,
};