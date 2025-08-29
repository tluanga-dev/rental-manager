'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stockLevelsApi, type StockLevel, type GetStockLevelsParams } from '@/services/api/stock-levels';
import { StockLevelsTable } from './StockLevelsTable';
import { StockLevelsFilters } from './StockLevelsFilters';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { StockTransferModal } from './StockTransferModal';
import { RefreshCw, Plus, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StockLevelsFilterState {
  search: string;
  location_id: string;
  category_id: string;
  brand_id: string;
  stock_status: string;
}

interface StockLevelsSortConfig {
  field: string;
  order: 'asc' | 'desc';
}

export function StockLevelsManagement() {
  const [filters, setFilters] = useState<StockLevelsFilterState>({
    search: '',
    location_id: '',
    category_id: '',
    brand_id: '',
    stock_status: 'all',
  });

  const [sortConfig, setSortConfig] = useState<StockLevelsSortConfig>({
    field: 'item_name',
    order: 'asc',
  });

  const [page, setPage] = useState(0);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedStockLevel, setSelectedStockLevel] = useState<StockLevel | null>(null);
  const limit = 50;

  // Fetch stock levels
  const {
    data: stockLevelsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['stock-levels', filters, sortConfig, page],
    queryFn: () => {
      const params: GetStockLevelsParams = {
        search: filters.search || undefined,
        location_id: filters.location_id || undefined,
        category_id: filters.category_id || undefined,
        brand_id: filters.brand_id || undefined,
        stock_status: filters.stock_status === 'all' ? undefined : filters.stock_status as any,
        sort_by: sortConfig.field,
        sort_order: sortConfig.order,
        skip: page * limit,
        limit,
      };
      return stockLevelsApi.getStockLevels(params);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const stockLevels = stockLevelsResponse?.data || [];
  const total = stockLevelsResponse?.total || 0;

  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleFilterChange = (newFilters: StockLevelsFilterState) => {
    setFilters(newFilters);
    setPage(0); // Reset to first page when filters change
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleAdjustStock = (stockLevel: StockLevel) => {
    setSelectedStockLevel(stockLevel);
    setIsAdjustmentModalOpen(true);
  };

  const handleTransferStock = (stockLevel: StockLevel) => {
    setSelectedStockLevel(stockLevel);
    setIsTransferModalOpen(true);
  };

  const handleAdjustmentComplete = () => {
    setIsAdjustmentModalOpen(false);
    setSelectedStockLevel(null);
    refetch(); // Refresh data after adjustment
  };

  const handleTransferComplete = () => {
    setIsTransferModalOpen(false);
    setSelectedStockLevel(null);
    refetch(); // Refresh data after transfer
  };

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-red-100 p-3 rounded-full">
            <RefreshCw className="h-8 w-8 text-red-600" />
          </div>
        </div>
        
        <h3 className="text-lg font-semibold text-red-800 mb-2 text-center">
          Failed to Load Stock Levels
        </h3>
        
        <p className="text-red-700 mb-4 text-center">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
        
        <div className="flex justify-center">
          <Button onClick={handleRefresh} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <StockLevelsFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          isLoading={isLoading}
        />
        
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stock Levels Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Stock Levels ({total} items)
            </h3>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsAdjustmentModalOpen(true)}
                size="sm"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adjust Stock
              </Button>
              <Button
                onClick={() => setIsTransferModalOpen(true)}
                size="sm"
                variant="outline"
              >
                <ArrowUpDown className="h-4 w-4 mr-1" />
                Transfer Stock
              </Button>
            </div>
          </div>
        </div>

        <StockLevelsTable
          stockLevels={stockLevels}
          sortConfig={sortConfig}
          onSort={handleSort}
          onAdjustStock={handleAdjustStock}
          onTransferStock={handleTransferStock}
          isLoading={isLoading}
        />

        {/* Pagination */}
        {total > limit && (
          <div className="p-4 border-t">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} items
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(prev => Math.max(0, prev - 1))}
                  disabled={page === 0 || isLoading}
                  variant="outline"
                  size="sm"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setPage(prev => prev + 1)}
                  disabled={stockLevels.length < limit || isLoading}
                  variant="outline"
                  size="sm"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <StockAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        onComplete={handleAdjustmentComplete}
        stockLevel={selectedStockLevel}
      />

      <StockTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onComplete={handleTransferComplete}
        stockLevel={selectedStockLevel}
      />
    </div>
  );
}