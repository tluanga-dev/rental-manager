import { useState, useCallback, useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSuppliers, UseSupplierOptions } from './useSuppliers';
import { Supplier } from '@/types/supplier';

export interface UseSupplierSearchOptions extends UseSupplierOptions {
  debounceMs?: number;
}

export function useSupplierSearch(options: UseSupplierSearchOptions = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, options.debounceMs || 300);
  
  const { data, isLoading, error, refetch } = useSuppliers({
    ...options,
    search: debouncedSearch,
  });

  // Client-side filtering for instant results
  const filteredSuppliers = useMemo(() => {
    if (!data?.suppliers) return [];
    if (!searchTerm || searchTerm === debouncedSearch) {
      return data.suppliers;
    }
    
    // Provide instant client-side filtering while debounced query runs
    const lowerSearch = searchTerm.toLowerCase();
    return data.suppliers.filter((supplier: Supplier) =>
      supplier.name.toLowerCase().includes(lowerSearch) ||
      supplier.code.toLowerCase().includes(lowerSearch)
    );
  }, [data?.suppliers, searchTerm, debouncedSearch]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    suppliers: filteredSuppliers,
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