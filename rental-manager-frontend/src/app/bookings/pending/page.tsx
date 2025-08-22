'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Check, X, AlertCircle, Calendar, MapPin, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format, differenceInDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useBookings } from '@/hooks/useBookings';
import { BookingFilters, RentalBooking } from '@/types/booking';
import { formatBookingPeriod } from '@/services/api/bookings';

export default function PendingBookingsPage() {
  const router = useRouter();
  const [selectedBooking, setSelectedBooking] = useState<RentalBooking | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  
  // Filter for pending bookings only
  const [filters] = useState<BookingFilters>({
    status: 'PENDING'
  });
  
  const {
    bookings,
    total,
    isLoading,
    refetch,
    confirmBooking,
    cancelBooking,
    isConfirming,
    isCancelling,
  } = useBookings(filters, 1, 100); // Load up to 100 pending bookings

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [refetch]);

  const handleConfirmBooking = (booking: RentalBooking) => {
    setSelectedBooking(booking);
    setIsConfirmOpen(true);
  };

  const handleConfirmConfirm = async () => {
    if (selectedBooking) {
      await confirmBooking(selectedBooking.id);
      setIsConfirmOpen(false);
      setSelectedBooking(null);
      refetch();
    }
  };

  const handleCancelBooking = (booking: RentalBooking) => {
    setSelectedBooking(booking);
    setIsCancelOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (selectedBooking && cancelReason) {
      await cancelBooking({ id: selectedBooking.id, reason: cancelReason });
      setIsCancelOpen(false);
      setCancelReason('');
      setSelectedBooking(null);
      refetch();
    }
  };

  const getDaysUntilRental = (startDate: string) => {
    return differenceInDays(new Date(startDate), new Date());
  };

  const getUrgencyBadge = (daysUntil: number) => {
    if (daysUntil < 0) {
      return <Badge variant="destructive">Overdue</Badge>;
    } else if (daysUntil === 0) {
      return <Badge variant="destructive">Today</Badge>;
    } else if (daysUntil === 1) {
      return <Badge variant="destructive">Tomorrow</Badge>;
    } else if (daysUntil <= 3) {
      return <Badge variant="secondary">In {daysUntil} days</Badge>;
    } else if (daysUntil <= 7) {
      return <Badge variant="outline">Next week</Badge>;
    }
    return null;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/bookings')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-8 w-8 text-orange-500" />
              Pending Confirmations
            </h1>
            <p className="text-gray-600 mt-2">
              Bookings waiting for confirmation ({total} pending)
            </p>
          </div>
          
          <Button
            variant="outline"
            onClick={refetch}
          >
            Refresh
          </Button>
        </div>
      </div>

      {total > 0 && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            You have {total} booking{total !== 1 ? 's' : ''} waiting for confirmation. 
            Please review and confirm or cancel them as soon as possible.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center">
            Loading pending bookings...
          </CardContent>
        </Card>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Pending Bookings</h3>
            <p className="text-gray-600">
              All bookings have been processed. Great job!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bookings.map((booking) => {
            const daysUntil = getDaysUntilRental(booking.rental_start_date);
            const urgencyBadge = getUrgencyBadge(daysUntil);
            
            return (
              <Card key={booking.id} className={daysUntil <= 1 ? 'border-orange-300' : ''}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {booking.booking_reference}
                      </CardTitle>
                      <CardDescription>
                        Created {format(new Date(booking.created_at), 'MMM d, yyyy h:mm a')}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {urgencyBadge}
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Customer:</span>
                        <span>{booking.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{formatBookingPeriod(booking.rental_start_date, booking.rental_end_date)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span>{booking.location_name || 'No location specified'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-gray-500" />
                        <span>{booking.total_items} item{booking.total_items !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  
                  {booking.notes && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Notes:</span> {booking.notes}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/bookings/${booking.id}`)}
                    >
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCancelBooking(booking)}
                      disabled={isCancelling}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => handleConfirmBooking(booking)}
                      disabled={isConfirming}
                      className={daysUntil <= 1 ? 'bg-orange-600 hover:bg-orange-700' : ''}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Confirm
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to confirm this booking? The customer will be notified.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="py-4 space-y-2">
              <p className="text-sm">
                <span className="font-medium">Reference:</span> {selectedBooking.booking_reference}
              </p>
              <p className="text-sm">
                <span className="font-medium">Customer:</span> {selectedBooking.customer_name}
              </p>
              <p className="text-sm">
                <span className="font-medium">Period:</span> {formatBookingPeriod(selectedBooking.rental_start_date, selectedBooking.rental_end_date)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={handleConfirmConfirm}
              disabled={isConfirming}
            >
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Please provide a reason for cancelling this booking. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="cancel-reason">Cancellation Reason</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter reason for cancellation..."
              rows={4}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelOpen(false)}>
              Keep Booking
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelConfirm}
              disabled={!cancelReason || isCancelling}
            >
              Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}