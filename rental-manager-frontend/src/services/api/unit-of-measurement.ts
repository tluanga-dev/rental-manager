import { apiClient } from '@/lib/axios';
import type {
  UnitOfMeasurement,
  CreateUnitOfMeasurementRequest,
  UpdateUnitOfMeasurementRequest,
  UnitOfMeasurementListResponse,
} from '@/types/unit-of-measurement';

export const unitOfMeasurementApi = {
  // Create a new unit of measurement
  create: async (data: CreateUnitOfMeasurementRequest): Promise<UnitOfMeasurement> => {
    const response = await apiClient.post('/unit-of-measurement/', data);
    return response.data.data;
  },

  // Get all units of measurement
  list: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    is_active?: boolean;
    sort_field?: string;
    sort_direction?: 'asc' | 'desc';
    include_inactive?: boolean;
  }): Promise<UnitOfMeasurementListResponse> => {
    // Convert boolean parameters to strings for proper query parameter serialization
    const queryParams = params ? {
      ...params,
      ...(params.is_active !== undefined && { is_active: params.is_active.toString() }),
      ...(params.include_inactive !== undefined && { include_inactive: params.include_inactive.toString() }),
    } : undefined;
    const response = await apiClient.get('/unit-of-measurement/', { params: queryParams });
    return response.data.data;
  },

  // Get units for dropdown (formatted for UnitOfMeasurementDropdown component)
  getUnits: async (params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    units: Array<{
      id: string;
      name: string;
      abbreviation?: string;
    }>;
    total: number;
  }> => {
    const apiParams = {
      search: params?.search,
      page_size: params?.limit || 100,
      page: params?.offset ? Math.floor(params.offset / (params.limit || 100)) + 1 : 1,
    };

    const response = await apiClient.get('/unit-of-measurement/', { params: apiParams });
    const data = response.data.data;
    
    return {
      units: data.items.map((unit: UnitOfMeasurement) => ({
        id: unit.id,
        name: unit.name,
        abbreviation: unit.abbreviation,
      })),
      total: data.total,
    };
  },

  // Get unit of measurement by ID
  getById: async (id: string): Promise<UnitOfMeasurement> => {
    const response = await apiClient.get(`/unit-of-measurement/${id}`);
    return response.data.data;
  },

  // Get unit of measurement by name
  getByName: async (name: string): Promise<UnitOfMeasurement> => {
    const response = await apiClient.get(`/unit-of-measurement/by-name/${name}`);
    return response.data.data;
  },

  // Get unit of measurement by abbreviation
  getByAbbreviation: async (abbreviation: string): Promise<UnitOfMeasurement> => {
    const response = await apiClient.get(`/unit-of-measurement/by-abbreviation/${abbreviation}`);
    return response.data.data;
  },

  // Update unit of measurement
  update: async (id: string, data: UpdateUnitOfMeasurementRequest): Promise<UnitOfMeasurement> => {
    const response = await apiClient.put(`/unit-of-measurement/${id}`, data);
    return response.data.data;
  },

  // Delete unit of measurement (soft delete)
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/unit-of-measurement/${id}`);
  },

  // Search units by name
  searchByName: async (name: string, limit: number = 10): Promise<UnitOfMeasurement[]> => {
    const params = {
      search: name,
      page_size: limit,
    };
    const response = await apiClient.get('/unit-of-measurement/', { params });
    const data = response.data.data;
    return data.items;
  },

  // Get active units (for dropdowns)
  getActive: async (params?: {
    search?: string;
    limit?: number;
  }): Promise<UnitOfMeasurement[]> => {
    const response = await apiClient.get('/unit-of-measurement/active/', { params });
    return response.data.data;
  },

  // Bulk operations
  bulkOperation: async (unitIds: string[], operation: 'activate' | 'deactivate'): Promise<{
    success_count: number;
    failure_count: number;
    errors: string[];
  }> => {
    const response = await apiClient.post('/unit-of-measurement/bulk-operation/', {
      unit_ids: unitIds,
      operation,
    });
    return response.data.data;
  },

  // Activate unit
  activate: async (id: string): Promise<void> => {
    await apiClient.post(`/unit-of-measurement/${id}/activate/`);
  },

  // Deactivate unit
  deactivate: async (id: string): Promise<void> => {
    await apiClient.post(`/unit-of-measurement/${id}/deactivate/`);
  },

  // Get statistics
  getStats: async (): Promise<{
    total_units: number;
    active_units: number;
    inactive_units: number;
    units_with_items: number;
    units_without_items: number;
    most_used_units: Array<{
      name: string;
      item_count: number;
    }>;
  }> => {
    const response = await apiClient.get('/unit-of-measurement/stats/');
    return response.data.data;
  },

  // Export units
  export: async (includeInactive: boolean = false): Promise<UnitOfMeasurement[]> => {
    const response = await apiClient.get('/unit-of-measurement/export/', {
      params: { include_inactive: includeInactive.toString() },
    });
    return response.data.data;
  },

  // Import units
  import: async (units: CreateUnitOfMeasurementRequest[]): Promise<{
    total_processed: number;
    successful_imports: number;
    failed_imports: number;
    skipped_imports: number;
    errors: string[];
  }> => {
    const response = await apiClient.post('/unit-of-measurement/import/', units);
    return response.data.data;
  },
};