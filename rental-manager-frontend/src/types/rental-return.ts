// TypeScript interfaces for Rental Return System

export interface RentalItem {
  id: string;
  line_number: number;
  item_id: string;
  item_name: string;
  sku: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  discount_amount: number;
  rental_period: number;
  rental_period_unit: string;
  rental_start_date: string;
  rental_end_date: string;
  current_rental_status: RentalStatus;
  notes: string;
}

export interface RentalDetails {
  id: string;
  transaction_number: string;
  transaction_type: string;
  transaction_date: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_type: string;
  location_id: string;
  location_name: string;
  payment_method: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  deposit_amount: number;
  discount_amount: number;
  status: string;
  rental_status: RentalStatus;
  payment_status: string | null;
  rental_start_date: string;
  rental_end_date: string;
  delivery_required: boolean;
  pickup_required: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: RentalItem[];
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    customer_type: string;
  };
  location: {
    id: string;
    name: string;
  };
  financial_summary: {
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    deposit_amount: number;
  };
  rental_period: {
    start_date: string;
    end_date: string;
    duration_days: number;
  };
}

export interface ReturnableRental extends RentalDetails {
  returnable_items: RentalItem[];
  return_metadata: {
    can_return: boolean;
    return_date: string;
    is_overdue: boolean;
  };
}

export type RentalStatus = 
  | 'RENTAL_INPROGRESS'
  | 'RENTAL_COMPLETED' 
  | 'RENTAL_LATE'
  | 'RENTAL_EXTENDED'
  | 'RENTAL_PARTIAL_RETURN'
  | 'RENTAL_LATE_PARTIAL_RETURN';

export type ReturnAction = 
  | 'COMPLETE_RETURN'
  | 'PARTIAL_RETURN'
  | 'MARK_LATE'
  | 'MARK_DAMAGED';

export interface ItemReturnRequest {
  line_id: string;
  item_id: string;
  return_quantity: number;
  return_date: string;
  return_action: ReturnAction;
  condition_notes?: string;
  damage_notes?: string;
  damage_penalty?: number;
}

export interface RentalReturnRequest {
  rental_id: string;
  return_date: string;
  items: ItemReturnRequest[];
  notes?: string;
  processed_by?: string;
}

export interface ItemReturnResponse {
  line_id: string;
  item_name: string;
  sku: string;
  original_quantity: string;
  returned_quantity: string;
  remaining_quantity: string;
  return_date: string;
  new_status: string;
  condition_notes?: string;
}

export interface FinancialImpact {
  deposit_amount: number;
  late_fees: number;
  damage_penalties?: number; // Optional since backend doesn't always include it
  total_charges?: number;    // Optional since backend doesn't always include it
  days_late: number;
  total_refund: number;
  charges_applied: boolean;
}

export interface RentalReturnResponse {
  success: boolean;
  message: string;
  rental_id: string;
  transaction_number: string;
  return_date: string;
  items_returned: ItemReturnResponse[];
  rental_status: string;
  financial_impact: FinancialImpact;
  timestamp: string;
}

export interface ReturnItemState {
  item: RentalItem;
  selected: boolean;
  return_quantity: number;
  return_action: ReturnAction;
  condition_notes: string;
  damage_notes: string;
  damage_penalty: number;
}