import { useState, useCallback, useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useUnitsOfMeasurement, UseUnitsOfMeasurementOptions } from './useUnitsOfMeasurement';
import { UnitOfMeasurement } from '@/types/unit-of-measurement';

export interface UseUnitOfMeasurementSearchOptions extends UseUnitsOfMeasurementOptions {
  debounceMs?: number;
}

export function useUnitOfMeasurementSearch(options: UseUnitOfMeasurementSearchOptions = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, options.debounceMs || 300);
  
  const { data, isLoading, error, refetch } = useUnitsOfMeasurement({
    ...options,
    search: debouncedSearch,
  });

  // Client-side filtering for instant results
  const filteredUnits = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm || searchTerm === debouncedSearch) {
      return data.items;
    }
    
    // Provide instant client-side filtering while debounced query runs
    const lowerSearch = searchTerm.toLowerCase();
    return data.items.filter((unit: UnitOfMeasurement) =>
      unit.name.toLowerCase().includes(lowerSearch) ||
      (unit.abbreviation && unit.abbreviation.toLowerCase().includes(lowerSearch))
    );
  }, [data?.items, searchTerm, debouncedSearch]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    units: filteredUnits,
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