'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  Trash2,
  Package, 
  Warehouse,
  AlertTriangle,
  CheckCircle,
  Tag,
  Barcode,
} from 'lucide-react';
import { RentalStatusToggle } from '@/components/rental-blocking/RentalStatusToggle';
import { useRentalBlocking } from '@/hooks/useRentalBlocking';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import type { Item, ItemNested, ItemType, ItemStatus } from '@/types/item';
import { CategoryDropdown } from '@/components/categories/CategoryDropdown';
import { BrandDropdown } from '@/components/brands/BrandDropdown';

// Validation schema for essential item filters only
const itemFilterSchema = z.object({
  // Essential filters only
  category_id: z.string().optional(),
  brand_id: z.string().optional(),
  item_status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']).optional(),
  active_only: z.boolean().optional(),
  
  // Date range filters
  created_after: z.string().optional(),
  created_before: z.string().optional(),
  updated_after: z.string().optional(),
  updated_before: z.string().optional(),
});

type ItemFilterFormData = z.infer<typeof itemFilterSchema>;

// Type that supports both old and new API formats
type ItemWithNestedSupport = Item & {
  // Allow nested objects in place of ID strings
  category_id?: string | { id: string; name: string };
  brand_id?: string | { id: string; name: string };
  unit_of_measurement_id?: string | { id: string; name: string; code?: string };
};

interface ItemListProps {
  items: (Item | ItemWithNestedSupport)[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onFilter: (filters: ItemFilterFormData) => void;
  onCreateItem: () => void;
  onEditItem: (itemId: string) => void;
  onViewItem: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  isLoading?: boolean;
  getCategoryName?: (categoryId: string | undefined) => string;
}

export function ItemList({
  items,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  onFilter,
  onCreateItem,
  onEditItem,
  onViewItem,
  onDeleteItem,
  isLoading,
  getCategoryName,
}: ItemListProps) {
  const { toggleEntityStatus } = useRentalBlocking();

  const filterForm = useForm<ItemFilterFormData>({
    resolver: zodResolver(itemFilterSchema),
    defaultValues: {
      // Essential filters only
      category_id: undefined,
      brand_id: undefined,
      item_status: undefined,
      active_only: undefined,
      
      // Date filters
      created_after: undefined,
      created_before: undefined,
      updated_after: undefined,
      updated_before: undefined,
    },
  });

  const handleFilter = (data: ItemFilterFormData) => {
    onFilter(data);
  };

  const clearFilters = () => {
    filterForm.reset();
    onFilter({});
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₹0';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };


  
  const getStatusColor = (status: ItemStatus) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'INACTIVE': return 'bg-yellow-100 text-yellow-800';
      case 'DISCONTINUED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">

      {/* Essential Filters - Single Row Layout */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={filterForm.handleSubmit(handleFilter)} className="space-y-4">
            {/* Single Row Filter Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Category Filter */}
              <div className="space-y-2">
                <Label>Category</Label>
                <CategoryDropdown
                  value={filterForm.watch('category_id') || ''}
                  onChange={(value) => filterForm.setValue('category_id', value || undefined)}
                  placeholder="Search categories..."
                  searchable={true}
                  clearable={true}
                  onlyLeaf={true}
                  showPath={true}
                  virtualScroll={true}
                  fullWidth={true}
                  size="medium"
                  debounceMs={300}
                />
              </div>

              {/* Brand Filter */}
              <div className="space-y-2">
                <Label>Brand</Label>
                <BrandDropdown
                  value={filterForm.watch('brand_id') || ''}
                  onChange={(value) => filterForm.setValue('brand_id', value || undefined)}
                  placeholder="Search brands..."
                  searchable={true}
                  clearable={true}
                  showCode={true}
                  fullWidth={true}
                  size="medium"
                  debounceMs={300}
                />
              </div>

              {/* Item Status Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filterForm.watch('item_status') || ''}
                  onValueChange={(value) =>
                    filterForm.setValue('item_status', value === 'all' ? undefined : value as any)
                  }
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

              {/* Created Date Range */}
              <div className="space-y-2">
                <Label>Created After</Label>
                <Input
                  type="date"
                  {...filterForm.register('created_after')}
                />
              </div>

              {/* Updated Date Range */}
              <div className="space-y-2">
                <Label>Updated After</Label>
                <Input
                  type="date"
                  {...filterForm.register('updated_after')}
                />
              </div>
            </div>

            {/* Optional Second Row for Date Before Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Created Before</Label>
                <Input
                  type="date"
                  {...filterForm.register('created_before')}
                />
              </div>

              <div className="space-y-2">
                <Label>Updated Before</Label>
                <Input
                  type="date"
                  {...filterForm.register('updated_before')}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-end space-x-2">
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear
                </Button>
                <Button type="submit" disabled={isLoading}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rental Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Loading items...
                  </TableCell>
                </TableRow>
              ) : !items || items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="text-muted-foreground space-y-2">
                      <p>No items found</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                      {process.env.NODE_ENV === 'development' && (
                        <details className="text-xs bg-gray-50 p-2 rounded mt-2">
                          <summary className="cursor-pointer text-slate-600">Debug Info</summary>
                          <div className="mt-2 text-left">
                            <p>Items array: {JSON.stringify(items)}</p>
                            <p>Total count: {totalCount}</p>
                            <p>Loading state: {isLoading ? 'true' : 'false'}</p>
                          </div>
                        </details>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                (items || []).map((item) => {
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{item.item_name}</div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {item.sku && (
                                  <>
                                    <Barcode className="h-3 w-3" />
                                    <span>SKU: {item.sku}</span>
                                  </>
                                )}
                                {item.item_code && item.item_code !== item.sku && (
                                  <>
                                    <span>•</span>
                                    <span>Code: {item.item_code}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {/* Handle both old and new nested format */}
                          {item.category?.category_name || 
                           (item.category_id && typeof item.category_id === 'object' && 'name' in item.category_id) ? item.category_id.name :
                           (getCategoryName && typeof item.category_id === 'string' ? getCategoryName(item.category_id) : 'Uncategorized')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {/* Handle both old and new nested format */}
                          {item.brand?.brand_name || 
                           (item.brand_id && typeof item.brand_id === 'object' && 'name' in item.brand_id) ? item.brand_id.name :
                           (typeof item.brand_id === 'string' ? `Brand ID: ${item.brand_id.slice(0, 8)}...` : '-')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {/* Handle unit of measurement - new nested format */}
                          {item.unit_of_measurement_id && typeof item.unit_of_measurement_id === 'object' && 'name' in item.unit_of_measurement_id ? 
                           `${item.unit_of_measurement_id.name}${item.unit_of_measurement_id.code ? ` (${item.unit_of_measurement_id.code})` : ''}` :
                           (typeof item.unit_of_measurement_id === 'string' ? 'Unit' : '-')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {item.is_rentable && item.is_saleable ? 'Rental & Sale' : 
                           item.is_rentable ? 'Rental Only' : 
                           item.is_saleable ? 'Sale Only' : 'Not Available'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {item.rental_rate_per_period && (
                            <div className="flex items-center gap-1 text-sm">
                              <Package className="h-3 w-3" />
                              <span className="font-medium">
                                {formatCurrency(item.rental_rate_per_period)}{item.rental_period ? ` for ${item.rental_period} day${Number(item.rental_period) > 1 ? 's' : ''}` : '/period'}
                              </span>
                            </div>
                          )}
                          {item.sale_price && (
                            <div className="flex items-center gap-1 text-sm">
                              <Package className="h-3 w-3" />
                              <span className="font-medium">
                                {formatCurrency(item.sale_price)} sale
                              </span>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Purchase: {formatCurrency(item.purchase_price)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs', getStatusColor(item.item_status))}>
                          {item.item_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.is_rentable ? (
                          <RentalStatusToggle
                            entityId={item.id}
                            entityType="ITEM"
                            entityName={item.item_name}
                            currentStatus={item.is_rental_blocked || false}
                            currentReason={item.rental_block_reason}
                            onStatusChange={async (blocked, remarks) => {
                              await toggleEntityStatus('ITEM', item.id, blocked, remarks);
                            }}
                            size="sm"
                          />
                        ) : (
                          <span className="text-xs text-gray-500">Not rentable</span>
                        )}
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
                          {onDeleteItem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteItem(item.id)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount} items
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