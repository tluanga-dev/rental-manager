'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarIcon, Search, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PastelCalendar } from '@/components/ui/pastel-calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { rentalsApi } from '@/services/api/rentals';
import { cn } from '@/lib/utils';
import type { AvailabilityResponse } from '@/types/rentals';

interface AvailabilityCheckerProps {
  onAvailabilityCheck?: (result: AvailabilityResponse) => void;
  className?: string;
}

export function AvailabilityChecker({ onAvailabilityCheck, className }: AvailabilityCheckerProps) {
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [result, setResult] = useState<AvailabilityResponse | null>(null);

  const checkAvailabilityMutation = useMutation({
    mutationFn: rentalsApi.checkAvailability,
    onSuccess: (data) => {
      setResult(data);
      onAvailabilityCheck?.(data);
    },
  });

  const handleCheck = () => {
    if (!itemId || !startDate || !endDate || quantity < 1) {
      return;
    }

    checkAvailabilityMutation.mutate({
      items: [
        {
          item_id: itemId,
          quantity,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
        },
      ],
      check_alternative_locations: true,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'PARTIAL':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'UNAVAILABLE':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Check Availability
        </CardTitle>
        <CardDescription>
          Verify item availability for specific dates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="item-id">Item ID</Label>
            <Input
              id="item-id"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              placeholder="Enter item ID"
            />
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <PastelCalendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <PastelCalendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Button
          onClick={handleCheck}
          disabled={checkAvailabilityMutation.isPending || !itemId || !startDate || !endDate}
          className="w-full"
        >
          {checkAvailabilityMutation.isPending ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Check Availability
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Availability Results</h4>
              <Badge
                variant={result.can_fulfill_order ? "success" : "destructive"}
              >
                {result.can_fulfill_order ? "Available" : "Limited"}
              </Badge>
            </div>

            {result.availability.map((item, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(item.availability_status)}
                    <span className="font-medium">{item.item.name}</span>
                  </div>
                  <Badge variant="outline">
                    {item.availability_status}
                  </Badge>
                </div>

                <div className="text-sm text-gray-600">
                  <p>Requested: {item.requested_quantity} | Available: {item.total_available_all_locations}</p>
                </div>

                {/* Primary Location */}
                <div className="bg-gray-50 p-2 rounded text-sm">
                  <p className="font-medium">{item.primary_location.location_name}</p>
                  <p>Available: {item.primary_location.available} | On Rent: {item.primary_location.on_rent}</p>
                </div>

                {/* Alternative Locations */}
                {item.alternative_locations.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Alternative Locations:</p>
                    {item.alternative_locations.map((location, locIndex) => (
                      <div key={locIndex} className="bg-slate-50 p-2 rounded text-sm">
                        <p className="font-medium">{location.location_name}</p>
                        <p>Available: {location.available} | Distance: {location.distance_km}km</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {item.suggestions.alternative_dates.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Alternative Dates:</p>
                    {item.suggestions.alternative_dates.map((altDate, dateIndex) => (
                      <div key={dateIndex} className="bg-yellow-50 p-2 rounded text-sm">
                        <p>{format(new Date(altDate.start_date), "PPP")} - {format(new Date(altDate.end_date), "PPP")}</p>
                        <p>Available: {altDate.available}</p>
                      </div>
                    ))}
                  </div>
                )}

                {item.suggestions.similar_items.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Similar Items:</p>
                    {item.suggestions.similar_items.map((similar, simIndex) => (
                      <div key={simIndex} className="bg-green-50 p-2 rounded text-sm">
                        <p className="font-medium">{similar.name}</p>
                        <p>Available: {similar.available} | Compatibility: {similar.compatibility}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!result.can_fulfill_order && result.partial_fulfillment_possible && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Full order cannot be fulfilled, but partial fulfillment is possible. Consider adjusting quantities or dates.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {checkAvailabilityMutation.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to check availability. Please try again.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}