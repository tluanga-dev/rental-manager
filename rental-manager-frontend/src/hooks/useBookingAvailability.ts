import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { 
  bookingAvailabilityApi, 
  AvailabilityCheckRequest,
  AvailabilityCheckResponse 
} from '@/services/api/booking-availability';
import { AvailabilityStatus } from '@/components/bookings/BookingRecordingForm';

export interface UseBookingAvailabilityOptions {
  onSuccess?: (data: AvailabilityCheckResponse) => void;
  onError?: (error: Error) => void;
}

export function useBookingAvailability(options?: UseBookingAvailabilityOptions) {
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, AvailabilityStatus>>({});
  const [lastCheckParams, setLastCheckParams] = useState<AvailabilityCheckRequest | null>(null);

  const checkAvailabilityMutation = useMutation({
    mutationFn: bookingAvailabilityApi.checkAvailability,
    onSuccess: (data) => {
      // Transform response to availability map
      const map: Record<string, AvailabilityStatus> = {};
      const items = data?.items || [];
      
      items.forEach(item => {
        map[item.item_id] = bookingAvailabilityApi.transformToAvailabilityStatus(item);
      });
      
      setAvailabilityMap(map);
      
      // Show notification if any items are unavailable
      const unavailableItems = items.filter(item => !item.is_available);
      if (unavailableItems.length > 0) {
        toast.warning(`${unavailableItems.length} item(s) have availability issues`);
      } else if (items.length > 0) {
        toast.success('All items are available for the selected dates');
      }
      
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      console.error('Availability check failed:', error);
      toast.error('Failed to check availability. Please try again.');
      options?.onError?.(error);
    },
  });

  const checkAvailability = useCallback(async (
    items: Array<{ item_id: string; quantity: number }>,
    start_date: Date,
    end_date: Date,
    location_id: string,
    exclude_booking_id?: string
  ) => {
    const request: AvailabilityCheckRequest = {
      items,
      start_date: format(start_date, 'yyyy-MM-dd'),
      end_date: format(end_date, 'yyyy-MM-dd'),
      location_id,
      exclude_booking_id,
    };
    
    setLastCheckParams(request);
    return checkAvailabilityMutation.mutate(request);
  }, [checkAvailabilityMutation]);

  const recheckAvailability = useCallback(() => {
    if (lastCheckParams) {
      checkAvailabilityMutation.mutate(lastCheckParams);
    }
  }, [lastCheckParams, checkAvailabilityMutation]);

  const getItemAvailability = useCallback((itemId: string): AvailabilityStatus | undefined => {
    return availabilityMap[itemId];
  }, [availabilityMap]);

  const clearAvailability = useCallback(() => {
    setAvailabilityMap({});
    setLastCheckParams(null);
  }, []);

  const isAllAvailable = useCallback((): boolean => {
    const items = Object.values(availabilityMap);
    return items.length > 0 && items.every(item => item.is_available);
  }, [availabilityMap]);

  const getUnavailableItems = useCallback((): Array<{ itemId: string; status: AvailabilityStatus }> => {
    return Object.entries(availabilityMap)
      .filter(([_, status]) => !status.is_available)
      .map(([itemId, status]) => ({ itemId, status }));
  }, [availabilityMap]);

  return {
    // State
    availabilityMap,
    isChecking: checkAvailabilityMutation.isPending,
    lastError: checkAvailabilityMutation.error,
    
    // Actions
    checkAvailability,
    recheckAvailability,
    clearAvailability,
    
    // Helpers
    getItemAvailability,
    isAllAvailable,
    getUnavailableItems,
  };
}

// Hook for getting availability calendar
export function useAvailabilityCalendar(
  itemId: string,
  locationId: string,
  startDate: string,
  endDate: string
) {
  return useMutation({
    mutationKey: ['availability-calendar', itemId, locationId, startDate, endDate],
    mutationFn: () => bookingAvailabilityApi.getAvailabilityCalendar({
      item_id: itemId,
      location_id: locationId,
      start_date: startDate,
      end_date: endDate,
    }),
  });
}

// Hook for getting suggested periods
export function useSuggestedPeriods() {
  return useMutation({
    mutationFn: bookingAvailabilityApi.getSuggestedPeriods,
    onSuccess: (data) => {
      if (data.suggestions && data.suggestions.length > 0) {
        toast.info(`Found ${data.suggestions.length} available period(s)`);
      } else {
        toast.warning('No available periods found for the requested duration');
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to get suggested periods');
      console.error('Suggested periods error:', error);
    },
  });
}