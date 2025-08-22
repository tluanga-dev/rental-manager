import type { CustomerResponse } from '@/services/api/customers';

// Base customer interface for dropdown component
export interface Customer {
  id: string;
  name: string;
  code: string;
  type: 'INDIVIDUAL' | 'BUSINESS';
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  status: 'active' | 'inactive';
  blacklist_status: 'CLEAR' | 'BLACKLISTED';
  credit_limit?: number;
  lifetime_value?: number;
  last_transaction_date?: string | null;
}

// Customer dropdown component props
export interface CustomerDropdownProps {
  // Core props
  value?: string;
  onChange?: (customerId: string, customer: Customer) => void;
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
  showTier?: boolean;
  showCreditInfo?: boolean;
  showLastTransaction?: boolean;
  allowAddNew?: boolean;
  
  // Filter options
  includeInactive?: boolean;
  excludeBlacklisted?: boolean;
  customerType?: 'INDIVIDUAL' | 'BUSINESS' | 'all';
  minTier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  maxResults?: number;
  
  // Recent customers
  showRecentCustomers?: boolean;
  recentCustomersLimit?: number;
  
  // Performance options
  debounceMs?: number;
  cacheTime?: number;
  staleTime?: number;
  
  // Special filtering
  filterByTransactionHistory?: boolean;
  requireCreditCheck?: boolean;
}

// Internal dropdown state
export interface CustomerDropdownState {
  isOpen: boolean;
  searchTerm: string;
  highlightedIndex: number;
  isLoading: boolean;
  error: Error | null;
  recentCustomers: Customer[];
}

// Customer option for display
export interface CustomerOption {
  customer: Customer;
  isSelected: boolean;
  isHighlighted: boolean;
  displayName: string;
  secondaryInfo: string;
  hasWarning: boolean;
  warningMessage?: string;
  tierColor: string;
  icon: string;
}

// Customer query parameters
export interface CustomerQueryParams {
  search?: string;
  customer_type?: 'INDIVIDUAL' | 'BUSINESS' | 'all';
  customer_tier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  blacklist_status?: 'CLEAR' | 'BLACKLISTED' | 'all';
  status?: 'active' | 'inactive' | 'all';
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'code' | 'tier' | 'lifetime_value' | 'last_transaction';
  sortOrder?: 'asc' | 'desc';
}

// Customer selection event
export interface CustomerSelectionEvent {
  customer: Customer;
  source: 'search' | 'recent' | 'browse';
  searchTerm?: string;
}

// Customer creation quick form
export interface QuickCustomerCreate {
  customer_type: 'INDIVIDUAL' | 'BUSINESS';
  business_name?: string;
  first_name?: string;
  last_name?: string;
  customer_code?: string; // Auto-generated if not provided
}

// VirtualCustomerList props
export interface VirtualCustomerListProps {
  customers: Customer[];
  selectedId?: string;
  highlightedIndex: number;
  onSelect: (customer: Customer) => void;
  showCode?: boolean;
  showTier?: boolean;
  showCreditInfo?: boolean;
  showLastTransaction?: boolean;
  excludeBlacklisted?: boolean;
  height?: number;
  itemHeight?: number;
}

// Customer display utilities
export interface CustomerDisplayUtils {
  getDisplayName: (customer: Customer) => string;
  getSecondaryInfo: (customer: Customer) => string;
  getTierColor: (tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM') => string;
  getCustomerIcon: (type: 'INDIVIDUAL' | 'BUSINESS') => string;
  getWarningMessage: (customer: Customer) => string | null;
  formatCreditInfo: (customer: Customer) => string;
  formatLastTransaction: (date: string | null) => string;
}

// Customer tier color mapping
export const CUSTOMER_TIER_COLORS = {
  BRONZE: '#CD7F32',
  SILVER: '#C0C0C0',
  GOLD: '#FFD700',
  PLATINUM: '#E5E4E2',
} as const;

// Customer tier labels
export const CUSTOMER_TIER_LABELS = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
} as const;

// Customer type icons
export const CUSTOMER_TYPE_ICONS = {
  INDIVIDUAL: '👤',
  BUSINESS: '🏢',
} as const;

// Customer status colors
export const CUSTOMER_STATUS_COLORS = {
  active: 'text-green-600',
  inactive: 'text-gray-500',
  blacklisted: 'text-red-600',
} as const;