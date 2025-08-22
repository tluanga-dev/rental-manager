import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '@/services/api/sales';
import type { 
  SaleTransaction,
  SaleTransactionWithLines, 
  CreateSaleRequest,
  SaleFilters,
  SalesStats,
  SalesDashboardData
} from '@/types/sales';

// Query keys for sales
export const salesQueryKeys = {
  all: ['sales'] as const,
  lists: () => [...salesQueryKeys.all, 'list'] as const,
  list: (filters: SaleFilters) => [...salesQueryKeys.lists(), filters] as const,
  details: () => [...salesQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...salesQueryKeys.details(), id] as const,
  detailWithLines: (id: string) => [...salesQueryKeys.details(), id, 'with-lines'] as const,
  detailByNumber: (number: string) => [...salesQueryKeys.details(), 'number', number] as const,
  stats: () => [...salesQueryKeys.all, 'stats'] as const,
  dashboard: () => [...salesQueryKeys.all, 'dashboard'] as const,
};

// Hook for listing sales transactions
export function useSales(filters: SaleFilters = {}) {
  const query = useQuery({
    queryKey: salesQueryKeys.list(filters),
    queryFn: () => salesApi.listTransactions(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 2,
  });

  return {
    transactions: query.data?.items || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

// Hook for getting a single sale transaction
export function useSale(transactionId: string, enabled = true) {
  const query = useQuery({
    queryKey: salesQueryKeys.detail(transactionId),
    queryFn: () => salesApi.getTransactionDetails(transactionId),
    enabled: enabled && !!transactionId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  return {
    transaction: query.data || null,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

// Hook for getting a sale transaction with line items
export function useSaleWithLines(transactionId: string, enabled = true) {
  const query = useQuery({
    queryKey: salesQueryKeys.detailWithLines(transactionId),
    queryFn: () => salesApi.getTransactionWithLines(transactionId),
    enabled: enabled && !!transactionId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  return {
    transaction: query.data || null,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

// Hook for getting sale by transaction number
export function useSaleByNumber(transactionNumber: string, enabled = true) {
  const query = useQuery({
    queryKey: salesQueryKeys.detailByNumber(transactionNumber),
    queryFn: () => salesApi.getTransactionByNumber(transactionNumber),
    enabled: enabled && !!transactionNumber,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  return {
    transaction: query.data || null,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

// Hook for getting sales statistics
export function useSalesStats(dateRange?: { from: string; to: string }) {
  const query = useQuery({
    queryKey: [...salesQueryKeys.stats(), dateRange],
    queryFn: () => salesApi.getSalesStats(dateRange),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  return {
    stats: query.data || null,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

// Hook for getting dashboard data
export function useSalesDashboard() {
  const query = useQuery({
    queryKey: salesQueryKeys.dashboard(),
    queryFn: () => salesApi.getDashboardData(),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 2,
  });

  return {
    dashboardData: query.data || null,
    isLoading: query.isLoading,
    error: query.error?.message || null,
    refetch: query.refetch,
  };
}

// Hook for creating a new sale
export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSaleRequest) => salesApi.createNewSale(data),
    onSuccess: (response) => {
      // Invalidate and refetch sales list
      queryClient.invalidateQueries({ queryKey: salesQueryKeys.lists() });
      
      // Invalidate dashboard data
      queryClient.invalidateQueries({ queryKey: salesQueryKeys.dashboard() });
      
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: salesQueryKeys.stats() });

      // Optionally set the new transaction in cache
      queryClient.setQueryData(
        salesQueryKeys.detail(response.transaction_id),
        response.data
      );
    },
    onError: (error) => {
      console.error('Failed to create sale:', error);
    },
  });
}

// Hook for cancelling a sale
export function useCancelSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason?: string }) =>
      salesApi.cancelTransaction(transactionId, reason),
    onSuccess: (updatedTransaction) => {
      // Update the transaction in cache
      queryClient.setQueryData(
        salesQueryKeys.detail(updatedTransaction.id),
        updatedTransaction
      );

      // Invalidate lists to show updated status
      queryClient.invalidateQueries({ queryKey: salesQueryKeys.lists() });
      
      // Invalidate dashboard data
      queryClient.invalidateQueries({ queryKey: salesQueryKeys.dashboard() });
    },
    onError: (error) => {
      console.error('Failed to cancel sale:', error);
    },
  });
}

// Hook for processing a refund
export function useRefundSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      transactionId, 
      amount, 
      reason 
    }: { 
      transactionId: string; 
      amount?: number; 
      reason?: string; 
    }) => salesApi.refundTransaction(transactionId, amount, reason),
    onSuccess: (updatedTransaction) => {
      // Update the transaction in cache
      queryClient.setQueryData(
        salesQueryKeys.detail(updatedTransaction.id),
        updatedTransaction
      );

      // Invalidate lists to show updated status
      queryClient.invalidateQueries({ queryKey: salesQueryKeys.lists() });
      
      // Invalidate dashboard data
      queryClient.invalidateQueries({ queryKey: salesQueryKeys.dashboard() });
    },
    onError: (error) => {
      console.error('Failed to process refund:', error);
    },
  });
}

// Hook for searching saleable items
export function useSaleableItems(searchQuery: string, enabled = true) {
  const query = useQuery({
    queryKey: ['saleable-items', searchQuery],
    queryFn: () => salesApi.searchSaleableItems(searchQuery),
    enabled: enabled && searchQuery.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    error: query.error?.message || null,
  };
}

// Hook for checking item availability
export function useItemAvailability() {
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      salesApi.checkItemAvailability(itemId, quantity),
  });
}

// Custom hook for paginated sales with filters
export function usePaginatedSales(initialFilters: SaleFilters = {}) {
  const [filters, setFilters] = React.useState<SaleFilters>({
    skip: 0,
    limit: 100,
    ...initialFilters,
  });

  const salesQuery = useSales(filters);

  const updateFilters = (newFilters: Partial<SaleFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters({ skip: 0, limit: 100 });
  };

  const nextPage = () => {
    const currentSkip = filters.skip || 0;
    const currentLimit = filters.limit || 100;
    if (currentSkip + currentLimit < salesQuery.total) {
      updateFilters({ skip: currentSkip + currentLimit });
    }
  };

  const previousPage = () => {
    const currentSkip = filters.skip || 0;
    const currentLimit = filters.limit || 100;
    if (currentSkip > 0) {
      updateFilters({ skip: Math.max(0, currentSkip - currentLimit) });
    }
  };

  const goToPage = (page: number) => {
    const currentLimit = filters.limit || 100;
    updateFilters({ skip: page * currentLimit });
  };

  const currentPage = Math.floor((filters.skip || 0) / (filters.limit || 100));
  const totalPages = Math.ceil(salesQuery.total / (filters.limit || 100));
  const hasNextPage = currentPage < totalPages - 1;
  const hasPreviousPage = currentPage > 0;

  return {
    ...salesQuery,
    filters,
    updateFilters,
    resetFilters,
    pagination: {
      currentPage,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      nextPage,
      previousPage,
      goToPage,
    },
  };
}

// Re-export React for the custom hook that uses useState
import React from 'react';