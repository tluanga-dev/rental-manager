/**
 * Custom hook for managing rental bookings
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { bookingsApi } from '@/services/api/bookings';
import {
  BookingCreateRequest,
  BookingUpdateRequest,
  RentalBooking,
  BookingAvailabilityRequest,
  BookingAvailabilityResponse,
  BookingFilters,
  BookingStatus
} from '@/types/booking';

export const useBookings = (filters?: BookingFilters, page: number = 1, pageSize: number = 20) => {
  const queryClient = useQueryClient();
  
  // Fetch bookings list
  const {
    data: bookingsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['bookings', filters, page, pageSize],
    queryFn: () => bookingsApi.list(filters, page, pageSize),
    keepPreviousData: true
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: (data: BookingCreateRequest) => bookingsApi.create(data),
    onSuccess: (newBooking) => {
      queryClient.invalidateQueries(['bookings']);
      toast.success(`Booking ${newBooking.booking_reference} created successfully`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    }
  });

  // Update booking mutation
  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BookingUpdateRequest }) =>
      bookingsApi.update(id, data),
    onSuccess: (updatedBooking) => {
      queryClient.invalidateQueries(['bookings']);
      queryClient.invalidateQueries(['booking', updatedBooking.id]);
      toast.success('Booking updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update booking');
    }
  });

  // Confirm booking mutation
  const confirmBookingMutation = useMutation({
    mutationFn: (bookingId: string) => bookingsApi.confirm(bookingId),
    onSuccess: (booking) => {
      queryClient.invalidateQueries(['bookings']);
      queryClient.invalidateQueries(['booking', booking.id]);
      toast.success(`Booking ${booking.booking_reference} confirmed`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to confirm booking');
    }
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      bookingsApi.cancel(id, reason),
    onSuccess: (booking) => {
      queryClient.invalidateQueries(['bookings']);
      queryClient.invalidateQueries(['booking', booking.id]);
      toast.success(`Booking ${booking.booking_reference} cancelled`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to cancel booking');
    }
  });

  // Convert to rental mutation
  const convertToRentalMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: any }) =>
      bookingsApi.convertToRental(id, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries(['bookings']);
      queryClient.invalidateQueries(['rentals']);
      toast.success(result.message);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to convert booking to rental');
    }
  });

  return {
    bookings: bookingsData?.bookings || [],
    total: bookingsData?.total || 0,
    totalPages: bookingsData?.total_pages || 0,
    currentPage: page,
    pageSize,
    isLoading,
    error,
    refetch,
    createBooking: createBookingMutation.mutate,
    updateBooking: updateBookingMutation.mutate,
    confirmBooking: confirmBookingMutation.mutate,
    cancelBooking: cancelBookingMutation.mutate,
    convertToRental: convertToRentalMutation.mutate,
    isCreating: createBookingMutation.isLoading,
    isUpdating: updateBookingMutation.isLoading,
    isConfirming: confirmBookingMutation.isLoading,
    isCancelling: cancelBookingMutation.isLoading,
    isConverting: convertToRentalMutation.isLoading
  };
};

export const useBooking = (bookingId: string) => {
  const queryClient = useQueryClient();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => bookingsApi.getById(bookingId),
    enabled: !!bookingId
  });

  return {
    booking: data,
    isLoading,
    error,
    refetch: () => queryClient.invalidateQueries(['booking', bookingId])
  };
};

export const useBookingAvailability = () => {
  const [availability, setAvailability] = useState<BookingAvailabilityResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = useCallback(async (request: BookingAvailabilityRequest) => {
    setIsChecking(true);
    setError(null);
    
    try {
      const response = await bookingsApi.checkAvailability(request);
      setAvailability(response);
      return response;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to check availability';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAvailability(null);
    setError(null);
  }, []);

  return {
    availability,
    isChecking,
    error,
    checkAvailability,
    reset
  };
};

export const useBookingCalendar = (
  locationId?: string,
  itemIds?: string[],
  dateFrom?: string,
  dateTo?: string
) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['booking-calendar', locationId, itemIds, dateFrom, dateTo],
    queryFn: () => bookingsApi.getCalendar(locationId, itemIds, dateFrom, dateTo)
  });

  return {
    calendar: data,
    isLoading,
    error
  };
};

export const useBookingSummary = (dateFrom: string, dateTo: string, locationId?: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['booking-summary', dateFrom, dateTo, locationId],
    queryFn: () => bookingsApi.getSummary(dateFrom, dateTo, locationId),
    enabled: !!dateFrom && !!dateTo
  });

  return {
    summary: data,
    isLoading,
    error
  };
};

// Dedicated hook for creating bookings (used by BookingRecordingForm)
export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  
  const createBookingMutation = useMutation({
    mutationFn: (data: BookingCreateRequest) => bookingsApi.create(data),
    onSuccess: (newBooking) => {
      queryClient.invalidateQueries(['bookings']);
      toast.success(`Booking ${newBooking.booking_reference} created successfully`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    }
  });

  return {
    createBooking: createBookingMutation.mutateAsync, // Use mutateAsync for promise-based usage
    isCreating: createBookingMutation.isLoading,
    error: createBookingMutation.error
  };
};