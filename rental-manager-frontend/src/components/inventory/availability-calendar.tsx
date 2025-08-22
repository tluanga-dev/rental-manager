'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  Eye,
  Info
} from 'lucide-react';
import { InventoryReservation, InventoryStatus } from '@/types/inventory';
import { SKU, Location } from '@/types/api';

interface AvailabilityCalendarProps {
  reservations: InventoryReservation[];
  skus: SKU[];
  locations: Location[];
  selectedSKU?: string;
  selectedLocation?: string;
  onSKUChange: (skuId: string) => void;
  onLocationChange: (locationId: string) => void;
  onDateSelect: (date: Date) => void;
  onReservationClick: (reservation: InventoryReservation) => void;
  isLoading?: boolean;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  reservations: InventoryReservation[];
  availableUnits: number;
  totalUnits: number;
  conflicts: boolean;
}

export function AvailabilityCalendar({
  reservations,
  skus,
  locations,
  selectedSKU,
  selectedLocation,
  onSKUChange,
  onLocationChange,
  onDateSelect,
  onReservationClick,
  isLoading,
}: AvailabilityCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedReservation, setSelectedReservation] = useState<InventoryReservation | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const getSKUDetails = (skuId: string) => {
    return skus.find(s => s.id === skuId);
  };

  const getLocationName = (locationId: string) => {
    return locations.find(l => l.id === locationId)?.name || 'Unknown Location';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN');
  };

  // Generate calendar days for the current month
  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
    
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay())); // End on Saturday
    
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayReservations = reservations.filter(reservation => {
        const startDate = new Date(reservation.start_date);
        const endDate = new Date(reservation.end_date);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        const currentDay = new Date(date);
        currentDay.setHours(0, 0, 0, 0);
        
        // Check if date falls within reservation period
        if (selectedSKU && reservation.sku_id !== selectedSKU) return false;
        if (selectedLocation && reservation.location_id !== selectedLocation) return false;
        
        return currentDay >= startDate && currentDay <= endDate;
      });
      
      // Calculate availability (mock data - in real app this would come from API)
      const totalUnits = 10; // This should come from actual stock data
      const reservedUnits = dayReservations.reduce((sum, res) => sum + res.quantity, 0);
      const availableUnits = Math.max(0, totalUnits - reservedUnits);
      
      // Check for conflicts (more reservations than available units)
      const conflicts = reservedUnits > totalUnits;
      
      days.push({
        date: new Date(date),
        isCurrentMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        reservations: dayReservations,
        availableUnits,
        totalUnits,
        conflicts,
      });
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const navigateToToday = () => {
    setCurrentDate(new Date());
  };

  const getAvailabilityColor = (day: CalendarDay) => {
    if (day.conflicts) return 'bg-red-100 border-red-300';
    if (day.availableUnits === 0) return 'bg-orange-100 border-orange-300';
    if (day.availableUnits < day.totalUnits * 0.3) return 'bg-yellow-100 border-yellow-300';
    return 'bg-green-100 border-green-300';
  };

  const getAvailabilityIcon = (day: CalendarDay) => {
    if (day.conflicts) return <AlertTriangle className="h-3 w-3 text-red-600" />;
    if (day.availableUnits === 0) return <Package className="h-3 w-3 text-orange-600" />;
    if (day.reservations.length > 0) return <Clock className="h-3 w-3 text-yellow-600" />;
    return <CheckCircle className="h-3 w-3 text-green-600" />;
  };

  const handleReservationClick = (reservation: InventoryReservation) => {
    setSelectedReservation(reservation);
    setDetailsOpen(true);
    onReservationClick(reservation);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Availability Calendar</h2>
          <p className="text-muted-foreground">
            View rental bookings and availability conflicts
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">SKU</label>
              <Select value={selectedSKU || ''} onValueChange={onSKUChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All SKUs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All SKUs</SelectItem>
                  {skus.map((sku) => (
                    <SelectItem key={sku.id} value={sku.id}>
                      {sku.sku_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Select value={selectedLocation || ''} onValueChange={onLocationChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-lg font-semibold">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={navigateToToday}>
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Week day headers */}
            {weekDays.map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={`
                  min-h-[100px] p-1 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors
                  ${day.isCurrentMonth ? '' : 'bg-gray-50 opacity-50'}
                  ${day.isToday ? 'ring-2 ring-slate-500' : ''}
                  ${getAvailabilityColor(day)}
                `}
                onClick={() => onDateSelect(day.date)}
              >
                <div className="space-y-1">
                  {/* Date number */}
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${day.isToday ? 'font-bold' : ''}`}>
                      {day.date.getDate()}
                    </span>
                    {day.isCurrentMonth && getAvailabilityIcon(day)}
                  </div>
                  
                  {/* Availability info */}
                  {day.isCurrentMonth && (
                    <div className="space-y-1">
                      <div className="text-xs">
                        <span className={day.conflicts ? 'text-red-600 font-medium' : 'text-green-600'}>
                          {day.availableUnits}/{day.totalUnits}
                        </span>
                        <span className="text-muted-foreground"> avail</span>
                      </div>
                      
                      {/* Reservations */}
                      {day.reservations.slice(0, 2).map((reservation, idx) => (
                        <div
                          key={idx}
                          className="text-xs p-1 bg-slate-100 text-slate-800 rounded cursor-pointer hover:bg-slate-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReservationClick(reservation);
                          }}
                        >
                          <div className="truncate">
                            Qty: {reservation.quantity}
                          </div>
                        </div>
                      ))}
                      
                      {day.reservations.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{day.reservations.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-sm">Available</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
              <span className="text-sm">Limited</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
              <span className="text-sm">Fully Booked</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
              <span className="text-sm">Overbooked</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reservation Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reservation Details</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">SKU</label>
                  <div className="font-medium">
                    {getSKUDetails(selectedReservation.sku_id)?.sku_code || 'Unknown'}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Location</label>
                  <div className="font-medium">
                    {getLocationName(selectedReservation.location_id)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Quantity</label>
                  <div className="font-medium">{selectedReservation.quantity}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <Badge variant="outline">
                    {selectedReservation.reservation_type.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                  <div className="font-medium">
                    {formatDateTime(selectedReservation.start_date)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">End Date</label>
                  <div className="font-medium">
                    {formatDateTime(selectedReservation.end_date)}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  <Badge 
                    variant={selectedReservation.status === 'ACTIVE' ? 'default' : 'secondary'}
                  >
                    {selectedReservation.status}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Reserved For</label>
                <div className="font-medium">{selectedReservation.reserved_for}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <div className="text-sm">{formatDateTime(selectedReservation.created_at)}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Expires</label>
                <div className="text-sm">{formatDateTime(selectedReservation.expires_at)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}