import React from 'react';
import { FixedSizeList as List } from 'react-window';
import { ItemMasterDropdownOption, ItemType } from '@/types/item-master';
import { cn } from '@/lib/utils';

interface VirtualItemListProps {
  items: ItemMasterDropdownOption[];
  selectedId?: string;
  highlightedIndex: number;
  onSelect: (item: ItemMasterDropdownOption) => void;
  height: number;
  itemHeight?: number;
  showCode?: boolean;
  showType?: boolean;
  showSerialized?: boolean;
}

const ItemTypeColors: Record<ItemType, string> = {
  [ItemType.PRODUCT]: 'bg-slate-100 text-slate-800',
  [ItemType.SERVICE]: 'bg-green-100 text-green-800',
  [ItemType.BUNDLE]: 'bg-purple-100 text-purple-800',
};

interface ItemRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    items: ItemMasterDropdownOption[];
    selectedId?: string;
    highlightedIndex: number;
    onSelect: (item: ItemMasterDropdownOption) => void;
    showCode?: boolean;
    showType?: boolean;
    showSerialized?: boolean;
  };
}

function ItemRow({ index, style, data }: ItemRowProps) {
  const { items, selectedId, highlightedIndex, onSelect, showCode, showType, showSerialized } = data;
  const item = items[index];
  const isSelected = item.id === selectedId;
  const isHighlighted = index === highlightedIndex;

  return (
    <div
      style={style}
      className={cn(
        'px-3 py-2 cursor-pointer transition-colors',
        isSelected && 'bg-slate-50',
        isHighlighted && 'bg-gray-100',
        !isSelected && !isHighlighted && 'hover:bg-gray-50'
      )}
      onClick={() => onSelect(item)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {showCode && (
              <span className="text-xs text-gray-500 font-mono">{item.item_code}</span>
            )}
            <span className="text-sm font-medium text-gray-900 truncate">{item.item_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {showType && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              ItemTypeColors[item.item_type]
            )}>
              {item.item_type}
            </span>
          )}
          {showSerialized && item.is_serialized && (
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
              Serialized
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function VirtualItemList({
  items,
  selectedId,
  highlightedIndex,
  onSelect,
  height,
  itemHeight = 48,
  showCode = true,
  showType = true,
  showSerialized = false,
}: VirtualItemListProps) {
  const itemData = {
    items,
    selectedId,
    highlightedIndex,
    onSelect,
    showCode,
    showType,
    showSerialized,
  };

  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      width="100%"
      itemData={itemData}
    >
      {ItemRow}
    </List>
  );
}