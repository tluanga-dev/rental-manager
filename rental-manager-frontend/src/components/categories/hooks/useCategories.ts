import { useQuery } from '@tanstack/react-query';
import { categoryKeys } from '@/lib/query-keys';
import { categoriesApi, PaginatedCategories } from '@/services/api/categories';

export interface UseCategoriesOptions {
  search?: string;
  parentId?: string;
  isLeaf?: boolean;
  includeInactive?: boolean;
  limit?: number;
  skip?: number;
  enabled?: boolean;
  cacheTime?: number;
  staleTime?: number;
}

export function useCategories(options: UseCategoriesOptions = {}) {
  const {
    search = '',
    parentId,
    isLeaf,
    includeInactive = false,
    limit = 100,
    skip = 0,
    enabled = true,
    cacheTime = 5 * 60 * 1000,      // 5 minutes
    staleTime = 10 * 60 * 1000,     // 10 minutes
  } = options;

  // Convert limit/skip to page/page_size for API
  const page = Math.floor(skip / limit) + 1;
  const page_size = limit;

  const queryParams = {
    search,
    parent_id: parentId,
    is_leaf: isLeaf,
    is_active: includeInactive ? undefined : true,
    page,
    page_size,
  };

  return useQuery<PaginatedCategories>({
    queryKey: categoryKeys.list(queryParams),
    queryFn: async () => {
      try {
        const response = await categoriesApi.list(queryParams);
        
        // Ensure response has the expected structure
        if (response && typeof response === 'object' && 'items' in response) {
          return response as PaginatedCategories;
        }
        
        // If response is unexpected, try to normalize it
        if (Array.isArray(response)) {
          return {
            items: response,
            total: response.length,
            page: 1,
            page_size: response.length,
            total_pages: 1,
            has_next: false,
            has_previous: false,
          };
        }
        
        // Fallback to empty result
        console.warn('Unexpected response format from categories list:', response);
        return {
          items: [],
          total: 0,
          page: 1,
          page_size: 0,
          total_pages: 0,
          has_next: false,
          has_previous: false,
        };
      } catch (error) {
        console.error('Error fetching categories:', error);
        throw error;
      }
    },
    enabled,
    gcTime: cacheTime,
    staleTime,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}