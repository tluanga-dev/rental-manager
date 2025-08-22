'use client';

import React, { useState } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, Filter, Download, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookingCalendar } from '@/components/bookings/BookingCalendar';
import { useLocations } from '@/hooks/useLocations';
import { useBookings } from '@/hooks/useBookings';
import { BookingFilters } from '@/types/booking';

export default function BookingCalendarPage() {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [filters, setFilters] = useState<BookingFilters>({});
  const { locations } = useLocations();
  const { refetch } = useBookings(filters, 1);

  const handleLocationChange = (locationId: string) => {
    setSelectedLocation(locationId);
    setFilters({
      ...filters,
      location_id: locationId === 'all' ? undefined : locationId,
    });
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleExport = () => {
    // TODO: Implement calendar export functionality
    console.log('Export calendar');
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
          Back to Bookings
        </Button>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarIcon className="h-8 w-8" />
              Booking Calendar
            </h1>
            <p className="text-gray-600 mt-2">
              View all bookings in a calendar format
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
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
          </div>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter bookings by location or other criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 max-w-xs">
              <Select value={selectedLocation} onValueChange={handleLocationChange}>
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
            </div>
            
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <BookingCalendar 
            locationId={selectedLocation === 'all' ? undefined : selectedLocation}
            onBookingSelect={(booking) => router.push(`/bookings/${booking.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}