import { useState, useCallback, useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useBrands, UseBrandsOptions } from './useBrands';
import { Brand } from '@/types/api';

export interface UseBrandSearchOptions extends UseBrandsOptions {
  debounceMs?: number;
}

export function useBrandSearch(options: UseBrandSearchOptions = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, options.debounceMs || 300);
  
  const { data, isLoading, error, refetch } = useBrands({
    ...options,
    search: debouncedSearch,
  });

  // Client-side filtering for instant results
  const filteredBrands = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm || searchTerm === debouncedSearch) {
      return data.items;
    }
    
    // Provide instant client-side filtering while debounced query runs
    const lowerSearch = searchTerm.toLowerCase();
    return data.items.filter((brand: Brand) =>
      brand.name.toLowerCase().includes(lowerSearch) ||
      (brand.code && brand.code.toLowerCase().includes(lowerSearch))
    );
  }, [data?.items, searchTerm, debouncedSearch]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    brands: filteredBrands,
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