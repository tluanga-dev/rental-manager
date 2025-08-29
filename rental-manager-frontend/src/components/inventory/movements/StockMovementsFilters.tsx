'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { locationsApi } from '@/services/api/locations';
import { itemsApi } from '@/services/api/items';
import { usersApi } from '@/services/api/users';
import { useDebounce } from '@/hooks/useDebounce';

interface StockMovementsFiltersProps {
  filters: {
    search: string;
    item_id: string;
    location_id: string;
    movement_type: string;
    created_by: string;
    start_date: string;
    end_date: string;
  };
  onFilterChange: (filters: {
    search: string;
    item_id: string;
    location_id: string;
    movement_type: string;
    created_by: string;
    start_date: string;
    end_date: string;
  }) => void;
  isLoading?: boolean;
}

const movementTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'SALE', label: 'Sale' },
  { value: 'RENTAL_OUT', label: 'Rental Out' },
  { value: 'RENTAL_RETURN', label: 'Rental Return' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'WRITE_OFF', label: 'Write Off' },
];

export function StockMovementsFilters({ filters, onFilterChange, isLoading }: StockMovementsFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 300);

  // Update filters when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFilterChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch, filters, onFilterChange]);

  // Fetch filter options
  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getAll(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['items-for-filter'],
    queryFn: () => itemsApi.getAll({ limit: 100 }), // Limit for performance
    staleTime: 1000 * 60 * 5,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-for-filter'],
    queryFn: () => usersApi.getAll({ limit: 50 }), // Limit for performance
    staleTime: 1000 * 60 * 5,
  });

  const handleClearFilters = () => {
    setLocalSearch('');
    onFilterChange({
      search: '',
      item_id: '',
      location_id: '',
      movement_type: 'all',
      created_by: '',
      start_date: '',
      end_date: '',
    });
  };

  const hasActiveFilters = 
    filters.search || 
    filters.item_id || 
    filters.location_id || 
    filters.movement_type !== 'all' || 
    filters.created_by ||
    filters.start_date ||
    filters.end_date;

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search movements..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
        </div>

        {/* Item Filter */}
        <Select
          value={filters.item_id}
          onValueChange={(value) => onFilterChange({ ...filters, item_id: value })}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Items" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Items</SelectItem>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name} ({item.sku})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        {/* Movement Type Filter */}
        <Select
          value={filters.movement_type}
          onValueChange={(value) => onFilterChange({ ...filters, movement_type: value })}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {movementTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* User Filter */}
        <Select
          value={filters.created_by}
          onValueChange={(value) => onFilterChange({ ...filters, created_by: value })}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Users</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.first_name} {user.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Start Date */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="date"
            placeholder="Start Date"
            value={filters.start_date}
            onChange={(e) => onFilterChange({ ...filters, start_date: e.target.value })}
            className="pl-10"
            disabled={isLoading}
          />
        </div>

        {/* End Date */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="date"
            placeholder="End Date"
            value={filters.end_date}
            onChange={(e) => onFilterChange({ ...filters, end_date: e.target.value })}
            className="pl-10"
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}