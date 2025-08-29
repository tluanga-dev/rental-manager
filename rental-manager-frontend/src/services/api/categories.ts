
// Updated to match actual backend API expectations
import { apiClient } from '@/lib/axios';
// Updated to match actual backend API expectations
export interface CategoryCreate {
  name: string;
  parent_category_id?: string | null;
  display_order?: number;
}

export interface CategoryResponse {
  id: string;
  name: string;
  category_code: string;
  category_path: string;
  category_level: number;
  parent_category_id: string | null;
  is_leaf: boolean;
  is_active: boolean;
  display_order: number;
  child_count?: number;
  item_count?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryTree extends CategoryResponse {
  children?: CategoryTree[];
}

export interface CategoryUpdate {
  name?: string;
  description?: string;
  display_order?: number;
  parent_category_id?: string | null;
  is_active?: boolean;
  is_leaf?: boolean;
}

export interface CategoryMove {
  new_parent_id?: string | null;
}

export interface PaginatedCategories {
  items: CategoryResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export const categoriesApi = {
  // Create a new category
  create: async (data: CategoryCreate): Promise<CategoryResponse> => {
    const response = await apiClient.post('/categories/', data);
    // The axios interceptor wraps responses in {success: true, data: originalResponse}
    return response.data.data;
  },

  // Get all categories with optional filters
  list: async (params?: {
    page?: number;
    page_size?: number;
    name?: string;
    parent_id?: string;
    level?: number;
    is_leaf?: boolean;
    is_active?: boolean;
    search?: string;
    sort_field?: string;
    sort_direction?: 'asc' | 'desc';
    include_inactive?: boolean;
  }): Promise<PaginatedCategories> => {
    // Convert boolean parameters to strings for proper query parameter serialization
    const queryParams = params ? {
      ...params,
      ...(params.is_leaf !== undefined && { is_leaf: params.is_leaf.toString() }),
      ...(params.is_active !== undefined && { is_active: params.is_active.toString() }),
      ...(params.include_inactive !== undefined && { include_inactive: params.include_inactive.toString() }),
    } : undefined;
    const response = await apiClient.get('/categories/', { params: queryParams });
    // The axios interceptor wraps responses in {success: true, data: originalResponse}
    return response.data.data;
  },

  // Get category tree structure
  getTree: async (params?: {
    include_inactive?: boolean;
  }): Promise<CategoryTree[]> => {
    // Convert boolean parameters to strings for proper query parameter serialization
    const queryParams = params ? {
      ...params,
      ...(params.include_inactive !== undefined && { include_inactive: params.include_inactive.toString() }),
    } : undefined;
    const response = await apiClient.get('/categories/tree/', { params: queryParams });
    // The axios interceptor wraps responses in {success: true, data: originalResponse}
    return response.data.data;
  },

  // Get category by ID
  getById: async (id: string): Promise<CategoryResponse> => {
    const response = await apiClient.get(`/categories/${id}`);
    // The axios interceptor wraps responses in {success: true, data: originalResponse}
    return response.data.data;
  },

  // Update category
  update: async (id: string, data: CategoryUpdate): Promise<CategoryResponse> => {
    const response = await apiClient.put(`/categories/${id}`, data);
    // The axios interceptor wraps responses in {success: true, data: originalResponse}
    return response.data.data;
  },

  // Delete category (soft delete)
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/categories/${id}`);
  },

  // Get leaf categories (categories with no children)
  getLeafCategories: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    is_active?: boolean;
  }): Promise<PaginatedCategories> => {
    // Convert boolean parameters to strings for proper query parameter serialization
    const queryParams = params ? {
      ...params,
      ...(params.is_active !== undefined && { is_active: params.is_active.toString() }),
      is_leaf: 'true' // Send as string for proper query parameter serialization
    } : { is_leaf: 'true' };
    
    const response = await apiClient.get('/v1/categories/', { 
      params: queryParams
    });
    // The axios interceptor wraps responses in {success: true, data: originalResponse}
    return response.data.data;
  },

  // Get parent categories (categories that can have children)
  getParentCategories: async (params?: {
    include_inactive?: boolean;
  }): Promise<CategoryResponse[]> => {
    // Convert boolean parameters to strings for proper query parameter serialization
    const queryParams = params ? {
      ...params,
      ...(params.include_inactive !== undefined && { include_inactive: params.include_inactive.toString() }),
    } : undefined;
    const response = await apiClient.get('/categories/parents/', { params: queryParams });
    // The axios interceptor wraps responses in {success: true, data: originalResponse}
    return response.data.data;
  },

  // Get leaf categories using the dedicated leaves endpoint
  getLeaves: async (params?: {
    include_inactive?: boolean;
  }): Promise<CategoryResponse[]> => {
    // Convert boolean parameters to strings for proper query parameter serialization
    const queryParams = params ? {
      ...params,
      ...(params.include_inactive !== undefined && { include_inactive: params.include_inactive.toString() }),
    } : undefined;
    const response = await apiClient.get('/categories/leaves/', { params: queryParams });
    // The axios interceptor wraps responses in {success: true, data: originalResponse}
    return response.data.data;
  },

  // Toggle category active status
  toggleActive: async (id: string): Promise<CategoryResponse> => {
    const response = await apiClient.patch(`/categories/${id}/toggle-active`);
    // The axios interceptor wraps responses in {success: true, data: originalResponse}
    return response.data.data;
  },

  // Move category to new parent
  moveCategory: async (id: string, data: CategoryMove): Promise<CategoryResponse> => {
    const response = await apiClient.patch(`/categories/${id}/move`, data);
    // The axios interceptor wraps responses in {success: true, data: originalResponse}
    return response.data.data;
  },

  // Get categories that can be parents (excluding current category and its descendants)
  getAvailableParents: async (excludeId?: string, params?: {
    include_inactive?: boolean;
  }): Promise<CategoryResponse[]> => {
    const queryParams = {
      ...params,
      ...(params?.include_inactive !== undefined && { include_inactive: params.include_inactive.toString() }),
      ...(excludeId && { exclude_id: excludeId }),
    };
    const response = await apiClient.get('/categories/parents/', { params: queryParams });
    // The axios interceptor wraps responses in {success: true, data: originalResponse}
    return response.data.data;
  },
};