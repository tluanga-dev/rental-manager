import type { Supplier } from '@/types/supplier';

export interface SupplierDropdownProps {
  // Core props
  value?: string;
  onChange?: (supplierId: string, supplier: Supplier) => void;
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
  showCode?: boolean;
  showStatus?: boolean;
  
  // Data options
  includeInactive?: boolean;
  maxResults?: number;
  
  // Performance options
  debounceMs?: number;
  cacheTime?: number;
  staleTime?: number;
}

export interface SupplierDropdownState {
  isOpen: boolean;
  searchTerm: string;
  highlightedIndex: number;
  isLoading: boolean;
  error: Error | null;
}

export interface SupplierOption {
  supplier: Supplier;
  isSelected: boolean;
  isHighlighted: boolean;
}

export interface SupplierQueryParams {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'code' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}