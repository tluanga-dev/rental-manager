'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown, X, Search, AlertCircle, Folder, FolderOpen, Package } from 'lucide-react';
import { useCategorySearch } from '../hooks/useCategorySearch';
import { useClickOutside } from '@/hooks/use-click-outside';
import { CategoryDropdownProps } from './CategoryDropdown.types';
import { VirtualCategoryList } from './VirtualCategoryList';
import { usePerformanceTracking } from '@/utils/performance-monitor';
import type { CategoryResponse } from '@/services/api/categories';
import { cn } from '@/lib/utils';

export function CategoryDropdown({
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder = 'Search or select a category...',
  disabled = false,
  error = false,
  helperText,
  size = 'medium',
  fullWidth = false,
  className,
  name,
  id,
  required = false,
  searchable = true,
  clearable = true,
  virtualScroll = true,
  showPath = true,
  showTree = false,
  expandable = false,
  showIcons = true,
  showLevel = false,
  onlyLeaf = true,
  includeInactive = false,
  maxResults = 100,
  parentId,
  debounceMs = 300,
  cacheTime,
  staleTime,
}: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [expandedNodes] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Performance tracking
  const { trackRender, trackSearch, trackSelection, startTimer, endTimer } = 
    usePerformanceTracking('CategoryDropdown');

  const {
    categories,
    searchTerm,
    isLoading,
    error: fetchError,
    handleSearch,
    clearSearch,
    refetch,
    getCategoryByPath,
  } = useCategorySearch({
    onlyLeaf,
    debounceMs,
    cacheTime,
    staleTime,
  });

  // Find selected category
  const selectedCategory = useMemo(() => {
    if (!value) return null;
    return categories.find((c: CategoryResponse) => c.id === value) || null;
  }, [value, categories]);

  // Display value in input
  const inputValue = useMemo(() => {
    if (searchTerm) return searchTerm;
    if (selectedCategory) {
      return showPath ? selectedCategory.category_path : selectedCategory.name;
    }
    return '';
  }, [searchTerm, selectedCategory, showPath]);

  // Handle click outside
  useClickOutside(dropdownRef, () => {
    if (isOpen) {
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (!selectedCategory) {
        clearSearch();
      }
    }
  });

  // Handle category selection
  const handleSelect = useCallback((category: CategoryResponse) => {
    startTimer('selection');
    onChange?.(category.id, category);
    setIsOpen(false);
    setHighlightedIndex(-1);
    clearSearch();
    inputRef.current?.blur();
    endTimer('selection', { 
      categoryId: category.id, 
      categoryName: category.name,
      categoryPath: category.category_path 
    });
  }, [onChange, clearSearch, startTimer, endTimer]);

  // Handle clear
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('', null as any);
    clearSearch();
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }, [onChange, clearSearch]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    startTimer('search');
    handleSearch(value);
    if (!isOpen) {
      setIsOpen(true);
    }
    setHighlightedIndex(-1);
  }, [handleSearch, isOpen, startTimer]);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    onFocus?.();
    setIsOpen(true);
  }, [onFocus]);

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < categories.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && categories[highlightedIndex]) {
          handleSelect(categories[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (!selectedCategory) {
          clearSearch();
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, categories, highlightedIndex, handleSelect, selectedCategory, clearSearch]);

  // Track search results and component render
  useEffect(() => {
    if (!isLoading && searchTerm) {
      const duration = endTimer('search');
      if (duration !== null) {
        trackSearch(searchTerm, categories.length, duration);
      }
    }
  }, [categories, isLoading, searchTerm, endTimer, trackSearch]);

  // Track component renders
  useEffect(() => {
    trackRender({ 
      categoriesCount: categories.length, 
      isOpen, 
      hasSearchTerm: !!searchTerm,
      virtualScrollEnabled: virtualScroll && categories.length > 20
    });
  }, [categories.length, isOpen, searchTerm, virtualScroll, trackRender]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current && !virtualScroll) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [highlightedIndex, virtualScroll]);

  // Size classes
  const sizeClasses = {
    small: 'h-8 text-sm',
    medium: 'h-10 text-base',
    large: 'h-12 text-lg',
  };

  const hasError = error || !!fetchError;

  // Get icon for category
  const getCategoryIcon = (category: CategoryResponse) => {
    if (!showIcons) return null;
    
    if (category.is_leaf) {
      return <Package className="h-4 w-4 text-gray-400" />;
    }
    
    const isExpanded = expandedNodes.has(category.id);
    return isExpanded ? 
      <FolderOpen className="h-4 w-4 text-gray-400" /> : 
      <Folder className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'relative',
        fullWidth ? 'w-full' : 'w-[300px]',
        className
      )}
    >
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={!searchable}
          required={required}
          className={cn(
            'w-full rounded-md border bg-white px-3 pr-10 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            sizeClasses[size],
            hasError
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-slate-500 focus:ring-slate-500',
            disabled && 'cursor-not-allowed bg-gray-50 opacity-60',
            !searchable && 'cursor-pointer'
          )}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="category-dropdown-list"
          aria-invalid={hasError}
          aria-describedby={helperText ? 'category-dropdown-helper' : undefined}
        />

        {/* Icons */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2" />
          )}
          {!isLoading && hasError && (
            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
          )}
          {!isLoading && !hasError && clearable && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded pointer-events-auto"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-gray-500 transition-transform ml-1',
              isOpen && 'transform rotate-180'
            )}
          />
        </div>
      </div>

      {/* Helper text */}
      {helperText && (
        <p
          id="category-dropdown-helper"
          className={cn(
            'mt-1 text-sm',
            hasError ? 'text-red-600' : 'text-gray-500'
          )}
        >
          {helperText}
        </p>
      )}

      {/* Dropdown list */}
      {isOpen && (
        <div
          id="category-dropdown-list"
          ref={listRef}
          className={cn(
            'absolute z-50 mt-1 w-full rounded-md border border-gray-200',
            'bg-white shadow-lg max-h-60 overflow-auto',
            'focus:outline-none'
          )}
          role="listbox"
          aria-label="Categories"
        >
          {/* Loading state */}
          {isLoading && (
            <div className="px-3 py-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2" />
              Loading categories...
            </div>
          )}

          {/* Error state */}
          {!isLoading && fetchError && (
            <div className="px-3 py-8 text-center">
              <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600 mb-2">
                Failed to load categories
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-sm text-slate-600 hover:text-slate-800 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* No results */}
          {!isLoading && !fetchError && categories.length === 0 && (
            <div className="px-3 py-8 text-center text-gray-500">
              <Search className="h-6 w-6 mx-auto mb-2 text-gray-400" />
              {searchTerm ? 'No categories found' : 'No leaf categories available'}
            </div>
          )}

          {/* Category list */}
          {!isLoading && !fetchError && categories.length > 0 && (
            <>
              {virtualScroll && categories.length > 20 ? (
                <VirtualCategoryList
                  categories={categories}
                  selectedId={value}
                  highlightedIndex={highlightedIndex}
                  onSelect={handleSelect}
                  showPath={showPath}
                  showIcons={showIcons}
                  showLevel={showLevel}
                  height={300}
                  itemHeight={showPath ? 60 : 40}
                  getCategoryIcon={getCategoryIcon}
                />
              ) : (
                categories.map((category: CategoryResponse, index: number) => {
                  const level = category.category_level - 1; // 0-based for indentation
                  const indentClass = `pl-${3 + level * 4}`;
                  
                  return (
                    <div
                      key={category.id}
                      className={cn(
                        'px-3 py-2 cursor-pointer transition-colors',
                        'hover:bg-gray-100',
                        highlightedIndex === index && 'bg-gray-100',
                        value === category.id && 'bg-slate-50 text-slate-900',
                        indentClass
                      )}
                      onClick={() => handleSelect(category)}
                      role="option"
                      aria-selected={value === category.id}
                    >
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category)}
                        <div className="flex-1">
                          <div className="font-medium">
                            {category.name}
                            {showLevel && (
                              <span className="text-xs text-gray-400 ml-2">
                                (Level {category.category_level})
                              </span>
                            )}
                          </div>
                          {showPath && (
                            <div className="text-sm text-gray-500">
                              {category.category_path}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}