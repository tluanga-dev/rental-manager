'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stockMovementsApi, type StockMovement, type GetMovementsParams } from '@/services/api/stock-movements';
import { StockMovementsTable } from './StockMovementsTable';
import { StockMovementsFilters } from './StockMovementsFilters';
import { MovementsSummary } from './MovementsSummary';
import { RefreshCw, Download, Calendar, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface MovementsFilterState {
  search: string;
  item_id: string;
  location_id: string;
  movement_type: string;
  created_by: string;
  start_date: string;
  end_date: string;
}

interface MovementsSortConfig {
  field: string;
  order: 'asc' | 'desc';
}

export function StockMovementsManagement() {
  const [filters, setFilters] = useState<MovementsFilterState>({
    search: '',
    item_id: '',
    location_id: '',
    movement_type: 'all',
    created_by: '',
    start_date: '',
    end_date: '',
  });

  const [sortConfig, setSortConfig] = useState<MovementsSortConfig>({
    field: 'created_at',
    order: 'desc', // Show newest first
  });

  const [page, setPage] = useState(0);
  const [showSummary, setShowSummary] = useState(true);
  const limit = 50;

  // Fetch stock movements
  const {
    data: movementsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['stock-movements', filters, sortConfig, page],
    queryFn: () => {
      const params: GetMovementsParams = {
        search: filters.search || undefined,
        item_id: filters.item_id || undefined,
        location_id: filters.location_id || undefined,
        movement_type: filters.movement_type === 'all' ? undefined : filters.movement_type,
        created_by: filters.created_by || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        sort_by: sortConfig.field,
        sort_order: sortConfig.order,
        skip: page * limit,
        limit,
      };
      return stockMovementsApi.getMovements(params);
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch movement summary
  const {
    data: summaryData,
    isLoading: isLoadingSummary,
  } = useQuery({
    queryKey: ['movement-summary', filters],
    queryFn: () => {
      const params = {
        item_id: filters.item_id || undefined,
        location_id: filters.location_id || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      };
      return stockMovementsApi.getMovementSummary(params);
    },
    enabled: showSummary,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const movements = movementsResponse?.data || [];
  const total = movementsResponse?.total || 0;

  const handleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleFilterChange = (newFilters: MovementsFilterState) => {
    setFilters(newFilters);
    setPage(0); // Reset to first page when filters change
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleExportMovements = async () => {
    try {
      const params: GetMovementsParams = {
        search: filters.search || undefined,
        item_id: filters.item_id || undefined,
        location_id: filters.location_id || undefined,
        movement_type: filters.movement_type === 'all' ? undefined : filters.movement_type,
        created_by: filters.created_by || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        sort_by: sortConfig.field,
        sort_order: sortConfig.order,
      };

      const blob = await stockMovementsApi.exportMovements(params);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with date range
      const startDate = filters.start_date || 'all';
      const endDate = filters.end_date || 'time';
      link.download = `stock-movements-${startDate}-to-${endDate}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Stock movements have been exported to CSV.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export stock movements. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleQuickDateRange = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    setFilters(prev => ({
      ...prev,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    }));
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
          Failed to Load Stock Movements
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
      {/* Summary Section */}
      {showSummary && summaryData && (
        <MovementsSummary 
          summary={summaryData} 
          isLoading={isLoadingSummary}
          onToggle={() => setShowSummary(!showSummary)}
        />
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col gap-4">
        <StockMovementsFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          isLoading={isLoading}
        />
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Quick Date Filters */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Quick filters:</span>
            <div className="flex gap-1">
              {[
                { label: 'Today', days: 0 },
                { label: '7 days', days: 7 },
                { label: '30 days', days: 30 },
                { label: '90 days', days: 90 },
              ].map(({ label, days }) => (
                <Button
                  key={label}
                  onClick={() => handleQuickDateRange(days)}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowSummary(!showSummary)}
              variant="outline"
              size="sm"
            >
              <BarChart className="h-4 w-4 mr-2" />
              {showSummary ? 'Hide' : 'Show'} Summary
            </Button>
            
            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button onClick={handleExportMovements} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Stock Movements ({total.toLocaleString()} records)
            </h3>
            
            {/* Applied Filters Summary */}
            {(filters.search || filters.item_id || filters.location_id || filters.movement_type !== 'all' || filters.start_date || filters.end_date) && (
              <div className="text-sm text-gray-600">
                Filtered results
              </div>
            )}
          </div>
        </div>

        <StockMovementsTable
          movements={movements}
          sortConfig={sortConfig}
          onSort={handleSort}
          isLoading={isLoading}
        />

        {/* Pagination */}
        {total > limit && (
          <div className="p-4 border-t">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total.toLocaleString()} movements
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
                  disabled={movements.length < limit || isLoading}
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
    </div>
  );
}