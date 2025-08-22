/**
 * TypeScript types for rental booking system
 */

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  CONVERTED = 'CONVERTED'
}

export interface BookingItem {
  id: string;
  item_name: string;
  sku?: string;
  rental_rate?: number;
  rental_period?: number;
  available_quantity?: number;
}

export interface BookingCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface BookingLocation {
  id: string;
  name: string;
  code?: string;
  address?: string;
}

export interface RentalBooking {
  id: string;
  item_id: string;
  quantity_reserved: number;
  start_date: string;
  end_date: string;
  customer_id: string;
  location_id: string;
  booking_status: BookingStatus;
  booking_reference: string;
  estimated_rental_rate?: number;
  estimated_total?: number;
  deposit_required?: number;
  deposit_paid: boolean;
  notes?: string;
  cancelled_reason?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  converted_rental_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  
  // Related data
  item?: BookingItem;
  customer?: BookingCustomer;
  location?: BookingLocation;
  item_name?: string;
  customer_name?: string;
  location_name?: string;
}

export interface BookingCreateRequest {
  item_id: string;
  quantity_reserved: number;
  start_date: string;
  end_date: string;
  customer_id: string;
  location_id: string;
  estimated_rental_rate?: number;
  estimated_total?: number;
  deposit_required?: number;
  deposit_paid?: boolean;
  notes?: string;
}

export interface BookingUpdateRequest {
  quantity_reserved?: number;
  start_date?: string;
  end_date?: string;
  estimated_rental_rate?: number;
  estimated_total?: number;
  deposit_required?: number;
  deposit_paid?: boolean;
  notes?: string;
}

export interface BookingAvailabilityRequest {
  item_id: string;
  quantity: number;
  start_date: string;
  end_date: string;
  exclude_booking_id?: string;
}

export interface BookingAvailabilityResponse {
  is_available: boolean;
  available_quantity: number;
  total_available: number;
  total_booked: number;
  requested_quantity: number;
  conflicting_bookings: number;
  conflicts: Array<{
    booking_reference: string;
    customer_name: string;
    quantity: number;
    start_date: string;
    end_date: string;
  }>;
}

export interface BookingConflictCheckRequest {
  rental_id: string;
  items: Array<{
    item_id?: string;
    line_item_id?: string;
    quantity?: number;
    extend_quantity?: number;
  }>;
  new_end_date: string;
}

export interface BookingConflictCheckResponse {
  has_conflicts: boolean;
  conflicts: Record<string, any>;
  can_extend: boolean;
}

export interface BookingListResponse {
  bookings: RentalBooking[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface BookingCalendarDay {
  date: string;
  bookings: Array<{
    id: string;
    reference: string;
    customer_name: string;
    item_name: string;
    quantity: number;
    status: string;
  }>;
  total_booked: number;
  items: Record<string, {
    item_name: string;
    total_booked: number;
    bookings: Array<any>;
  }>;
}

export interface BookingCalendarResponse {
  date_range: {
    from: string;
    to: string;
  };
  total_bookings: number;
  calendar: Record<string, BookingCalendarDay>;
  filters: {
    location_id?: string;
    item_ids?: string[];
  };
}

export interface BookingSummaryResponse {
  total_bookings: number;
  status_breakdown: Record<string, number>;
  estimated_revenue: number;
  date_range: {
    from: string;
    to: string;
  };
  location_id?: string;
}

export interface BookingFilters {
  customer_id?: string;
  location_id?: string;
  item_id?: string;
  status?: BookingStatus;
  date_from?: string;
  date_to?: string;
  include_expired?: boolean;
}