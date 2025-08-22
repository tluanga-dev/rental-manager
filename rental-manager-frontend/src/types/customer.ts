// Re-export customer types from API for consistency
export type { 
  CustomerResponse,
  CustomerCreate,
  CustomerUpdate,
  CustomerListResponse,
  CustomerAnalytics,
  CustomerTransaction,
  CustomerTransactionHistory 
} from '@/services/api/customers';

// Re-export dropdown-specific types
export type {
  Customer,
  CustomerDropdownProps,
  CustomerOption,
  CustomerQueryParams,
  CustomerSelectionEvent,
  QuickCustomerCreate
} from '@/components/customers/CustomerDropdown/CustomerDropdown.types';

// Customer summary for form usage (similar to SupplierSummary)
export interface CustomerSummary {
  id: string;
  customer_code: string;
  display_name: string;
  customer_type: 'INDIVIDUAL' | 'BUSINESS';
  customer_tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  blacklist_status: 'CLEAR' | 'BLACKLISTED';
  is_active: boolean;
  credit_limit: number;
}

// Customer tier information
export interface CustomerTierInfo {
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  color: string;
  label: string;
  benefits: string[];
  creditLimitRange: { min: number; max: number };
  discountPercentage: number;
}

// Customer credit status
export interface CustomerCreditStatus {
  credit_limit: number;
  current_balance: number;
  available_credit: number;
  utilization_percentage: number;
  is_over_limit: boolean;
  days_overdue?: number;
}

// Customer contact information
export interface CustomerContact {
  primary_phone?: string;
  secondary_phone?: string;
  email?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  emergency_contact?: {
    name: string;
    phone: string;
    relationship: string;
  };
}

// Extended customer profile
export interface CustomerProfile extends CustomerSummary {
  business_name?: string;
  first_name?: string;
  last_name?: string;
  tax_id?: string;
  contact_info: CustomerContact;
  lifetime_value: number;
  total_transactions: number;
  last_transaction_date: string | null;
  registration_date: string;
  credit_status: CustomerCreditStatus;
  notes?: string;
  tags: string[];
}