import { useQuery } from '@tanstack/react-query';
import { categoryKeys } from '@/lib/query-keys';
import { categoriesApi, CategoryResponse, PaginatedCategories } from '@/services/api/categories';

export interface UseLeafCategoriesOptions {
  enabled?: boolean;
  cacheTime?: number;
  staleTime?: number;
}

export function useLeafCategories(options: UseLeafCategoriesOptions = {}) {
  const {
    enabled = true,
    cacheTime = 5 * 60 * 1000,      // 5 minutes
    staleTime = 30 * 60 * 1000,     // 30 minutes - leaf categories change less frequently
  } = options;

  return useQuery<CategoryResponse[]>({
    queryKey: categoryKeys.leaf(),
    queryFn: async () => {
      try {
        const response = await categoriesApi.list({
          page: 1,
          page_size: 20,
          sort_field: 'name',
          sort_direction: 'asc',
          include_inactive: false
        });
        
        // The list endpoint returns a paginated response with items array
        if (response && Array.isArray(response.items)) {
          return response.items;
        }
        
        // Fallback to empty array if response is unexpected
        console.warn('Unexpected response format from categories list:', response);
        return [];
      } catch (error) {
        console.error('Error fetching categories:', error);
        throw error;
      }
    },
    enabled,
    gcTime: cacheTime,
    staleTime,
    refetchOnWindowFocus: false, // Leaf categories are relatively stable
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}