'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown, X, Search, AlertCircle, Package, Warehouse } from 'lucide-react';
import { useItemSearch } from '../hooks/useItemSearch';
import { useClickOutside } from '@/hooks/use-click-outside';
import { ItemDropdownProps } from './ItemDropdown.types';
import { usePerformanceTracking } from '@/utils/performance-monitor';
import type { Item } from '@/types/item';
import { cn } from '@/lib/utils';

export function ItemDropdown({
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder = 'Search or select an item...',
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
  virtualScroll = false,
  showSku = true,
  showPrice = true,
  showStock = true,
  showCategory = false,
  categoryId,
  brandId,
  availableOnly = false,
  includeInactive = false,
  maxResults = 100,
  debounceMs = 300,
  cacheTime,
  staleTime,
}: ItemDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Performance tracking
  const { trackRender, trackSearch, trackSelection, startTimer, endTimer } = 
    usePerformanceTracking('ItemDropdown');

  const {
    items,
    searchTerm,
    isLoading,
    error: fetchError,
    handleSearch,
    clearSearch,
    refetch,
  } = useItemSearch({
    category_id: categoryId,
    brand_id: brandId,
    is_active: !includeInactive,
    available_only: availableOnly,
    limit: maxResults,
    debounceMs,
    cacheTime,
    staleTime,
  });

  // Debug logging for search issues
  useEffect(() => {
    console.log('🔍 ItemDropdown Debug:', {
      searchTerm,
      isLoading,
      itemsCount: items.length,
      fetchError: fetchError?.message,
      isOpen,
    });
  }, [searchTerm, isLoading, items.length, fetchError, isOpen]);

  // Find selected item
  const selectedItem = useMemo(() => {
    if (!value) return null;
    return items.find((i: Item) => i.id === value) || null;
  }, [value, items]);

  // Display value in input
  const inputValue = useMemo(() => {
    if (searchTerm) return searchTerm;
    if (selectedItem) {
      return showSku && selectedItem.sku 
        ? `${selectedItem.item_name} - SKU: ${selectedItem.sku}`
        : selectedItem.item_name;
    }
    return '';
  }, [searchTerm, selectedItem, showSku]);

  // Handle click outside
  useClickOutside(dropdownRef, () => {
    if (isOpen) {
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (!selectedItem) {
        clearSearch();
      }
    }
  });

  // Handle item selection
  const handleSelect = useCallback((item: Item) => {
    startTimer('selection');
    onChange?.(item.id, item);
    setIsOpen(false);
    setHighlightedIndex(-1);
    clearSearch();
    inputRef.current?.blur();
    endTimer('selection', { itemId: item.id, itemName: item.item_name });
  }, [onChange, clearSearch, startTimer, endTimer]);

  // Handle clear
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('', undefined);
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
          prev < items.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          handleSelect(items[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (!selectedItem) {
          clearSearch();
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, items, highlightedIndex, handleSelect, selectedItem, clearSearch]);

  // Track search results and component render
  useEffect(() => {
    if (!isLoading && searchTerm) {
      const duration = endTimer('search');
      if (duration !== null) {
        trackSearch(searchTerm, items.length, duration);
      }
    }
  }, [items, isLoading, searchTerm, endTimer, trackSearch]);

  // Track component renders
  useEffect(() => {
    trackRender({ 
      itemsCount: items.length, 
      isOpen, 
      hasSearchTerm: !!searchTerm,
      virtualScrollEnabled: virtualScroll && items.length > 20
    });
  }, [items.length, isOpen, searchTerm, virtualScroll, trackRender]);

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

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Size classes
  const sizeClasses = {
    small: 'h-8 text-sm',
    medium: 'h-10 text-base',
    large: 'h-12 text-lg',
  };

  const hasError = error || !!fetchError;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'relative',
        fullWidth ? 'w-full' : 'w-[400px]',
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
          aria-controls="item-dropdown-list"
          aria-invalid={hasError}
          aria-describedby={helperText ? 'item-dropdown-helper' : undefined}
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
          id="item-dropdown-helper"
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
          id="item-dropdown-list"
          ref={listRef}
          className={cn(
            'absolute z-50 mt-1 w-full rounded-md border border-gray-200',
            'bg-white shadow-lg max-h-80 overflow-auto',
            'focus:outline-none'
          )}
          role="listbox"
          aria-label="Items"
        >
          {/* Loading state */}
          {isLoading && (
            <div className="px-3 py-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2" />
              Loading items...
            </div>
          )}

          {/* Error state */}
          {!isLoading && fetchError && (
            <div className="px-3 py-8 text-center">
              <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600 mb-2">
                Failed to load items
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
          {!isLoading && !fetchError && items.length === 0 && (
            <div className="px-3 py-8 text-center text-gray-500">
              <Search className="h-6 w-6 mx-auto mb-2 text-gray-400" />
              No items found
            </div>
          )}

          {/* Item list */}
          {!isLoading && !fetchError && items.length > 0 && (
            items.map((item: Item, index: number) => (
              <div
                key={item.id}
                className={cn(
                  'px-3 py-3 cursor-pointer transition-colors border-b last:border-b-0',
                  'hover:bg-gray-50',
                  highlightedIndex === index && 'bg-gray-100',
                  value === item.id && 'bg-slate-50 text-slate-900'
                )}
                onClick={() => handleSelect(item)}
                role="option"
                aria-selected={value === item.id}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {item.item_name}
                          {showSku && item.sku && (
                            <span className="text-sm text-gray-600 font-normal ml-2">
                              - SKU: <span className="font-mono">{item.sku}</span>
                            </span>
                          )}
                        </div>
                        {showCategory && item.category && (
                          <div className="text-xs text-gray-400">
                            {item.category.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1 text-xs">
                    {showPrice && item.rental_rate_per_period && (
                      <div className="flex items-center gap-1 text-green-600 font-medium">
                        <Package className="h-3 w-3" />
                        {formatCurrency(item.rental_rate_per_period)}/period
                      </div>
                    )}
                    {showStock && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <Warehouse className="h-3 w-3" />
                        <span>
                          {item.initial_stock_quantity || 0} in stock
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}