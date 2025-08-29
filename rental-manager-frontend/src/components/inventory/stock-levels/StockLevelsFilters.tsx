'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { categoriesApi } from '@/services/api/categories';
import { brandsApi } from '@/services/api/brands';
import { locationsApi } from '@/services/api/locations';
import { useDebounce } from '@/hooks/useDebounce';

interface StockLevelsFiltersProps {
  filters: {
    search: string;
    location_id: string;
    category_id: string;
    brand_id: string;
    stock_status: string;
  };
  onFilterChange: (filters: {
    search: string;
    location_id: string;
    category_id: string;
    brand_id: string;
    stock_status: string;
  }) => void;
  isLoading?: boolean;
}

export function StockLevelsFilters({ filters, onFilterChange, isLoading }: StockLevelsFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 300);

  // Update filters when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFilterChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch, filters, onFilterChange]);

  // Fetch filter options
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: () => brandsApi.getAll(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getAll(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleClearFilters = () => {
    setLocalSearch('');
    onFilterChange({
      search: '',
      location_id: '',
      category_id: '',
      brand_id: '',
      stock_status: 'all',
    });
  };

  const hasActiveFilters = 
    filters.search || 
    filters.location_id || 
    filters.category_id || 
    filters.brand_id || 
    filters.stock_status !== 'all';

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <Button
            onClick={handleClearFilters}
            variant="ghost"
            size="sm"
            className="ml-auto text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search items or SKUs..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
        </div>

        {/* Location Filter */}
        <Select
          value={filters.location_id}
          onValueChange={(value) => onFilterChange({ ...filters, location_id: value })}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Locations</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category Filter */}
        <Select
          value={filters.category_id}
          onValueChange={(value) => onFilterChange({ ...filters, category_id: value })}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
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

        {/* Brand Filter */}
        <Select
          value={filters.brand_id}
          onValueChange={(value) => onFilterChange({ ...filters, brand_id: value })}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Brands</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Stock Status Filter */}
        <Select
          value={filters.stock_status}
          onValueChange={(value) => onFilterChange({ ...filters, stock_status: value })}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="IN_STOCK">In Stock</SelectItem>
            <SelectItem value="LOW_STOCK">Low Stock</SelectItem>
            <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}