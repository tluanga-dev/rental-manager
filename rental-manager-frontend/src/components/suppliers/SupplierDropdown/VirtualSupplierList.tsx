'use client';

import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import type { Supplier } from '@/types/supplier';
import { cn } from '@/lib/utils';

interface VirtualSupplierListProps {
  suppliers: Supplier[];
  selectedId?: string;
  highlightedIndex: number;
  onSelect: (supplier: Supplier) => void;
  showCode?: boolean;
  showStatus?: boolean;
  height?: number;
  itemHeight?: number;
}

interface SupplierItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    suppliers: Supplier[];
    selectedId?: string;
    highlightedIndex: number;
    onSelect: (supplier: Supplier) => void;
    showCode?: boolean;
    showStatus?: boolean;
  };
}

const SupplierItem: React.FC<SupplierItemProps> = ({ index, style, data }) => {
  const {
    suppliers,
    selectedId,
    highlightedIndex,
    onSelect,
    showCode = true,
    showStatus = false,
  } = data;

  const supplier = suppliers[index];
  const isSelected = selectedId === supplier.id;
  const isHighlighted = highlightedIndex === index;

  return (
    <div
      style={style}
      className={cn(
        'px-3 py-2 cursor-pointer transition-colors border-b border-gray-50 last:border-b-0',
        'hover:bg-gray-100',
        isHighlighted && 'bg-gray-100',
        isSelected && 'bg-slate-50 text-slate-900'
      )}
      onClick={() => onSelect(supplier)}
      role="option"
      aria-selected={isSelected}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{supplier.name}</div>
          {showCode && (
            <div className="text-sm text-gray-500 truncate">
              {supplier.code}
            </div>
          )}
        </div>
        {showStatus && supplier.status === 'inactive' && (
          <span className="ml-2 text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded flex-shrink-0">
            Inactive
          </span>
        )}
      </div>
    </div>
  );
};

export function VirtualSupplierList({
  suppliers,
  selectedId,
  highlightedIndex,
  onSelect,
  showCode = true,
  showStatus = false,
  height = 300,
  itemHeight = 60,
}: VirtualSupplierListProps) {
  const itemData = useMemo(() => ({
    suppliers,
    selectedId,
    highlightedIndex,
    onSelect,
    showCode,
    showStatus,
  }), [suppliers, selectedId, highlightedIndex, onSelect, showCode, showStatus]);

  // Calculate the actual height based on available items
  const actualHeight = Math.min(height, suppliers.length * itemHeight);

  return (
    <List
      height={actualHeight}
      itemCount={suppliers.length}
      itemSize={itemHeight}
      itemData={itemData}
      width="100%"
      className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
    >
      {SupplierItem}
    </List>
  );
}