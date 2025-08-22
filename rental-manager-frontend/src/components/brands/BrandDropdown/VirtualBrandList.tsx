'use client';

import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Brand } from '@/types/api';
import { cn } from '@/lib/utils';

interface VirtualBrandListProps {
  brands: Brand[];
  selectedId?: string;
  highlightedIndex: number;
  onSelect: (brand: Brand) => void;
  showCode?: boolean;
  showStatus?: boolean;
  height: number;
  itemHeight: number;
}

interface BrandItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    brands: Brand[];
    selectedId?: string;
    highlightedIndex: number;
    onSelect: (brand: Brand) => void;
    showCode?: boolean;
    showStatus?: boolean;
  };
}

const BrandItem: React.FC<BrandItemProps> = ({ index, style, data }) => {
  const { brands, selectedId, highlightedIndex, onSelect, showCode, showStatus } = data;
  const brand = brands[index];

  if (!brand) return null;

  return (
    <div
      style={style}
      className={cn(
        'px-3 py-2 cursor-pointer transition-colors',
        'hover:bg-gray-100',
        highlightedIndex === index && 'bg-gray-100',
        selectedId === brand.id && 'bg-slate-50 text-slate-900'
      )}
      onClick={() => onSelect(brand)}
      role="option"
      aria-selected={selectedId === brand.id}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{brand.name}</div>
          {showCode && brand.code && (
            <div className="text-sm text-gray-500">
              {brand.code}
            </div>
          )}
        </div>
        {showStatus && !brand.is_active && (
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
            Inactive
          </span>
        )}
      </div>
    </div>
  );
};

export const VirtualBrandList: React.FC<VirtualBrandListProps> = ({
  brands,
  selectedId,
  highlightedIndex,
  onSelect,
  showCode = true,
  showStatus = false,
  height,
  itemHeight,
}) => {
  const itemData = useMemo(() => ({
    brands,
    selectedId,
    highlightedIndex,
    onSelect,
    showCode,
    showStatus,
  }), [brands, selectedId, highlightedIndex, onSelect, showCode, showStatus]);

  return (
    <List
      height={height}
      itemCount={brands.length}
      itemSize={itemHeight}
      itemData={itemData}
      className="focus:outline-none"
    >
      {BrandItem}
    </List>
  );
};