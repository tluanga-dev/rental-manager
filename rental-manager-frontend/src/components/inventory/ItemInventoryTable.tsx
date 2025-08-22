'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Eye,
  Filter,
  Search,
  Loader2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { itemInventoryApi } from '@/services/api/item-inventory';
import { formatCurrencySync } from '@/lib/currency-utils';
import type { 
  ItemInventoryOverview, 
  SortConfig, 
  InventoryFilterState,
  StockStatus,
  ItemStatus
} from '@/types/item-inventory';

interface ItemInventoryTableProps {
  className?: string;
}

const STOCK_STATUS_COLORS = {
  IN_STOCK: 'bg-green-100 text-green-800 border-green-200',
  LOW_STOCK: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  OUT_OF_STOCK: 'bg-red-100 text-red-800 border-red-200',
};

const STOCK_STATUS_ICONS = {
  IN_STOCK: CheckCircle,
  LOW_STOCK: AlertTriangle,
  OUT_OF_STOCK: XCircle,
};

const ITEM_STATUS_COLORS = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  INACTIVE: 'bg-gray-100 text-gray-800 border-gray-200',
  DISCONTINUED: 'bg-red-100 text-red-800 border-red-200',
};

export function ItemInventoryTable({ className }: ItemInventoryTableProps) {
  const router = useRouter();
  
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'item_name',
    order: 'asc'
  });
  
  const [filters, setFilters] = useState<InventoryFilterState>({
    search: '',
    item_status: 'all',
    stock_status: 'all',
    brand_id: '',
    category_id: '',
    is_rentable: '',
    is_saleable: '',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [limit] = useState(50);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchTerm }));
      setPage(0); // Reset to first page when searching
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query for inventory data
  const {
    data: rawInventoryData = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['inventory-overview', { 
      skip: page * limit, 
      limit, 
      ...filters,
      sort_by: sortConfig.field,
      sort_order: sortConfig.order
    }],
    queryFn: () => itemInventoryApi.getOverview({
      skip: page * limit,
      limit,
      search: filters.search || undefined,
      item_status: filters.item_status === 'all' ? undefined : filters.item_status || undefined,
      stock_status: filters.stock_status === 'all' ? undefined : filters.stock_status || undefined,
      brand_id: filters.brand_id || undefined,
      category_id: filters.category_id || undefined,
      is_rentable: filters.is_rentable !== '' ? filters.is_rentable : undefined,
      is_saleable: filters.is_saleable !== '' ? filters.is_saleable : undefined,
      sort_by: sortConfig.field,
      sort_order: sortConfig.order,
    }),
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Apply client-side sorting if backend sorting fails for total
  const inventoryData = useMemo(() => {
    if (!Array.isArray(rawInventoryData)) return [];
    
    // If sorting by total, apply client-side sorting as fallback
    if (sortConfig.field === 'total') {
      const sorted = [...rawInventoryData].sort((a, b) => {
        const aValue = a.stock?.total || 0;
        const bValue = b.stock?.total || 0;
        
        if (sortConfig.order === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });
      return sorted;
    }
    
    return rawInventoryData;
  }, [rawInventoryData, sortConfig]);

  // Handle sorting
  const handleSort = (field: SortConfig['field']) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof InventoryFilterState, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      item_status: 'all',
      stock_status: 'all',
      brand_id: '',
      category_id: '',
      is_rentable: '',
      is_saleable: '',
    });
    setSearchTerm('');
    setPage(0);
  };

  // Summary statistics
  const summaryStats = useMemo(() => {
    const dataArray = Array.isArray(inventoryData) ? inventoryData : [];
    const total = dataArray.length;
    const inStock = dataArray.filter(item => (item.stock?.status || item.stock_status) === 'IN_STOCK').length;
    const lowStock = dataArray.filter(item => (item.stock?.status || item.stock_status) === 'LOW_STOCK').length;
    const outOfStock = dataArray.filter(item => (item.stock?.status || item.stock_status) === 'OUT_OF_STOCK').length;
    const totalValue = dataArray.reduce((sum, item) => {
      // Use backend-calculated total_value if available, otherwise fallback to client calculation
      if (item.total_value !== undefined) {
        return sum + item.total_value;
      }
      // Fallback for backward compatibility
      const quantity = item.stock?.total || item.total_quantity_on_hand || item.total_units || 0;
      const price = item.sale_price || 0;
      return sum + (quantity * price);
    }, 0);

    return { total, inStock, lowStock, outOfStock, totalValue };
  }, [inventoryData]);

  // Render sort icon
  const renderSortIcon = (field: SortConfig['field']) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.order === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  // Render stock status badge
  const renderStockStatusBadge = (status: StockStatus) => {
    const Icon = STOCK_STATUS_ICONS[status];
    return (
      <Badge 
        variant="outline" 
        className={cn('flex items-center gap-1', STOCK_STATUS_COLORS[status])}
      >
        <Icon className="h-3 w-3" />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  // Render item status badge
  const renderItemStatusBadge = (status: ItemStatus) => {
    return (
      <Badge 
        variant="outline" 
        className={cn('text-xs', ITEM_STATUS_COLORS[status])}
      >
        {status}
      </Badge>
    );
  };

  // Handle item click navigation
  const handleItemClick = (itemSku: string) => {
    // Navigate to item details page using SKU instead of ID
    // The item details page will handle SKU-based lookup
    window.open(`/products/items/sku/${itemSku}`, '_blank');
  };

  if (isError) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Inventory</h3>
            <p className="text-gray-600 mb-4">
              {error instanceof Error && error.message.includes('404') 
                ? 'The inventory service is currently unavailable. Please contact your administrator.' 
                : 'There was a problem loading the inventory data. Please try again.'}
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                Reload Page
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-2xl font-bold">{summaryStats.total}</p>
              </div>
              <Package className="h-8 w-8 text-slate-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Stock</p>
                <p className="text-2xl font-bold text-green-600">{summaryStats.inStock}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{summaryStats.lowStock}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{summaryStats.outOfStock}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrencySync(summaryStats.totalValue)}</p>
              </div>
              <Package className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Search Items
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Item Status
              </label>
              <Select
                value={filters.item_status}
                onValueChange={(value) => handleFilterChange('item_status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Stock Status
              </label>
              <Select
                value={filters.stock_status}
                onValueChange={(value) => handleFilterChange('stock_status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All stock levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stock levels</SelectItem>
                  <SelectItem value="IN_STOCK">In Stock</SelectItem>
                  <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
                  <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={clearFilters} variant="outline" size="sm">
                Clear Filters
              </Button>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Item Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              <span className="ml-2">Loading inventory...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('item_name')}
                        className="h-auto p-0 font-semibold"
                      >
                        Item Name
                        {renderSortIcon('item_name')}
                      </Button>
                    </TableHead>

                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('item_status')}
                        className="h-auto p-0 font-semibold"
                      >
                        Status
                        {renderSortIcon('item_status')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('brand')}
                        className="h-auto p-0 font-semibold"
                      >
                        Brand
                        {renderSortIcon('brand')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('category')}
                        className="h-auto p-0 font-semibold"
                      >
                        Category
                        {renderSortIcon('category')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right w-[120px]">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('total')}
                        className="h-auto p-0 font-semibold"
                      >
                        Stock Quantities
                        {renderSortIcon('total')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('stock_status')}
                        className="h-auto p-0 font-semibold"
                      >
                        Stock Status
                        {renderSortIcon('stock_status')}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Rental Rate</TableHead>
                    <TableHead className="text-right">Sale Price</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!Array.isArray(inventoryData) || inventoryData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-12 w-12 text-gray-400" />
                          <p className="text-gray-500">No inventory items found</p>
                          {filters.search && (
                            <p className="text-sm text-gray-400">
                              Try adjusting your search criteria
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (Array.isArray(inventoryData) ? inventoryData : []).map((item: ItemInventoryOverview) => (
                      <TableRow key={item.id || item.sku}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              <button
                                onClick={() => handleItemClick(item.sku)}
                                className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer transition-colors"
                                title="View item details"
                              >
                                {item.item_name}
                              </button>
                              <ExternalLink className="w-3 h-3 text-gray-400" />
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                                {item.sku}
                              </code>
                            </div>
                            {(item.is_rentable || item.is_saleable) && (
                              <div className="flex gap-1 mt-1">
                                {item.is_rentable && (
                                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                                    Rental
                                  </Badge>
                                )}
                                {item.is_saleable && (
                                  <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                                    Sale
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {renderItemStatusBadge(item.item_status)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {item.brand || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {item.category || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-0.5 text-sm">
                            <div className="font-medium text-gray-900">
                              Total: <span className="text-blue-600">{item.stock?.total || 0}</span>
                            </div>
                            <div className="text-gray-600">
                              Available: <span className="text-green-600 font-medium">{item.stock?.available || 0}</span>
                            </div>
                            <div className="text-gray-600">
                              Rented: <span className="text-orange-600 font-medium">{item.stock?.rented || 0}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {renderStockStatusBadge(item.stock?.status || 'OUT_OF_STOCK')}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.rental_rate 
                            ? formatCurrencySync(item.rental_rate)
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {item.sale_price 
                            ? formatCurrencySync(item.sale_price)
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          {item.total_value 
                            ? formatCurrencySync(item.total_value)
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleItemClick(item.sku)}
                            title="View item details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}