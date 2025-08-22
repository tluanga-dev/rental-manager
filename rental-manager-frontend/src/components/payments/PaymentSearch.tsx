'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Search, Filter, X, Calendar, IndianRupee, CreditCard } from 'lucide-react';
import { PaymentMethod, PaymentMethodInfo } from '@/types/payment';
import { format } from 'date-fns';

export interface PaymentSearchFilters {
  searchTerm?: string;
  paymentMethod?: PaymentMethod | 'ALL';
  amountRange?: {
    min?: number;
    max?: number;
  };
  dateRange?: {
    from?: string;
    to?: string;
  };
  paymentType?: 'ORIGINAL' | 'EXTENSION' | 'RETURN' | 'ADJUSTMENT' | 'ALL';
  reference?: string;
}

interface PaymentSearchProps {
  filters: PaymentSearchFilters;
  onFiltersChange: (filters: PaymentSearchFilters) => void;
  onClearFilters: () => void;
  showAdvancedFilters?: boolean;
  placeholder?: string;
}

export const PaymentSearch: React.FC<PaymentSearchProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  showAdvancedFilters = false,
  placeholder = 'Search payments by reference, customer, or amount...'
}) => {
  const [isExpanded, setIsExpanded] = useState(showAdvancedFilters);
  const [localFilters, setLocalFilters] = useState<PaymentSearchFilters>(filters);
  const [searchTerm, setSearchTerm] = useState(filters.searchTerm || '');

  // Debounce search term updates
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateFilter('searchTerm', searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, updateFilter]);

  const updateFilter = useCallback((key: keyof PaymentSearchFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  }, [localFilters, onFiltersChange]);

  const updateAmountRange = useCallback((type: 'min' | 'max', value: number | undefined) => {
    const newAmountRange = {
      ...localFilters.amountRange,
      [type]: value
    };
    updateFilter('amountRange', newAmountRange);
  }, [localFilters.amountRange, updateFilter]);

  const updateDateRange = useCallback((type: 'from' | 'to', value: string | undefined) => {
    const newDateRange = {
      ...localFilters.dateRange,
      [type]: value
    };
    updateFilter('dateRange', newDateRange);
  }, [localFilters.dateRange, updateFilter]);

  const hasActiveFilters = () => {
    return !!(
      localFilters.searchTerm ||
      (localFilters.paymentMethod && localFilters.paymentMethod !== 'ALL') ||
      (localFilters.paymentType && localFilters.paymentType !== 'ALL') ||
      localFilters.reference ||
      localFilters.amountRange?.min ||
      localFilters.amountRange?.max ||
      localFilters.dateRange?.from ||
      localFilters.dateRange?.to
    );
  };

  const clearAllFilters = () => {
    const emptyFilters: PaymentSearchFilters = {
      searchTerm: '',
      paymentMethod: 'ALL',
      paymentType: 'ALL',
      reference: '',
      amountRange: {},
      dateRange: {}
    };
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
    onClearFilters();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Basic Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={localFilters.searchTerm || ''}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {localFilters.searchTerm && (
            <button
              onClick={() => updateFilter('searchTerm', '')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-md transition-colors ${
            isExpanded || hasActiveFilters()
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters() && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              !
            </span>
          )}
        </button>
        
        {hasActiveFilters() && (
          <button
            onClick={clearAllFilters}
            className="px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Payment Method Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={localFilters.paymentMethod || 'ALL'}
                  onChange={(e) => updateFilter('paymentMethod', e.target.value as PaymentMethod | 'ALL')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Methods</option>
                  {Object.entries(PaymentMethod).map(([key, method]) => (
                    <option key={method} value={method}>
                      {PaymentMethodInfo[method].icon} {PaymentMethodInfo[method].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Payment Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Type
              </label>
              <select
                value={localFilters.paymentType || 'ALL'}
                onChange={(e) => updateFilter('paymentType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="ORIGINAL">Original Payment</option>
                <option value="EXTENSION">Extension Payment</option>
                <option value="RETURN">Return Payment</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </select>
            </div>

            {/* Reference Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference/Transaction ID
              </label>
              <input
                type="text"
                value={localFilters.reference || ''}
                onChange={(e) => updateFilter('reference', e.target.value)}
                placeholder="Enter reference ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={localFilters.amountRange?.min || ''}
                    onChange={(e) => updateAmountRange('min', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="Min amount"
                    min="0"
                    step="0.01"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={localFilters.amountRange?.max || ''}
                    onChange={(e) => updateAmountRange('max', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="Max amount"
                    min="0"
                    step="0.01"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={localFilters.dateRange?.from || ''}
                    onChange={(e) => updateDateRange('from', e.target.value || undefined)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={localFilters.dateRange?.to || ''}
                    onChange={(e) => updateDateRange('to', e.target.value || undefined)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Filter Summary */}
          {hasActiveFilters() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Active Filters:</h4>
              <div className="flex flex-wrap gap-2">
                {localFilters.searchTerm && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    Search: {localFilters.searchTerm}
                    <button onClick={() => updateFilter('searchTerm', '')}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {localFilters.paymentMethod && localFilters.paymentMethod !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    Method: {PaymentMethodInfo[localFilters.paymentMethod].label}
                    <button onClick={() => updateFilter('paymentMethod', 'ALL')}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {localFilters.paymentType && localFilters.paymentType !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    Type: {localFilters.paymentType}
                    <button onClick={() => updateFilter('paymentType', 'ALL')}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {(localFilters.amountRange?.min || localFilters.amountRange?.max) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    Amount: {localFilters.amountRange.min && `₹${localFilters.amountRange.min}`}
                    {localFilters.amountRange.min && localFilters.amountRange.max && ' - '}
                    {localFilters.amountRange.max && `₹${localFilters.amountRange.max}`}
                    <button onClick={() => updateFilter('amountRange', {})}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {(localFilters.dateRange?.from || localFilters.dateRange?.to) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    Date: {localFilters.dateRange.from && format(new Date(localFilters.dateRange.from), 'MMM dd')}
                    {localFilters.dateRange.from && localFilters.dateRange.to && ' - '}
                    {localFilters.dateRange.to && format(new Date(localFilters.dateRange.to), 'MMM dd')}
                    <button onClick={() => updateFilter('dateRange', {})}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};