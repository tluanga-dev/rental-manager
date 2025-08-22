import { useQuery } from '@tanstack/react-query';
import { brandKeys } from '@/lib/query-keys';
import { brandsApi, BrandListParams } from '@/services/api/brands';

export interface UseBrandsOptions {
  search?: string;
  includeInactive?: boolean;
  limit?: number;
  enabled?: boolean;
  cacheTime?: number;
  staleTime?: number;
}

export function useBrands(options: UseBrandsOptions = {}) {
  const {
    search = '',
    includeInactive = false,
    limit = 100,
    enabled = true,
    cacheTime = 2 * 60 * 1000,      // 2 minutes
    staleTime = 10 * 60 * 1000,     // 10 minutes
  } = options;

  const queryParams: BrandListParams = {
    search,
    is_active: includeInactive ? undefined : true,
    page_size: limit,
    page: 1,
  };

  return useQuery({
    queryKey: brandKeys.list(queryParams),
    queryFn: async () => {
      const response = await brandsApi.list(queryParams);
      return response;
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