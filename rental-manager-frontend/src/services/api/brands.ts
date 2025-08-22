import { apiClient } from '@/lib/axios';

// Brand Types - Updated to match current API
export interface BrandCreate {
  name: string;
  code?: string;
  description?: string;
  is_active?: boolean;
}

export interface BrandUpdate {
  name?: string;
  code?: string;
  description?: string;
}

export interface Brand {
  id: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandListResponse {
  items: Brand[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface BrandListParams {
  page?: number;
  page_size?: number;
  name?: string;
  code?: string;
  is_active?: boolean;
  search?: string;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  include_inactive?: boolean;
}

// Brands API - Updated to match current API
export const brandsApi = {
  create: async (brandData: BrandCreate): Promise<Brand> => {
    const response = await apiClient.post('/master-data/brands/', brandData);
    return response.data.data;
  },

  list: async (params: BrandListParams = {}): Promise<BrandListResponse> => {
    // Convert boolean parameters to strings for proper query parameter serialization
    const queryParams = {
      ...params,
      ...(params.is_active !== undefined && { is_active: params.is_active.toString() }),
      ...(params.include_inactive !== undefined && { include_inactive: params.include_inactive.toString() }),
    };
    const response = await apiClient.get('/master-data/brands/', { params: queryParams });
    return response.data.data;
  },

  getById: async (brandId: string): Promise<Brand> => {
    const response = await apiClient.get(`/master-data/brands/${brandId}`);
    return response.data.data;
  },

  update: async (brandId: string, brandData: BrandUpdate): Promise<Brand> => {
    const response = await apiClient.put(`/master-data/brands/${brandId}`, brandData);
    return response.data.data;
  },

  delete: async (brandId: string): Promise<void> => {
    await apiClient.delete(`/master-data/brands/${brandId}`);
  },
};