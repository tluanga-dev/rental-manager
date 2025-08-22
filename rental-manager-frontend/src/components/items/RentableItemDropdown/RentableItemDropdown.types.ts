import type { RentableItem } from '@/types/rentable-item';

export interface RentableItemDropdownProps {
  // Core functionality
  value?: string | null;
  onChange?: (itemId: string | null, item: RentableItem | null) => void;
  onBlur?: () => void;
  onFocus?: () => void;

  // Appearance
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  className?: string;

  // Form attributes
  name?: string;
  id?: string;
  required?: boolean;

  // Search and selection
  searchable?: boolean;
  clearable?: boolean;
  virtualScroll?: boolean;
  maxResults?: number;
  debounceMs?: number;

  // Display options
  showAvailability?: boolean;
  showPricing?: boolean;
  showLocation?: boolean;
  showCategory?: boolean;
  showBrand?: boolean;
  showSku?: boolean;

  // Filtering
  locationId?: string;
  categoryId?: string;
  minAvailableQuantity?: number;

  // Performance
  cacheTime?: number;
  staleTime?: number;

  // Events
  onError?: (error: string) => void;
  onSearchStart?: () => void;
  onSearchEnd?: (results: RentableItem[]) => void;
}

export interface RentableItemListItemProps {
  item: RentableItem;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: (item: RentableItem) => void;
  showAvailability?: boolean;
  showPricing?: boolean;
  showLocation?: boolean;
  showCategory?: boolean;
  showBrand?: boolean;
  showSku?: boolean;
  className?: string;
}

export interface VirtualRentableItemListProps {
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
  height?: number;
  itemHeight?: number;
  className?: string;
}

export interface RentableItemSearchState {
  searchTerm: string;
  isOpen: boolean;
  highlightedIndex: number;
  isLoading: boolean;
  error: string | null;
  lastSearchTime: number;
}

export interface RentableItemDropdownRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  openDropdown: () => void;
  closeDropdown: () => void;
  getSearchTerm: () => string;
  setSearchTerm: (term: string) => void;
}

// Performance tracking types
export interface RentableItemPerformanceMetrics {
  renderCount: number;
  averageRenderTime: number;
  searchCount: number;
  averageSearchTime: number;
  selectionCount: number;
  averageSelectionTime: number;
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface RentableItemDropdownConfig {
  defaultDebounceMs: number;
  defaultMaxResults: number;
  defaultCacheTime: number;
  defaultStaleTime: number;
  virtualScrollThreshold: number;
  defaultItemHeight: number;
  defaultDropdownHeight: number;
}

// Event handler types
export type RentableItemChangeHandler = (itemId: string | null, item: RentableItem | null) => void;
export type RentableItemSelectHandler = (item: RentableItem) => void;
export type RentableItemErrorHandler = (error: string) => void;
export type RentableItemSearchHandler = (term: string) => void;