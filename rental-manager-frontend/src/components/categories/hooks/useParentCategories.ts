import { useQuery } from '@tanstack/react-query';
import { categoryKeys } from '@/lib/query-keys';
import { categoriesApi, CategoryResponse } from '@/services/api/categories';

export interface UseParentCategoriesOptions {
  enabled?: boolean;
  cacheTime?: number;
  staleTime?: number;
  excludeId?: string; // Category ID to exclude (for editing)
  includeInactive?: boolean;
}

export function useParentCategories(options: UseParentCategoriesOptions = {}) {
  const {
    enabled = true,
    cacheTime = 5 * 60 * 1000,      // 5 minutes
    staleTime = 30 * 60 * 1000,     // 30 minutes
    excludeId,
    includeInactive = false,
  } = options;

  return useQuery<CategoryResponse[]>({
    queryKey: categoryKeys.parents(excludeId, includeInactive),
    queryFn: async () => {
      try {
        const response = await categoriesApi.getAvailableParents(excludeId, {
          include_inactive: includeInactive
        });
        
        // The available parents endpoint returns an array directly
        if (Array.isArray(response)) {
          return response;
        }
        
        // Fallback: if response has unexpected structure, return empty array
        console.warn('Unexpected response structure from parent categories API:', response);
        return [];
        
      } catch (error) {
        console.error('Error fetching parent categories:', error);
        
        // Return empty array on error to prevent crashes
        return [];
      }
    },
    enabled,
    cacheTime,
    staleTime,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}