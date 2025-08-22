import { useState, useCallback, useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useCustomers, UseCustomerOptions } from './useCustomers';
import { filterCustomers, sortCustomersByRelevance } from '@/utils/customer-utils';
import type { Customer } from '@/types/customer';

export interface UseCustomerSearchOptions extends UseCustomerOptions {
  debounceMs?: number;
}

export function useCustomerSearch(options: UseCustomerSearchOptions = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, options.debounceMs || 300);
  
  const { data, isLoading, error, refetch } = useCustomers({
    ...options,
    search: debouncedSearch,
  });

  // Client-side filtering for instant results
  const filteredCustomers = useMemo(() => {
    if (!data?.customers) return [];
    
    // If we have a search term but it hasn't been debounced yet, apply client-side filtering
    if (searchTerm && searchTerm !== debouncedSearch) {
      const filtered = filterCustomers(data.customers, searchTerm);
      return sortCustomersByRelevance(filtered);
    }
    
    // Otherwise return the API results (already filtered by debounced search)
    return sortCustomersByRelevance(data.customers);
  }, [data?.customers, searchTerm, debouncedSearch]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    customers: filteredCustomers,
    searchTerm,
    debouncedSearch,
    isLoading,
    error,
    handleSearch,
    clearSearch,
    refetch,
    totalCount: data?.total || 0,
  };
}