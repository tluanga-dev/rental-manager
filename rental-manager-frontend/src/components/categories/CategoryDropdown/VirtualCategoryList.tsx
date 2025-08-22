'use client';

import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { CategoryResponse } from '@/services/api/categories';
import { cn } from '@/lib/utils';

interface VirtualCategoryListProps {
  categories: CategoryResponse[];
  selectedId?: string;
  highlightedIndex: number;
  onSelect: (category: CategoryResponse) => void;
  showPath?: boolean;
  showIcons?: boolean;
  showLevel?: boolean;
  height: number;
  itemHeight: number;
  getCategoryIcon: (category: CategoryResponse) => React.ReactNode;
}

interface CategoryItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    categories: CategoryResponse[];
    selectedId?: string;
    highlightedIndex: number;
    onSelect: (category: CategoryResponse) => void;
    showPath?: boolean;
    showIcons?: boolean;
    showLevel?: boolean;
    getCategoryIcon: (category: CategoryResponse) => React.ReactNode;
  };
}

const CategoryItem: React.FC<CategoryItemProps> = ({ index, style, data }) => {
  const { 
    categories, 
    selectedId, 
    highlightedIndex, 
    onSelect, 
    showPath, 
    showIcons,
    showLevel,
    getCategoryIcon 
  } = data;
  const category = categories[index];

  if (!category) return null;

  const level = category.category_level - 1; // 0-based for indentation
  const paddingLeft = 12 + level * 16; // Base padding + level indent

  return (
    <div
      style={{ ...style, paddingLeft: `${paddingLeft}px` }}
      className={cn(
        'pr-3 py-2 cursor-pointer transition-colors flex items-center gap-2',
        'hover:bg-gray-100',
        highlightedIndex === index && 'bg-gray-100',
        selectedId === category.id && 'bg-slate-50 text-slate-900'
      )}
      onClick={() => onSelect(category)}
      role="option"
      aria-selected={selectedId === category.id}
    >
      {showIcons && getCategoryIcon(category)}
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
  );
};

export const VirtualCategoryList: React.FC<VirtualCategoryListProps> = ({
  categories,
  selectedId,
  highlightedIndex,
  onSelect,
  showPath = true,
  showIcons = true,
  showLevel = false,
  height,
  itemHeight,
  getCategoryIcon,
}) => {
  const itemData = useMemo(() => ({
    categories,
    selectedId,
    highlightedIndex,
    onSelect,
    showPath,
    showIcons,
    showLevel,
    getCategoryIcon,
  }), [categories, selectedId, highlightedIndex, onSelect, showPath, showIcons, showLevel, getCategoryIcon]);

  return (
    <List
      height={height}
      itemCount={categories.length}
      itemSize={itemHeight}
      itemData={itemData}
      className="focus:outline-none"
    >
      {CategoryItem}
    </List>
  );
};