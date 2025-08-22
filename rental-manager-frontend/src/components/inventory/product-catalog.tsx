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
  Plus, 
  Edit, 
  Eye, 
  Grid3X3, 
  List,
  Package,
  IndianRupee,
  Tag,
  Calendar
} from 'lucide-react';
import { ItemMaster, Brand, Category, SKU } from '@/types/api';

interface ProductCatalogProps {
  itemMasters: ItemMaster[];
  brands: Brand[];
  categories: Category[];
  skus: SKU[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onFilter: (filters: any) => void;
  onCreateItem: () => void;
  onEditItem: (itemId: string) => void;
  onViewItem: (itemId: string) => void;
  onCreateSKU: (itemId: string) => void;
  isLoading?: boolean;
}

type ViewMode = 'grid' | 'list';

interface ProductFilters {
  search: string;
  brand_id: string;
  category_id: string;
  is_active: boolean | undefined;
  min_price: number | undefined;
  max_price: number | undefined;
}

export function ProductCatalog({
  itemMasters,
  brands,
  categories,
  skus,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  onFilter,
  onCreateItem,
  onEditItem,
  onViewItem,
  onCreateSKU,
  isLoading,
}: ProductCatalogProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    brand_id: '',
    category_id: '',
    is_active: undefined,
    min_price: undefined,
    max_price: undefined,
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
    const emptyFilters = {
      search: '',
      brand_id: '',
      category_id: '',
      is_active: undefined,
      min_price: undefined,
      max_price: undefined,
    };
    setFilters(emptyFilters);
    onFilter(emptyFilters);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const getBrandName = (brandId: string) => {
    return brands.find(b => b.id === brandId)?.name || 'Unknown Brand';
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown Category';
  };

  const getItemSKUs = (itemId: string) => {
    return skus.filter(sku => sku.item_master_id === itemId);
  };

  const getMinMaxPrices = (itemSKUs: SKU[]) => {
    if (itemSKUs.length === 0) return { min: 0, max: 0 };
    
    const rentalPrices = itemSKUs.map(sku => sku.rental_price);
    return {
      min: Math.min(...rentalPrices),
      max: Math.max(...rentalPrices),
    };
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {itemMasters.map((item) => {
        const itemSKUs = getItemSKUs(item.id);
        const { min, max } = getMinMaxPrices(itemSKUs);
        
        return (
          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              {/* Product Image Placeholder */}
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                <Package className="h-16 w-16 text-gray-400" />
              </div>
              
              <div className="p-4 space-y-3">
                {/* Product Name and Brand */}
                <div>
                  <h3 className="font-semibold text-lg line-clamp-2">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {getBrandName(item.brand_id)}
                  </p>
                </div>

                {/* Category and Status */}
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {getCategoryName(item.category_id)}
                  </Badge>
                  <Badge variant={item.is_active ? 'default' : 'secondary'}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {/* Pricing */}
                {itemSKUs.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Rental/day:</span>
                      <span className="font-medium">
                        {min === max 
                          ? formatCurrency(min)
                          : `${formatCurrency(min)} - ${formatCurrency(max)}`
                        }
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {itemSKUs.length} variant{itemSKUs.length !== 1 ? 's' : ''} available
                    </div>
                  </div>
                )}

                {/* Description */}
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewItem(item.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditItem(item.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCreateSKU(item.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    SKU
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>SKUs</TableHead>
              <TableHead>Price Range</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading products...
                </TableCell>
              </TableRow>
            ) : itemMasters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <p>No products found</p>
                    <p className="text-sm">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              itemMasters.map((item) => {
                const itemSKUs = getItemSKUs(item.id);
                const { min, max } = getMinMaxPrices(itemSKUs);
                
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getBrandName(item.brand_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getCategoryName(item.category_id)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <div className="font-medium">{itemSKUs.length}</div>
                        <div className="text-xs text-muted-foreground">variants</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {itemSKUs.length > 0 ? (
                        <div className="text-sm">
                          {min === max 
                            ? formatCurrency(min)
                            : `${formatCurrency(min)} - ${formatCurrency(max)}`
                          }
                          <div className="text-xs text-muted-foreground">per day</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No pricing</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.is_active ? 'default' : 'secondary'}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(item.created_at)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewItem(item.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditItem(item.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCreateSKU(item.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          SKU
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
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Product Catalog</h2>
          <p className="text-muted-foreground">
            {totalCount} product{totalCount !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={onCreateItem}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
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
                placeholder="Search products, brands, or categories..."
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select
                    value={filters.brand_id}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, brand_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All brands" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All brands</SelectItem>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={filters.category_id}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, category_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={
                      filters.is_active !== undefined
                        ? filters.is_active.toString()
                        : ''
                    }
                    onValueChange={(value) =>
                      setFilters(prev => ({
                        ...prev,
                        is_active: value === '' ? undefined : value === 'true'
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Price (₹/day)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={filters.min_price || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      min_price: e.target.value ? Number(e.target.value) : undefined
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Price (₹/day)</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="No limit"
                    value={filters.max_price || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      max_price: e.target.value ? Number(e.target.value) : undefined
                    }))}
                  />
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

      {/* Product Grid/List */}
      {viewMode === 'grid' ? renderGridView() : renderListView()}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount} products
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
              >
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onPageChange(page)}
                      disabled={isLoading}
                    >
                      {page}
                    </Button>
                  );
                })}
                {totalPages > 5 && (
                  <>
                    {currentPage < totalPages - 2 && <span>...</span>}
                    <Button
                      variant={currentPage === totalPages ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onPageChange(totalPages)}
                      disabled={isLoading}
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}