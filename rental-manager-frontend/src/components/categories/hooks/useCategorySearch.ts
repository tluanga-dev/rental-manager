import { useState, useCallback, useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useLeafCategories, UseLeafCategoriesOptions } from './useLeafCategories';
import { CategoryResponse } from '@/services/api/categories';

export interface UseCategorySearchOptions extends UseLeafCategoriesOptions {
  debounceMs?: number;
  onlyLeaf?: boolean;
}

export function useCategorySearch(options: UseCategorySearchOptions = {}) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, options.debounceMs || 300);
  const { onlyLeaf = true, ...leafCategoryOptions } = options;
  
  // Use leaf categories which are the categories that can be selected for items
  const { data: categories = [], isLoading, error, refetch } = useLeafCategories(leafCategoryOptions);

  // Client-side filtering for instant results
  const filteredCategories = useMemo(() => {
    // Ensure categories is always an array
    const categoriesArray = Array.isArray(categories) ? categories : [];
    
    if (categoriesArray.length === 0) return [];
    
    // Ensure searchTerm is a string and not empty
    const searchString = typeof searchTerm === 'string' ? searchTerm.trim() : '';
    if (!searchString) return categoriesArray;
    
    const lowerSearch = searchString.toLowerCase();
    
    // Search in category name and path
    return categoriesArray.filter((category: CategoryResponse) => {
      const nameMatch = category.name.toLowerCase().includes(lowerSearch);
      const pathMatch = category.category_path.toLowerCase().includes(lowerSearch);
      
      // Also search for partial path matches (e.g., "elec > lap" matches "Electronics > Computers > Laptops")
      const pathParts = category.category_path.split(' > ');
      const searchParts = searchString.toLowerCase().split(' > ').filter(p => p.trim());
      const partialPathMatch = searchParts.every(searchPart => 
        pathParts.some(pathPart => pathPart.toLowerCase().includes(searchPart))
      );
      
      return nameMatch || pathMatch || partialPathMatch;
    });
  }, [categories, searchTerm]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  const getCategoryByPath = useCallback((path: string) => {
    const categoriesArray = Array.isArray(categories) ? categories : [];
    return categoriesArray.find((cat: CategoryResponse) => cat.category_path === path);
  }, [categories]);

  return {
    categories: filteredCategories,
    allCategories: Array.isArray(categories) ? categories : [],
    searchTerm,
    debouncedSearch,
    isLoading,
    error,
    handleSearch,
    clearSearch,
    refetch,
    totalCount: Array.isArray(categories) ? categories.length : 0,
    filteredCount: filteredCategories.length,
    getCategoryByPath,
  };
}