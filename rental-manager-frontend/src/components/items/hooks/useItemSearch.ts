import React, { useState, useCallback, useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useItems, UseItemsOptions } from './useItems';
import { Item } from '@/types/item';

export interface UseItemSearchOptions extends UseItemsOptions {
  debounceMs?: number;
}

export function useItemSearch(options: UseItemSearchOptions = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, options.debounceMs || 300);
  
  const { data, isLoading, error, refetch } = useItems({
    ...options,
    search: debouncedSearch,
  });

  // Debug logging for search API calls
  React.useEffect(() => {
    console.log('🔍 useItemSearch state:', {
      searchTerm,
      debouncedSearch,
      options,
      isLoading,
      dataReceived: !!data,
      itemsCount: data?.items?.length || 0,
      error: error?.message,
    });
  }, [searchTerm, debouncedSearch, data, isLoading, error, options]);

  // Client-side filtering for instant results
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm || searchTerm === debouncedSearch) {
      return data.items;
    }
    
    // Provide instant client-side filtering while debounced query runs
    const lowerSearch = searchTerm.toLowerCase();
    return data.items.filter((item: Item) =>
      item.item_name.toLowerCase().includes(lowerSearch) ||
      item.sku.toLowerCase().includes(lowerSearch) ||
      (item.description && item.description.toLowerCase().includes(lowerSearch))
    );
  }, [data?.items, searchTerm, debouncedSearch]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    items: filteredItems,
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