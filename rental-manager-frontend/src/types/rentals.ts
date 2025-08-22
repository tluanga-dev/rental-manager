// Rental Management Types
// Based on the comprehensive rental API documentation

// Core Rental Types
export interface Rental {
  id: string;
  transaction_number: string;
  transaction_type: 'RENTAL';
  status: TransactionStatus;
  rental_status: RentalStatus;
  customer: CustomerSummary;
  location: LocationSummary;
  transaction_date: string;
  rental_period: RentalPeriod;
  financial_summary: FinancialSummary;
  delivery_info?: DeliveryInfo;
  notes?: string;
  reference_number?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
  rental_items: RentalItem[];
  rental_agreement?: RentalAgreement;
  insurance?: InsuranceInfo;
}

export interface RentalItem {
  id: string;
  line_number: number;
  item: ItemSummary;
  quantity: number;
  quantity_returned: number;
  quantity_damaged: number;
  rental_rate: RentalRate;
  discount?: Discount;
  line_total: number;
  notes?: string;
  condition_out: ItemCondition;
  condition_notes_out?: string;
  accessories: Accessory[];
  reserved_units: ReservedUnit[];
}

export interface CustomerSummary {
  id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  credit_limit?: number;
  current_balance?: number;
}

export interface LocationSummary {
  id: string;
  name: string;
  code: string;
  address?: string;
}

export interface RentalPeriod {
  start_date: string;
  end_date: string;
  original_end_date?: string;
  total_days: number;
  business_days: number;
  days_elapsed?: number;
  days_remaining?: number;
  is_overdue: boolean;
  extensions: RentalExtension[];
}

export interface FinancialSummary {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  delivery_charge?: number;
  pickup_charge?: number;
  late_fees: number;
  damage_charges: number;
  other_charges: number;
  deposit_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  refundable_deposit?: number;
}

export interface DeliveryInfo {
  delivery_required: boolean;
  delivery_address?: string;
  delivery_contact?: string;
  delivery_phone?: string;
  delivery_date?: string;
  delivery_time?: string;
  delivery_status: DeliveryStatus;
  delivery_completed_at?: string;
  delivery_notes?: string;
}

// Due Today Rentals Types
export interface DueTodayRentalItem {
  id: string;
  item_id: string;
  item_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  rental_period_value: number;
  rental_period_unit: string;
  current_rental_status?: string;
  notes?: string;
}

export interface DueTodayRental {
  id: string;
  transaction_number: string;
  party_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  location_id: string;
  location_name: string;
  rental_start_date: string;
  rental_end_date: string;
  days_overdue: number;
  is_overdue: boolean;
  status: string;
  payment_status: string;
  total_amount: number;
  deposit_amount: number;
  items_count: number;
  items: DueTodayRentalItem[];
  created_at: string;
  updated_at: string;
}

export interface LocationSummaryDueToday {
  location_id: string;
  location_name: string;
  rental_count: number;
  total_value: number;
}

export interface DueTodaySummary {
  total_rentals: number;
  total_value: number;
  overdue_count: number;
  locations: LocationSummaryDueToday[];
  status_breakdown: Record<string, number>;
}

export interface DueTodayFilters {
  search?: string;
  location_id?: string;
  status?: string;
}

export interface DueTodayResponse {
  success: boolean;
  message: string;
  data: DueTodayRental[];
  summary: DueTodaySummary;
  filters_applied: Record<string, any>;
  timestamp: string;
  pickup_required: boolean;
  pickup_date?: string;
  pickup_time?: string;
  pickup_status: DeliveryStatus;
}

export interface ItemSummary {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  brand: string;
}

export interface RentalRate {
  period_type: PeriodType;
  period_value: number;
  unit_rate: number;
  total_periods: number;
  line_subtotal: number;
}

export interface Discount {
  type: DiscountType;
  value: number;
  amount: number;
}

export interface Accessory {
  item_id: string;
  name: string;
  quantity: number;
  returned: number;
}

export interface ReservedUnit {
  unit_code: string;
  serial_number?: string;
  condition: ItemCondition;
  status: UnitStatus;
}

export interface RentalAgreement {
  agreement_number: string;
  template_id: string;
  signed: boolean;
  signed_at?: string;
  signed_by?: string;
  signature_method?: SignatureMethod;
  agreement_url?: string;
  terms_accepted: boolean;
}

export interface InsuranceInfo {
  required: boolean;
  provided: boolean;
  policy_number?: string;
  coverage_amount?: number;
  deductible?: number;
  provider?: string;
}

export interface RentalExtension {
  id: string;
  original_end_date: string;
  new_end_date: string;
  additional_days: number;
  additional_charges: FinancialSummary;
  reason?: string;
  created_at: string;
  created_by: string;
}

// Rental Return Types
export interface RentalReturn {
  id: string;
  return_number: string;
  rental_id: string;
  rental_number: string;
  return_date: string;
  return_status: ReturnStatus;
  on_time_return: boolean;
  items_returned: ReturnedItem[];
  charges_summary: ReturnChargesSummary;
  inventory_updates: InventoryUpdates;
}

export interface ReturnedItem {
  item_id: string;
  item_name: string;
  quantity_rented: number;
  quantity_returned: number;
  condition: ItemCondition;
  damage_details?: DamageDetails;
  cleaning_fee?: number;
}

export interface DamageDetails {
  damaged_count: number;
  damage_charge: number;
  description: string;
}

export interface ReturnChargesSummary {
  rental_charges: number;
  late_fees: number;
  damage_charges: number;
  cleaning_fees: number;
  other_charges: number;
  total_charges: number;
  deposit_amount: number;
  deposit_deductions: number;
  deposit_refund: number;
  balance_due: number;
}

export interface InventoryUpdates {
  items_returned_to_stock: number;
  items_sent_for_repair: number;
  items_written_off: number;
}

// Availability Types
export interface AvailabilityCheck {
  items: AvailabilityCheckItem[];
  location_id?: string;
  check_alternative_locations: boolean;
}

export interface AvailabilityCheckItem {
  item_id: string;
  quantity: number;
  start_date: string;
  end_date: string;
}

export interface AvailabilityResponse {
  check_date: string;
  period: {
    start_date: string;
    end_date: string;
  };
  availability: ItemAvailability[];
  can_fulfill_order: boolean;
  partial_fulfillment_possible: boolean;
}

export interface ItemAvailability {
  item: ItemSummary;
  requested_quantity: number;
  primary_location: LocationAvailability;
  alternative_locations: LocationAvailability[];
  availability_status: AvailabilityStatus;
  total_available_all_locations: number;
  suggestions: AvailabilitySuggestions;
}

export interface LocationAvailability {
  location_id: string;
  location_name: string;
  available: number;
  reserved: number;
  on_rent: number;
  total_stock: number;
  can_fulfill: boolean;
  distance_km?: number;
  transfer_time_hours?: number;
}

export interface AvailabilitySuggestions {
  split_locations: boolean;
  alternative_dates: AlternativeDate[];
  similar_items: SimilarItem[];
}

export interface AlternativeDate {
  start_date: string;
  end_date: string;
  available: number;
}

export interface SimilarItem {
  item_id: string;
  name: string;
  available: number;
  compatibility: string;
}

// Reservation Types
export interface Reservation {
  party_id: string;
  items: ReservationItem[];
  hold_until: string;
  notes?: string;
}

export interface ReservationItem {
  item_id: string;
  quantity: number;
  start_date: string;
  end_date: string;
}

// Report Types
export interface RevenueReport {
  report_period: {
    from: string;
    to: string;
  };
  revenue_summary: RevenueSummary;
  revenue_by_period: RevenueByPeriod[];
  top_revenue_items: TopRevenueItem[];
}

export interface RevenueSummary {
  total_revenue: number;
  rental_income: number;
  late_fees: number;
  damage_charges: number;
  delivery_charges: number;
  other_income: number;
  average_rental_value: number;
  total_rentals: number;
}

export interface RevenueByPeriod {
  date: string;
  revenue: number;
  rentals: number;
}

export interface TopRevenueItem {
  item_id: string;
  item_name: string;
  revenue: number;
  rental_count: number;
  average_rental: number;
}

export interface UtilizationReport {
  report_period: {
    from: string;
    to: string;
    total_days: number;
  };
  utilization_summary: {
    average_utilization_rate: number;
    peak_utilization_date: string;
    lowest_utilization_date: string;
  };
  item_utilization: ItemUtilization[];
}

export interface ItemUtilization {
  item: {
    id: string;
    name: string;
    total_units: number;
  };
  utilization: {
    days_rented: number;
    possible_rental_days: number;
    utilization_rate: number;
    revenue_per_unit: number;
    times_rented: number;
  };
}

export interface OverdueReport {
  report_date: string;
  overdue_summary: {
    total_overdue: number;
    total_overdue_value: number;
    average_days_overdue: number;
    customers_affected: number;
  };
  overdue_rentals: OverdueRental[];
}

export interface OverdueRental {
  rental_id: string;
  rental_number: string;
  customer: CustomerSummary;
  rental_end_date: string;
  days_overdue: number;
  rental_value: number;
  late_fees_accrued: number;
  items_count: number;
  contact_attempts: ContactAttempt[];
}

export interface ContactAttempt {
  date: string;
  method: ContactMethod;
  status: ContactStatus;
}

// Form Types
export interface CreateRentalRequest {
  party_id: string;
  transaction_date: string;
  location_id: string;
  notes?: string;
  reference_number?: string;
  deposit_amount?: number;
  delivery_required?: boolean;
  delivery_address?: string;
  delivery_date?: string;
  delivery_time?: string;
  pickup_required?: boolean;
  pickup_date?: string;
  pickup_time?: string;
  items: CreateRentalItemRequest[];
  payment_method?: PaymentMethod;
  payment_reference?: string;
}

export interface CreateRentalItemRequest {
  item_id: string;
  quantity: number;
  rental_period_type: PeriodType;
  rental_period_value: number;
  rental_start_date: string;
  rental_end_date: string;
  unit_rate: number;
  discount_type?: DiscountType;
  discount_value?: number;
  notes?: string;
  accessories?: AccessoryRequest[];
}

export interface AccessoryRequest {
  item_id: string;
  quantity: number;
  description?: string;
}

export interface CreateReturnRequest {
  return_date: string;
  return_location_id: string;
  received_by: string;
  return_items: CreateReturnItemRequest[];
  late_return: boolean;
  overall_notes?: string;
  final_inspection_complete: boolean;
}

export interface CreateReturnItemRequest {
  item_id: string;
  return_quantity: number;
  condition_on_return: ItemCondition;
  damage_assessment?: DamageAssessmentRequest;
  cleaning_required: boolean;
  cleaning_fee?: number;
  notes?: string;
}

export interface DamageAssessmentRequest {
  has_damage: boolean;
  damage_description?: string;
  damaged_units?: string[];
  damage_charge?: number;
  photos?: string[];
}

export interface ExtendRentalRequest {
  new_end_date: string;
  reason?: string;
  apply_original_rate?: boolean;
  discount_type?: DiscountType;
  discount_value?: number;
}

export interface CalculateChargesRequest {
  party_id: string;
  items: CalculateChargesItemRequest[];
  delivery_required?: boolean;
  pickup_required?: boolean;
  apply_tax?: boolean;
}

export interface CalculateChargesItemRequest {
  item_id: string;
  quantity: number;
  rental_period_type: PeriodType;
  rental_period_value: number;
  rental_start_date: string;
  rental_end_date: string;
  discount_type?: DiscountType;
  discount_value?: number;
}

export interface CalculateChargesResponse {
  calculation_date: string;
  rental_period: {
    start_date: string;
    end_date: string;
    total_days: number;
    billable_days: number;
  };
  item_charges: ItemChargeCalculation[];
  summary: ChargesSummary;
  customer_pricing: CustomerPricing;
}

export interface ItemChargeCalculation {
  item_id: string;
  item_name: string;
  quantity: number;
  rate_per_unit: number;
  periods: number;
  subtotal: number;
  discount: number;
  total: number;
}

export interface ChargesSummary {
  items_subtotal: number;
  total_discount: number;
  taxable_amount: number;
  tax_rate: number;
  tax_amount: number;
  delivery_charge: number;
  pickup_charge: number;
  suggested_deposit: number;
  total_amount: number;
}

export interface CustomerPricing {
  is_vip: boolean;
  has_contract: boolean;
  contract_discount: number;
  loyalty_discount: number;
}

// Enums
export type TransactionStatus = 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type RentalStatus = 
  | 'RESERVED'
  | 'CONFIRMED'
  | 'PICKED_UP'
  | 'ACTIVE'
  | 'OVERDUE'
  | 'LATE'
  | 'EXTENDED'
  | 'PARTIAL_RETURN'
  | 'LATE_PARTIAL_RETURN'
  | 'RETURNED'
  | 'COMPLETED';

export type ItemCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';

export type PeriodType = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type DiscountType = 'PERCENTAGE' | 'FIXED';

export type UnitStatus = 'AVAILABLE' | 'RESERVED' | 'ON_RENT' | 'MAINTENANCE' | 'OUT_OF_ORDER';

export type DeliveryStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export type SignatureMethod = 'ELECTRONIC' | 'PHYSICAL' | 'DIGITAL';

export type ReturnStatus = 'COMPLETED' | 'CANCELLED' | 'PROCESSING' | 'DISPUTED';

export type AvailabilityStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';

export type PaymentMethod = 'CREDIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'CHECK';

export type ContactMethod = 'EMAIL' | 'PHONE' | 'SMS' | 'IN_PERSON';

export type ContactStatus = 'SENT' | 'DELIVERED' | 'OPENED' | 'REPLIED' | 'NO_ANSWER' | 'FAILED';

// Additional enum from API guide
export enum RentalPeriodUnit {
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH'
}

// Enhanced API Guide Types
export interface RentalLifecycle {
  id: string;
  transaction_id: string;
  current_status: RentalStatus;
  last_status_change: string;
  total_returned_quantity: number;
  expected_return_date: string;
  actual_return_date?: string;
  total_late_fees: number;
  total_damage_fees: number;
  total_other_fees: number;
  created_at: string;
  updated_at: string;
}

export interface RentalTransaction {
  // Core transaction fields
  id: string;
  transaction_number: string;
  transaction_date: string;
  party_id: string;
  location_id: string;
  status: TransactionStatus;
  
  // Rental-specific fields
  rental_start_date: string;
  rental_end_date: string;
  rental_period?: number;
  rental_period_unit?: RentalPeriodUnit;
  current_rental_status: RentalStatus;
  
  // Financial fields
  total_amount: number;
  paid_amount: number;
  deposit_amount?: number;
  deposit_paid: boolean;
  customer_advance_balance: number;
  
  // Delivery/Pickup fields
  delivery_required: boolean;
  delivery_address?: string;
  delivery_date?: string;
  delivery_time?: string;
  pickup_required: boolean;
  pickup_date?: string;
  pickup_time?: string;
  
  // Relationships
  lifecycle?: RentalLifecycle;
  
  // Computed properties
  is_overdue?: boolean;
  days_overdue?: number;
  reference_number?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface RentalApiResponse {
  data: RentalTransaction[];
  total?: number;
  page?: number;
  pageSize?: number;
}

// Enhanced Filter Parameters matching API guide
export interface RentalFilterParams {
  // Pagination
  skip?: number;
  limit?: number;
  
  // Filters
  party_id?: string;
  location_id?: string;
  status?: TransactionStatus;
  rental_status?: RentalStatus;
  date_from?: string;
  date_to?: string;
  overdue_only?: boolean;
}

// Legacy filter interface for backward compatibility
export interface RentalFilters {
  skip?: number;
  limit?: number;
  rental_status?: RentalStatus;
  party_id?: string;
  location_id?: string;
  start_date_from?: string;
  start_date_to?: string;
  end_date_from?: string;
  end_date_to?: string;
  overdue_only?: boolean;
  active_only?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface CustomerRentalFilters {
  skip?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
  status?: RentalStatus;
  include_cancelled?: boolean;
}

export interface ReportFilters {
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  date_from?: string;
  date_to?: string;
  group_by?: 'category' | 'customer' | 'location';
  location_id?: string;
  party_id?: string;
}

// Response Types
export interface RentalListResponse {
  items: Rental[];
  total: number;
  page: number;
  size: number;
  pages: number;
  summary?: {
    total_active: number;
    total_overdue: number;
    total_reserved: number;
    total_revenue: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  transaction_id?: string;
  transaction_number?: string;
  data: T;
}

export interface ApiError {
  detail: string;
  error_code?: string;
  errors?: Record<string, string[]>;
}

// UI State Types
export interface RentalFormState {
  loading: boolean;
  submitting: boolean;
  availabilityChecking: boolean;
  errors: Record<string, string>;
  availability?: AvailabilityResponse;
  calculations?: CalculateChargesResponse;
}

export interface RentalListState {
  loading: boolean;
  rentals: Rental[];
  total: number;
  filters: RentalFilters;
  selectedRentals: string[];
}

// Constants
export const ITEM_CONDITIONS: Array<{
  value: ItemCondition;
  label: string;
  description: string;
}> = [
  { value: 'EXCELLENT', label: 'Excellent', description: 'Like new condition' },
  { value: 'GOOD', label: 'Good', description: 'Minor wear, fully functional' },
  { value: 'FAIR', label: 'Fair', description: 'Noticeable wear' },
  { value: 'POOR', label: 'Poor', description: 'Significant wear' },
  { value: 'DAMAGED', label: 'Damaged', description: 'Needs repair' },
];

export const PERIOD_TYPES: Array<{
  value: PeriodType;
  label: string;
  description: string;
}> = [
  { value: 'HOURLY', label: 'Hourly', description: 'Hourly rental periods' },
  { value: 'DAILY', label: 'Daily', description: '24-hour periods' },
  { value: 'WEEKLY', label: 'Weekly', description: '7-day periods' },
  { value: 'MONTHLY', label: 'Monthly', description: 'Calendar months' },
];

export const RENTAL_STATUSES: Array<{
  value: RentalStatus;
  label: string;
  color: string;
  priority: number;
  icon?: string;
}> = [
  { value: 'RESERVED', label: 'Reserved', color: 'blue', priority: 10 },
  { value: 'CONFIRMED', label: 'Confirmed', color: 'green', priority: 20 },
  { value: 'PICKED_UP', label: 'Picked Up', color: 'purple', priority: 30 },
  { value: 'ACTIVE', label: 'Active', color: 'green', priority: 40 },
  { value: 'EXTENDED', label: 'Extended', color: 'blue', priority: 50 },
  { value: 'PARTIAL_RETURN', label: 'Partial Return', color: 'orange', priority: 60 },
  { value: 'OVERDUE', label: 'Overdue', color: 'red', priority: 70 },
  { value: 'LATE', label: 'Late', color: 'red', priority: 80 },
  { value: 'LATE_PARTIAL_RETURN', label: 'Late Partial', color: 'red', priority: 90 },
  { value: 'RETURNED', label: 'Returned', color: 'gray', priority: 100 },
  { value: 'COMPLETED', label: 'Completed', color: 'green', priority: 110 },
];

// Rental Status Business Rules and Helpers
export interface RentalStatusConfig {
  value: RentalStatus;
  label: string;
  color: string;
  priority: number;
  description: string;
}

// Helper functions for rental status logic
export const getRentalStatusConfig = (status: RentalStatus): RentalStatusConfig => {
  const statusInfo = RENTAL_STATUSES.find(s => s.value === status);
  if (!statusInfo) {
    return {
      value: 'ACTIVE',
      label: 'Active',
      color: 'green',
      priority: 40,
      description: 'Unknown status, defaulting to Active'
    };
  }
  
  return {
    ...statusInfo,
    description: getStatusDescription(status)
  };
};

export const getStatusDescription = (status: RentalStatus): string => {
  const descriptions: Record<RentalStatus, string> = {
    'RESERVED': 'Items reserved for customer',
    'CONFIRMED': 'Rental confirmed, awaiting pickup',
    'PICKED_UP': 'Items picked up by customer',
    'ACTIVE': 'Items currently on rent, within timeframe',
    'EXTENDED': 'Rental period has been extended',
    'PARTIAL_RETURN': 'Some items returned, within timeframe',
    'OVERDUE': 'Past return date, no items returned',
    'LATE': 'Past return date, no returns processed',
    'LATE_PARTIAL_RETURN': 'Some items returned, past return date',
    'RETURNED': 'All items returned to inventory',
    'COMPLETED': 'Rental transaction completed'
  };
  
  return descriptions[status] || 'Unknown status';
};

export const getHighestPriorityStatus = (statuses: RentalStatus[]): RentalStatus => {
  if (statuses.length === 0) return 'ACTIVE';
  
  const configs = statuses.map(getRentalStatusConfig);
  const highestPriority = configs.reduce((prev, current) => 
    current.priority > prev.priority ? current : prev
  );
  
  return highestPriority.value;
};

export const isLateStatus = (status: RentalStatus): boolean => {
  return ['LATE', 'LATE_PARTIAL_RETURN', 'OVERDUE'].includes(status);
};

export const isActiveStatus = (status: RentalStatus): boolean => {
  return ['RESERVED', 'CONFIRMED', 'PICKED_UP', 'ACTIVE', 'EXTENDED', 'PARTIAL_RETURN', 'LATE', 'LATE_PARTIAL_RETURN'].includes(status);
};

export const isCompletedStatus = (status: RentalStatus): boolean => {
  return ['RETURNED', 'COMPLETED'].includes(status);
};