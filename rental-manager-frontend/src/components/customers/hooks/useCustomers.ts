import { useQuery } from '@tanstack/react-query';
import { customerKeys } from '@/lib/query-keys';
import { customersApi } from '@/services/api/customers';
import { transformCustomerResponse } from '@/utils/customer-utils';
import type { CustomerQueryParams } from '@/types/customer';

export interface UseCustomerOptions {
  search?: string;
  customerType?: 'INDIVIDUAL' | 'BUSINESS' | 'all';
  customerTier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  blacklistStatus?: 'CLEAR' | 'BLACKLISTED' | 'all';
  includeInactive?: boolean;
  limit?: number;
  enabled?: boolean;
  cacheTime?: number;
  staleTime?: number;
}

export function useCustomers(options: UseCustomerOptions = {}) {
  const {
    search = '',
    customerType = 'all',
    customerTier,
    blacklistStatus = 'all',
    includeInactive = false,
    limit = 100,
    enabled = true,
    cacheTime = 2 * 60 * 1000,      // 2 minutes
    staleTime = 10 * 60 * 1000,     // 10 minutes
  } = options;

  const queryParams: CustomerQueryParams = {
    search,
    customer_type: customerType === 'all' ? undefined : customerType,
    customer_tier: customerTier,
    blacklist_status: blacklistStatus === 'all' ? undefined : blacklistStatus,
    status: includeInactive ? 'all' : 'active',
    limit,
    sortBy: 'name',
    sortOrder: 'asc',
  };

  return useQuery({
    queryKey: customerKeys.list(queryParams),
    queryFn: async () => {
      try {
        // Use the customers API to get customer data
        const response = await customersApi.list({
          search,
          customer_type: customerType === 'all' ? undefined : customerType,
          customer_tier: customerTier,
          blacklist_status: blacklistStatus === 'all' ? undefined : blacklistStatus,
          is_active: includeInactive ? undefined : true,
          limit,
          skip: 0,
        });

        // The API returns a paginated response with items array
        const customers = response.items || [];
        
        return {
          customers: customers.map(transformCustomerResponse),
          total: response.total || customers.length,
        };
      } catch (error) {
        // Log the error and throw it to be handled by React Query
        console.error('Failed to fetch customers:', error);
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