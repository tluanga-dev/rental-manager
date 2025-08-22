/**
 * API service for multi-item booking management
 */

import { apiClient } from '@/lib/axios';
import {
  MultiBookingCreateRequest,
  MultiBookingHeader,
  MultiBookingListResponse,
  MultiBookingAvailabilityRequest,
  MultiBookingAvailabilityResponse,
  MultiBookingFilters,
  MultiBookingUpdateRequest,
  MultiBookingConvertToRentalResponse,
  MultiBookingStatus
} from '@/types/multi-booking';

const MULTI_BOOKINGS_BASE_URL = '/transactions/rentals/bookings/multi';

export const multiBookingsApi = {
  /**
   * Create a new multi-item booking
   */
  create: async (data: MultiBookingCreateRequest): Promise<MultiBookingHeader> => {
    const response = await apiClient.post<MultiBookingHeader>(MULTI_BOOKINGS_BASE_URL, data);
    return response.data;
  },

  /**
   * Get booking by ID
   */
  getById: async (bookingId: string): Promise<MultiBookingHeader> => {
    const response = await apiClient.get<MultiBookingHeader>(`${MULTI_BOOKINGS_BASE_URL}/${bookingId}`);
    return response.data;
  },

  /**
   * Get booking by reference number
   */
  getByReference: async (reference: string): Promise<MultiBookingHeader> => {
    const response = await apiClient.get<MultiBookingHeader>(
      `${MULTI_BOOKINGS_BASE_URL}/reference/${reference}`
    );
    return response.data;
  },

  /**
   * List bookings with filters and pagination
   */
  list: async (
    filters?: MultiBookingFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<MultiBookingListResponse> => {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.customer_id) params.append('customer_id', filters.customer_id);
      if (filters.location_id) params.append('location_id', filters.location_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
    }
    
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    
    const response = await apiClient.get<MultiBookingListResponse>(
      `${MULTI_BOOKINGS_BASE_URL}?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Update a booking
   */
  update: async (bookingId: string, data: MultiBookingUpdateRequest): Promise<MultiBookingHeader> => {
    const response = await apiClient.put<MultiBookingHeader>(
      `${MULTI_BOOKINGS_BASE_URL}/${bookingId}`,
      data
    );
    return response.data;
  },

  /**
   * Check availability for multiple items
   */
  checkAvailability: async (
    request: MultiBookingAvailabilityRequest
  ): Promise<MultiBookingAvailabilityResponse> => {
    const response = await apiClient.post<MultiBookingAvailabilityResponse>(
      `${MULTI_BOOKINGS_BASE_URL}/check-availability`,
      request
    );
    return response.data;
  },

  /**
   * Confirm a pending booking
   */
  confirm: async (bookingId: string): Promise<MultiBookingHeader> => {
    const response = await apiClient.put<MultiBookingHeader>(
      `${MULTI_BOOKINGS_BASE_URL}/${bookingId}/confirm`
    );
    return response.data;
  },

  /**
   * Cancel a booking
   */
  cancel: async (bookingId: string, reason: string): Promise<MultiBookingHeader> => {
    const response = await apiClient.put<MultiBookingHeader>(
      `${MULTI_BOOKINGS_BASE_URL}/${bookingId}/cancel`,
      null,
      { params: { reason } }
    );
    return response.data;
  },

  /**
   * Convert a confirmed booking to a rental
   */
  convertToRental: async (bookingId: string): Promise<MultiBookingConvertToRentalResponse> => {
    const response = await apiClient.post<MultiBookingConvertToRentalResponse>(
      `${MULTI_BOOKINGS_BASE_URL}/${bookingId}/convert-to-rental`
    );
    return response.data;
  }
};

// Export helper functions for common operations
export const getMultiBookingStatusColor = (status: MultiBookingStatus): string => {
  switch (status) {
    case MultiBookingStatus.CONFIRMED:
      return 'green';
    case MultiBookingStatus.PENDING:
      return 'yellow';
    case MultiBookingStatus.CANCELLED:
      return 'red';
    case MultiBookingStatus.CONVERTED:
      return 'blue';
    default:
      return 'gray';
  }
};

export const getMultiBookingStatusLabel = (status: MultiBookingStatus): string => {
  switch (status) {
    case MultiBookingStatus.CONFIRMED:
      return 'Confirmed';
    case MultiBookingStatus.PENDING:
      return 'Pending';
    case MultiBookingStatus.CANCELLED:
      return 'Cancelled';
    case MultiBookingStatus.CONVERTED:
      return 'Converted to Rental';
    default:
      return status;
  }
};

export const calculateBookingTotals = (items: any[]) => {
  let subtotal = 0;
  
  items.forEach(item => {
    const itemTotal = item.quantity * item.unit_rate * item.rental_period;
    const discount = item.discount_amount || 0;
    subtotal += itemTotal - discount;
  });
  
  const tax = subtotal * 0.00; // No tax for now
  const total = subtotal + tax;
  const depositRequired = total * 0.20; // 20% deposit
  
  return {
    subtotal,
    tax,
    total,
    depositRequired
  };
};