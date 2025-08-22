'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { InventoryItemsSummary } from './InventoryItemsSummary';
import { InventoryItemsFilters } from './InventoryItemsFilters';
import { InventoryItemsTable } from './InventoryItemsTable';
import { DatabaseErrorHandler } from '../DatabaseErrorHandler';
import { inventoryItemsApi } from '@/services/api/inventory-items';
import type { 
  InventoryItemsFilterState, 
  InventoryItemsSortConfig,
  InventorySummaryStats 
} from '@/types/inventory-items';

export function InventoryItemsList() {
  const [filters, setFilters] = useState<InventoryItemsFilterState>({
    search: '',
    category_id: '',
    brand_id: '',
    item_status: 'all',
    stock_status: 'all',
    is_rentable: undefined,
    is_saleable: undefined,
  });

  const [sortConfig, setSortConfig] = useState<InventoryItemsSortConfig>({
    field: 'item_name',
    order: 'asc',
  });

  const [page, setPage] = useState(0);
  const limit = 50;

  // Fetch inventory items
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['inventory-items', filters, sortConfig, page],
    queryFn: () => inventoryItemsApi.getItems({
      search: filters.search || undefined,
      category_id: filters.category_id || undefined,
      brand_id: filters.brand_id || undefined,
      item_status: filters.item_status === 'all' ? undefined : filters.item_status,
      stock_status: filters.stock_status === 'all' ? undefined : filters.stock_status,
      is_rentable: filters.is_rentable,
      is_saleable: filters.is_saleable,
      sort_by: sortConfig.field === 'stock_summary.total' ? 'total' : sortConfig.field,
      sort_order: sortConfig.order,
      skip: page * limit,
      limit,
    }),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Calculate summary statistics
  const summaryStats: InventorySummaryStats = useMemo(() => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        total_products: 0,
        total_units: 0,
        total_value: 0,
        stock_health: 0,
        in_stock: 0,
        low_stock: 0,
        out_of_stock: 0,
      };
    }

    const stats = items.reduce((acc, item) => {
      acc.total_products += 1;
      acc.total_units += item.stock_summary.total;
      acc.total_value += item.total_value;
      
      switch (item.stock_summary.stock_status) {
        case 'IN_STOCK':
          acc.in_stock += 1;
          break;
        case 'LOW_STOCK':
          acc.low_stock += 1;
          break;
        case 'OUT_OF_STOCK':
          acc.out_of_stock += 1;
          break;
      }
      
      return acc;
    }, {
      total_products: 0,
      total_units: 0,
      total_value: 0,
      stock_health: 0,
      in_stock: 0,
      low_stock: 0,
      out_of_stock: 0,
    });

    // Calculate stock health percentage
    stats.stock_health = stats.total_products > 0 
      ? ((stats.in_stock / stats.total_products) * 100)
      : 0;

    return stats;
  }, [items]);

  const handleSort = (field: InventoryItemsSortConfig['field']) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleFilterChange = (newFilters: InventoryItemsFilterState) => {
    setFilters(newFilters);
    setPage(0); // Reset to first page when filters change
  };

  const handleRefresh = () => {
    refetch();
  };

  if (isError) {
    // Check if this is a database schema error and show specialized handler
    const databaseErrorComponent = <DatabaseErrorHandler error={error} onRetry={handleRefresh} />;
    if (databaseErrorComponent) {
      // If DatabaseErrorHandler can handle this error, use it
      const isSchemaError = error?.response?.data?.detail?.includes('is_rental_blocked') ||
                           error?.response?.data?.detail?.includes('rental_block_reason') ||
                           error?.response?.data?.detail?.includes('column') && error?.response?.data?.detail?.includes('does not exist');
      
      if (isSchemaError) {
        return databaseErrorComponent;
      }
    }

    // Extract detailed error information if available
    const errorDetails = {
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      endpoint: '/api/inventory/items',
      method: 'GET',
      timestamp: new Date().toISOString(),
      // Try to extract enhanced error details from axios error
      ...(error && typeof error === 'object' && 'response' in error && error.response?.data?.error 
        ? error.response.data.error 
        : {})
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="max-w-2xl w-full">
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                Failed to Load Inventory Items
              </h3>
              
              <p className="text-red-700 dark:text-red-300 mb-4">
                {errorDetails.message}
              </p>
              
              {/* Show endpoint that failed */}
              <div className="bg-red-100 dark:bg-red-900 rounded p-3 mb-4">
                <p className="text-xs font-mono text-red-800 dark:text-red-200">
                  GET /api/inventory/items
                </p>
              </div>

              {/* Show suggestions if available */}
              {errorDetails.suggestions && errorDetails.suggestions.length > 0 && (
                <div className="text-left mb-4">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                    💡 Possible solutions:
                  </p>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    {errorDetails.suggestions.map((suggestion: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <span className="text-red-500 mr-1">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </button>
                
                <button
                  onClick={() => {
                    console.group('🔍 Detailed Error Information');
                    console.error('Full Error Object:', error);
                    console.error('Error Details:', errorDetails);
                    console.groupEnd();
                  }}
                  className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  View Debug Info
                </button>
              </div>
              
              {/* Debug information */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 text-left">
                  <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:text-red-800 dark:hover:text-red-200">
                    Show Technical Details
                  </summary>
                  <div className="mt-2 p-3 bg-red-200 dark:bg-red-800 rounded text-xs">
                    <pre className="whitespace-pre-wrap font-mono text-red-900 dark:text-red-100">
                      {JSON.stringify(errorDetails, null, 2)}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <InventoryItemsSummary 
        stats={summaryStats} 
        isLoading={isLoading}
      />

      {/* Filters */}
      <InventoryItemsFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />

      {/* Data Table */}
      <InventoryItemsTable
        items={items}
        sortConfig={sortConfig}
        onSort={handleSort}
        isLoading={isLoading}
      />

      {/* Pagination */}
      {items.length >= limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * limit + 1} to {Math.min((page + 1) * limit, page * limit + items.length)} items
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(prev => Math.max(0, prev - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(prev => prev + 1)}
              disabled={items.length < limit}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}