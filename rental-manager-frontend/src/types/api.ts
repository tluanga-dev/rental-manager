// Common API response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Re-export transaction types from transactions.ts
export type { 
  TransactionHeader, 
  TransactionLine, 
  TransactionPayment,
  TransactionStatus,
  PaymentStatus,
  PaymentMethod,
  TransactionType 
} from './transactions';

// Transaction request/response types for API endpoints
export interface CreateSaleRequest {
  customer_id: string;
  location_id: string;
  items: SaleLineItem[];
  tax_rate?: number;
  auto_reserve_inventory?: boolean;
  notes?: string;
}

export interface SaleLineItem {
  sku_id: string;
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
}

export interface CreateRentalRequest {
  customer_id: string;
  location_id: string;
  rental_start_date: string;
  rental_end_date: string;
  items: RentalLineItem[];
  deposit_amount?: number;
  auto_reserve_inventory?: boolean;
  notes?: string;
}

export interface RentalLineItem {
  sku_id: string;
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
  rental_days: number;
  deposit_per_unit: number;
}

export interface PaymentRequest {
  payment_amount: number;
  payment_method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CHECK' | 'DIGITAL_WALLET' | 'CRYPTOCURRENCY';
  payment_reference?: string;
  split_payments?: SplitPayment[];
}

export interface SplitPayment {
  payment_method: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'CHECK' | 'DIGITAL_WALLET' | 'CRYPTOCURRENCY';
  amount: number;
  payment_reference?: string;
}

export interface TransactionHistoryParams {
  customer_id?: string;
  location_id?: string;
  transaction_type?: 'SALE' | 'RENTAL' | 'RETURN' | 'REFUND';
  status?: 'DRAFT' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  payment_status?: 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED' | 'FAILED' | 'CANCELLED';
  start_date?: string;
  end_date?: string;
  skip?: number;
  limit?: number;
}

export interface TransactionDailySummary {
  date: string;
  total_sales: number;
  total_rentals: number;
  total_returns: number;
  total_revenue: number;
  transaction_count: number;
}

export interface TransactionRevenueSummary {
  period: string;
  total_revenue: number;
  sales_revenue: number;
  rental_revenue: number;
  fees_revenue: number;
  refunds_amount: number;
  net_revenue: number;
  transaction_count: number;
  average_transaction_value: number;
}

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Customer types based on backend business rules
export interface Customer {
  id: string;
  customer_code?: string;
  customer_type: CustomerType;
  
  // Individual customer fields
  first_name?: string;
  last_name?: string;
  
  // Business customer fields
  business_name?: string;
  tax_id?: string;
  
  // Common fields
  customer_tier: CustomerTier;
  credit_limit: number;
  is_active: boolean;
  blacklist_status: BlacklistStatus;
  created_at: string;
  updated_at: string;
  last_transaction_date?: string;
  lifetime_value: number;
  
  // Relationships
  contact_methods: CustomerContactMethod[];
  addresses: CustomerAddress[];
  contact_persons?: CustomerContactPerson[]; // For business customers
}

export interface CustomerContactMethod {
  id: string;
  customer_id: string;
  contact_type: ContactType;
  contact_value: string;
  contact_label?: string;
  is_primary: boolean;
  is_verified: boolean;
  verified_date?: string;
  opt_in_marketing: boolean;
  is_active: boolean;
  created_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  address_type: AddressType;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  country: string;
  postal_code?: string;
  is_default: boolean;
}

export interface CustomerContactPerson {
  id: string;
  customer_id: string;
  contact_name: string;
  designation?: string;
  department?: string;
  is_primary: boolean;
  is_active: boolean;
  contact_methods: ContactPersonMethod[];
  created_at: string;
}

export interface ContactPersonMethod {
  id: string;
  contact_person_id: string;
  contact_type: ContactType;
  contact_value: string;
  is_primary: boolean;
  is_active: boolean;
}

// Enums based on backend
export type CustomerType = 'INDIVIDUAL' | 'BUSINESS';
export type CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type BlacklistStatus = 'CLEAR' | 'BLACKLISTED';
export type ContactType = 'MOBILE' | 'EMAIL' | 'PHONE' | 'FAX';
export type AddressType = 'BILLING' | 'SHIPPING' | 'BOTH';

// Customer summary for lists
export interface CustomerSummary {
  id: string;
  display_name: string;
  customer_type: CustomerType;
  primary_email?: string;
  primary_phone?: string;
  customer_tier: CustomerTier;
  lifetime_value: number;
  is_active: boolean;
  blacklist_status: BlacklistStatus;
  last_transaction_date?: string;
}

// Item Master types
export interface ItemMaster {
  id: string;
  name: string;
  description?: string;
  brand_id: string;
  category_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Brand types
export interface Brand {
  id: string;
  name: string;
  code?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// Category types
export interface Category {
  id: string;
  category_name: string;
  parent_category_id: string | null;
  display_order: number;
  category_path: string;
  category_level: number;
  is_leaf: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

// SKU types
export interface SKU {
  id: string;
  sku_code: string;
  item_master_id: string;
  rental_price: number;
  sale_price: number;
  deposit_amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Location types
export interface Location {
  id: string;
  name: string;
  address: string;
  location_type: 'STORE' | 'WAREHOUSE';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}