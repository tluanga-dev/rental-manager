import type { Item } from '@/types/item';

export interface ItemDropdownProps {
  // Core props
  value?: string;
  onChange?: (itemId: string, item?: Item) => void;
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
  showSku?: boolean;
  showPrice?: boolean;
  showStock?: boolean;
  showCategory?: boolean;
  
  // Data options
  categoryId?: string;
  brandId?: string;
  availableOnly?: boolean;
  includeInactive?: boolean;
  maxResults?: number;
  
  // Performance options
  debounceMs?: number;
  cacheTime?: number;
  staleTime?: number;
}

export interface ItemDropdownState {
  isOpen: boolean;
  searchTerm: string;
  highlightedIndex: number;
  isLoading: boolean;
  error: Error | null;
}

export interface ItemOption {
  item: Item;
  isSelected: boolean;
  isHighlighted: boolean;
}

export interface ItemQueryParams {
  search?: string;
  category_id?: string;
  brand_id?: string;
  is_active?: boolean;
  available_only?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'item_name' | 'sku' | 'rental_price_daily' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}