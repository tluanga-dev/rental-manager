// Sales types based on sale-transaction-api-documentation-160725.md

export interface SaleTransaction {
  id: string;
  transaction_number: string;
  transaction_type: 'SALE';
  status: SaleTransactionStatus;
  payment_status: SalePaymentStatus;
  customer_id: string;
  customer_name: string;
  transaction_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due?: number;
  notes?: string;
  reference_number?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface SaleTransactionLine {
  id: string;
  transaction_id: string;
  line_number: number;
  line_type: 'PRODUCT';
  item_id: string;
  item_name: string;
  item_sku: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  discount_rate: number;
  discount_amount: number;
  line_subtotal: number;
  line_total: number;
  description?: string;
  notes?: string;
  created_at: string;
}

export interface SaleTransactionWithLines extends SaleTransaction {
  transaction_lines: SaleTransactionLine[];
}

// Saleable Item Types
export interface SaleableItem {
  id: string;
  item_name: string;
  sku: string;
  sale_price: number | null;
  purchase_price: number | null;
  tax_rate: number;
  is_saleable: boolean;
  item_status: string;
  
  // Category and Brand info
  category_id?: string;
  category_name?: string;
  brand_id?: string;
  brand_name?: string;
  
  // Unit of measurement
  unit_of_measurement_id: string;
  unit_name: string;
  unit_abbreviation: string;
  
  // Stock information
  available_quantity: number;
  reserved_quantity: number;
  total_stock: number;
  
  // Additional info
  model_number?: string;
  description?: string;
  specifications?: string;
}

export interface SaleableItemsResponse {
  success: boolean;
  data: SaleableItem[];
  total: number;
  skip: number;
  limit: number;
  message: string;
}

export interface CreateSaleRequest {
  customer_id: string;
  transaction_date: string;
  notes?: string;
  reference_number?: string;
  items: CreateSaleItem[];
}

export interface CreateSaleItem {
  item_id: string;
  quantity: number;
  unit_cost: number;
  tax_rate?: number;
  discount_amount?: number;
  notes?: string;
}

export interface CreateSaleResponse {
  success: boolean;
  message: string;
  transaction_id: string;
  transaction_number: string;
  data: SaleTransactionWithLines;
}

// Form types for components
export interface SaleFormData {
  customer_id: string;
  transaction_date: Date;
  notes: string;
  reference_number: string;
  items: SaleFormItem[];
}

export interface SaleFormItem {
  item_id: string;
  item_name?: string;
  item_sku?: string;
  quantity: number;
  unit_cost: number;
  tax_rate: number;
  discount_amount: number;
  notes: string;
  // Calculated fields
  subtotal?: number;
  tax_amount?: number;
  line_total?: number;
}

// Filter types
export interface SaleFilters {
  skip?: number;
  limit?: number;
  transaction_type?: 'SALE';
  status?: SaleTransactionStatus;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface SaleListResponse {
  items: SaleTransaction[];
  total: number;
  skip: number;
  limit: number;
}

// Enums
export type SaleTransactionStatus = 
  | 'PENDING'
  | 'COMPLETED'
  | 'CANCELLED';

export type SalePaymentStatus = 
  | 'PENDING'
  | 'PAID'
  | 'PARTIAL'
  | 'FAILED'
  | 'REFUNDED';

// Validation types
export interface SaleValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface SaleValidationResult {
  isValid: boolean;
  errors: SaleValidationError[];
  warnings: string[];
}

// Summary types for calculations
export interface SaleSummary {
  subtotal: number;
  total_tax: number;
  total_discount: number;
  grand_total: number;
  item_count: number;
}

// Item selection types
export interface SaleableItem {
  id: string;
  sku: string;
  item_name: string;
  sale_price: number;
  is_saleable: boolean;
  stock_available: number;
  tax_rate?: number;
}

export interface ItemAvailabilityCheck {
  item_id: string;
  requested_quantity: number;
  available_stock: number;
  is_available: boolean;
  insufficient_stock?: boolean;
}

// Statistics types for dashboard
export interface SalesStats {
  today_sales: number;
  monthly_sales: number;
  total_transactions: number;
  average_sale_amount: number;
}

export interface SalesDashboardData {
  stats: SalesStats;
  recent_sales: SaleTransaction[];
  top_selling_items: Array<{
    item_name: string;
    quantity_sold: number;
    revenue: number;
  }>;
}

// Error types
export interface SaleApiError {
  detail: string | Array<{
    type: string;
    loc: string[];
    msg: string;
    input: any;
    url?: string;
  }>;
}

// Print/Export types
export interface SaleReceiptData {
  transaction: SaleTransactionWithLines;
  customer: {
    name: string;
    email?: string;
    phone?: string;
  };
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
}

export const SALE_TRANSACTION_STATUSES = [
  { value: 'PENDING', label: 'Pending', color: 'yellow' },
  { value: 'COMPLETED', label: 'Completed', color: 'green' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'red' }
] as const;

export const SALE_PAYMENT_STATUSES = [
  { value: 'PENDING', label: 'Pending', color: 'yellow' },
  { value: 'PAID', label: 'Paid', color: 'green' },
  { value: 'PARTIAL', label: 'Partial', color: 'blue' },
  { value: 'FAILED', label: 'Failed', color: 'red' },
  { value: 'REFUNDED', label: 'Refunded', color: 'gray' }
] as const;