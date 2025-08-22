'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  Package, 
  MapPin, 
  AlertTriangle, 
  CheckCircle,
  TrendingDown,
  RefreshCw,
  BarChart3,
  Eye,
  Edit
} from 'lucide-react';
import { StockLevel, InventoryFilters } from '@/types/inventory';
import { Location, SKU, ItemMaster, Brand, Category } from '@/types/api';

interface StockLevelGridProps {
  stockLevels: StockLevel[];
  locations: Location[];
  skus: SKU[];
  itemMasters: ItemMaster[];
  brands: Brand[];
  categories: Category[];
  onFilter: (filters: InventoryFilters) => void;
  onViewDetails: (stockLevel: StockLevel) => void;
  onAdjustStock: (stockLevelId: string) => void;
  onTransferStock: (stockLevelId: string) => void;
  isLoading?: boolean;
}

export function StockLevelGrid({
  stockLevels,
  locations,
  skus,
  itemMasters,
  brands,
  categories,
  onFilter,
  onViewDetails,
  onAdjustStock,
  onTransferStock,
  isLoading,
}: StockLevelGridProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [filters, setFilters] = useState<InventoryFilters>({
    location_ids: [],
    sku_ids: [],
    search: '',
  });

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onFilter({ search: quickSearch });
  };

  const handleFilter = () => {
    onFilter(filters);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    const emptyFilters: InventoryFilters = {
      location_ids: [],
      sku_ids: [],
      search: '',
    };
    setFilters(emptyFilters);
    onFilter(emptyFilters);
  };

  const getLocationName = (locationId: string) => {
    return locations.find(l => l.id === locationId)?.name || 'Unknown Location';
  };

  const getSKUDetails = (skuId: string) => {
    const sku = skus.find(s => s.id === skuId);
    if (!sku) return { skuCode: 'Unknown', itemName: 'Unknown', brandName: 'Unknown' };

    const itemMaster = itemMasters.find(i => i.id === sku.item_master_id);
    const brand = itemMaster ? brands.find(b => b.id === itemMaster.brand_id) : null;

    return {
      skuCode: sku.sku_code,
      itemName: itemMaster?.name || 'Unknown',
      brandName: brand?.name || 'Unknown',
    };
  };

  const calculateUtilization = (stockLevel: StockLevel) => {
    if (stockLevel.total_units === 0) return 0;
    return ((stockLevel.total_units - stockLevel.available_units) / stockLevel.total_units) * 100;
  };

  const getStockStatus = (stockLevel: StockLevel) => {
    const availableRatio = stockLevel.available_units / stockLevel.total_units;
    if (availableRatio === 0) return { status: 'out-of-stock', color: 'bg-red-100 text-red-800' };
    if (availableRatio < 0.2) return { status: 'low-stock', color: 'bg-yellow-100 text-yellow-800' };
    if (availableRatio < 0.5) return { status: 'medium-stock', color: 'bg-orange-100 text-orange-800' };
    return { status: 'good-stock', color: 'bg-green-100 text-green-800' };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN');
  };

  // Group stock levels by location for better visualization
  const stockByLocation = locations.map(location => ({
    location,
    stockLevels: stockLevels.filter(sl => sl.location_id === location.id),
  }));

  // Calculate totals
  const totalUnits = stockLevels.reduce((sum, sl) => sum + sl.total_units, 0);
  const totalAvailable = stockLevels.reduce((sum, sl) => sum + sl.available_units, 0);
  const totalRented = stockLevels.reduce((sum, sl) => sum + sl.rented_units, 0);
  const totalReserved = stockLevels.reduce((sum, sl) => sum + sl.reserved_units, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Stock Levels</h2>
          <p className="text-muted-foreground">
            Monitor inventory levels across all locations
          </p>
        </div>
        <Button variant="outline" onClick={() => onFilter(filters)} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-slate-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Units</p>
                <p className="text-2xl font-bold">{totalUnits.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-2xl font-bold">{totalAvailable.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Rented Out</p>
                <p className="text-2xl font-bold">{totalRented.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Reserved</p>
                <p className="text-2xl font-bold">{totalReserved.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Search */}
          <form onSubmit={handleQuickSearch} className="flex space-x-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by SKU code, item name, or brand..."
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              Search
            </Button>
          </form>

          {/* Advanced Filters */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Advanced Filters
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Locations</Label>
                  <Select
                    value={filters.location_ids?.join(',') || ''}
                    onValueChange={(value) =>
                      setFilters(prev => ({
                        ...prev,
                        location_ids: value ? [value] : []
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All locations</SelectItem>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Stock Status</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="good-stock">Good Stock</SelectItem>
                      <SelectItem value="medium-stock">Medium Stock</SelectItem>
                      <SelectItem value="low-stock">Low Stock</SelectItem>
                      <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
                <Button type="button" onClick={handleFilter} disabled={isLoading}>
                  Apply Filters
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Stock Level Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Levels by Location</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU / Item</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Rented</TableHead>
                <TableHead>Maintenance</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    Loading stock levels...
                  </TableCell>
                </TableRow>
              ) : stockLevels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <div className="text-muted-foreground">
                      <p>No stock levels found</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                stockLevels.map((stockLevel) => {
                  const skuDetails = getSKUDetails(stockLevel.sku_id);
                  const locationName = getLocationName(stockLevel.location_id);
                  const utilization = calculateUtilization(stockLevel);
                  const stockStatus = getStockStatus(stockLevel);

                  return (
                    <TableRow key={stockLevel.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{skuDetails.skuCode}</div>
                          <div className="text-sm text-muted-foreground">
                            {skuDetails.itemName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {skuDetails.brandName}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{locationName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{stockLevel.total_units}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-green-600">
                          {stockLevel.available_units}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-600">
                          {stockLevel.reserved_units}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-purple-600">
                          {stockLevel.rented_units}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-yellow-600">
                          {stockLevel.maintenance_units}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {utilization.toFixed(1)}%
                          </div>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-slate-500 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(utilization, 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={stockStatus.color}>
                          {stockStatus.status.replace('-', ' ')}
                        </Badge>
                        {stockLevel.available_units === 0 && (
                          <AlertTriangle className="h-4 w-4 text-red-500 ml-1" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(stockLevel.last_updated)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewDetails(stockLevel)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAdjustStock(stockLevel.id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onTransferStock(stockLevel.id)}
                          >
                            Transfer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Location Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stockByLocation.map(({ location, stockLevels: locationStock }) => {
          const locationTotal = locationStock.reduce((sum, sl) => sum + sl.total_units, 0);
          const locationAvailable = locationStock.reduce((sum, sl) => sum + sl.available_units, 0);
          const locationUtilization = locationTotal > 0 
            ? ((locationTotal - locationAvailable) / locationTotal) * 100 
            : 0;

          return (
            <Card key={location.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5" />
                    <span>{location.name}</span>
                  </div>
                  <Badge variant="outline">{locationStock.length} SKUs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{locationTotal}</p>
                      <p className="text-sm text-muted-foreground">Total Units</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{locationAvailable}</p>
                      <p className="text-sm text-muted-foreground">Available</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{locationUtilization.toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">Utilization</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Utilization Rate</span>
                      <span>{locationUtilization.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-slate-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(locationUtilization, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => onFilter({ location_ids: [location.id] })}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}