'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  MapPin, 
  Filter, 
  X, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import type { DueTodayFilters, LocationSummaryDueToday } from '@/types/rentals';

interface DueTodayFiltersProps {
  filters: DueTodayFilters;
  onFiltersChange: (filters: Partial<DueTodayFilters>) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  locations: LocationSummaryDueToday[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  className?: string;
}

const RENTAL_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'OVERDUE', label: 'Overdue' },
];

export function DueTodayFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  onRefresh,
  locations,
  isLoading = false,
  isRefreshing = false,
  className = '',
}: DueTodayFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const debouncedSearch = useDebounce(searchInput, 300);

  // Update search filter when debounced value changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch, filters.search, onFiltersChange]);

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  // Handle location filter change
  const handleLocationChange = useCallback((value: string) => {
    onFiltersChange({ location_id: value === 'all' ? undefined : value });
  }, [onFiltersChange]);

  // Handle status filter change
  const handleStatusChange = useCallback((value: string) => {
    onFiltersChange({ status: value === 'all' ? undefined : value });
  }, [onFiltersChange]);

  // Clear search input
  const clearSearch = useCallback(() => {
    setSearchInput('');
    onFiltersChange({ search: undefined });
  }, [onFiltersChange]);

  // Check if any filters are active
  const hasActiveFilters = !!(filters.search || filters.location_id || filters.status);
  const activeFilterCount = [filters.search, filters.location_id, filters.status].filter(Boolean).length;

  return (
    <Card className={`${className}`}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header with title and actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount} active
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearFilters}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* Filter Controls */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Search Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Customer name or transaction number..."
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 pr-10"
                />
                {searchInput && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Location
              </label>
              <Select
                value={filters.location_id || 'all'}
                onValueChange={handleLocationChange}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <SelectValue placeholder="All locations" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.location_id} value={location.location_id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{location.location_name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {location.rental_count}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Status
              </label>
              <Select
                value={filters.status || 'all'}
                onValueChange={handleStatusChange}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                    <SelectValue placeholder="All statuses" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {RENTAL_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <span className="text-sm text-gray-600">Active filters:</span>
              
              {filters.search && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Search className="w-3 h-3" />
                  Search: "{filters.search}"
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFiltersChange({ search: undefined })}
                    className="h-4 w-4 p-0 ml-1 hover:bg-gray-200"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              )}
              
              {filters.location_id && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Location: {locations.find(l => l.location_id === filters.location_id)?.location_name || 'Unknown'}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFiltersChange({ location_id: undefined })}
                    className="h-4 w-4 p-0 ml-1 hover:bg-gray-200"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              )}
              
              {filters.status && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Status: {RENTAL_STATUSES.find(s => s.value === filters.status)?.label || filters.status}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onFiltersChange({ status: undefined })}
                    className="h-4 w-4 p-0 ml-1 hover:bg-gray-200"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              )}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-2 text-gray-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading filters...</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default DueTodayFilters;