'use client';

import React, { useRef, useEffect } from 'react';
import { VariableSizeList as List } from 'react-window';
import { UnitOfMeasurement } from '@/types/unit-of-measurement';
import { cn } from '@/lib/utils';

interface VirtualUnitListProps {
  units: UnitOfMeasurement[];
  selectedId?: string;
  highlightedIndex: number;
  onSelect: (unit: UnitOfMeasurement) => void;
  showAbbreviation?: boolean;
  showDescription?: boolean;
  height: number;
  itemHeight: number;
}

export function VirtualUnitList({
  units,
  selectedId,
  highlightedIndex,
  onSelect,
  showAbbreviation = true,
  showDescription = false,
  height,
  itemHeight,
}: VirtualUnitListProps) {
  const listRef = useRef<List>(null);

  // Scroll to highlighted item
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      listRef.current.scrollToItem(highlightedIndex, 'smart');
    }
  }, [highlightedIndex]);

  const getItemSize = (index: number) => {
    const unit = units[index];
    let size = itemHeight;
    if (showDescription && unit.description) {
      // Add extra height for description
      size += 20;
    }
    return size;
  };

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const unit = units[index];
    const isHighlighted = highlightedIndex === index;
    const isSelected = selectedId === unit.id;

    return (
      <div
        style={style}
        className={cn(
          'px-3 py-2 cursor-pointer transition-colors',
          'hover:bg-gray-100',
          isHighlighted && 'bg-gray-100',
          isSelected && 'bg-slate-50 text-slate-900'
        )}
        onClick={() => onSelect(unit)}
        role="option"
        aria-selected={isSelected}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{unit.name}</span>
              {showAbbreviation && unit.abbreviation && (
                <span className="text-sm text-gray-500">
                  ({unit.abbreviation})
                </span>
              )}
            </div>
            {showDescription && unit.description && (
              <div className="text-sm text-gray-500 truncate">
                {unit.description}
              </div>
            )}
          </div>
          {!unit.is_active && (
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
              Inactive
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <List
      ref={listRef}
      height={height}
      itemCount={units.length}
      itemSize={getItemSize}
      width="100%"
      overscanCount={5}
    >
      {Row}
    </List>
  );
}