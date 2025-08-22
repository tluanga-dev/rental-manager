'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import { rentalsApi } from '@/services/api/rentals';
import type { DueTodayResponse, DueTodayFilters } from '@/types/rentals';

interface UseDueTodayRentalsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  initialFilters?: DueTodayFilters;
}

export function useDueTodayRentals(options: UseDueTodayRentalsOptions = {}) {
  const {
    autoRefresh = true,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    initialFilters = {},
  } = options;

  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<DueTodayFilters>(initialFilters);
  const [retryCount, setRetryCount] = useState(0);

  // Query key that includes filters for proper caching
  const queryKey = useMemo(
    () => ['rentals-due-today', filters],
    [filters]
  );

  // Main query for due today rentals
  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => rentalsApi.getRentalsDueToday(filters),
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: true,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: (failureCount, error) => {
      // Retry up to 3 times with exponential backoff
      if (failureCount < 3) {
        const delay = Math.min(1000 * Math.pow(2, failureCount), 30000);
        setTimeout(() => setRetryCount(prev => prev + 1), delay);
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
  });

  // Update filters and trigger refetch
  const updateFilters = useCallback((newFilters: Partial<DueTodayFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    setRetryCount(0);
    return refetch();
  }, [refetch]);

  // Invalidate and refetch
  const invalidateAndRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['rentals-due-today'] });
    return refresh();
  }, [queryClient, refresh]);

  // Search functionality with debouncing
  const search = useCallback((searchTerm: string) => {
    updateFilters({ search: searchTerm || undefined });
  }, [updateFilters]);

  // Filter by location
  const filterByLocation = useCallback((locationId: string) => {
    updateFilters({ location_id: locationId || undefined });
  }, [updateFilters]);

  // Filter by status
  const filterByStatus = useCallback((status: string) => {
    updateFilters({ status: status || undefined });
  }, [updateFilters]);

  // Computed values
  const rentals = data?.data || [];
  const summary = data?.summary || {
    total_rentals: 0,
    total_value: 0,
    overdue_count: 0,
    locations: [],
    status_breakdown: {},
  };
  const filtersApplied = data?.filters_applied || {};
  const hasFilters = Object.keys(filters).some(key => filters[key as keyof DueTodayFilters]);

  // Error handling
  const errorMessage = useMemo(() => {
    if (!error) return null;
    
    if (error.message.includes('Network Error')) {
      return 'Unable to connect to server. Please check your internet connection.';
    }
    
    if (error.message.includes('500')) {
      return 'Server error occurred. Please try again later.';
    }
    
    if (error.message.includes('403')) {
      return 'You do not have permission to view this data.';
    }
    
    return 'An unexpected error occurred. Please try again.';
  }, [error]);

  // Loading states
  const isInitialLoading = isLoading && !data;
  const isRefreshLoading = isRefetching && !!data;

  return {
    // Data
    rentals,
    summary,
    filtersApplied,
    
    // Loading states
    isLoading: isInitialLoading,
    isRefreshing: isRefreshLoading,
    isError,
    error: errorMessage,
    retryCount,
    
    // Filter state
    filters,
    hasFilters,
    
    // Actions
    updateFilters,
    clearFilters,
    search,
    filterByLocation,
    filterByStatus,
    refresh,
    invalidateAndRefetch,
    
    // Query info
    lastUpdated: data?.timestamp,
    queryKey,
  };
}

export default useDueTodayRentals;