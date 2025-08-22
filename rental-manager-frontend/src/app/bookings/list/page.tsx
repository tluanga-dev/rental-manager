'use client';

import React, { useState } from 'react';
import { ArrowLeft, List as ListIcon, Search, Filter, Download, RefreshCw, Eye, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useBookings } from '@/hooks/useBookings';
import { BookingStatus, BookingFilters, RentalBooking } from '@/types/booking';
import { getBookingStatusColor, getBookingStatusLabel, formatBookingPeriod } from '@/services/api/bookings';
import { useLocations } from '@/hooks/useLocations';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function BookingListPage() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<BookingFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<RentalBooking | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  
  const { locations } = useLocations();
  const {
    bookings,
    total,
    totalPages,
    isLoading,
    refetch,
    confirmBooking,
    cancelBooking,
    convertToRental,
    isConfirming,
    isCancelling,
    isConverting
  } = useBookings(filters, currentPage);

  const handleSearch = () => {
    setFilters({
      ...filters,
      search: searchTerm || undefined,
    });
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof BookingFilters, value: any) => {
    setFilters({
      ...filters,
      [key]: value || undefined,
    });
    setCurrentPage(1);
  };

  const handleViewDetails = (booking: RentalBooking) => {
    router.push(`/bookings/${booking.id}`);
  };

  const handleConfirmBooking = async (booking: RentalBooking) => {
    await confirmBooking(booking.id);
    refetch();
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

  const handleConvertToRental = async (booking: RentalBooking) => {
    await convertToRental(booking.id);
    router.push('/rentals');
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export bookings list');
  };

  return (
    <ProtectedRoute>
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
              <ListIcon className="h-8 w-8" />
              All Bookings
            </h1>
            <p className="text-gray-600 mt-2">
              Complete list of all rental bookings
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={refetch}
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={() => router.push('/bookings/new')}
            >
              Create New Booking
            </Button>
          </div>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Search & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by reference or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <Select 
              value={selectedLocation} 
              onValueChange={(value) => {
                setSelectedLocation(value);
                handleFilterChange('location_id', value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations?.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.location_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={selectedStatus} 
              onValueChange={(value) => {
                setSelectedStatus(value);
                handleFilterChange('status', value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Booking Period</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading bookings...
                    </TableCell>
                  </TableRow>
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No bookings found
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">
                        {booking.booking_reference}
                      </TableCell>
                      <TableCell>{booking.customer_name}</TableCell>
                      <TableCell>{formatBookingPeriod(booking.rental_start_date, booking.rental_end_date)}</TableCell>
                      <TableCell>{booking.total_items}</TableCell>
                      <TableCell>{booking.location_name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={getBookingStatusColor(booking.status)}>
                          {getBookingStatusLabel(booking.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(booking.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDetails(booking)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {booking.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleConfirmBooking(booking)}
                                disabled={isConfirming}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCancelBooking(booking)}
                                disabled={isCancelling}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                          
                          {booking.status === 'CONFIRMED' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleConvertToRental(booking)}
                              disabled={isConverting}
                            >
                              Convert
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, total)} of {total} bookings
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
    </ProtectedRoute>
  );
}