import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rentalsApi } from '@/services/api/rentals';
import { RentalFilterParams } from '@/types/rentals';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

export interface UseRentalsOptions extends RentalFilterParams {
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  cacheTime?: number;
}

export const useRentals = (options: UseRentalsOptions = {}) => {
  const { 
    enabled = true, 
    refetchInterval, 
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 10 * 60 * 1000, // 10 minutes
    ...filters 
  } = options;
  
  // Debounce filters to avoid excessive API calls
  const debouncedFilters = useDebounce(filters, 300);
  
  const query = useQuery({
    queryKey: ['rental-transactions', debouncedFilters],
    queryFn: async () => {
      try {
        // First try the new enhanced API
        const result = await rentalsApi.getRentalTransactions(debouncedFilters);
        console.log('getRentalTransactions result:', result);
        return result;
      } catch (error) {
        console.error('getRentalTransactions failed, trying fallback:', error);
        try {
          // Fallback to the original getRentals method
          const fallbackResult = await rentalsApi.getRentals(debouncedFilters);
          console.log('getRentals fallback result:', fallbackResult);
          return fallbackResult;
        } catch (fallbackError) {
          console.error('Both rental APIs failed:', fallbackError);
          // Return empty array if both fail
          return [];
        }
      }
    },
    enabled,
    refetchInterval,
    staleTime,
    cacheTime,
    retry: 2,
    retryDelay: 1000,
  });

  return {
    ...query,
    rentals: Array.isArray(query.data) ? query.data : (query.data?.data || query.data?.items || []),
    totalCount: Array.isArray(query.data) ? query.data.length : (query.data?.total || query.data?.length || 0),
  };
};

// Hook for single rental with lifecycle polling
export const useRental = (
  rentalId: string, 
  options: { pollingInterval?: number; enabled?: boolean } = {}
) => {
  const { pollingInterval = 30000, enabled = true } = options; // Default 30 seconds
  
  return useQuery({
    queryKey: ['rental', rentalId],
    queryFn: () => rentalsApi.getRentalById(rentalId),
    enabled: !!rentalId && enabled,
    refetchInterval: pollingInterval,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

// Hook for rental search
export const useRentalSearch = (searchTerm: string, limit = 10) => {
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  return useQuery({
    queryKey: ['rental-search', debouncedSearchTerm, limit],
    queryFn: () => rentalsApi.searchRentals(debouncedSearchTerm, limit),
    enabled: debouncedSearchTerm.length >= 3,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook for overdue rentals specifically
export const useOverdueRentals = (filters: Omit<RentalFilterParams, 'overdue_only'> = {}) => {
  return useRentals({
    ...filters,
    overdue_only: true,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes for overdue rentals
  });
};

// Hook for active rentals
export const useActiveRentals = (filters: Omit<RentalFilterParams, 'rental_status'> = {}) => {
  return useRentals({
    ...filters,
    rental_status: 'ACTIVE',
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes for active rentals
  });
};

export default useRentals;