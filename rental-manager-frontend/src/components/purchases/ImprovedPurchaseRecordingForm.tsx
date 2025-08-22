'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { CalendarIcon, Plus, Save, ArrowLeft, AlertTriangle, Package2, Package } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PastelCalendar } from '@/components/ui/pastel-calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorDialog } from '@/components/dialogs/error-dialog';

import { SupplierDropdown } from '@/components/suppliers/SupplierDropdown/SupplierDropdown';
import { PurchaseItemsTable } from '@/components/purchases/PurchaseItemsTable';
import { PurchaseItemForm } from '@/components/purchases/PurchaseItemForm';
import { LocationSelector } from '@/components/locations/location-selector';
import { useCreatePurchase } from '@/hooks/use-purchases';
import { locationsApi } from '@/services/api/locations';
import { PurchaseValidator } from '@/lib/purchase-validation';
import { cn } from '@/lib/utils';
import type { ItemCondition, PurchaseFormData } from '@/types/purchases';
import type { Location } from '@/types/location';

const purchaseItemSchema = z.object({
  item_id: z.string().min(1, 'Item is required'),
  item_name: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_cost: z.number().min(0, 'Unit cost must be positive'),
  tax_rate: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  discount_amount: z.number().min(0, 'Discount amount cannot be negative'),
  condition: z.enum(['A', 'B', 'C', 'D']),
  notes: z.string().optional(),
  serial_numbers: z.array(z.string()).optional(),
  serial_number_required: z.boolean().optional(),
});

const purchaseFormSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier is required'),
  location_id: z.string().min(1, 'Location is required'),
  purchase_date: z.date(),
  notes: z.string().optional(),
  reference_number: z.string().optional(),
  payment_status: z.enum(['PENDING', 'PAID', 'PARTIAL']).default('PAID'),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
});

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;
type PurchaseItem = z.infer<typeof purchaseItemSchema>;

interface ImprovedPurchaseRecordingFormProps {
  onSuccess?: (purchase: any) => void;
  onCancel?: () => void;
}

export function ImprovedPurchaseRecordingForm({ onSuccess, onCancel }: ImprovedPurchaseRecordingFormProps) {
  const router = useRouter();
  const createPurchase = useCreatePurchase();

  // State for options
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  
  // State for item management
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [formResetTrigger, setFormResetTrigger] = useState(false);
  
  // State for validation
  const [formValidation, setFormValidation] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>({ isValid: true, errors: [], warnings: [] });
  
  // State for error handling
  const [errorDialog, setErrorDialog] = useState({
    open: false,
    error: null as any,
    requestId: '',
    timestamp: '',
    endpoint: ''
  });
  
  const [selectedSupplier, setSelectedSupplier] = useState<any>();

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      supplier_id: '',
      location_id: '',
      purchase_date: new Date(),
      notes: '',
      reference_number: '',
      payment_status: 'PAID',
      items: [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Calculation functions for purchase totals
  const calculateTotalTaxAmount = () => {
    return fields.reduce((sum, item) => {
      const subtotal = item.quantity * item.unit_cost;
      const discount = item.discount_amount || 0;
      const taxableAmount = subtotal - discount;
      const taxAmount = taxableAmount * ((item.tax_rate || 0) / 100);
      return sum + taxAmount;
    }, 0);
  };

  const calculateAggregatedDiscountAmount = () => {
    return fields.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
  };

  const calculateTotalAmount = () => {
    return fields.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const calculateGrandTotal = () => {
    const totalAmount = calculateTotalAmount();
    const taxAmount = calculateTotalTaxAmount();
    const discountAmount = calculateAggregatedDiscountAmount();
    return totalAmount + taxAmount - discountAmount;
  };

  // Load options on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        setLoadingOptions(true);
        const locationsData = await locationsApi.list({ is_active: true });
        const locationsArray = Array.isArray(locationsData) ? locationsData : locationsData?.items || [];
        setLocations(locationsArray);
      } catch (error) {
        console.error('Failed to load options:', error);
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, []);

  const onSubmit = async (values: PurchaseFormValues) => {
    if (!formValidation.isValid && formValidation.errors.length > 0) {
      console.warn('Form has validation errors:', formValidation.errors);
      return;
    }

    const requestTimestamp = new Date().toISOString();
    const endpoint = 'POST /api/transactions/purchases/new';
    
    try {
      // ==============================
      // 🚀 COMPREHENSIVE REQUEST LOGGING
      // ==============================
      console.group('🚀 === PURCHASE FORM SUBMISSION START ===');
      console.log(`⏰ Timestamp: ${requestTimestamp}`);
      console.log(`🌐 Endpoint: ${endpoint}`);
      console.log(`📋 Raw Form Values:`, JSON.stringify(values, null, 2));
      
      console.groupCollapsed('📊 Form Fields Detailed Analysis');
      console.log('🔸 Supplier Information:');
      console.log(`  - Supplier ID: ${values.supplier_id}`);
      console.log(`  - Selected Supplier:`, selectedSupplier);
      console.log('🔸 Location Information:');
      console.log(`  - Location ID: ${values.location_id}`);
      console.log('🔸 Transaction Details:');
      console.log(`  - Purchase Date: ${values.purchase_date}`);
      console.log(`  - Reference Number: ${values.reference_number || 'None'}`);
      console.log(`  - Payment Status: ${values.payment_status}`);
      console.log(`  - Notes: ${values.notes || 'None'}`);
      console.log('🔸 Items Analysis:');
      console.log(`  - Number of Items: ${values.items.length}`);
      values.items.forEach((item, index) => {
        console.log(`  📦 Item ${index + 1}:`, {
          item_id: item.item_id,
          item_name: item.item_name,
          sku: item.sku,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          tax_rate: item.tax_rate,
          discount_amount: item.discount_amount,
          condition: item.condition,
          serial_numbers: item.serial_numbers
        });
      });
      console.groupEnd();

      console.groupCollapsed('💰 Financial Calculations');
      const subtotal = calculateTotalAmount();
      const totalTax = calculateTotalTaxAmount();
      const totalDiscount = calculateAggregatedDiscountAmount();
      const grandTotal = calculateGrandTotal();
      
      console.log(`💵 Subtotal (all items): ₹${subtotal.toFixed(2)}`);
      console.log(`🧾 Total Tax: ₹${totalTax.toFixed(2)}`);
      console.log(`💸 Total Discount: ₹${totalDiscount.toFixed(2)}`);
      console.log(`🏆 GRAND TOTAL: ₹${grandTotal.toFixed(2)}`);
      
      // Individual item calculations
      values.items.forEach((item, index) => {
        const itemTotal = item.quantity * item.unit_cost;
        const itemTax = (itemTotal - (item.discount_amount || 0)) * ((item.tax_rate || 0) / 100);
        const itemGrandTotal = itemTotal + itemTax - (item.discount_amount || 0);
        
        console.log(`💳 Item ${index + 1} Financial Breakdown:`, {
          subtotal: `₹${itemTotal.toFixed(2)}`,
          tax: `₹${itemTax.toFixed(2)}`,
          discount: `₹${(item.discount_amount || 0).toFixed(2)}`,
          total: `₹${itemGrandTotal.toFixed(2)}`
        });
      });
      console.groupEnd();

      // Fix the payload structure to match API specification
      const formData: PurchaseFormData = {
        supplier_id: values.supplier_id,
        location_id: values.location_id,
        purchase_date: format(values.purchase_date, 'yyyy-MM-dd'),
        reference_number: values.reference_number,
        notes: values.notes,
        payment_status: values.payment_status,
        items: values.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          tax_rate: item.tax_rate || 0,
          discount_amount: item.discount_amount || 0,
          condition: item.condition as ItemCondition,
          notes: item.notes,
          serial_numbers: item.serial_numbers || undefined,
        })),
      };

      console.groupCollapsed('📦 Final API Payload');
      console.log('🔥 Complete JSON Payload being sent to API:');
      console.log(JSON.stringify(formData, null, 2));
      console.log('📝 Payload Validation:');
      console.log(`  ✅ Supplier ID: ${formData.supplier_id ? 'Valid' : '❌ Missing'}`);
      console.log(`  ✅ Location ID: ${formData.location_id ? 'Valid' : '❌ Missing'}`);
      console.log(`  ✅ Purchase Date: ${formData.purchase_date ? 'Valid' : '❌ Missing'}`);
      console.log(`  ✅ Items Count: ${formData.items.length} items`);
      formData.items.forEach((item, index) => {
        console.log(`  📋 Item ${index + 1} validation:`, {
          item_id: item.item_id ? '✅ Valid' : '❌ Missing',
          quantity: item.quantity > 0 ? '✅ Valid' : '❌ Invalid',
          unit_cost: item.unit_cost >= 0 ? '✅ Valid' : '❌ Invalid',
          condition: item.condition ? '✅ Valid' : '❌ Missing'
        });
      });
      console.groupEnd();

      console.log('🌐 Making API Request...');
      console.groupEnd();

      // Make the API request
      const result = await createPurchase.mutateAsync(formData);
      
      // ==============================
      // ✅ SUCCESS LOGGING
      // ==============================
      console.group('✅ === PURCHASE CREATION SUCCESS ===');
      console.log(`⏰ Completion Time: ${new Date().toISOString()}`);
      console.log(`🎉 Server Response:`, JSON.stringify(result, null, 2));
      console.log(`📋 Created Purchase ID: ${result?.id || 'N/A'}`);
      console.log(`🔗 Transaction Reference: ${result?.reference_number || 'N/A'}`);
      console.log(`💰 Final Amount: ₹${result?.total_amount || 'N/A'}`);
      
      if (result?.id) {
        console.log(`🌐 Direct Link: ${window.location.origin}/purchases/history/${result.id}`);
      }
      console.groupEnd();
      
      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/purchases/history/${result.id}`);
      }
    } catch (error: any) {
      // ==============================
      // ❌ COMPREHENSIVE ERROR LOGGING
      // ==============================
      console.group('❌ === PURCHASE CREATION FAILED ===');
      console.log(`⏰ Error Time: ${new Date().toISOString()}`);
      console.log(`🌐 Failed Endpoint: ${endpoint}`);
      
      // Basic error information
      console.error('💥 Error Object:', error);
      console.error('🔍 Error Message:', error?.message);
      console.error('📡 Response Status:', error?.response?.status);
      console.error('📊 Response Data:', error?.response?.data);
      console.error('🌐 Response Headers:', error?.response?.headers);
      
      // Detailed analysis
      console.groupCollapsed('🔬 Detailed Error Analysis');
      console.log('Error Type:', error?.constructor?.name || 'Unknown');
      console.log('HTTP Status Code:', error?.response?.status || 'N/A');
      console.log('HTTP Status Text:', error?.response?.statusText || 'N/A');
      console.log('Request URL:', error?.config?.url || 'N/A');
      console.log('Request Method:', error?.config?.method || 'N/A');
      console.log('Request Headers:', error?.config?.headers || 'N/A');
      console.log('Request Data:', error?.config?.data || 'N/A');
      console.log('Error Stack:', error?.stack || 'N/A');
      console.groupEnd();

      // Validation errors breakdown
      if (error?.response?.status === 422 && error?.response?.data?.detail) {
        console.groupCollapsed('🔎 Validation Errors Breakdown');
        const validationErrors = error.response.data.detail;
        if (Array.isArray(validationErrors)) {
          validationErrors.forEach((err: any, index: number) => {
            console.error(`❌ Validation Error ${index + 1}:`, {
              field: err.loc?.join('.') || 'unknown',
              message: err.msg || 'No message',
              type: err.type || 'unknown',
              input: err.input || 'N/A',
              ctx: err.ctx || {}
            });
          });
        } else {
          console.error('❌ Validation Error (non-array):', validationErrors);
        }
        console.groupEnd();
      }

      // Network and connectivity analysis
      console.groupCollapsed('🌐 Network Analysis');
      if (error?.code === 'NETWORK_ERROR') {
        console.error('🚫 Network Error: Unable to connect to server');
      } else if (error?.code === 'TIMEOUT') {
        console.error('⏱️ Timeout Error: Request took too long');
      } else if (error?.response) {
        console.log('✅ Server responded with error');
      } else if (error?.request) {
        console.error('📡 Request made but no response received');
      } else {
        console.error('⚙️ Error in request setup');
      }
      console.groupEnd();

      // User impact analysis
      console.groupCollapsed('👤 User Impact Analysis');
      const httpStatus = error?.response?.status;
      let userImpact = 'Unknown error occurred';
      let severity = 'medium';
      
      if (httpStatus === 422) {
        userImpact = 'Form data validation failed - user needs to fix input';
        severity = 'low';
      } else if (httpStatus === 401) {
        userImpact = 'User authentication expired - needs to login again';
        severity = 'high';
      } else if (httpStatus === 403) {
        userImpact = 'User lacks permission - contact administrator';
        severity = 'high';
      } else if (httpStatus === 404) {
        userImpact = 'Resource not found - data may have been deleted';
        severity = 'medium';
      } else if (httpStatus === 409) {
        userImpact = 'Data conflict - duplicate or related records exist';
        severity = 'medium';
      } else if (httpStatus >= 500) {
        userImpact = 'Server error - technical team needs to investigate';
        severity = 'high';
      }
      
      console.log(`🎯 User Impact: ${userImpact}`);
      console.log(`⚠️ Severity: ${severity}`);
      console.groupEnd();

      console.groupEnd();

      // Check if this is a debouncing error
      if (error.message && error.message.includes('Please wait')) {
        // Extract the wait time from the message
        const match = error.message.match(/(\d+) second/);
        const waitSeconds = match ? parseInt(match[1]) : 1;
        
        // Show a more user-friendly error dialog for debouncing
        console.log('⏱️ Debouncing error detected - wait time:', waitSeconds, 'seconds');
        setErrorDialog({
          open: true,
          error: {
            message: `Too many submission attempts. Please wait ${waitSeconds} second${waitSeconds !== 1 ? 's' : ''} before trying again.`,
            isDebounceError: true,
            waitSeconds: waitSeconds
          },
          requestId: `debounce-${Date.now()}`,
          timestamp: requestTimestamp,
          endpoint: endpoint
        });
        return;
      }

      // Extract request ID if available
      const requestId = error?.response?.headers?.['x-request-id'] || 
                       error?.response?.headers?.['x-correlation-id'] ||
                       error?.response?.headers?.['x-railway-request-id'] ||
                       `local-${Date.now()}`;

      // Show error dialog to user
      setErrorDialog({
        open: true,
        error: error,
        requestId: requestId,
        timestamp: requestTimestamp,
        endpoint: endpoint
      });
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const handleAddExistingItem = () => {
    setEditingItemIndex(null);
    setFormResetTrigger(prev => !prev); // Trigger form reset
    setIsItemFormOpen(true);
  };

  const handleEditItem = (index: number, item: PurchaseItem) => {
    setEditingItemIndex(index);
    setIsItemFormOpen(true);
  };

  const handleRemoveItem = (index: number) => {
    remove(index);
  };

  const handleItemFormSubmit = (itemData: any) => {
    try {
      const purchaseItem: PurchaseItem = {
        item_id: itemData.item_id,
        item_name: itemData.item_name || '',
        sku: itemData.sku || '',
        quantity: itemData.quantity,
        unit_cost: itemData.unit_cost,
        tax_rate: itemData.tax_rate || 0,
        discount_amount: itemData.discount_amount || 0,
        condition: itemData.condition,
        notes: itemData.notes,
        serial_numbers: itemData.serial_numbers || undefined,
        serial_number_required: itemData.serial_number_required || false,
      };

      if (editingItemIndex !== null) {
        update(editingItemIndex, purchaseItem);
      } else {
        append(purchaseItem);
      }
      
      setIsItemFormOpen(false);
      setEditingItemIndex(null);
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const handleItemFormCancel = () => {
    setIsItemFormOpen(false);
    setEditingItemIndex(null);
  };

  const handleErrorDialogClose = () => {
    setErrorDialog(prev => ({ ...prev, open: false }));
  };

  const handleRetrySubmission = () => {
    // Close error dialog and retry form submission
    setErrorDialog(prev => ({ ...prev, open: false }));
    
    // If it was a debounce error, add bypass flag
    const currentValues = form.getValues();
    if (errorDialog.error?.isDebounceError) {
      // Add bypass flag to skip debouncing on retry
      (currentValues as any).bypassDebounce = true;
    }
    
    form.handleSubmit(onSubmit)();
  };

  return (
    <div className="container mx-auto p-6 space-y-6" style={{ maxWidth: '1382px' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Record Purchase</h1>
          <p className="text-muted-foreground">Create a new purchase record with items</p>
        </div>
        <Button variant="ghost" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Purchase Details */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Details</CardTitle>
              <CardDescription>Basic information about this purchase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier *</FormLabel>
                      <FormControl>
                        <SupplierDropdown
                          value={field.value}
                          onChange={(value, supplier) => {
                            field.onChange(value);
                            setSelectedSupplier(supplier);
                          }}
                          placeholder="Select supplier..."
                          fullWidth
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
                      <FormLabel>Storage Location *</FormLabel>
                      <FormControl>
                        <LocationSelector
                          locations={locations}
                          selectedLocationId={field.value || ''}
                          onSelect={(location) => {
                            field.onChange(location.id);
                          }}
                          placeholder="Select location..."
                          allowedTypes={['WAREHOUSE', 'STORE']}
                          showActiveOnly={true}
                          compact={true}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchase_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date *</FormLabel>
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
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            maxDate={new Date()}
                            minDate={new Date("1900-01-01")}
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
                        <Input placeholder="PO-12345, Invoice-67890..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="PAID">Paid</SelectItem>
                          <SelectItem value="PARTIAL">Partial</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Calculated Values */}
              <div className="space-y-4">
                {/* Tax Amount and Discount Amount Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Tax Amount
                    </label>
                    <div className="relative">
                      <div className="h-10 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 flex items-center">
                        <span className="text-gray-500">₹</span>
                        <span className="ml-1">{calculateTotalTaxAmount().toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Total tax from {fields.length} item{fields.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Total Discount Amount
                    </label>
                    <div className="relative">
                      <div className="h-10 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 flex items-center">
                        <span className="text-gray-500">₹</span>
                        <span className="ml-1">{calculateAggregatedDiscountAmount().toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Total discount from purchase items
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total Amount and Grand Total Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Total Amount
                    </label>
                    <div className="relative">
                      <div className="h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700 flex items-center">
                        <span className="text-slate-500">₹</span>
                        <span className="ml-1 font-medium">{calculateTotalAmount().toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Sum of all items before adjustments
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Grand Total
                    </label>
                    <div className="relative">
                      <div className="h-10 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-700 flex items-center">
                        <span className="text-green-500">₹</span>
                        <span className="ml-1 font-semibold">{calculateGrandTotal().toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Final amount after taxes and discounts
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional notes about this purchase..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Purchase Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Purchase Items</h2>
                <p className="text-muted-foreground">Add items to this purchase</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleAddExistingItem}
                  variant="default"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Purchase Item
                </Button>
              </div>
            </div>

            <PurchaseItemsTable
              items={fields}
              onEditItem={handleEditItem}
              onRemoveItem={handleRemoveItem}
              isEditable={true}
            />
          </div>

          {/* Validation Warnings */}
          {formValidation.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div>
                  <p className="font-medium">Please review the following warnings:</p>
                  <ul className="list-disc list-inside mt-2">
                    {formValidation.warnings.map((warning: string, index: number) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createPurchase.isPending || fields.length === 0}
            >
              {createPurchase.isPending ? (
                <>
                  <Package2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording Purchase...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      {/* Item Form Dialog */}
      <Dialog open={isItemFormOpen} onOpenChange={setIsItemFormOpen}>
        <DialogContent className="max-w-7xl max-h-fit border-0 shadow-2xl backdrop-blur-sm bg-white/95">
          <DialogHeader className="space-y-2 pb-4 border-b border-gray-100">
            <DialogTitle className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg">
                <Package className="h-5 w-5 text-slate-600" />
              </div>
              {editingItemIndex !== null ? 'Edit Purchase Item' : 'Add Purchase Item'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base leading-relaxed">
              {editingItemIndex !== null 
                ? 'Update the details for this purchase item with pricing and location information.'
                : 'Add items to your purchase with detailed pricing and condition information.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <PurchaseItemForm
            initialData={editingItemIndex !== null ? fields[editingItemIndex] : undefined}
            locations={locations}
            onSubmit={handleItemFormSubmit}
            onCancel={handleItemFormCancel}
            isSubmitting={false}
            resetTrigger={formResetTrigger}
          />
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog(prev => ({ ...prev, open }))}
        title="Purchase Submission Failed"
        error={errorDialog.error}
        httpStatus={errorDialog.error?.response?.status}
        requestId={errorDialog.requestId}
        timestamp={errorDialog.timestamp}
        endpoint={errorDialog.endpoint}
        retryAction={handleRetrySubmission}
        onClose={handleErrorDialogClose}
      />
    </div>
  );
}