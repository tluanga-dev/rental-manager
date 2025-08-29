'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { locationsApi } from '@/services/api/locations';
import { useDebounce } from '@/hooks/useDebounce';

interface AlertsFiltersProps {
  filters: {
    search: string;
    location_id: string;
    alert_type: string;
    severity: string;
  };
  onFilterChange: (filters: {
    search: string;
    location_id: string;
    alert_type: string;
    severity: string;
  }) => void;
  isLoading?: boolean;
}

const alertTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'LOW_STOCK', label: 'Low Stock' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
  { value: 'MAINTENANCE_DUE', label: 'Maintenance Due' },
  { value: 'WARRANTY_EXPIRING', label: 'Warranty Expiring' },
  { value: 'DAMAGE_REPORTED', label: 'Damage Reported' },
  { value: 'INSPECTION_DUE', label: 'Inspection Due' },
];

const severityLevels = [
  { value: 'all', label: 'All Severities' },
  { value: 'high', label: 'High Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'low', label: 'Low Priority' },
];

export function AlertsFilters({ filters, onFilterChange, isLoading }: AlertsFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 300);

  // Update filters when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFilterChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch, filters, onFilterChange]);

  // Fetch locations for filter
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
      alert_type: 'all',
      severity: 'all',
    });
  };

  const hasActiveFilters = 
    filters.search || 
    filters.location_id || 
    filters.alert_type !== 'all' || 
    filters.severity !== 'all';

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search alerts..."
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

        {/* Alert Type Filter */}
        <Select
          value={filters.alert_type}
          onValueChange={(value) => onFilterChange({ ...filters, alert_type: value })}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {alertTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Severity Filter */}
        <Select
          value={filters.severity}
          onValueChange={(value) => onFilterChange({ ...filters, severity: value })}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {severityLevels.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}