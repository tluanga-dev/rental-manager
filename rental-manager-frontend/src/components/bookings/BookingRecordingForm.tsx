'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { CalendarIcon, Plus, Trash2, Package, Save, ArrowLeft, AlertTriangle, Check, X, Clock } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PastelCalendar } from '@/components/ui/pastel-calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

import { CustomerDropdown } from '@/components/customers/CustomerDropdown';
import { LocationSelector } from '@/components/locations/location-selector';
import { ItemDropdown } from '@/components/items/ItemDropdown';
import { cn } from '@/lib/utils';
import { useBookingAvailability } from '@/hooks/useBookingAvailability';
import { useCreateBooking } from '@/hooks/useBookings';

// Types
export type RentalPeriodUnit = 'DAYS' | 'WEEKS' | 'MONTHS';

export interface AvailabilityStatus {
  is_available: boolean;
  available_quantity: number;
  total_quantity: number;
  conflicts: Array<{
    booking_id: string;
    quantity: number;
    start_date: string;
    end_date: string;
  }>;
  suggestions?: Array<{
    start_date: string;
    end_date: string;
  }>;
}

const bookingItemSchema = z.object({
  item_id: z.string().min(1, 'Item is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  rental_period_value: z.number().min(1, 'Rental period must be at least 1'),
  rental_period_unit: z.enum(['DAYS', 'WEEKS', 'MONTHS']),
  unit_rate: z.number().min(0, 'Rate must be positive'),
  notes: z.string().optional(),
  availability_status: z.any().optional(), // Will be populated after checking
});

const bookingFormSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  location_id: z.string().min(1, 'Location is required'),
  booking_date: z.date(),
  start_date: z.date(),
  end_date: z.date(),
  notes: z.string().optional(),
  deposit_amount: z.number().min(0, 'Deposit cannot be negative'),
  items: z.array(bookingItemSchema).min(1, 'At least one item is required'),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

interface BookingRecordingFormProps {
  onSuccess?: (booking: any) => void;
  onCancel?: () => void;
}

export function BookingRecordingForm({ onSuccess, onCancel }: BookingRecordingFormProps) {
  const router = useRouter();
  const { createBooking, isCreating } = useCreateBooking();
  
  // Use the availability hook
  const {
    availabilityMap,
    isChecking: checkingAvailability,
    checkAvailability: checkItemsAvailability,
    getItemAvailability,
    isAllAvailable,
  } = useBookingAvailability();
  
  const [selectedItems, setSelectedItems] = useState<Record<number, any>>({});
  
  // Financial calculations
  const [financialSummary, setFinancialSummary] = useState({
    subtotal: 0,
    deposit: 0,
    total: 0,
  });

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      customer_id: '',
      location_id: '',
      booking_date: new Date(),
      start_date: new Date(),
      end_date: addDays(new Date(), 7),
      notes: '',
      deposit_amount: 0,
      items: [
        {
          item_id: '',
          quantity: 1,
          rental_period_value: 7,
          rental_period_unit: 'DAYS',
          unit_rate: 0,
          notes: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Calculate rental days
  const calculateRentalDays = () => {
    const startDate = form.watch('start_date');
    const endDate = form.watch('end_date');
    if (!startDate || !endDate) return 0;
    return differenceInDays(endDate, startDate) + 1;
  };

  // Check availability for all items
  const checkAvailability = async () => {
    const items = form.getValues('items');
    const startDate = form.getValues('start_date');
    const endDate = form.getValues('end_date');
    const locationId = form.getValues('location_id');

    // Filter out items without IDs
    const validItems = (items || [])
      .filter(item => item.item_id)
      .map(item => ({
        item_id: item.item_id,
        quantity: item.quantity
      }));

    if (validItems.length === 0) {
      return;
    }

    if (!locationId) {
      form.setError('location_id', { message: 'Please select a location first' });
      return;
    }

    // Call the availability check
    await checkItemsAvailability(validItems, startDate, endDate, locationId);
  };

  // Calculate financial summary
  useEffect(() => {
    const items = form.watch('items');
    const startDate = form.watch('start_date');
    const endDate = form.watch('end_date');
    
    if (!startDate || !endDate) return;

    const days = differenceInDays(endDate, startDate) + 1;
    let subtotal = 0;

    items.forEach(item => {
      if (item.unit_rate && item.quantity) {
        // Calculate based on rental period unit
        let periods = 1;
        switch (item.rental_period_unit) {
          case 'DAYS':
            periods = Math.ceil(days / item.rental_period_value);
            break;
          case 'WEEKS':
            periods = Math.ceil(days / (item.rental_period_value * 7));
            break;
          case 'MONTHS':
            periods = Math.ceil(days / (item.rental_period_value * 30));
            break;
        }
        subtotal += item.unit_rate * item.quantity * periods;
      }
    });

    const deposit = subtotal * 0.2; // 20% deposit
    
    setFinancialSummary({
      subtotal,
      deposit,
      total: subtotal,
    });

    // Auto-update deposit field
    form.setValue('deposit_amount', deposit);
  }, [form.watch('items'), form.watch('start_date'), form.watch('end_date')]);

  // Check availability when dates or items change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name?.startsWith('items') || name === 'start_date' || name === 'end_date') {
        const hasItems = value.items?.some(item => item?.item_id);
        if (hasItems && value.start_date && value.end_date) {
          checkAvailability();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const onSubmit = async (values: BookingFormValues) => {
    try {
      // Transform data for API
      const bookingData = {
        customer_id: values.customer_id,
        location_id: values.location_id,
        start_date: format(values.start_date, 'yyyy-MM-dd'),
        end_date: format(values.end_date, 'yyyy-MM-dd'),
        notes: values.notes,
        deposit_paid: values.deposit_amount > 0,
        items: values.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          rental_period: item.rental_period_value,
          rental_period_unit: item.rental_period_unit,
          unit_rate: item.unit_rate,
          discount_amount: 0,
          notes: item.notes,
        })),
      };

      console.log('Creating booking:', bookingData);
      
      // Call actual API
      const result = await createBooking(bookingData);
      
      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push('/bookings');
      }
    } catch (error) {
      console.error('Failed to create booking:', error);
    }
  };

  const getAvailabilityBadge = (itemId: string, quantity: number) => {
    const status = getItemAvailability(itemId);
    if (!status) return null;

    if (status.is_available && status.available_quantity >= quantity) {
      return (
        <Badge variant="outline" className="border-green-500 text-green-700">
          <Check className="w-3 h-3 mr-1" />
          Available ({status.available_quantity}/{status.total_quantity})
        </Badge>
      );
    } else if (status.available_quantity > 0) {
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-700">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Limited ({status.available_quantity}/{status.total_quantity})
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="border-red-500 text-red-700">
          <X className="w-3 h-3 mr-1" />
          Not Available
        </Badge>
      );
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Customer & Location Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer & Location</CardTitle>
            <CardDescription>
              Select the customer and pickup location
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {/* Customer Selection */}
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <FormControl>
                    <CustomerDropdown
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select customer"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location Selection */}
            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <LocationSelector
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Date Selection Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rental Period</CardTitle>
            <CardDescription>
              Select the rental start and end dates
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            {/* Start Date */}
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <PastelCalendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Date */}
            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <PastelCalendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < form.getValues('start_date')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rental Duration Display */}
            <div className="flex items-end">
              <div className="w-full p-2 border rounded-md bg-muted">
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-lg font-semibold">{calculateRentalDays()} days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Booking Items</CardTitle>
                <CardDescription>
                  Add items to the booking with quantities and rental periods
                </CardDescription>
              </div>
              {checkingAvailability && (
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1 animate-spin" />
                  Checking availability...
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
                <div className="col-span-3">Item</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-2">Period</div>
                <div className="col-span-2">Rate</div>
                <div className="col-span-2">Availability</div>
                <div className="col-span-1">Total</div>
                <div className="col-span-1"></div>
              </div>

              <Separator />

              {/* Item Rows */}
              {fields.map((field, index) => {
                const item = form.watch(`items.${index}`);
                const days = calculateRentalDays();
                let periods = 1;
                
                switch (item?.rental_period_unit) {
                  case 'DAYS':
                    periods = Math.ceil(days / (item.rental_period_value || 1));
                    break;
                  case 'WEEKS':
                    periods = Math.ceil(days / ((item.rental_period_value || 1) * 7));
                    break;
                  case 'MONTHS':
                    periods = Math.ceil(days / ((item.rental_period_value || 1) * 30));
                    break;
                }
                
                const lineTotal = (item?.unit_rate || 0) * (item?.quantity || 0) * periods;

                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                    {/* Item Selection */}
                    <div className="col-span-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.item_id`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <ItemDropdown
                                value={field.value}
                                onChange={(value) => {
                                  field.onChange(value);
                                  // Update selected items tracking
                                  if (value) {
                                    const item = { id: value, name: 'Item' }; // Get actual item data
                                    setSelectedItems(prev => ({ ...prev, [index]: item }));
                                  }
                                }}
                                placeholder="Select item"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Quantity */}
                    <div className="col-span-1">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                {...field}
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Period */}
                    <div className="col-span-2 flex gap-1">
                      <FormField
                        control={form.control}
                        name={`items.${index}.rental_period_value`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                {...field}
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.rental_period_unit`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="DAYS">Days</SelectItem>
                                <SelectItem value="WEEKS">Weeks</SelectItem>
                                <SelectItem value="MONTHS">Months</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Rate */}
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.unit_rate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Availability Status */}
                    <div className="col-span-2 flex items-center">
                      {item?.item_id && getAvailabilityBadge(item.item_id, item.quantity || 1)}
                    </div>

                    {/* Line Total */}
                    <div className="col-span-1 flex items-center">
                      <span className="font-medium">${lineTotal.toFixed(2)}</span>
                    </div>

                    {/* Remove Button */}
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Add Item Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({
                  item_id: '',
                  quantity: 1,
                  rental_period_value: 7,
                  rental_period_unit: 'DAYS',
                  unit_rate: 0,
                  notes: '',
                })}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">${financialSummary.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Required Deposit (20%):</span>
                <span className="font-medium">${financialSummary.deposit.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total:</span>
                <span>${financialSummary.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Deposit Amount Input */}
            <div className="mt-4">
              <FormField
                control={form.control}
                name="deposit_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the deposit amount collected from the customer
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional notes about this booking..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onCancel ? onCancel() : router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => checkAvailability()}
              disabled={checkingAvailability}
            >
              {checkingAvailability ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Check Availability
                </>
              )}
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              Create Booking
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}