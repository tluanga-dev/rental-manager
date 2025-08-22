'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Package, 
  IndianRupee,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import axios from '@/lib/axios';
import { toast } from 'sonner';
import { PeriodBasedExtension, PeriodType } from '@/components/extension/PeriodBasedExtension';
import { AvailabilityStatus, ConflictInfo } from '@/components/extension/AvailabilityStatus';
import { rentalExtensionService } from '@/services/api/rental-extensions';

interface RentalItem {
  line_id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  rental_end_date: string;
  daily_rate?: number;
  rental_period?: number; // Number of days in the rental period from item master
  rental_period_value?: number; // Alternative field name for rental period
  rental_period_unit?: string; // Unit type (DAY, WEEK, MONTH)
  rental_rate?: {
    unit_rate: number;
    period_value: number;
    period_type: string;
  };
  sku?: string;
  category?: string;
}

interface RentalDetails {
  id: string;
  transaction_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  rental_start_date: string;
  rental_end_date: string;
  total_amount: number;
  paid_amount: number;
  extension_count: number;
  rental_status?: string;
  items: RentalItem[];
}

export default function SimplifiedRentalExtensionPage() {
  const router = useRouter();
  const params = useParams();
  const rentalId = params.id as string;

  // State management
  const [rental, setRental] = useState<RentalDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Extension state
  const [periodCount, setPeriodCount] = useState<number>(1);
  const [periodType, setPeriodType] = useState<PeriodType>('DAY');
  const [calculatedEndDate, setCalculatedEndDate] = useState<string>('');
  const [totalDays, setTotalDays] = useState<number>(0);
  const [calculatedRate, setCalculatedRate] = useState<number>(0);
  const [userHasInteracted, setUserHasInteracted] = useState<boolean>(false);
  
  // Availability state
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const checkDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch rental details on mount
  useEffect(() => {
    if (rentalId) {
      fetchRentalDetails();
    }
  }, [rentalId]);

  const fetchRentalDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/transactions/rentals/${rentalId}`);
      const rentalData = response.data.data;
      
      // Ensure items have daily rates and rental periods
      const itemsWithRates = rentalData.items.map((item: RentalItem) => ({
        ...item,
        daily_rate: item.daily_rate || item.unit_price || 0,
        rental_period: item.rental_period || item.rental_period_value || item.rental_rate?.period_value || 1
      }));
      
      setRental({
        ...rentalData,
        items: itemsWithRates
      });
      
      setError(null);
    } catch (err: any) {
      console.error('Error fetching rental:', err);
      setError(err.response?.data?.detail || 'Failed to load rental details');
      toast.error('Failed to load rental details');
    } finally {
      setLoading(false);
    }
  };

  // Get the rental period (in days) from the first item
  // Assuming all items have the same rental period for simplicity
  const getRentalPeriodDays = useCallback(() => {
    if (!rental || rental.items.length === 0) return 1;
    const firstItem = rental.items[0];
    return firstItem.rental_period || firstItem.rental_period_value || firstItem.rental_rate?.period_value || 1;
  }, [rental]);

  // Calculate total rate for one period from all items
  const calculateTotalPeriodRate = useCallback(() => {
    if (!rental) return 0;
    const periodDays = getRentalPeriodDays();
    return rental.items.reduce((total, item) => {
      const itemDailyRate = item.daily_rate || item.unit_price || 0;
      // Rate for one period = daily rate * period days * quantity
      return total + (itemDailyRate * periodDays * item.quantity);
    }, 0);
  }, [rental, getRentalPeriodDays]);

  // Check availability for the selected period
  const checkAvailability = useCallback(async (endDate: string) => {
    if (!rental || !endDate) {
      console.log('Skipping availability check - missing rental or endDate');
      return;
    }
    
    // Validate date format
    const endDateObj = new Date(endDate);
    if (isNaN(endDateObj.getTime())) {
      console.error('Invalid end date format:', endDate);
      toast.error('Invalid date format. Please try again.');
      return;
    }
    
    try {
      setIsChecking(true);
      setIsAvailable(null);
      setConflicts([]);
      
      // Log the request for debugging
      console.log('Checking availability:', { 
        rentalId, 
        endDate,
        currentEndDate: rental.rental_end_date 
      });
      
      const response = await rentalExtensionService.checkAvailability(
        rentalId,
        endDate
      );
      
      console.log('Availability response:', response);
      setIsAvailable(response.can_extend);
      
      // Process conflicts if any
      if (!response.can_extend && response.items) {
        const conflictList: ConflictInfo[] = response.items
          .filter((item: any) => item.has_conflict)
          .map((item: any) => ({
            item_id: item.item_id,
            item_name: item.item_name,
            conflicting_rental_id: '', // Backend should provide this
            conflicting_customer: 'Another customer', // Backend should provide this
            conflict_start: item.current_end_date || '',
            conflict_end: endDate
          }));
        setConflicts(conflictList);
      }
    } catch (err: any) {
      // More detailed error logging
      console.error('Availability check failed:', {
        error: err,
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });
      
      // Don't automatically set unavailable on server error
      if (err.response?.status === 500) {
        toast.error('Server error checking availability. Please try again later.');
        setIsAvailable(null); // Reset to null, not false
      } else if (err.response?.status === 404) {
        toast.error('Rental not found. Please refresh the page.');
        setIsAvailable(null);
      } else {
        setIsAvailable(false);
        toast.error(err.response?.data?.detail || 'Failed to check availability');
      }
    } finally {
      setIsChecking(false);
    }
  }, [rental, rentalId]);

  // Handle period change with debounced availability check
  const handlePeriodChange = useCallback((periods: number, type: PeriodType, endDate: string) => {
    // Mark that user has interacted
    if (!userHasInteracted) {
      setUserHasInteracted(true);
    }
    
    setPeriodCount(periods);
    setPeriodType(type);
    setCalculatedEndDate(endDate);
    
    // Get the rental period in days from item master
    const periodDays = getRentalPeriodDays();
    
    // Calculate total days based on number of periods
    // Total extension days = number of periods * days per period
    const totalDays = periods * periodDays;
    setTotalDays(totalDays);
    
    // Calculate rate
    // Total rate = rate per period * number of periods
    const periodRate = calculateTotalPeriodRate();
    const totalRate = periodRate * periods;
    setCalculatedRate(totalRate);
    
    // Clear previous timer and set new one
    if (checkDebounceTimerRef.current) {
      clearTimeout(checkDebounceTimerRef.current);
    }
    
    // Only check availability if user has interacted and we have valid data
    if (endDate && periods > 0) {
      checkDebounceTimerRef.current = setTimeout(() => {
        checkAvailability(endDate);
      }, 500); // 500ms debounce
    }
  }, [rental, getRentalPeriodDays, calculateTotalPeriodRate, checkAvailability, userHasInteracted]);


  // Process the extension
  const processExtension = async () => {
    if (!rental || !isAvailable || !calculatedEndDate) {
      toast.error('Please ensure all requirements are met');
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Prepare extension request
      const extensionRequest = {
        new_end_date: calculatedEndDate,
        items: rental.items.map(item => ({
          line_id: item.line_id,
          action: 'EXTEND' as const,
          extend_quantity: item.quantity,
          new_end_date: calculatedEndDate
        })),
        payment_option: 'PAY_LATER' as const,
        notes: `Extension for ${totalDays} days (${periodCount} ${periodType.toLowerCase()}${periodCount > 1 ? 's' : ''})`
      };
      
      const response = await rentalExtensionService.processExtension(
        rentalId,
        extensionRequest
      );
      
      if (response.success) {
        toast.success('Rental extended successfully!');
        
        // Redirect to rental details page
        setTimeout(() => {
          router.push(`/rentals/${rentalId}`);
        }, 1000);
      }
    } catch (err: any) {
      console.error('Extension processing error:', err);
      toast.error(err.response?.data?.detail || 'Failed to process extension');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkDebounceTimerRef.current) {
        clearTimeout(checkDebounceTimerRef.current);
      }
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Error state
  if (error && !rental) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600 mb-4">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Error Loading Rental</span>
            </div>
            <p className="text-gray-600">{error}</p>
            <Button 
              variant="outline" 
              onClick={() => router.back()}
              className="mt-4"
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!rental) return null;

  const totalItems = rental.items.reduce((sum, item) => sum + item.quantity, 0);
  const periodDays = getRentalPeriodDays();
  const periodRate = calculateTotalPeriodRate();
  const extensionStartDate = addDays(new Date(rental.rental_end_date), 1);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 hover:bg-gray-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Rental Details
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Extend Rental
            </h1>
            <p className="text-gray-600 mt-1">
              #{rental.transaction_number}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Customer</p>
            <p className="font-medium">{rental.customer_name}</p>
          </div>
        </div>
      </div>

      {/* Current Rental Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Current Rental Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Current End Date</p>
              <p className="font-medium">{format(new Date(rental.rental_end_date), 'MMM dd, yyyy')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="font-medium">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Rate per Period ({periodDays} days)</p>
              <p className="font-medium">₹{periodRate.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Extensions</p>
              <p className="font-medium">{rental.extension_count} time{rental.extension_count !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period Selection */}
      <PeriodBasedExtension
        currentEndDate={rental.rental_end_date}
        originalDailyRate={periodRate / periodDays} // Daily rate for display
        periodDays={periodDays}
        periodRate={periodRate}
        itemCount={totalItems}
        onPeriodChange={handlePeriodChange}
        className="mb-6"
      />

      {/* Availability Status */}
      <AvailabilityStatus
        checking={isChecking}
        available={isAvailable}
        conflicts={conflicts}
        calculatedRate={calculatedRate}
        periodDetails={{
          startDate: format(extensionStartDate, 'yyyy-MM-dd'),
          endDate: calculatedEndDate,
          totalDays: totalDays
        }}
        itemCount={totalItems}
        className="mb-6"
      />

      {/* Items Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Items to Extend ({rental.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rental.items.map((item) => (
              <div 
                key={item.line_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.item_name}</p>
                  {item.sku && (
                    <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium">Qty: {item.quantity}</p>
                  <p className="text-sm text-gray-500">
                    ₹{(item.daily_rate || item.unit_price || 0).toFixed(2)}/day
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between items-center sticky bottom-0 bg-white py-4 border-t">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        
        <div className="flex items-center gap-3">
          {isAvailable && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Available</span>
            </div>
          )}
          
          <Button
            onClick={processExtension}
            disabled={!isAvailable || isChecking || isProcessing || !calculatedEndDate}
            className="min-w-[200px]"
          >
            {isProcessing ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Processing...
              </>
            ) : (
              <>
                <IndianRupee className="w-4 h-4 mr-1" />
                Extend for ₹{calculatedRate.toFixed(2)}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}