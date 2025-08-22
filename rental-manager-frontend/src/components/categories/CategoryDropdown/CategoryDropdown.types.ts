import type { CategoryResponse } from '@/services/api/categories';

export interface CategoryDropdownProps {
  // Core props
  value?: string;
  onChange?: (categoryId: string, category: CategoryResponse) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  
  // UI props
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  className?: string;
  name?: string;
  id?: string;
  required?: boolean;
  
  // Feature flags
  searchable?: boolean;
  clearable?: boolean;
  virtualScroll?: boolean;
  showPath?: boolean;
  showTree?: boolean;
  expandable?: boolean;
  showIcons?: boolean;
  showLevel?: boolean;
  
  // Data options
  onlyLeaf?: boolean;
  includeInactive?: boolean;
  maxResults?: number;
  parentId?: string;
  
  // Performance options
  debounceMs?: number;
  cacheTime?: number;
  staleTime?: number;
}

export interface CategoryDropdownState {
  isOpen: boolean;
  searchTerm: string;
  highlightedIndex: number;
  expandedNodes: Set<string>;
  isLoading: boolean;
  error: Error | null;
}

export interface CategoryOption {
  category: CategoryResponse;
  isSelected: boolean;
  isHighlighted: boolean;
  isExpanded?: boolean;
  isSelectable: boolean;
}

export interface CategoryTreeNode extends CategoryResponse {
  children?: CategoryTreeNode[];
}