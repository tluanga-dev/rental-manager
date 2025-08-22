/**
 * API service for rental booking management
 */

import { apiClient } from '@/lib/axios';
import {
  BookingCreateRequest,
  BookingUpdateRequest,
  RentalBooking,
  BookingListResponse,
  BookingAvailabilityRequest,
  BookingAvailabilityResponse,
  BookingConflictCheckRequest,
  BookingConflictCheckResponse,
  BookingCalendarResponse,
  BookingSummaryResponse,
  BookingFilters,
  BookingStatus
} from '@/types/booking';

const BOOKINGS_BASE_URL = '/transactions/rentals/bookings';

export const bookingsApi = {
  /**
   * Create a new booking
   */
  create: async (data: BookingCreateRequest): Promise<RentalBooking> => {
    const response = await apiClient.post<RentalBooking>(BOOKINGS_BASE_URL, data);
    return response.data;
  },

  /**
   * Get booking by ID
   */
  getById: async (bookingId: string): Promise<RentalBooking> => {
    const response = await apiClient.get<RentalBooking>(`${BOOKINGS_BASE_URL}/${bookingId}`);
    return response.data;
  },

  /**
   * Get booking by reference number
   */
  getByReference: async (reference: string): Promise<RentalBooking> => {
    const response = await apiClient.get<RentalBooking>(
      `${BOOKINGS_BASE_URL}/reference/${reference}`
    );
    return response.data;
  },

  /**
   * List bookings with filters and pagination
   */
  list: async (
    filters?: BookingFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<BookingListResponse> => {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.customer_id) params.append('customer_id', filters.customer_id);
      if (filters.location_id) params.append('location_id', filters.location_id);
      if (filters.item_id) params.append('item_id', filters.item_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.include_expired !== undefined) {
        params.append('include_expired', filters.include_expired.toString());
      }
    }
    
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    
    const response = await apiClient.get<BookingListResponse>(
      `${BOOKINGS_BASE_URL}?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Update a booking
   */
  update: async (bookingId: string, data: BookingUpdateRequest): Promise<RentalBooking> => {
    const response = await apiClient.put<RentalBooking>(
      `${BOOKINGS_BASE_URL}/${bookingId}`,
      data
    );
    return response.data;
  },

  /**
   * Check item availability for booking
   */
  checkAvailability: async (
    request: BookingAvailabilityRequest
  ): Promise<BookingAvailabilityResponse> => {
    const response = await apiClient.post<BookingAvailabilityResponse>(
      `${BOOKINGS_BASE_URL}/check-availability`,
      request
    );
    return response.data;
  },

  /**
   * Check for booking conflicts (for rental extensions)
   */
  checkConflicts: async (
    request: BookingConflictCheckRequest
  ): Promise<BookingConflictCheckResponse> => {
    const response = await apiClient.post<BookingConflictCheckResponse>(
      `${BOOKINGS_BASE_URL}/check-conflicts`,
      request
    );
    return response.data;
  },

  /**
   * Confirm a pending booking
   */
  confirm: async (bookingId: string): Promise<RentalBooking> => {
    const response = await apiClient.put<RentalBooking>(
      `${BOOKINGS_BASE_URL}/${bookingId}/confirm`
    );
    return response.data;
  },

  /**
   * Cancel a booking
   */
  cancel: async (bookingId: string, reason: string): Promise<RentalBooking> => {
    const response = await apiClient.put<RentalBooking>(
      `${BOOKINGS_BASE_URL}/${bookingId}/cancel`,
      null,
      { params: { reason } }
    );
    return response.data;
  },

  /**
   * Convert a confirmed booking to a rental
   */
  convertToRental: async (
    bookingId: string,
    additionalData?: any
  ): Promise<{
    success: boolean;
    message: string;
    rental_id: string;
    rental_number: string;
  }> => {
    const response = await apiClient.post(
      `${BOOKINGS_BASE_URL}/${bookingId}/convert-to-rental`,
      additionalData || {}
    );
    return response.data;
  },

  /**
   * Get booking calendar data
   */
  getCalendar: async (
    locationId?: string,
    itemIds?: string[],
    dateFrom?: string,
    dateTo?: string
  ): Promise<BookingCalendarResponse> => {
    const params = new URLSearchParams();
    
    if (locationId) params.append('location_id', locationId);
    if (itemIds && itemIds.length > 0) {
      itemIds.forEach(id => params.append('item_ids', id));
    }
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    
    const response = await apiClient.get<BookingCalendarResponse>(
      `${BOOKINGS_BASE_URL}/calendar/view?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Get booking summary statistics
   */
  getSummary: async (
    dateFrom: string,
    dateTo: string,
    locationId?: string
  ): Promise<BookingSummaryResponse> => {
    const params = new URLSearchParams();
    params.append('date_from', dateFrom);
    params.append('date_to', dateTo);
    if (locationId) params.append('location_id', locationId);
    
    const response = await apiClient.get<BookingSummaryResponse>(
      `${BOOKINGS_BASE_URL}/summary/stats?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Expire old pending bookings
   */
  expireOldBookings: async (): Promise<{
    success: boolean;
    expired_count: number;
    message: string;
  }> => {
    const response = await apiClient.post(`${BOOKINGS_BASE_URL}/expire-old`);
    return response.data;
  }
};

// Export helper functions for common operations
export const getBookingStatusColor = (status: BookingStatus): string => {
  switch (status) {
    case BookingStatus.CONFIRMED:
      return 'green';
    case BookingStatus.PENDING:
      return 'yellow';
    case BookingStatus.CANCELLED:
      return 'red';
    case BookingStatus.CONVERTED:
      return 'blue';
    default:
      return 'gray';
  }
};

export const getBookingStatusLabel = (status: BookingStatus): string => {
  switch (status) {
    case BookingStatus.CONFIRMED:
      return 'Confirmed';
    case BookingStatus.PENDING:
      return 'Pending';
    case BookingStatus.CANCELLED:
      return 'Cancelled';
    case BookingStatus.CONVERTED:
      return 'Converted to Rental';
    default:
      return status;
  }
};

export const formatBookingPeriod = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()} (${days} days)`;
};