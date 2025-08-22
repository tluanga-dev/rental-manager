/**
 * TypeScript types for multi-item booking system
 */

export enum MultiBookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  CONVERTED = 'CONVERTED'
}

export interface BookingItem {
  item_id: string;
  quantity: number;
  rental_period: number;
  rental_period_unit: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  unit_rate: number;
  discount_amount?: number;
  notes?: string;
}

export interface BookingItemResponse {
  id: string;
  line_number: number;
  item_id: string;
  quantity_reserved: number;
  rental_period: number;
  rental_period_unit: string;
  unit_rate: number;
  discount_amount?: number;
  line_total?: number;
  notes?: string;
  item?: {
    id: string;
    item_name: string;
    sku?: string;
    rental_rate?: number;
  };
}

export interface MultiBookingCreateRequest {
  customer_id: string;
  location_id: string;
  booking_date: string;
  start_date: string;
  end_date: string;
  items: BookingItem[];
  deposit_paid?: boolean;
  payment_method?: string;
  notes?: string;
}

export interface MultiBookingHeader {
  id: string;
  booking_reference: string;
  customer_id: string;
  location_id: string;
  booking_date: string;
  start_date: string;
  end_date: string;
  booking_status: MultiBookingStatus;
  total_items: number;
  estimated_subtotal?: number;
  estimated_tax?: number;
  estimated_total?: number;
  deposit_required?: number;
  deposit_paid: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  lines: BookingItemResponse[];
  
  // Related data (optional, populated when needed)
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  location?: {
    id: string;
    name: string;
    code?: string;
  };
}

export interface MultiBookingListResponse {
  bookings: MultiBookingHeader[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface MultiBookingAvailabilityRequest {
  items: Array<{
    item_id: string;
    quantity: number;
  }>;
  start_date: string;
  end_date: string;
  exclude_booking_id?: string;
}

export interface MultiBookingAvailabilityResponse {
  all_available: boolean;
  items: Array<{
    item_id: string;
    requested_quantity: number;
    available_stock: number;
    booked_quantity: number;
    available_for_booking: number;
    is_available: boolean;
  }>;
  start_date: string;
  end_date: string;
}

export interface MultiBookingFilters {
  customer_id?: string;
  location_id?: string;
  status?: MultiBookingStatus;
  date_from?: string;
  date_to?: string;
}

export interface MultiBookingUpdateRequest {
  start_date?: string;
  end_date?: string;
  notes?: string;
  deposit_paid?: boolean;
}

export interface MultiBookingConvertToRentalResponse {
  success: boolean;
  message: string;
  booking_id: string;
  rental_id?: string;
}