'use client';

import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Package, Users, MapPin, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useBookingCalendar } from '@/hooks/useBookings';
import { BookingStatus, RentalBooking } from '@/types/booking';
import { getBookingStatusColor, getBookingStatusLabel } from '@/services/api/bookings';

interface BookingCalendarProps {
  locationId?: string;
  itemIds?: string[];
  onBookingClick?: (booking: any) => void;
  onDateClick?: (date: Date) => void;
}

export const BookingCalendar: React.FC<BookingCalendarProps> = ({
  locationId,
  itemIds,
  onBookingClick,
  onDateClick
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBookings, setSelectedBookings] = useState<any[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Calculate date range for the calendar view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Fetch calendar data
  const { calendar, isLoading, error } = useBookingCalendar(
    locationId,
    itemIds,
    format(monthStart, 'yyyy-MM-dd'),
    format(monthEnd, 'yyyy-MM-dd')
  );

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Add padding days to start on Sunday
    const startPadding = monthStart.getDay();
    const paddingStart = [];
    for (let i = startPadding - 1; i >= 0; i--) {
      paddingStart.push(new Date(monthStart.getTime() - (i + 1) * 24 * 60 * 60 * 1000));
    }
    
    // Add padding days to end on Saturday
    const endPadding = 6 - monthEnd.getDay();
    const paddingEnd = [];
    for (let i = 1; i <= endPadding; i++) {
      paddingEnd.push(new Date(monthEnd.getTime() + i * 24 * 60 * 60 * 1000));
    }
    
    return [...paddingStart, ...days, ...paddingEnd];
  }, [monthStart, monthEnd]);

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayData = calendar?.calendar[dateStr];
    
    if (dayData && dayData.bookings.length > 0) {
      setSelectedDate(date);
      setSelectedBookings(dayData.bookings);
      setIsDetailsOpen(true);
    }
    
    onDateClick?.(date);
  };

  const getDayClass = (date: Date) => {
    const baseClass = "min-h-[80px] p-1 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors";
    const isCurrentMonth = isSameMonth(date, currentMonth);
    const isTodayDate = isToday(date);
    
    let classes = baseClass;
    
    if (!isCurrentMonth) {
      classes += " bg-gray-50 opacity-50";
    }
    
    if (isTodayDate) {
      classes += " ring-2 ring-blue-500";
    }
    
    // Add availability indicator
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayData = calendar?.calendar[dateStr];
    
    if (dayData && dayData.total_booked > 0) {
      const bookingCount = dayData.bookings.length;
      if (bookingCount >= 5) {
        classes += " bg-red-50"; // Heavily booked
      } else if (bookingCount >= 3) {
        classes += " bg-orange-50"; // Moderately booked
      } else {
        classes += " bg-green-50"; // Lightly booked
      }
    }
    
    return classes;
  };

  const renderDayContent = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayData = calendar?.calendar[dateStr];
    const isCurrentMonth = isSameMonth(date, currentMonth);
    
    return (
      <div className="h-full">
        <div className="flex justify-between items-start mb-1">
          <span className={`text-sm ${isToday(date) ? 'font-bold text-blue-600' : ''}`}>
            {format(date, 'd')}
          </span>
          {dayData && dayData.total_booked > 0 && isCurrentMonth && (
            <Badge variant="secondary" className="text-xs px-1 py-0">
              {dayData.bookings.length}
            </Badge>
          )}
        </div>
        
        {isCurrentMonth && dayData && dayData.bookings.length > 0 && (
          <div className="space-y-1">
            {dayData.bookings.slice(0, 2).map((booking, idx) => (
              <div
                key={idx}
                className="text-xs p-1 bg-white rounded border cursor-pointer hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onBookingClick?.(booking);
                }}
              >
                <div className="truncate font-medium">{booking.customer_name}</div>
                <div className="truncate text-gray-500">
                  {booking.quantity} × {booking.item_name}
                </div>
              </div>
            ))}
            {dayData.bookings.length > 2 && (
              <div className="text-xs text-gray-500 text-center">
                +{dayData.bookings.length - 2} more
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCalendarGrid = () => {
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return (
      <div className="grid grid-cols-7 gap-0">
        {/* Week day headers */}
        {weekDays.map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-700 border-b">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {calendarDays.map((date, index) => (
          <div
            key={index}
            className={getDayClass(date)}
            onClick={() => handleDateClick(date)}
          >
            {renderDayContent(date)}
          </div>
        ))}
      </div>
    );
  };

  const renderBookingDetails = () => (
    <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Bookings for {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {selectedBookings.map((booking, index) => (
            <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onBookingClick?.(booking)}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">{booking.reference}</p>
                    <p className="text-sm text-gray-600">{booking.customer_name}</p>
                  </div>
                  <Badge className={`bg-${getBookingStatusColor(booking.status)}-100`}>
                    {getBookingStatusLabel(booking.status)}
                  </Badge>
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>Item:</strong> {booking.item_name}</p>
                  <p><strong>Quantity:</strong> {booking.quantity}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderSummaryCards = () => {
    if (!calendar) return null;
    
    const totalBookings = calendar.total_bookings;
    const uniqueItems = new Set(
      Object.values(calendar.calendar)
        .flatMap(day => day.bookings.map(b => b.item_name))
    ).size;
    const uniqueCustomers = new Set(
      Object.values(calendar.calendar)
        .flatMap(day => day.bookings.map(b => b.customer_name))
    ).size;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold">{totalBookings}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unique Items</p>
                <p className="text-2xl font-bold">{uniqueItems}</p>
              </div>
              <Package className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unique Customers</p>
                <p className="text-2xl font-bold">{uniqueCustomers}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center text-red-500">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Failed to load calendar data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {renderSummaryCards()}
      
      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle>
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
            >
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            renderCalendarGrid()
          )}
        </CardContent>
      </Card>
      
      {/* Booking Details Dialog */}
      {renderBookingDetails()}
      
      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-50 border border-gray-200"></div>
              <span className="text-sm">Light Bookings (1-2)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-orange-50 border border-gray-200"></div>
              <span className="text-sm">Moderate Bookings (3-4)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-50 border border-gray-200"></div>
              <span className="text-sm">Heavy Bookings (5+)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-500"></div>
              <span className="text-sm">Today</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};