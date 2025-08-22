'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Plus, Calendar, List, Search, Filter, Download, RefreshCw, Eye, Check, X, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { BookingCalendar } from './BookingCalendar';
import { useBookings, useBookingSummary } from '@/hooks/useBookings';
import { BookingStatus, BookingFilters, RentalBooking } from '@/types/booking';
import { getBookingStatusColor, getBookingStatusLabel, formatBookingPeriod } from '@/services/api/bookings';
import { useLocations } from '@/hooks/useLocations';

export const BookingManagementDashboard: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'list' | 'calendar' | 'summary'>('list');
  const [selectedBooking, setSelectedBooking] = useState<RentalBooking | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState<BookingFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  
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
  
  // Get summary for the current month
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const { summary } = useBookingSummary(
    format(monthStart, 'yyyy-MM-dd'),
    format(monthEnd, 'yyyy-MM-dd'),
    selectedLocation
  );

  const handleSearch = () => {
    setFilters({
      ...filters,
      // Add search logic based on reference or customer name
    });
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof BookingFilters, value: any) => {
    setFilters({
      ...filters,
      [key]: value
    });
    setCurrentPage(1);
  };

  const handleViewDetails = (booking: RentalBooking) => {
    setSelectedBooking(booking);
    setIsDetailsOpen(true);
  };

  const handleConfirmBooking = (booking: RentalBooking) => {
    confirmBooking(booking.id);
  };

  const handleCancelBooking = (booking: RentalBooking) => {
    setSelectedBooking(booking);
    setIsCancelOpen(true);
  };

  const handleCancelConfirm = () => {
    if (selectedBooking && cancelReason) {
      cancelBooking({ id: selectedBooking.id, reason: cancelReason });
      setIsCancelOpen(false);
      setCancelReason('');
      setSelectedBooking(null);
    }
  };

  const handleConvertToRental = (booking: RentalBooking) => {
    if (confirm(`Convert booking ${booking.booking_reference} to a rental?`)) {
      convertToRental({ id: booking.id });
    }
  };

  const renderFilters = () => (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="search">Search</Label>
            <div className="flex gap-2">
              <Input
                id="search"
                placeholder="Reference or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button size="sm" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value={BookingStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={BookingStatus.CONFIRMED}>Confirmed</SelectItem>
                <SelectItem value={BookingStatus.CANCELLED}>Cancelled</SelectItem>
                <SelectItem value={BookingStatus.CONVERTED}>Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="location">Location</Label>
            <Select
              value={selectedLocation || 'all'}
              onValueChange={(value) => {
                setSelectedLocation(value === 'all' ? '' : value);
                handleFilterChange('location_id', value === 'all' ? undefined : value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations?.map(location => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="date-range">Date Range</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.date_from || ''}
                onChange={(e) => handleFilterChange('date_from', e.target.value || undefined)}
              />
              <Input
                type="date"
                value={filters.date_to || ''}
                onChange={(e) => handleFilterChange('date_to', e.target.value || undefined)}
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters({});
              setSearchTerm('');
              setSelectedLocation('');
              setCurrentPage(1);
            }}
          >
            Clear Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderBookingsList = () => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Bookings List</CardTitle>
          <Badge variant="secondary">{total} total bookings</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium">
                  {booking.booking_reference}
                </TableCell>
                <TableCell>{booking.customer_name || 'N/A'}</TableCell>
                <TableCell>{booking.item_name || 'N/A'}</TableCell>
                <TableCell className="text-sm">
                  {formatBookingPeriod(booking.start_date, booking.end_date)}
                </TableCell>
                <TableCell>{booking.quantity_reserved}</TableCell>
                <TableCell>
                  <Badge 
                    variant={booking.booking_status === BookingStatus.CONFIRMED ? 'success' : 
                            booking.booking_status === BookingStatus.PENDING ? 'warning' :
                            booking.booking_status === BookingStatus.CANCELLED ? 'destructive' : 'secondary'}
                  >
                    {getBookingStatusLabel(booking.booking_status)}
                  </Badge>
                </TableCell>
                <TableCell>${booking.estimated_total?.toFixed(2) || '0.00'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleViewDetails(booking)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    {booking.booking_status === BookingStatus.PENDING && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleConfirmBooking(booking)}
                        disabled={isConfirming}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                    
                    {booking.booking_status === BookingStatus.CONFIRMED && 
                     new Date(booking.start_date) <= new Date() && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleConvertToRental(booking)}
                        disabled={isConverting}
                      >
                        <ArrowRight className="h-4 w-4 text-blue-600" />
                      </Button>
                    )}
                    
                    {(booking.booking_status === BookingStatus.PENDING || 
                      booking.booking_status === BookingStatus.CONFIRMED) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancelBooking(booking)}
                        disabled={isCancelling}
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            
            {bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  No bookings found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
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
  );

  const renderSummary = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary?.total_bookings || 0}</div>
          <p className="text-xs text-gray-600 mt-1">This month</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {summary?.status_breakdown?.CONFIRMED || 0}
          </div>
          <p className="text-xs text-gray-600 mt-1">Ready for rental</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {summary?.status_breakdown?.PENDING || 0}
          </div>
          <p className="text-xs text-gray-600 mt-1">Awaiting confirmation</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Est. Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            ${summary?.estimated_revenue?.toFixed(2) || '0.00'}
          </div>
          <p className="text-xs text-gray-600 mt-1">From confirmed bookings</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderBookingDetails = () => (
    <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Booking Details - {selectedBooking?.booking_reference}</DialogTitle>
        </DialogHeader>
        
        {selectedBooking && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-600">Status</Label>
                <div className="mt-1">
                  <Badge 
                    variant={selectedBooking.booking_status === BookingStatus.CONFIRMED ? 'success' : 
                            selectedBooking.booking_status === BookingStatus.PENDING ? 'warning' :
                            selectedBooking.booking_status === BookingStatus.CANCELLED ? 'destructive' : 'secondary'}
                  >
                    {getBookingStatusLabel(selectedBooking.booking_status)}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Created</Label>
                <p className="text-sm">{format(new Date(selectedBooking.created_at), 'PPP')}</p>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Booking Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600">Customer</Label>
                  <p className="text-sm">{selectedBooking.customer_name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Item</Label>
                  <p className="text-sm">{selectedBooking.item_name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Quantity</Label>
                  <p className="text-sm">{selectedBooking.quantity_reserved}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Location</Label>
                  <p className="text-sm">{selectedBooking.location_name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Period</Label>
                  <p className="text-sm">
                    {formatBookingPeriod(selectedBooking.start_date, selectedBooking.end_date)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Financial Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600">Estimated Total</Label>
                  <p className="text-sm font-medium">
                    ${selectedBooking.estimated_total?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Deposit Required</Label>
                  <p className="text-sm font-medium">
                    ${selectedBooking.deposit_required?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Deposit Status</Label>
                  <Badge variant={selectedBooking.deposit_paid ? 'success' : 'warning'}>
                    {selectedBooking.deposit_paid ? 'Paid' : 'Pending'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {selectedBooking.notes && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Notes</h4>
                <p className="text-sm text-gray-600">{selectedBooking.notes}</p>
              </div>
            )}
            
            {selectedBooking.cancelled_reason && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Cancellation Details</h4>
                <p className="text-sm text-gray-600">{selectedBooking.cancelled_reason}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Cancelled on {format(new Date(selectedBooking.cancelled_at!), 'PPP')}
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  const renderCancelDialog = () => (
    <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel booking {selectedBooking?.booking_reference}?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="cancel-reason">Cancellation Reason</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Please provide a reason for cancellation..."
              rows={3}
            />
          </div>
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
            {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Booking Management</h1>
          <p className="text-gray-600">Manage rental bookings and reservations</p>
        </div>
        <Button 
          onClick={() => router.push('/bookings/create')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Booking
        </Button>
      </div>
      
      {/* Summary Cards */}
      {renderSummary()}
      
      {/* Filters */}
      {renderFilters()}
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="list">
            <List className="h-4 w-4 mr-2" />
            List View
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Calendar View
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="list">
          {renderBookingsList()}
        </TabsContent>
        
        <TabsContent value="calendar">
          <BookingCalendar
            locationId={selectedLocation}
            onBookingClick={handleViewDetails}
          />
        </TabsContent>
      </Tabs>
      
      {/* Dialogs */}
      
      {renderBookingDetails()}
      {renderCancelDialog()}
    </div>
  );
};