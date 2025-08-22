'use client';

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Package, MapPin, Tag } from 'lucide-react';
import type { VirtualRentableItemListProps } from './RentableItemDropdown.types';
import type { RentableItem } from '@/types/rentable-item';
import { cn } from '@/lib/utils';

interface VirtualItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    items: RentableItem[];
    selectedId?: string | null;
    highlightedIndex: number;
    onSelect: (item: RentableItem) => void;
    showAvailability?: boolean;
    showPricing?: boolean;
    showLocation?: boolean;
    showCategory?: boolean;
    showBrand?: boolean;
    showSku?: boolean;
  };
}

// Individual item component for virtual list
const VirtualItem = React.memo<VirtualItemProps>(({ index, style, data }) => {
  const {
    items,
    selectedId,
    highlightedIndex,
    onSelect,
    showAvailability,
    showPricing,
    showLocation,
    showCategory,
    showBrand,
    showSku,
  } = data;

  const item = items[index];
  const isSelected = selectedId === item.id;
  const isHighlighted = highlightedIndex === index;

  const handleClick = useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);

  const totalAvailable = item.availability.total_available;
  const primaryLocation = item.availability.locations[0];
  const basePrice = item.rental_pricing.base_price;

  return (
    <div
      style={style}
      className={cn(
        'px-3 py-3 cursor-pointer transition-colors border-b border-gray-100',
        'hover:bg-gray-50',
        isHighlighted && 'bg-slate-50',
        isSelected && 'bg-slate-100 text-slate-900'
      )}
      onClick={handleClick}
      role="option"
      aria-selected={isSelected}
    >
      <div className="flex items-start justify-between gap-3 h-full">
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
          </div>

          {/* Category and Brand */}
          {(showCategory || showBrand) && (
            <div className="flex items-center gap-3 mb-2 text-sm text-gray-600">
              {showCategory && item.category && (
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  <span className="truncate">{item.category.name}</span>
                </div>
              )}
              {showBrand && item.brand && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">•</span>
                  <span className="truncate">{item.brand.name}</span>
                </div>
              )}
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
                <span className={cn(
                  'font-medium',
                  totalAvailable > 0 ? 'text-green-700' : 'text-red-700'
                )}>
                  {totalAvailable} available
                </span>
              </div>

              {showLocation && primaryLocation && (
                <div className="flex items-center gap-1 text-gray-600">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{primaryLocation.location_name}</span>
                  {item.availability.locations.length > 1 && (
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      +{item.availability.locations.length - 1}
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

VirtualItem.displayName = 'VirtualItem';

// Main virtual list component
export const VirtualRentableItemList: React.FC<VirtualRentableItemListProps> = ({
  items,
  selectedId,
  highlightedIndex,
  onSelect,
  showAvailability = true,
  showPricing = true,
  showLocation = true,
  showCategory = true,
  showBrand = true,
  showSku = true,
  height = 300,
  itemHeight = 80,
  className,
}) => {
  const listRef = useRef<List>(null);

  // Scroll to highlighted item
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      listRef.current.scrollToItem(highlightedIndex, 'smart');
    }
  }, [highlightedIndex]);

  // Scroll to selected item when it changes
  useEffect(() => {
    if (selectedId && listRef.current) {
      const selectedIndex = items.findIndex(item => item.id === selectedId);
      if (selectedIndex >= 0) {
        listRef.current.scrollToItem(selectedIndex, 'smart');
      }
    }
  }, [selectedId, items]);

  // Memoize item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    items,
    selectedId,
    highlightedIndex,
    onSelect,
    showAvailability,
    showPricing,
    showLocation,
    showCategory,
    showBrand,
    showSku,
  }), [
    items,
    selectedId,
    highlightedIndex,
    onSelect,
    showAvailability,
    showPricing,
    showLocation,
    showCategory,
    showBrand,
    showSku,
  ]);

  if (items.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-gray-500">
        No items to display
      </div>
    );
  }

  return (
    <div className={cn('border-gray-200', className)}>
      <List
        ref={listRef}
        height={height}
        itemCount={items.length}
        itemSize={itemHeight}
        itemData={itemData}
        width="100%"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#CBD5E0 #F7FAFC',
        }}
      >
        {VirtualItem}
      </List>
    </div>
  );
};

export default VirtualRentableItemList;