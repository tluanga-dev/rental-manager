'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryOverviewApi, ItemInventoryOverview } from '@/services/api/inventory';
import { categoriesApi } from '@/services/api/categories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  RefreshCw,
  Eye,
  Edit,
  Loader2,
  TrendingUp,
  AlertCircle,
  ArrowUpDown,
  Building2,
  Download,
  Upload,
  Truck,
  Clock,
  XCircle,
  CheckCircle,
  Package
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type SortDirection = 'asc' | 'desc';
type SortField = 'item_name' | 'sku' | 'total_units' | 'stock_status' | 'created_at';

export default function StockPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('item_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(100);

  // Fetch inventory overview
  const { data: inventoryData, isLoading: inventoryLoading, refetch: refetchInventory, error: inventoryError } = useQuery({
    queryKey: ['inventory-overview', searchTerm, selectedCategory, selectedStockStatus, sortField, sortDirection, skip, limit],
    queryFn: () => inventoryOverviewApi.getOverview({
      skip,
      limit,
      category_id: selectedCategory || undefined,
      stock_status: selectedStockStatus as 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' || undefined,
      search: searchTerm || undefined,
      sort_by: sortField,
      sort_order: sortDirection,
    }),
    enabled: true,
  });

  // Fetch categories for filter dropdown
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list({ page_size: 1000 }),
  });

  // Extract inventory items array
  const inventoryItems = useMemo(() => {
    if (!inventoryData) return [];
    // Handle both direct array and wrapped response formats
    if (Array.isArray(inventoryData)) {
      return inventoryData;
    }
    // Handle API response wrapper
    if (inventoryData.data && Array.isArray(inventoryData.data)) {
      return inventoryData.data;
    }
    return [];
  }, [inventoryData]);

  // Extract categories array
  const categories = useMemo(() => {
    if (!categoriesData) return [];
    return Array.isArray(categoriesData) ? categoriesData : (categoriesData.items || []);
  }, [categoriesData]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const stats = {
      totalItems: inventoryItems.length,
      totalUnits: 0,
      totalValue: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      inStockItems: 0,
      rentableItems: 0,
      saleableItems: 0,
      totalAvailable: 0,
      totalOnRent: 0,
    };

    inventoryItems.forEach((item: ItemInventoryOverview) => {
      stats.totalUnits += item.total_units;
      stats.totalValue += item.total_quantity_on_hand * (item.sale_price || 0);
      stats.totalAvailable += item.total_quantity_available;
      stats.totalOnRent += item.total_quantity_on_rent;
      
      if (item.stock_status === 'LOW_STOCK') {
        stats.lowStockItems++;
      } else if (item.stock_status === 'OUT_OF_STOCK') {
        stats.outOfStockItems++;
      } else if (item.stock_status === 'IN_STOCK') {
        stats.inStockItems++;
      }
      
      if (item.is_rentable) {
        stats.rentableItems++;
      }
      
      if (item.is_saleable) {
        stats.saleableItems++;
      }
    });

    return stats;
  }, [inventoryItems]);

  const isLoading = inventoryLoading || categoriesLoading;

  const getStockStatusBadge = (status: string, isLowStock: boolean) => {
    if (status === 'OUT_OF_STOCK') {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Out of Stock</Badge>;
    } else if (status === 'LOW_STOCK' || isLowStock) {
      return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />Low Stock</Badge>;
    } else {
      return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />In Stock</Badge>;
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="default">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'DISCONTINUED':
        return <Badge variant="destructive">Discontinued</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleViewDetails = (itemId: string) => {
    router.push(`/inventory/items/${itemId}`);
  };

  const handleRefresh = () => {
    refetchInventory();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUpDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 rotate-180" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2 text-lg">Loading inventory...</span>
      </div>
    );
  }

  if (inventoryError) {
    return (
      <div className="flex items-center justify-center h-96">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <span className="ml-2 text-lg">Error loading inventory data</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Stock Levels</h1>
          <p className="text-gray-600 mt-1">Monitor and manage your inventory stock levels</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalItems}</div>
            <p className="text-xs text-muted-foreground">
              {summaryStats.totalUnits} total units
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Status</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summaryStats.inStockItems}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-orange-600">{summaryStats.lowStockItems} low</span> · 
              <span className="text-red-600 ml-1">{summaryStats.outOfStockItems} out</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Units</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalAvailable}</div>
            <p className="text-xs text-muted-foreground">
              {summaryStats.totalOnRent} on rent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summaryStats.totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              {summaryStats.rentableItems} rentable · {summaryStats.saleableItems} saleable
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by item name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStockStatus} onValueChange={setSelectedStockStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by stock status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Stock Status</SelectItem>
                <SelectItem value="IN_STOCK">In Stock</SelectItem>
                <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
                <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setSelectedStockStatus('');
              }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('item_name')}
                      >
                        <div className="flex items-center gap-2">
                          Item Name <SortIcon field="item_name" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('sku')}
                      >
                        <div className="flex items-center gap-2">
                          SKU <SortIcon field="sku" />
                        </div>
                      </TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('total_units')}
                      >
                        <div className="flex items-center gap-2">
                          Total Units <SortIcon field="total_units" />
                        </div>
                      </TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>On Rent</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('stock_status')}
                      >
                        <div className="flex items-center gap-2">
                          Stock Status <SortIcon field="stock_status" />
                        </div>
                      </TableHead>
                      <TableHead>Reorder Point</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryItems.map((item: ItemInventoryOverview) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-semibold">{item.item_name}</div>
                            <div className="text-sm text-gray-500">{getItemStatusBadge(item.item_status)}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm">{item.sku}</code>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{item.category_name || 'N/A'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{item.brand_name || 'N/A'}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {item.is_rentable && <Badge variant="outline" className="text-xs">Rentable</Badge>}
                            {item.is_saleable && <Badge variant="outline" className="text-xs">Saleable</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div className="font-semibold">{item.total_units}</div>
                            <div className="text-xs text-gray-500">
                              A:{item.units_by_status.available} R:{item.units_by_status.rented} M:{item.units_by_status.maintenance}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center font-semibold text-green-600">
                            {item.total_quantity_available}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-center font-semibold text-slate-600">
                            {item.total_quantity_on_rent}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStockStatusBadge(item.stock_status, item.is_low_stock)}
                        </TableCell>
                        <TableCell>
                          <div className="text-center">
                            <div className="font-semibold">{item.reorder_point}</div>
                            {item.is_low_stock && (
                              <div className="text-xs text-orange-600">Below threshold</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(item.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/inventory/items/${item.id}/edit`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Stock Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventoryItems.map((item: ItemInventoryOverview) => (
                  <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{item.item_name}</CardTitle>
                        {getStockStatusBadge(item.stock_status, item.is_low_stock)}
                      </div>
                      <div className="text-sm text-gray-500">
                        SKU: <code>{item.sku}</code>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Units:</span>
                          <span className="font-semibold">{item.total_units}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Available:</span>
                          <span className="font-semibold text-green-600">{item.total_quantity_available}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>On Rent:</span>
                          <span className="font-semibold text-slate-600">{item.total_quantity_on_rent}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Reorder Point:</span>
                          <span className="font-semibold">{item.reorder_point}</span>
                        </div>
                        {item.rental_rate_per_period && (
                          <div className="flex justify-between">
                            <span>Rental Rate:</span>
                            <span className="font-semibold">{formatCurrency(item.rental_rate_per_period)}</span>
                          </div>
                        )}
                        {item.sale_price && (
                          <div className="flex justify-between">
                            <span>Sale Price:</span>
                            <span className="font-semibold">{formatCurrency(item.sale_price)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Category:</span>
                          <span className="text-sm">{item.category_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Brand:</span>
                          <span className="text-sm">{item.brand_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Updated:</span>
                          <span className="text-sm text-gray-500">{formatDate(item.updated_at)}</span>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(item.id)}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/inventory/items/${item.id}/edit`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Showing {inventoryItems.length} items
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSkip(Math.max(0, skip - limit))}
            disabled={skip === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSkip(skip + limit)}
            disabled={inventoryItems.length < limit}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
