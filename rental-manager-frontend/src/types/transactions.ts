// Transaction-related types
export interface TransactionHeader {
  id: string;
  transaction_number: string;
  transaction_type: TransactionType;
  customer_id: string;
  location_id: string;
  staff_id: string;
  transaction_date: string;
  due_date?: string; // For rentals
  status: TransactionStatus;
  subtotal_amount: number;
  tax_amount: number;
  discount_amount: number;
  deposit_amount: number;
  total_amount: number;
  payment_status: PaymentStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionLine {
  id: string;
  transaction_id: string;
  sku_id: string;
  inventory_unit_id?: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  line_total: number;
  rental_start_date?: string;
  rental_end_date?: string;
  rental_days?: number;
  deposit_per_unit: number;
  line_deposit_total: number;
  notes?: string;
}

export interface TransactionPayment {
  id: string;
  transaction_id: string;
  payment_method: PaymentMethod;
  payment_reference?: string;
  amount: number;
  payment_date: string;
  status: PaymentStatus;
  processed_by: string;
  notes?: string;
}

export interface RentalAgreement {
  id: string;
  transaction_id: string;
  customer_id: string;
  agreement_date: string;
  terms_accepted: boolean;
  digital_signature?: string;
  witness_signature?: string;
  agreement_document_url?: string;
  created_at: string;
}

export interface PreRentalInspection {
  id: string;
  transaction_line_id: string;
  inventory_unit_id: string;
  inspector_id: string;
  inspection_date: string;
  condition_before: ConditionGrade;
  photos: InspectionPhoto[];
  checklist_items: ChecklistItem[];
  notes?: string;
  customer_acknowledged: boolean;
  customer_signature?: string;
}

export interface InspectionPhoto {
  id: string;
  photo_url: string;
  photo_type: PhotoType;
  description?: string;
  uploaded_at: string;
}

export interface ChecklistItem {
  id: string;
  item_name: string;
  item_type: ChecklistItemType;
  status: ChecklistStatus;
  notes?: string;
}

// Enums
export type TransactionType = 'SALE' | 'RENTAL' | 'RETURN' | 'REFUND';

export type TransactionStatus = 
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus = 
  | 'PENDING'
  | 'PAID'
  | 'PARTIAL'
  | 'FAILED'
  | 'REFUNDED';

export type PaymentMethod = 
  | 'CASH'
  | 'CARD'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'CREDIT'
  | 'CHEQUE';

export type ConditionGrade = 'A' | 'B' | 'C' | 'D';

export type PhotoType = 
  | 'OVERALL'
  | 'SERIAL_NUMBER'
  | 'DAMAGE'
  | 'ACCESSORIES'
  | 'PACKAGING';

export type ChecklistItemType = 
  | 'FUNCTIONALITY'
  | 'APPEARANCE'
  | 'ACCESSORIES'
  | 'DOCUMENTATION'
  | 'SAFETY';

export type ChecklistStatus = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';

// Cart and wizard types
export interface CartItem {
  sku_id: string;
  quantity: number;
  unit_price: number;
  original_price?: number;  // Store the original item price
  custom_price?: number;    // Store user-modified price
  price_override_reason?: string; // Optional reason for price change
  rental_days?: number;
  rental_start_date?: string;
  rental_end_date?: string;
  deposit_per_unit: number;
  discount_percentage: number;
  notes?: string;
}

export interface TransactionWizardData {
  transaction_type: TransactionType;
  customer_id?: string;
  location_id: string;
  cart_items: CartItem[];
  discount_amount: number;
  payment_method?: PaymentMethod;
  payment_reference?: string;
  notes?: string;
  rental_agreement_accepted?: boolean;
  digital_signature?: string;
}

export interface PricingBreakdown {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  deposit_total: number;
  total_amount: number;
  payment_due: number;
}

export interface AvailabilityCheck {
  sku_id: string;
  location_id: string;
  start_date: string;
  end_date: string;
  quantity_requested: number;
  quantity_available: number;
  is_available: boolean;
  conflicts?: string[];
}

// Form data types
export interface ProductSelectorData {
  sku_id: string;
  quantity: number;
  rental_days?: number;
  rental_start_date?: string;
  rental_end_date?: string;
}

export interface CustomerSelectorData {
  customer_id: string;
  customer_type: 'existing' | 'new' | 'walk_in';
  customer_data?: any; // For new customer creation
}

export interface PaymentFormData {
  payment_method: PaymentMethod;
  amount: number;
  payment_reference?: string;
  split_payments?: SplitPayment[];
}

export interface SplitPayment {
  payment_method: PaymentMethod;
  amount: number;
  payment_reference?: string;
}

// Pricing and discount types
export interface DiscountRule {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  minimum_amount?: number;
  customer_tiers?: string[];
  applicable_categories?: string[];
  start_date?: string;
  end_date?: string;
  is_active: boolean;
}

export type DiscountType = 
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'BUY_X_GET_Y'
  | 'BULK_DISCOUNT'
  | 'LOYALTY_DISCOUNT';

export interface TierPricing {
  min_days: number;
  max_days?: number;
  discount_percentage: number;
  price_per_day: number;
}

// Transaction summary types
export interface TransactionSummary {
  transaction_header: TransactionHeader;
  transaction_lines: TransactionLine[];
  customer: any; // Customer type from api.ts
  payment_details: TransactionPayment[];
  rental_agreement?: RentalAgreement;
  inspection_reports?: PreRentalInspection[];
}