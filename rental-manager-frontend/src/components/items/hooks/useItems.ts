import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '@/services/api/items';
import type { ItemSearchParams, CreateItemRequest } from '@/types/item';

export interface UseItemsOptions extends ItemSearchParams {
  cacheTime?: number;
  staleTime?: number;
  enabled?: boolean;
}

export function useItems(options: UseItemsOptions = {}) {
  const {
    search,
    category_id,
    brand_id,
    is_active = true,
    is_serialized,
    min_price,
    max_price,
    min_stock,
    available_only,
    skip = 0,
    limit = 50,
    sort_by = 'item_name',
    sort_order = 'asc',
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 1 * 60 * 1000, // 1 minute
    enabled = true,
  } = options;

  return useQuery({
    queryKey: [
      'items', 
      { 
        search, 
        category_id, 
        brand_id, 
        active_only: is_active,  // Use active_only in query key to match backend
        is_serialized,
        min_price,
        max_price,
        min_stock,
        available_only,
        skip, 
        limit, 
        sort_by, 
        sort_order 
      }
    ],
    queryFn: () => itemsApi.list({
      search,
      category_id,
      brand_id,
      active_only: is_active,  // Map is_active to active_only for backend
      is_serialized,
      min_price,
      max_price,
      min_stock,
      available_only,
      skip,
      limit,
      sort_by,
      sort_order,
    }),
    enabled,
    cacheTime,
    staleTime,
  });
}

// Item Creation Hook
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateItemRequest) => itemsApi.create(data),
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      // toast.success('Item created successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || 'Failed to create item';
      // toast.error(message);
    }
  });
}