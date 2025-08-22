import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useDebounce } from './use-debounce';
import { rentableItemsApi } from '@/services/api/rentable-items';
import type { RentableItem, RentableItemsParams } from '@/types/rentable-items';

// Simplified response type for the new API
interface RentableItemsResponse {
  items: RentableItem[];
  total: number;
}

// Search params type
interface RentableItemSearchParams extends RentableItemsParams {
  search?: string;
}

// Result types
interface UseRentableItemsResult {
  data?: RentableItemsResponse;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  updateParams: (params: Partial<RentableItemSearchParams>) => void;
  resetParams: () => void;
}

interface UseRentableItemSearchResult {
  items: RentableItem[];
  isLoading: boolean;
  error: Error | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  updateParams: (params: Partial<RentableItemSearchParams>) => void;
}

// Main hook for rentable items management
export function useRentableItems(params?: RentableItemSearchParams): UseRentableItemsResult {
  const [localParams, setLocalParams] = useState<RentableItemSearchParams>(params || {});

  const {
    data,
    isLoading,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['rentable-items', localParams],
    queryFn: ({ pageParam = 0 }) =>
      // Use the new rentable items API with proper response handling
      rentableItemsApi.getRentableItems({
        ...localParams,
        skip: pageParam,
        limit: localParams.limit || 20,
      }).then(items => ({
        items,
        total: items.length, // Simplified for now - you might want total count from API
      })),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return totalFetched < lastPage.total ? totalFetched : undefined;
    },
    keepPreviousData: true,
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateParams = useCallback((newParams: Partial<RentableItemSearchParams>) => {
    setLocalParams(prev => ({ ...prev, ...newParams }));
  }, []);

  const resetParams = useCallback(() => {
    setLocalParams({});
  }, []);

  // Flatten paginated data
  const flattenedData = useMemo(() => {
    if (!data) return undefined;
    
    const allItems = data.pages.flatMap(page => page.items);
    return {
      items: allItems,
      total: data.pages[0]?.total || 0,
      skip: localParams.skip || 0,
      limit: localParams.limit || 20,
    };
  }, [data, localParams]);

  return {
    data: flattenedData,
    isLoading,
    error: error as Error | null,
    refetch,
    hasNextPage: !!hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    params: localParams,
    updateParams,
    resetParams,
  };
}

// Debounced search hook for rentable items
export function useRentableItemSearch(
  initialParams?: Omit<RentableItemSearchParams, 'search'>
): UseRentableItemSearchResult {
  const [searchTerm, setSearchTerm] = useState('');
  const [localParams, setLocalParams] = useState<RentableItemSearchParams>(
    initialParams || {}
  );
  
  // Debounce search term for 300ms
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['rentable-items-search', debouncedSearchTerm, localParams],
    queryFn: ({ pageParam = 0 }) =>
      rentableItemsApi.getAvailable({
        ...localParams,
        search: debouncedSearchTerm || undefined,
        skip: pageParam,
        limit: localParams.limit || 20,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return totalFetched < lastPage.total ? totalFetched : undefined;
    },
    keepPreviousData: true,
    enabled: true, // Always enabled, will return all items if no search term
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  // Flatten paginated results
  const { items, totalCount } = useMemo(() => {
    if (!data) return { items: [], totalCount: 0 };
    
    const allItems = data.pages.flatMap(page => page.items);
    return {
      items: allItems,
      totalCount: data.pages[0]?.total || 0,
    };
  }, [data]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const updateParams = useCallback((newParams: Partial<RentableItemSearchParams>) => {
    setLocalParams(prev => ({ ...prev, ...newParams }));
  }, []);

  return {
    items,
    isLoading,
    error: error as Error | null,
    searchTerm,
    setSearchTerm,
    totalCount,
    hasMore: !!hasNextPage,
    loadMore,
    params: localParams,
    updateParams,
  };
}

// Hook for rentable items by specific location
export function useRentableItemsByLocation(
  locationId: string,
  params?: Omit<RentableItemSearchParams, 'location_id'>
) {
  return useQuery({
    queryKey: ['rentable-items-by-location', locationId, params],
    queryFn: () => rentableItemsApi.getByLocation(locationId, params),
    enabled: !!locationId,
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for rentable items by specific category
export function useRentableItemsByCategory(
  categoryId: string,
  params?: Omit<RentableItemSearchParams, 'category_id'>
) {
  return useQuery({
    queryKey: ['rentable-items-by-category', categoryId, params],
    queryFn: () => rentableItemsApi.getByCategory(categoryId, params),
    enabled: !!categoryId,
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Simple search hook without infinite query (for dropdown use)
export function useRentableItemsSimple(params?: RentableItemSearchParams) {
  const [localParams, setLocalParams] = useState<RentableItemSearchParams>(params || {});

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['rentable-items-simple', localParams],
    queryFn: () => rentableItemsApi.getAvailable(localParams),
    keepPreviousData: true,
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateParams = useCallback((newParams: Partial<RentableItemSearchParams>) => {
    setLocalParams(prev => ({ ...prev, ...newParams }));
  }, []);

  const resetParams = useCallback(() => {
    setLocalParams({});
  }, []);

  return {
    items: data?.items || [],
    total: data?.total || 0,
    isLoading,
    error: error as Error | null,
    refetch,
    params: localParams,
    updateParams,
    resetParams,
  };
}

// Performance tracking hook
export function useRentableItemsPerformance() {
  const [metrics, setMetrics] = useState<{
    searchCount: number;
    averageSearchTime: number;
    lastSearchTime: number;
    totalItems: number;
  }>({
    searchCount: 0,
    averageSearchTime: 0,
    lastSearchTime: 0,
    totalItems: 0,
  });

  const trackSearch = useCallback((startTime: number, endTime: number, itemCount: number) => {
    const searchTime = endTime - startTime;
    
    setMetrics(prev => {
      const newSearchCount = prev.searchCount + 1;
      const newAverageSearchTime = 
        (prev.averageSearchTime * prev.searchCount + searchTime) / newSearchCount;
      
      return {
        searchCount: newSearchCount,
        averageSearchTime: newAverageSearchTime,
        lastSearchTime: searchTime,
        totalItems: itemCount,
      };
    });
  }, []);

  const resetMetrics = useCallback(() => {
    setMetrics({
      searchCount: 0,
      averageSearchTime: 0,
      lastSearchTime: 0,
      totalItems: 0,
    });
  }, []);

  return {
    metrics,
    trackSearch,
    resetMetrics,
  };
}

// Export types for convenience
export type {
  RentableItem,
  RentableItemListResponse,
  RentableItemSearchParams,
  UseRentableItemsResult,
  UseRentableItemSearchResult,
};