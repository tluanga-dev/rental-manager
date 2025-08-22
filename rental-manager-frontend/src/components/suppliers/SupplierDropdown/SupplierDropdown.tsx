'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown, X, Search, AlertCircle } from 'lucide-react';
import { useSupplierSearch } from '../hooks/useSupplierSearch';
import { useClickOutside } from '@/hooks/use-click-outside';
import { SupplierDropdownProps } from './SupplierDropdown.types';
import { VirtualSupplierList } from './VirtualSupplierList';
import { usePerformanceTracking } from '@/utils/performance-monitor';
import type { Supplier } from '@/types/supplier';
import { cn } from '@/lib/utils';

export function SupplierDropdown({
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder = 'Search or select a supplier...',
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
  showCode = true,
  showStatus = false,
  includeInactive = false,
  maxResults = 100,
  debounceMs = 300,
  cacheTime,
  staleTime,
}: SupplierDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Performance tracking
  const { trackRender, trackSearch, trackSelection, startTimer, endTimer } = 
    usePerformanceTracking('SupplierDropdown');

  const {
    suppliers,
    searchTerm,
    isLoading,
    error: fetchError,
    handleSearch,
    clearSearch,
    refetch,
  } = useSupplierSearch({
    includeInactive,
    limit: maxResults,
    debounceMs,
    cacheTime,
    staleTime,
  });

  // Find selected supplier
  const selectedSupplier = useMemo(() => {
    if (!value) return null;
    return suppliers.find((s: Supplier) => s.id === value) || null;
  }, [value, suppliers]);

  // Display value in input
  const inputValue = useMemo(() => {
    if (searchTerm) return searchTerm;
    if (selectedSupplier) return selectedSupplier.name;
    return '';
  }, [searchTerm, selectedSupplier]);

  // Handle click outside
  useClickOutside(dropdownRef, () => {
    if (isOpen) {
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (!selectedSupplier) {
        clearSearch();
      }
    }
  });

  // Handle supplier selection
  const handleSelect = useCallback((supplier: Supplier) => {
    startTimer('selection');
    onChange?.(supplier.id, supplier);
    setIsOpen(false);
    setHighlightedIndex(-1);
    clearSearch();
    inputRef.current?.blur();
    endTimer('selection', { supplierId: supplier.id, supplierName: supplier.name });
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
    // Track search will be called when suppliers update
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
          prev < suppliers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && suppliers[highlightedIndex]) {
          handleSelect(suppliers[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (!selectedSupplier) {
          clearSearch();
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, suppliers, highlightedIndex, handleSelect, selectedSupplier, clearSearch]);

  // Track search results and component render
  useEffect(() => {
    if (!isLoading && searchTerm) {
      const duration = endTimer('search');
      if (duration !== null) {
        trackSearch(searchTerm, suppliers.length, duration);
      }
    }
  }, [suppliers, isLoading, searchTerm, endTimer, trackSearch]);

  // Track component renders
  useEffect(() => {
    trackRender({ 
      suppliersCount: suppliers.length, 
      isOpen, 
      hasSearchTerm: !!searchTerm,
      virtualScrollEnabled: virtualScroll && suppliers.length > 20
    });
  }, [suppliers.length, isOpen, searchTerm, virtualScroll, trackRender]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [highlightedIndex]);

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
          aria-controls="supplier-dropdown-list"
          aria-invalid={hasError}
          aria-describedby={helperText ? 'supplier-dropdown-helper' : undefined}
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
          id="supplier-dropdown-helper"
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
          id="supplier-dropdown-list"
          ref={listRef}
          className={cn(
            'absolute z-50 mt-1 w-full rounded-md border border-gray-200',
            'bg-white shadow-lg max-h-60 overflow-auto',
            'focus:outline-none'
          )}
          role="listbox"
          aria-label="Suppliers"
        >
          {/* Loading state */}
          {isLoading && (
            <div className="px-3 py-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2" />
              Loading suppliers...
            </div>
          )}

          {/* Error state */}
          {!isLoading && fetchError && (
            <div className="px-3 py-8 text-center">
              <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600 mb-2">
                Failed to load suppliers
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
          {!isLoading && !fetchError && suppliers.length === 0 && (
            <div className="px-3 py-8 text-center text-gray-500">
              <Search className="h-6 w-6 mx-auto mb-2 text-gray-400" />
              No suppliers found
            </div>
          )}

          {/* Supplier list */}
          {!isLoading && !fetchError && suppliers.length > 0 && (
            <>
              {virtualScroll && suppliers.length > 20 ? (
                <VirtualSupplierList
                  suppliers={suppliers}
                  selectedId={value}
                  highlightedIndex={highlightedIndex}
                  onSelect={handleSelect}
                  showCode={showCode}
                  showStatus={showStatus}
                  height={300}
                  itemHeight={showCode ? 60 : 40}
                />
              ) : (
                suppliers.map((supplier: Supplier, index: number) => (
                  <div
                    key={supplier.id}
                    className={cn(
                      'px-3 py-2 cursor-pointer transition-colors',
                      'hover:bg-gray-100',
                      highlightedIndex === index && 'bg-gray-100',
                      value === supplier.id && 'bg-slate-50 text-slate-900'
                    )}
                    onClick={() => handleSelect(supplier)}
                    role="option"
                    aria-selected={value === supplier.id}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{supplier.name}</div>
                        {showCode && (
                          <div className="text-sm text-gray-500">
                            {supplier.code}
                          </div>
                        )}
                      </div>
                      {showStatus && supplier.status === 'inactive' && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}