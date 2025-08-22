import apiClient from '@/lib/axios';
import { AvailabilityStatus } from '@/components/bookings/BookingRecordingForm';

export interface AvailabilityCheckRequest {
  items: Array<{
    item_id: string;
    quantity: number;
  }>;
  start_date: string;
  end_date: string;
  location_id: string;
  exclude_booking_id?: string;
}

export interface AvailabilityCheckResponse {
  is_available: boolean;
  items: Array<{
    item_id: string;
    is_available: boolean;
    available_quantity: number;
    total_quantity: number;
    requested_quantity: number;
    conflicts: Array<{
      booking_id: string;
      booking_reference: string;
      quantity: number;
      start_date: string;
      end_date: string;
      customer_name?: string;
    }>;
    suggestions?: Array<{
      start_date: string;
      end_date: string;
      available_quantity: number;
    }>;
  }>;
  overall_suggestions?: Array<{
    start_date: string;
    end_date: string;
    all_items_available: boolean;
  }>;
}

export const bookingAvailabilityApi = {
  /**
   * Check availability for multiple items
   */
  checkAvailability: async (request: AvailabilityCheckRequest): Promise<AvailabilityCheckResponse> => {
    const response = await apiClient.post('/transactions/rentals/bookings/check-availability', request);
    return response.data;
  },

  /**
   * Get availability calendar for a specific item
   */
  getAvailabilityCalendar: async (params: {
    item_id: string;
    location_id: string;
    start_date: string;
    end_date: string;
  }) => {
    const response = await apiClient.get('/transactions/rentals/bookings/availability-calendar', {
      params
    });
    return response.data;
  },

  /**
   * Get suggested available periods for items
   */
  getSuggestedPeriods: async (params: {
    item_ids: string[];
    location_id: string;
    preferred_duration_days: number;
    from_date?: string;
  }) => {
    const response = await apiClient.post('/transactions/rentals/bookings/suggested-periods', {
      item_ids: params.item_ids,
      location_id: params.location_id,
      preferred_duration_days: params.preferred_duration_days,
      from_date: params.from_date || new Date().toISOString().split('T')[0],
    });
    return response.data;
  },

  /**
   * Transform backend response to frontend AvailabilityStatus format
   */
  transformToAvailabilityStatus: (
    itemData: AvailabilityCheckResponse['items'][0]
  ): AvailabilityStatus => {
    return {
      is_available: itemData.is_available,
      available_quantity: itemData.available_quantity,
      total_quantity: itemData.total_quantity,
      conflicts: itemData.conflicts.map(conflict => ({
        booking_id: conflict.booking_id,
        quantity: conflict.quantity,
        start_date: conflict.start_date,
        end_date: conflict.end_date,
      })),
      suggestions: itemData.suggestions?.map(suggestion => ({
        start_date: suggestion.start_date,
        end_date: suggestion.end_date,
      })),
    };
  },
};