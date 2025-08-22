'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Search, 
  X, 
  Filter,
  RefreshCw 
} from 'lucide-react';
import type { InventoryItemsFilterState } from '@/types/inventory-items';

interface InventoryItemsFiltersProps {
  filters: InventoryItemsFilterState;
  onFilterChange: (filters: InventoryItemsFilterState) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function InventoryItemsFilters({
  filters,
  onFilterChange,
  onRefresh,
  isLoading
}: InventoryItemsFiltersProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== filters.search) {
        onFilterChange({ ...filters, search: searchTerm });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleFilterChange = (key: keyof InventoryItemsFilterState, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setSearchTerm('');
    onFilterChange({
      search: '',
      category_id: '',
      brand_id: '',
      item_status: 'all',
      stock_status: 'all',
      is_rentable: undefined,
      is_saleable: undefined,
    });
  };

  const hasActiveFilters = 
    filters.search ||
    filters.category_id ||
    filters.brand_id ||
    filters.item_status !== 'all' ||
    filters.stock_status !== 'all' ||
    filters.is_rentable !== undefined ||
    filters.is_saleable !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, SKU, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap gap-2">
          {/* Item Status */}
          <Select
            value={filters.item_status}
            onValueChange={(value) => handleFilterChange('item_status', value)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Item Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
            </SelectContent>
          </Select>

          {/* Stock Status */}
          <Select
            value={filters.stock_status}
            onValueChange={(value) => handleFilterChange('stock_status', value)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Stock Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="IN_STOCK">In Stock</SelectItem>
              <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
              <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
            </SelectContent>
          </Select>

          {/* Rentable */}
          <Select
            value={filters.is_rentable === undefined ? 'all' : String(filters.is_rentable)}
            onValueChange={(value) => handleFilterChange('is_rentable', value === 'all' ? undefined : value === 'true')}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Rentable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="true">Rentable</SelectItem>
              <SelectItem value="false">Not Rentable</SelectItem>
            </SelectContent>
          </Select>

          {/* Saleable */}
          <Select
            value={filters.is_saleable === undefined ? 'all' : String(filters.is_saleable)}
            onValueChange={(value) => handleFilterChange('is_saleable', value === 'all' ? undefined : value === 'true')}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Saleable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="true">Saleable</SelectItem>
              <SelectItem value="false">Not Saleable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
          
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Active filters:</span>
          <div className="flex flex-wrap gap-2">
            {filters.search && (
              <span className="px-2 py-1 bg-secondary rounded-md">
                Search: {filters.search}
              </span>
            )}
            {filters.item_status !== 'all' && (
              <span className="px-2 py-1 bg-secondary rounded-md">
                Status: {filters.item_status}
              </span>
            )}
            {filters.stock_status !== 'all' && (
              <span className="px-2 py-1 bg-secondary rounded-md">
                Stock: {filters.stock_status}
              </span>
            )}
            {filters.is_rentable !== '' && (
              <span className="px-2 py-1 bg-secondary rounded-md">
                {filters.is_rentable ? 'Rentable' : 'Not Rentable'}
              </span>
            )}
            {filters.is_saleable !== '' && (
              <span className="px-2 py-1 bg-secondary rounded-md">
                {filters.is_saleable ? 'Saleable' : 'Not Saleable'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}