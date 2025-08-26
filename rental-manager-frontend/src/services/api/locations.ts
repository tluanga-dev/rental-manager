import { apiClient } from '@/lib/axios';
import type { Location as LocationModel } from '@/types/location';

// Use Location type from shared types
export type { Location as LocationModel } from '@/types/location';

interface LocationListParams {
  skip?: number;
  limit?: number;
  location_type?: string;
  active_only?: boolean;
  search?: string;
}

interface LocationListResponse {
  items: LocationModel[];
  total: number;
  skip: number;
  limit: number;
  has_next: boolean;
  has_previous: boolean;
}

interface CreateLocationData {
  location_name: string;      // Use backend field names directly
  location_code: string;      // Use backend field names directly
  location_type: 'WAREHOUSE' | 'STORE' | 'SERVICE_CENTER';
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  contact_number?: string | null;  // Use backend field name
  email?: string | null;           // Use backend field name
  contact_person?: string | null;
}

interface UpdateLocationData {
  location_name?: string;
  location_code?: string;
  location_type?: 'WAREHOUSE' | 'STORE' | 'SERVICE_CENTER';
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  contact_number?: string | null;  // Use backend field name
  email?: string | null;           // Use backend field name
  manager_user_id?: number | null;
  contact_person?: string | null;
}

interface AssignManagerData {
  manager_user_id: string;
}

export const locationsApi = {
  // Create a new location
  create: async (data: CreateLocationData): Promise<LocationModel> => {
    // Debug logging to see what data is being sent
    console.log('🔍 Creating location with data:', JSON.stringify(data, null, 2));
    console.log('🔍 Data keys:', Object.keys(data));
    console.log('🔍 location_code:', data.location_code);
    console.log('🔍 location_name:', data.location_name);
    
    const response = await apiClient.post('/locations/', data);
    return (response.data.success ? response.data.data : response.data) as LocationModel;
  },

  // List locations with pagination and filters - Fixed URL and parameters
  list: async (params: LocationListParams = {}): Promise<LocationListResponse> => {
    const response = await apiClient.get('/locations/', { params });
    const data = response.data.success ? response.data.data : response.data;
    
    // Handle the actual API response structure with 'locations' and 'pagination' properties
    if (data.locations && data.pagination) {
      return {
        items: data.locations,  // Map 'locations' to 'items'
        total: data.pagination.total_items || data.locations.length,
        skip: data.pagination.page || params.skip || 0,
        limit: data.pagination.page_size || params.limit || 100,
        has_next: data.pagination.has_next || false,
        has_previous: data.pagination.has_previous || false
      };
    }
    
    // Handle direct array response
    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        skip: params.skip || 0,
        limit: params.limit || 100,
        has_next: false,
        has_previous: false
      };
    }
    
    // Return data as is if it already has the expected structure
    return data;
  },

  // Get location by ID - Fixed URL
  getById: async (id: string): Promise<LocationModel> => {
    const response = await apiClient.get(`/locations/${id}`);
    return (response.data.success ? response.data.data : response.data) as LocationModel;
  },

  // Update an existing location - Fixed URL
  update: async (id: string, data: UpdateLocationData): Promise<LocationModel> => {
    const response = await apiClient.put(`/locations/${id}`, data);
    return (response.data.success ? response.data.data : response.data) as LocationModel;
  },

  // Delete a location (soft delete) - Fixed URL
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/locations/${id}`);
  },

  // Get active locations only
  getActive: async (): Promise<LocationModel[]> => {
    const response = await locationsApi.list({ active_only: true });
    return response.items;
  },

  // Search locations by name
  search: async (query: string, limit: number = 10): Promise<LocationModel[]> => {
    const response = await locationsApi.list({ search: query, limit });
    return response.items;
  },

  // Activate a location
  activate: async (id: string): Promise<LocationModel> => {
    const response = await apiClient.post(`/locations/${id}/activate`);
    return (response.data.success ? response.data.data : response.data) as LocationModel;
  },

  // Deactivate a location
  deactivate: async (id: string): Promise<LocationModel> => {
    const response = await apiClient.post(`/locations/${id}/deactivate`);
    return (response.data.success ? response.data.data : response.data) as LocationModel;
  },

  // Assign manager to location
  assignManager: async (id: string, data: AssignManagerData): Promise<LocationModel> => {
    const response = await apiClient.post(`/locations/${id}/assign-manager`, data);
    return (response.data.success ? response.data.data : response.data) as LocationModel;
  },

  // Remove manager from location
  removeManager: async (id: string): Promise<LocationModel> => {
    const response = await apiClient.post(`/locations/${id}/remove-manager`);
    return (response.data.success ? response.data.data : response.data) as LocationModel;
  }
};
