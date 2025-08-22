import type { UnitOfMeasurement } from '@/types/unit-of-measurement';

export interface UnitOfMeasurementDropdownProps {
  // Core props
  value?: string;
  onChange?: (unitId: string, unit: UnitOfMeasurement) => void;
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
  showAbbreviation?: boolean;
  showDescription?: boolean;
  
  // Data options
  includeInactive?: boolean;
  maxResults?: number;
  
  // Performance options
  debounceMs?: number;
  cacheTime?: number;
  staleTime?: number;
}

export interface UnitOfMeasurementDropdownState {
  isOpen: boolean;
  searchTerm: string;
  highlightedIndex: number;
  isLoading: boolean;
  error: Error | null;
}

export interface UnitOption {
  unit: UnitOfMeasurement;
  isSelected: boolean;
  isHighlighted: boolean;
}

export interface UnitQueryParams {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'abbreviation' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}