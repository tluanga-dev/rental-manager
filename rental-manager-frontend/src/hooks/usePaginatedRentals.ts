import { useState, useCallback } from 'react';
import { RentalFilterParams } from '@/types/rentals';
import { useRentals } from './useRentals';

export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface UsePaginatedRentalsResult {
  rentals: unknown[];
  isLoading: boolean;
  error: unknown;
  pagination: PaginationInfo;
  filters: RentalFilterParams;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setFilters: (filters: RentalFilterParams) => void;
  nextPage: () => void;
  previousPage: () => void;
  refetch: () => void;
}

export const usePaginatedRentals = (
  initialPage = 1, 
  initialPageSize = 20,
  initialFilters: RentalFilterParams = {}
): UsePaginatedRentalsResult => {
  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [filters, setFiltersState] = useState<RentalFilterParams>(initialFilters);
  
  const skip = (page - 1) * pageSize;
  
  const { rentals, isLoading, error, refetch, totalCount } = useRentals({
    ...filters,
    skip,
    limit: pageSize,
  });
  
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;
  
  const setPage = useCallback((newPage: number) => {
    const clampedPage = Math.max(1, Math.min(newPage, totalPages || 1));
    setPageState(clampedPage);
  }, [totalPages]);
  
  const setPageSize = useCallback((newPageSize: number) => {
    setPageSizeState(newPageSize);
    setPageState(1); // Reset to first page when page size changes
  }, []);
  
  const setFilters = useCallback((newFilters: RentalFilterParams) => {
    setFiltersState(newFilters);
    setPageState(1); // Reset to first page when filters change
  }, []);
  
  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPage(page + 1);
    }
  }, [page, hasNextPage, setPage]);
  
  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setPage(page - 1);
    }
  }, [page, hasPreviousPage, setPage]);
  
  const pagination: PaginationInfo = {
    currentPage: page,
    pageSize,
    totalItems: totalCount,
    totalPages,
    hasNextPage,
    hasPreviousPage,
  };
  
  return {
    rentals,
    isLoading,
    error,
    pagination,
    filters,
    setPage,
    setPageSize,
    setFilters,
    nextPage,
    previousPage,
    refetch,
  };
};

export default usePaginatedRentals;