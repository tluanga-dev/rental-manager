'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Search, Package, AlertCircle } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { salesApi } from '@/services/api/sales';
import { formatCurrencySync } from '@/lib/currency-utils';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { SaleableItem } from '@/types/sales';
import type { SaleableItemDropdownProps } from './SaleableItemDropdown.types';

export function SaleableItemDropdown({
  value,
  onChange,
  placeholder = 'Search and select an item...',
  disabled = false,
  showSku = true,
  showPrice = true,
  showStock = true,
  fullWidth = false,
  className,
  locationId,
  categoryId,
  brandId,
}: SaleableItemDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<SaleableItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SaleableItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch items based on search
  useEffect(() => {
    const fetchItems = async () => {
      if (!debouncedSearchQuery.trim() && !isOpen) return;
      
      setIsLoading(true);
      try {
        const results = await salesApi.searchSaleableItems(
          debouncedSearchQuery,
          50,
          {
            category_id: categoryId,
            brand_id: brandId,
            location_id: locationId,
            in_stock_only: false, // Temporarily set to false to show items without stock
          }
        );
        setItems(results);
      } catch (error) {
        console.error('Error fetching saleable items:', error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [debouncedSearchQuery, categoryId, brandId, locationId, isOpen]);

  // Load selected item details if value changes
  useEffect(() => {
    if (value && (!selectedItem || selectedItem.id !== value)) {
      // Find item in current list or fetch it
      const item = items.find(i => i.id === value);
      if (item) {
        setSelectedItem(item);
      }
    } else if (!value) {
      setSelectedItem(null);
    }
  }, [value, items]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < items.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (items[highlightedIndex]) {
          handleItemSelect(items[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [isOpen, items, highlightedIndex]);

  const handleItemSelect = (item: SaleableItem) => {
    setSelectedItem(item);
    onChange(item.id, item);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(0);
  };

  const getStockStatusBadge = (item: SaleableItem) => {
    if (!showStock) return null;
    
    if (item.available_quantity === 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          Out of Stock
        </Badge>
      );
    } else if (item.available_quantity < 10) {
      return (
        <Badge variant="secondary" className="text-xs">
          Low Stock ({item.available_quantity})
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
          In Stock ({item.available_quantity})
        </Badge>
      );
    }
  };

  return (
    <div 
      ref={dropdownRef}
      className={cn(
        "relative",
        fullWidth ? "w-full" : "w-64",
        className
      )}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm",
          "bg-white border rounded-md shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-slate-500",
          disabled ? "bg-gray-50 cursor-not-allowed opacity-50" : "hover:bg-gray-50 cursor-pointer",
          "transition-colors"
        )}
      >
        <div className="flex items-center gap-2 flex-1 text-left">
          {selectedItem ? (
            <>
              <Package className="h-4 w-4 text-gray-400" />
              <span className="truncate">{selectedItem.item_name}</span>
              {showSku && (
                <span className="text-xs text-gray-500">({selectedItem.sku})</span>
              )}
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-gray-400 transition-transform",
          isOpen && "transform rotate-180"
        )} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-96 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search items..."
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                autoFocus
              />
            </div>
          </div>

          {/* Items List */}
          <div ref={listRef} className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500">
                Loading items...
              </div>
            ) : items.length === 0 ? (
              <div className="p-4 text-center">
                <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No saleable items found</p>
                {searchQuery && (
                  <p className="text-xs text-gray-400 mt-1">
                    Try adjusting your search
                  </p>
                )}
              </div>
            ) : (
              items.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => handleItemSelect(item)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "px-3 py-2 cursor-pointer transition-colors",
                    "hover:bg-gray-50",
                    highlightedIndex === index && "bg-gray-100",
                    item.available_quantity === 0 && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {item.item_name}
                        </span>
                        {showSku && (
                          <span className="text-xs text-gray-500">
                            {item.sku}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        {showPrice && item.sale_price && (
                          <span className="text-xs text-gray-600">
                            {formatCurrencySync(item.sale_price)}
                          </span>
                        )}
                        
                        {item.category_name && (
                          <Badge variant="outline" className="text-xs">
                            {item.category_name}
                          </Badge>
                        )}
                        
                        {item.brand_name && (
                          <Badge variant="outline" className="text-xs">
                            {item.brand_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="ml-2">
                      {getStockStatusBadge(item)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}