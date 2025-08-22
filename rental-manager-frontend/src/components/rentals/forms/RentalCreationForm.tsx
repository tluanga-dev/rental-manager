'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarIcon, Plus, Trash2, Package, Save, ArrowLeft, AlertTriangle, IndianRupee, Calculator, CheckCircle, Clock, Truck } from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';

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
import { PriceInput } from '@/components/ui/price-input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

import { CustomerDropdown } from '@/components/customers/CustomerDropdown/CustomerDropdown';
import { LocationSelector } from '@/components/locations/location-selector';
import { RentalItemDialog } from './RentalItemDialog';
import { RentalItemsTable, type RentalItem } from './RentalItemsTable';
import { rentalsApi } from '@/services/api/rentals';
import { locationsApi } from '@/services/api/locations';
import { cn } from '@/lib/utils';
import { rentalFormSchema } from '@/lib/validations/rental';
import type { 
  CreateRentalRequest, 
  CalculateChargesResponse,
  AvailabilityResponse,
  ItemCondition,
  PeriodType,
  PaymentMethod 
} from '@/types/rentals';
import type { Location } from '@/types/location';
import type { Customer } from '@/types/customer';
import { ITEM_CONDITIONS, PERIOD_TYPES, RENTAL_STATUSES } from '@/types/rentals';

interface RentalFormValues {
  customer_id: string;
  customer?: Customer | null;
  transaction_date: Date;
  location_id: string;
  notes?: string;
  reference_number?: string;
  deposit_amount: number;
  delivery_required: boolean;
  delivery_address?: string;
  delivery_date?: Date;
  delivery_time?: string;
  pickup_required: boolean;
  pickup_date?: Date;
  pickup_time?: string;
  payment_method: PaymentMethod;
  payment_reference?: string;
  items: Array<{
    item_id: string;
    quantity: number;
    rental_period_type: PeriodType;
    rental_period_value: number;
    rental_start_date: Date;
    rental_end_date: Date;
    unit_rate: number;
    discount_type?: 'PERCENTAGE' | 'FIXED';
    discount_value?: number;
    notes?: string;
    accessories?: Array<{
      item_id: string;
      quantity: number;
      description?: string;
    }>;
  }>;
}

interface RentalCreationFormProps {
  onSuccess?: (rental: any) => void;
  onCancel?: () => void;
}

export function RentalCreationForm({ onSuccess, onCancel }: RentalCreationFormProps) {
  const router = useRouter();
  
  // State management
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [calculations, setCalculations] = useState<CalculateChargesResponse | null>(null);
  const [availabilityResponse, setAvailabilityResponse] = useState<AvailabilityResponse | null>(null);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [rentalItems, setRentalItems] = useState<RentalItem[]>([]);

  // API mutations
  const createRentalMutation = useMutation({
    mutationFn: rentalsApi.createRental,
    onSuccess: (data) => {
      if (onSuccess) {
        onSuccess(data);
      } else {
        router.push(`/rentals/${data.id}`);
      }
    },
  });

  const calculateChargesMutation = useMutation({
    mutationFn: rentalsApi.calculateCharges,
    onSuccess: setCalculations,
  });

  const checkAvailabilityMutation = useMutation({
    mutationFn: rentalsApi.checkAvailability,
    onSuccess: (data) => {
      setAvailabilityResponse(data);
      setAvailabilityStatus(data.can_fulfill_order ? 'available' : 'unavailable');
    },
  });

  // Load locations
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', 'active'],
    queryFn: () => locationsApi.list({ is_active: true }),
    select: (data) => Array.isArray(data) ? data : data?.items || [],
  });

  const form = useForm<RentalFormValues>({
    resolver: zodResolver(rentalFormSchema),
    defaultValues: {
      customer_id: '',
      customer: null,
      transaction_date: new Date(),
      location_id: '',
      notes: '',
      reference_number: '',
      deposit_amount: 0,
      delivery_required: false,
      pickup_required: false,
      payment_method: 'CREDIT_CARD',
      items: [{
        item_id: '',
        quantity: 1,
        rental_period_type: 'DAILY',
        rental_period_value: 1,
        rental_start_date: new Date(),
        rental_end_date: addDays(new Date(), 1),
        unit_rate: 0,
      }],
    },
  });

  // Availability checking
  const checkAvailability = useCallback(async () => {
    const formValues = form.getValues();
    const items = rentalItems.filter(item => item.item_id && item.quantity > 0);
    
    if (items.length === 0) return;

    setAvailabilityStatus('checking');
    
    try {
      await checkAvailabilityMutation.mutateAsync({
        items: items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          start_date: format(item.rental_start_date, 'yyyy-MM-dd'),
          end_date: format(item.rental_end_date, 'yyyy-MM-dd'),
        })),
        location_id: formValues.location_id || undefined,
        check_alternative_locations: true,
      });
    } catch (error) {
      setAvailabilityStatus('idle');
      console.error('Availability check failed:', error);
    }
  }, [form, checkAvailabilityMutation]);

  // Calculate charges
  const calculateCharges = useCallback(async () => {
    const formValues = form.getValues();
    const items = formValues.items.filter(item => item.item_id && item.quantity > 0);
    
    if (!formValues.customer_id || items.length === 0) return;

    try {
      await calculateChargesMutation.mutateAsync({
        customer_id: formValues.customer_id,
        items: items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          rental_period_type: item.rental_period_type,
          rental_period_value: item.rental_period_value,
          rental_start_date: format(item.rental_start_date, 'yyyy-MM-dd'),
          rental_end_date: format(item.rental_end_date, 'yyyy-MM-dd'),
          discount_type: item.discount_type,
          discount_value: item.discount_value,
        })),
        delivery_required: formValues.delivery_required,
        pickup_required: formValues.pickup_required,
        apply_tax: true,
      });
    } catch (error) {
      console.error('Charge calculation failed:', error);
    }
  }, [form, calculateChargesMutation]);

  // Auto-trigger availability check and charge calculation when items change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name?.includes('items') || name === 'customer_id') {
        const timeoutId = setTimeout(() => {
          checkAvailability();
          calculateCharges();
        }, 500); // Debounce
        return () => clearTimeout(timeoutId);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, checkAvailability, calculateCharges]);

  // Sync selectedCustomer with form state
  useEffect(() => {
    if (selectedCustomer) {
      form.setValue('customer', selectedCustomer);
    }
  }, [selectedCustomer, form]);

  const onSubmit = async (values: RentalFormValues) => {
    try {
      // Log customer data to verify it's stored in form state
      console.log('Selected customer in form state:', values.customer);
      
      const requestData: CreateRentalRequest = {
        customer_id: values.customer_id,
        transaction_date: format(values.transaction_date, 'yyyy-MM-dd'),
        location_id: values.location_id,
        notes: values.notes,
        reference_number: values.reference_number,
        deposit_amount: values.deposit_amount,
        delivery_required: values.delivery_required,
        delivery_address: values.delivery_address,
        delivery_date: values.delivery_date ? format(values.delivery_date, 'yyyy-MM-dd') : undefined,
        delivery_time: values.delivery_time,
        pickup_required: values.pickup_required,
        pickup_date: values.pickup_date ? format(values.pickup_date, 'yyyy-MM-dd') : undefined,
        pickup_time: values.pickup_time,
        items: values.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          rental_period_type: item.rental_period_type,
          rental_period_value: item.rental_period_value,
          rental_start_date: format(item.rental_start_date, 'yyyy-MM-dd'),
          rental_end_date: format(item.rental_end_date, 'yyyy-MM-dd'),
          unit_rate: item.unit_rate,
          discount_type: item.discount_type,
          discount_value: item.discount_value,
          notes: item.notes,
          accessories: item.accessories,
        })),
        payment_method: values.payment_method,
        payment_reference: values.payment_reference,
      };

      await createRentalMutation.mutateAsync(requestData);
    } catch (error) {
      console.error('Rental creation failed:', error);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const addItem = () => {
    append({
      item_id: '',
      quantity: 1,
      rental_period_type: 'DAILY',
      rental_period_value: 1,
      rental_start_date: new Date(),
      rental_end_date: addDays(new Date(), 1),
      unit_rate: 0,
    });
  };

  // Item management functions
  const handleAddItem = (newItem: any) => {
    const rentalItem: RentalItem = {
      item_id: newItem.item_id || '',
      quantity: newItem.quantity || 1,
      rental_start_date: newItem.rental_start_date || new Date(),
      rental_end_date: newItem.rental_end_date || new Date(),
      rental_period_type: newItem.rental_period_type || 'DAILY',
      rental_period_value: newItem.rental_period_value || 1,
      unit_rate: newItem.unit_rate || 0,
      discount_value: newItem.discount_value || 0,
      notes: newItem.notes || ''
    };
    
    setRentalItems(prev => [...prev, rentalItem]);
    // Also update the form state
    const currentItems = form.getValues('items') || [];
    form.setValue('items', [...currentItems, {
      item_id: rentalItem.item_id,
      quantity: rentalItem.quantity,
      rental_period_type: rentalItem.rental_period_type as PeriodType,
      rental_period_value: rentalItem.rental_period_value,
      rental_start_date: rentalItem.rental_start_date,
      rental_end_date: rentalItem.rental_end_date,
      unit_rate: rentalItem.unit_rate,
      discount_value: rentalItem.discount_value,
      notes: rentalItem.notes
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setRentalItems(prev => prev.filter((_, i) => i !== index));
    // Also update the form state
    const currentItems = form.getValues('items') || [];
    form.setValue('items', currentItems.filter((_, i) => i !== index));
  };

  const getRentalDays = (startDate: Date, endDate: Date) => {
    return Math.max(1, differenceInDays(endDate, startDate));
  };

  const getAvailabilityBadge = () => {
    switch (availabilityStatus) {
      case 'checking':
        return (
          <Badge variant="secondary" className="gap-2">
            <Clock className="w-3 h-3 animate-spin" />
            Checking...
          </Badge>
        );
      case 'available':
        return (
          <Badge variant="success" className="gap-2">
            <CheckCircle className="w-3 h-3" />
            Available
          </Badge>
        );
      case 'unavailable':
        return (
          <Badge variant="destructive" className="gap-2">
            <AlertTriangle className="w-3 h-3" />
            Unavailable
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Rental</h1>
          <p className="text-gray-600 mt-1">Create a new rental transaction with availability checking</p>
        </div>
        <div className="flex items-center gap-4">
          {getAvailabilityBadge()}
          <Button variant="outline" onClick={handleCancel}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Customer and Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Rental Information
              </CardTitle>
              <CardDescription>
                Select customer, location, and set rental dates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer *</FormLabel>
                      <FormControl>
                        <CustomerDropdown
                          value={field.value}
                          onChange={(value, customer) => {
                            field.onChange(value);
                            form.setValue('customer', customer);
                            setSelectedCustomer(customer);
                          }}
                          placeholder="Select a customer"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select pickup location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name} ({location.location_code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transaction_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="reference_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Optional reference number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deposit_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Security Deposit</FormLabel>
                      <FormControl>
                        <PriceInput
                          {...field}
                          onChange={(value) => field.onChange(value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Delivery & Pickup Options */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Delivery & Pickup
                </CardTitle>
                
                {/* Delivery & Pickup switches inline with title */}
                <div className="flex items-center gap-4">
                  <FormField
                    control={form.control}
                    name="delivery_required"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2">
                        <FormLabel className="text-sm font-medium">Delivery</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pickup_required"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2">
                        <FormLabel className="text-sm font-medium">Pickup</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Delivery details - compact row layout */}
              {form.watch('delivery_required') && (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="delivery_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Address *</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Enter delivery address" className="min-h-[60px]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="delivery_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Date *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <PastelCalendar
                                value={field.value}
                                onChange={field.onChange}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="delivery_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Time *</FormLabel>
                          <FormControl>
                            <Input {...field} type="time" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Pickup details - compact row layout */}
              {form.watch('pickup_required') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="pickup_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pickup Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <PastelCalendar
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pickup_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pickup Time *</FormLabel>
                        <FormControl>
                          <Input {...field} type="time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rental Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Rental Items
                  {availabilityResponse && (
                    <Badge variant={availabilityResponse.can_fulfill_order ? "outline" : "destructive"}>
                      {availabilityResponse.can_fulfill_order ? "Available" : "Limited Availability"}
                    </Badge>
                  )}
                </span>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsItemDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </CardTitle>
              <CardDescription>
                Manage rental items with quantities, rates, and dates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RentalItemsTable 
                items={rentalItems}
                onRemoveItem={handleRemoveItem}
              />
            </CardContent>
          </Card>

          {/* Rental Item Dialog */}
          <RentalItemDialog
            isOpen={isItemDialogOpen}
            onOpenChange={setIsItemDialogOpen}
            onAddItem={handleAddItem}
          />

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                          <SelectItem value="CHECK">Check</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Reference</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Transaction ID, check number, etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Pricing Summary */}
              {calculations && (
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Pricing Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{calculations.summary.items_subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span>-₹{calculations.summary.total_discount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax ({calculations.summary.tax_rate}%):</span>
                      <span>₹{calculations.summary.tax_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery:</span>
                      <span>₹{calculations.summary.delivery_charge.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2 col-span-2">
                      <span>Total:</span>
                      <span>₹{calculations.summary.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-semibold col-span-2">
                      <span>Suggested Deposit:</span>
                      <span>₹{calculations.summary.suggested_deposit.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Any additional notes or special instructions..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit Actions */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createRentalMutation.isPending || availabilityStatus === 'unavailable'}
            >
              <Save className="w-4 h-4 mr-2" />
              {createRentalMutation.isPending ? 'Creating...' : 'Create Rental'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}