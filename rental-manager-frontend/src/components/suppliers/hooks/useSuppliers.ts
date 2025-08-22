import { useQuery } from '@tanstack/react-query';
import { supplierKeys } from '@/lib/query-keys';
import { suppliersApi } from '@/services/api/suppliers';
import { SupplierQueryParams } from '../SupplierDropdown/SupplierDropdown.types';

export interface UseSupplierOptions {
  search?: string;
  includeInactive?: boolean;
  limit?: number;
  enabled?: boolean;
  cacheTime?: number;
  staleTime?: number;
}

export function useSuppliers(options: UseSupplierOptions = {}) {
  const {
    search = '',
    includeInactive = false,
    limit = 100,
    enabled = true,
    cacheTime = 2 * 60 * 1000,      // 2 minutes
    staleTime = 10 * 60 * 1000,     // 10 minutes
  } = options;

  const queryParams: SupplierQueryParams = {
    search,
    status: includeInactive ? 'all' : 'active',
    limit,
    sortBy: 'name',
    sortOrder: 'asc',
  };

  return useQuery({
    queryKey: supplierKeys.list(queryParams),
    queryFn: async () => {
      // Use the existing API with proper params
      const response = await suppliersApi.getSuppliers({
        search,
        status: includeInactive ? 'all' : 'active',
        limit,
        offset: 0,
      });
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