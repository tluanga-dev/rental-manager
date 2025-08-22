'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { RentalFilterParams } from '@/types/rentals';
import { customersApi } from '@/services/api/customers';
import { locationsApi } from '@/services/api/locations';

interface RentalFiltersProps {
  onFiltersChange: (filters: RentalFilterParams) => void;
  initialFilters?: RentalFilterParams;
  showAdvanced?: boolean;
}

export const RentalFilters: React.FC<RentalFiltersProps> = ({
  onFiltersChange,
  initialFilters = {},
  showAdvanced = true,
}) => {
  const [filters, setFilters] = useState<RentalFilterParams>(initialFilters);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Load customers for dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customers', 'simple'],
    queryFn: () => customersApi.getAll({ limit: 100 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Load locations for dropdown  
  const { data: locationsData } = useQuery({
    queryKey: ['locations', 'simple'],
    queryFn: () => locationsApi.getAll({ limit: 100 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const customers = customersData?.data?.customers || [];
  const locations = locationsData?.data?.locations || [];

  // Update filters when they change
  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  const handleFilterChange = (key: keyof RentalFilterParams, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  // Count active filters
  const activeFilterCount = Object.values(filters).filter(value => 
    value !== undefined && value !== '' && value !== null
  ).length;

  const statusOptions = [
    { value: 'ACTIVE', label: 'Active', color: 'text-green-600' },
    { value: 'RETURNED', label: 'Returned', color: 'text-blue-600' },
    { value: 'LATE', label: 'Late', color: 'text-yellow-600' },
    { value: 'LOST', label: 'Lost', color: 'text-red-600' },
    { value: 'DAMAGED', label: 'Damaged', color: 'text-red-600' },
  ];
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
            {showAdvanced && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              >
                {showAdvancedOptions ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Less Options
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    More Options
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Search Term */}
          <div className="grid gap-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search transactions, customers, items..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Quick Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Filter */}
            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer</Label>
              <select
                id="customer_id"
                value={filters.customer_id || ''}
                onChange={(e) => handleFilterChange('customer_id', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="">All Customers</option>
                {customers.map((customer: any) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.code && `(${customer.code})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <Label htmlFor="location_id">Location</Label>
              <select
                id="location_id"
                value={filters.location_id || ''}
                onChange={(e) => handleFilterChange('location_id', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="">All Locations</option>
                {locations.map((location: any) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                <option value="">All Statuses</option>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Advanced Options */}
          {showAdvancedOptions && (
            <div className="space-y-4 pt-4 border-t">
              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_from" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    From Date
                  </Label>
                  <Input
                    id="date_from"
                    type="date"
                    value={filters.date_from || ''}
                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_to" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    To Date
                  </Label>
                  <Input
                    id="date_to"
                    type="date"
                    value={filters.date_to || ''}
                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                  />
                </div>
              </div>

              {/* Additional Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Overdue Toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    id="overdue_only"
                    type="checkbox"
                    checked={filters.overdue_only || false}
                    onChange={(e) => handleFilterChange('overdue_only', e.target.checked)}
                    className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300 rounded"
                  />
                  <Label htmlFor="overdue_only" className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Show overdue rentals only
                  </Label>
                </div>

                {/* Late Returns Toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    id="late_returns"
                    type="checkbox"
                    checked={filters.late_returns || false}
                    onChange={(e) => handleFilterChange('late_returns', e.target.checked)}
                    className="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300 rounded"
                  />
                  <Label htmlFor="late_returns">
                    Include late returns
                  </Label>
                </div>
              </div>

              {/* Amount Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_amount">Minimum Amount</Label>
                  <Input
                    id="min_amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={filters.min_amount || ''}
                    onChange={(e) => handleFilterChange('min_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_amount">Maximum Amount</Label>
                  <Input
                    id="max_amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={filters.max_amount || ''}
                    onChange={(e) => handleFilterChange('max_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Active Filter Tags */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {filters.search && (
                <Badge variant="outline" className="flex items-center gap-1">
                  Search: {filters.search}
                  <button
                    onClick={() => handleFilterChange('search', '')}
                    className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {filters.status && (
                <Badge variant="outline" className="flex items-center gap-1">
                  Status: {statusOptions.find(s => s.value === filters.status)?.label}
                  <button
                    onClick={() => handleFilterChange('status', '')}
                    className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {filters.customer_id && (
                <Badge variant="outline" className="flex items-center gap-1">
                  Customer: {customers.find((c: any) => c.id === filters.customer_id)?.name}
                  <button
                    onClick={() => handleFilterChange('customer_id', '')}
                    className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {filters.location_id && (
                <Badge variant="outline" className="flex items-center gap-1">
                  Location: {locations.find((l: any) => l.id === filters.location_id)?.name}
                  <button
                    onClick={() => handleFilterChange('location_id', '')}
                    className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {filters.overdue_only && (
                <Badge variant="outline" className="flex items-center gap-1 text-red-600">
                  Overdue Only
                  <button
                    onClick={() => handleFilterChange('overdue_only', false)}
                    className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RentalFilters;