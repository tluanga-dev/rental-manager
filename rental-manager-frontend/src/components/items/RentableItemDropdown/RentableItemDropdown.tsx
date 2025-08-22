'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { ChevronDown, X, Search, AlertCircle, Package, MapPin, Tag, Ban } from 'lucide-react';
import { useRentableItemSearch } from '@/hooks/use-rentable-items';
import { useClickOutside } from '@/hooks/use-click-outside';
import { VirtualRentableItemList } from './VirtualRentableItemList';
import type { 
  RentableItemDropdownProps, 
  RentableItemDropdownRef,
  RentableItemListItemProps 
} from './RentableItemDropdown.types';
import type { RentableItem } from '@/types/rentable-item';
import { cn } from '@/lib/utils';

// Individual item component for the dropdown list
const RentableItemListItem = React.memo<RentableItemListItemProps>(({
  item,
  isSelected,
  isHighlighted,
  onSelect,
  showAvailability = true,
  showPricing = true,
  showLocation = true,
  showCategory = true,
  showBrand = true,
  showSku = true,
  className,
}) => {
  const handleClick = useCallback(() => {
    // Prevent selection if item is rental blocked
    if (item.is_rental_blocked) {
      return;
    }
    onSelect(item);
  }, [item, onSelect]);

  const totalAvailable = item.availability.total_available;
  const primaryLocation = item.availability.locations[0];
  const basePrice = item.rental_pricing.base_price;

  const isBlocked = item.is_rental_blocked;

  return (
    <div
      className={cn(
        'px-3 py-3 transition-colors border-b border-gray-100 last:border-b-0',
        isBlocked ? 'cursor-not-allowed opacity-60 bg-red-50' : 'cursor-pointer hover:bg-gray-50',
        isHighlighted && !isBlocked && 'bg-slate-50',
        isSelected && 'bg-slate-100 text-slate-900',
        className
      )}
      onClick={handleClick}
      role="option"
      aria-selected={isSelected}
      aria-disabled={isBlocked}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Item name and SKU */}
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <div className="font-medium text-gray-900 truncate">{item.item_name}</div>
            {showSku && (
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                {item.sku}
              </span>
            )}
            {isBlocked && (
              <div className="flex items-center gap-1 text-xs text-red-600 bg-red-100 px-2 py-1 rounded flex-shrink-0">
                <Ban className="h-3 w-3" />
                <span>Blocked</span>
              </div>
            )}
          </div>

          {/* Category and Brand */}
          {(showCategory || showBrand) && (
            <div className="flex items-center gap-3 mb-2 text-sm text-gray-600">
              {showCategory && item.category && (
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  <span>{item.category.name}</span>
                </div>
              )}
              {showBrand && item.brand && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">•</span>
                  <span>{item.brand.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Rental blocking message */}
          {isBlocked && item.rental_block_reason && (
            <div className="text-xs text-red-600 mb-2 bg-red-50 border border-red-200 rounded px-2 py-1">
              <strong>Blocked:</strong> {item.rental_block_reason}
            </div>
          )}

          {/* Availability and Location */}
          {showAvailability && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  totalAvailable > 0 ? 'bg-green-500' : 'bg-red-500'
                )}>
                </div>
                <span className={totalAvailable > 0 ? 'text-green-700' : 'text-red-700'}>
                  {totalAvailable} available
                </span>
              </div>

              {showLocation && primaryLocation && (
                <div className="flex items-center gap-1 text-gray-600">
                  <MapPin className="h-3 w-3" />
                  <span>{primaryLocation.location_name}</span>
                  {item.availability.locations.length > 1 && (
                    <span className="text-xs text-gray-500">
                      +{item.availability.locations.length - 1} more
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pricing */}
        {showPricing && basePrice && (
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
              <Package className="h-3 w-3" />
              <span>${basePrice.toFixed(2)}</span>
            </div>
            <div className="text-xs text-gray-500">
              /{item.rental_pricing.rental_period || 'day'}
            </div>
            {item.rental_pricing.min_rental_days > 1 && (
              <div className="text-xs text-gray-500">
                min {item.rental_pricing.min_rental_days}d
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

RentableItemListItem.displayName = 'RentableItemListItem';

// Main dropdown component
export const RentableItemDropdown = forwardRef<RentableItemDropdownRef, RentableItemDropdownProps>(({
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder = 'Search for rentable items...',
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
  maxResults = 50,
  debounceMs = 300,
  showAvailability = true,
  showPricing = true,
  showLocation = true,
  showCategory = true,
  showBrand = true,
  showSku = true,
  locationId,
  categoryId,
  minAvailableQuantity = 1,
  cacheTime,
  staleTime,
  onError,
  onSearchStart,
  onSearchEnd,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Use the rentable items search hook
  const {
    items,
    isLoading,
    error: fetchError,
    searchTerm,
    setSearchTerm,
    totalCount,
    hasMore,
    loadMore,
    updateParams,
  } = useRentableItemSearch({
    location_id: locationId,
    category_id: categoryId,
    limit: maxResults,
  });

  // Filter items by minimum available quantity
  const filteredItems = useMemo(() => {
    return (items || []).filter(item => item.availability?.total_available >= minAvailableQuantity);
  }, [items, minAvailableQuantity]);

  // Find selected item
  const selectedItem = useMemo(() => {
    if (!value) return null;
    return filteredItems.find(item => item.id === value) || null;
  }, [value, filteredItems]);

  // Display value in input
  const inputValue = useMemo(() => {
    if (searchTerm) return searchTerm;
    if (selectedItem) return selectedItem.item_name;
    return '';
  }, [searchTerm, selectedItem]);

  // Handle click outside
  useClickOutside(dropdownRef, () => {
    if (isOpen) {
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (!selectedItem) {
        setSearchTerm('');
      }
    }
  });

  // Handle item selection
  const handleSelect = useCallback((item: RentableItem) => {
    onChange?.(item.id, item);
    setIsOpen(false);
    setHighlightedIndex(-1);
    setSearchTerm('');
    inputRef.current?.blur();
  }, [onChange, setSearchTerm]);

  // Handle clear
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(null, null);
    setSearchTerm('');
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }, [onChange, setSearchTerm]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onSearchStart?.();
    setSearchTerm(value);
    if (!isOpen) {
      setIsOpen(true);
    }
    setHighlightedIndex(-1);
  }, [setSearchTerm, isOpen, onSearchStart]);

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
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredItems[highlightedIndex]) {
          handleSelect(filteredItems[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (!selectedItem) {
          setSearchTerm('');
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, filteredItems, highlightedIndex, handleSelect, selectedItem, setSearchTerm]);

  // Track search results
  useEffect(() => {
    if (!isLoading && searchTerm) {
      onSearchEnd?.(filteredItems);
    }
  }, [filteredItems, isLoading, searchTerm, onSearchEnd]);

  // Track errors
  useEffect(() => {
    if (fetchError) {
      onError?.(fetchError.message);
    }
  }, [fetchError, onError]);

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

  // Imperative ref methods
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    clear: () => {
      onChange?.(null, null);
      setSearchTerm('');
      setHighlightedIndex(-1);
    },
    openDropdown: () => setIsOpen(true),
    closeDropdown: () => setIsOpen(false),
    getSearchTerm: () => searchTerm,
    setSearchTerm: (term: string) => setSearchTerm(term),
  }), [onChange, searchTerm, setSearchTerm]);

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
        fullWidth ? 'w-full' : 'w-[350px]',
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
          aria-controls="rentable-item-dropdown-list"
          aria-invalid={hasError}
          aria-describedby={helperText ? 'rentable-item-dropdown-helper' : undefined}
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
          id="rentable-item-dropdown-helper"
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
          id="rentable-item-dropdown-list"
          ref={listRef}
          className={cn(
            'absolute z-50 mt-1 w-full rounded-md border border-gray-200',
            'bg-white shadow-lg max-h-80 overflow-auto',
            'focus:outline-none'
          )}
          role="listbox"
          aria-label="Rentable Items"
        >
          {/* Loading state */}
          {isLoading && filteredItems.length === 0 && (
            <div className="px-3 py-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2" />
              Loading rentable items...
            </div>
          )}

          {/* Error state */}
          {!isLoading && fetchError && (
            <div className="px-3 py-8 text-center">
              <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-600 mb-2">
                Failed to load rentable items
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-sm text-slate-600 hover:text-slate-800 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* No results */}
          {!isLoading && !fetchError && filteredItems.length === 0 && (
            <div className="px-3 py-8 text-center text-gray-500">
              <Search className="h-6 w-6 mx-auto mb-2 text-gray-400" />
              {searchTerm ? 'No items found matching your search' : 'No rentable items available'}
            </div>
          )}

          {/* Item list */}
          {!isLoading && !fetchError && filteredItems.length > 0 && (
            <>
              {virtualScroll && filteredItems.length > 10 ? (
                <VirtualRentableItemList
                  items={filteredItems}
                  selectedId={value}
                  highlightedIndex={highlightedIndex}
                  onSelect={handleSelect}
                  showAvailability={showAvailability}
                  showPricing={showPricing}
                  showLocation={showLocation}
                  showCategory={showCategory}
                  showBrand={showBrand}
                  showSku={showSku}
                  height={320}
                  itemHeight={80}
                />
              ) : (
                filteredItems.map((item, index) => (
                  <RentableItemListItem
                    key={item.id}
                    item={item}
                    isSelected={value === item.id}
                    isHighlighted={highlightedIndex === index}
                    onSelect={handleSelect}
                    showAvailability={showAvailability}
                    showPricing={showPricing}
                    showLocation={showLocation}
                    showCategory={showCategory}
                    showBrand={showBrand}
                    showSku={showSku}
                  />
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

RentableItemDropdown.displayName = 'RentableItemDropdown';