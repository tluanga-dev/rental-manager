'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { CalendarIcon, Plus, Trash2, Package, Save, ArrowLeft, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

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

import { SupplierDropdown } from '@/components/suppliers/SupplierDropdown/SupplierDropdown';
import { LocationSelector } from '@/components/locations/location-selector';
import { ItemDropdown } from '@/components/items/ItemDropdown';
import { SerialNumberInput } from './SerialNumberInput';
import { useCreatePurchase } from '@/hooks/use-purchases';
import { locationsApi } from '@/services/api/locations';
import { PurchaseValidator } from '@/lib/purchase-validation';
import { cn } from '@/lib/utils';
import type { ItemCondition, PurchaseFormData } from '@/types/purchases';
import type { SKU } from '@/types/sku';
import type { Location } from '@/types/location';
import { ITEM_CONDITIONS } from '@/types/purchases';

const purchaseItemSchema = z.object({
  item_sku_selection: z.object({
    item: z.any().optional(),
    sku: z.any().optional(),
  }).optional(),
  item_id: z.string().min(1, 'Item is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_cost: z.number().min(0, 'Unit cost must be positive'),
  condition: z.enum(['A', 'B', 'C', 'D']),
  notes: z.string().optional(),
  serial_numbers: z.array(z.string().min(1, 'Serial number cannot be empty')).optional(),
  // Batch-specific fields
  batch_code: z.string().optional(),
  sale_price: z.number().min(0, 'Sale price must be positive').optional(),
  rental_rate_per_period: z.number().min(0, 'Rental rate must be positive').optional(),
  rental_period: z.number().min(1, 'Rental period must be at least 1').optional(),
  security_deposit: z.number().min(0, 'Security deposit must be positive').optional(),
  model_number: z.string().optional(),
  warranty_period_days: z.number().min(0, 'Warranty period must be positive').optional(),
  remarks: z.string().optional(),
});

const purchaseFormSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier is required'),
  location_id: z.string().min(1, 'Location is required'),
  purchase_date: z.date(),
  notes: z.string().optional(),
  reference_number: z.string().optional(),
  tax_rate: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  discount_amount: z.number().min(0, 'Discount amount cannot be negative'),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
});

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

interface PurchaseRecordingFormProps {
  onSuccess?: (purchase: any) => void;
  onCancel?: () => void;
}

export function PurchaseRecordingForm({ onSuccess, onCancel }: PurchaseRecordingFormProps) {
  const router = useRouter();
  const createPurchase = useCreatePurchase();

  // State for options
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  
  // State for selected items to track serial number requirements
  const [selectedItems, setSelectedItems] = useState<Record<number, any>>({});
  
  // State for validation
  const [formValidation, setFormValidation] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>({ isValid: true, errors: [], warnings: [] });
  
  // Enhanced data for validation (keeping for future use)
  const [fullSkus] = useState<SKU[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>();

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      supplier_id: '',
      location_id: '',
      purchase_date: new Date(),
      notes: '',
      reference_number: '',
      tax_rate: 0,
      discount_amount: 0,
      items: [
        {
          item_sku_selection: undefined,
          batch_code: '',
          sale_price: 0,
          rental_rate_per_period: 0,
          rental_period: 1,
          security_deposit: 0,
          model_number: '',
          warranty_period_days: 0,
          remarks: '',
          item_id: '',
          quantity: 1,
          unit_cost: 0,
          condition: 'A',
          notes: '',
          serial_numbers: [],
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Load options on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        setLoadingOptions(true);
        const locationsData = await locationsApi.list({ is_active: true });

        // Handle both array and paginated response for locations
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

  // Selected supplier is now managed directly in SupplierDropdown onChange handler

  // Real-time form validation
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.items && value.items.length > 0) {
        let validation = { isValid: true, errors: [], warnings: [] };
        
        // Existing validation
        if (fullSkus.length > 0) {
          validation = PurchaseValidator.validatePurchaseForm(
            form.getValues() as any,
            fullSkus,
            selectedSupplier
          );
        }
        
        // Serial number validation
        const serialErrors = validateSerialNumbers(value.items, selectedItems);
        validation.errors = [...validation.errors, ...serialErrors];
        validation.isValid = validation.isValid && serialErrors.length === 0;
        
        setFormValidation(validation);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, fullSkus, selectedSupplier, selectedItems, validateSerialNumbers]);

  const onSubmit = async (values: PurchaseFormValues) => {
    try {
      const formData: PurchaseFormData = {
        supplier_id: values.supplier_id,
        location_id: values.location_id,
        purchase_date: format(values.purchase_date, 'yyyy-MM-dd'),
        tax_amount: calculateTaxAmount(),
        discount_amount: values.discount_amount,
        notes: values.notes,
        reference_number: values.reference_number,
        items: values.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          tax_rate: values.tax_rate || 0,
          discount_amount: 0, // Per-item discount, defaulting to 0
          condition: item.condition as ItemCondition,
          notes: item.notes,
          serial_numbers: item.serial_numbers?.filter(sn => sn && sn.trim()) || [],
        })),
      };

      const result = await createPurchase.mutateAsync(formData);
      
      // Show success message
      console.log('Purchase created successfully:', result);
      
      if (onSuccess) {
        onSuccess(result);
      } else {
        // Navigate to purchase detail page using the transaction ID
        const purchaseId = result.data?.id || result.transaction_id || result.id;
        router.push(`/purchases/history/${purchaseId}`);
      }
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Purchase creation failed:', error);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  // Serial number validation function
  const validateSerialNumbers = useCallback((items: any[], selectedItems: Record<number, any>) => {
    const errors: string[] = [];
    const allSerialNumbers: string[] = [];
    
    items.forEach((item, index) => {
      const selectedItem = selectedItems[index];
      
      if (selectedItem?.serial_number_required) {
        const serialNumbers = item.serial_numbers || [];
        const validSerialNumbers = serialNumbers.filter((sn: string) => sn && sn.trim());
        
        // Check if serial numbers are provided
        if (validSerialNumbers.length === 0) {
          errors.push(`Serial numbers are required for ${selectedItem.item_name}`);
          return;
        }
        
        // Check if quantity matches serial number count
        if (validSerialNumbers.length !== item.quantity) {
          errors.push(
            `${selectedItem.item_name}: ${item.quantity} units ordered but ${validSerialNumbers.length} serial numbers provided`
          );
        }
        
        // Check for duplicates within item
        const uniqueSerials = new Set(validSerialNumbers);
        if (uniqueSerials.size !== validSerialNumbers.length) {
          errors.push(`Duplicate serial numbers found for ${selectedItem.item_name}`);
        }
        
        // Check for duplicates across items
        validSerialNumbers.forEach((serial: string) => {
          if (allSerialNumbers.includes(serial)) {
            errors.push(`Serial number '${serial}' is used multiple times`);
          } else {
            allSerialNumbers.push(serial);
          }
        });
      }
    });
    
    return errors;
  }, []);

  const addItem = () => {
    append({
      item_id: '',
      quantity: 1,
      unit_cost: 0,
      condition: 'A',
      notes: '',
      serial_numbers: [],
      // Batch-specific fields with defaults
      batch_code: '',
      sale_price: 0,
      rental_rate_per_period: 0,
      rental_period: 1,
      security_deposit: 0,
      model_number: '',
      warranty_period_days: 0,
      remarks: '',
    });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      
      // Clean up selected items state
      setSelectedItems(prev => {
        const updated = { ...prev };
        delete updated[index];
        
        // Reindex remaining items
        const reindexed: Record<number, any> = {};
        Object.keys(updated).forEach(key => {
          const numKey = parseInt(key);
          if (numKey > index) {
            reindexed[numKey - 1] = updated[numKey];
          } else {
            reindexed[numKey] = updated[numKey];
          }
        });
        
        return reindexed;
      });
    }
  };

  const calculateSubtotal = () => {
    const items = form.watch('items');
    return items.reduce((total, item) => total + (item.quantity * item.unit_cost), 0);
  };

  const calculateTaxAmount = () => {
    const subtotal = calculateSubtotal();
    const taxRate = form.watch('tax_rate') || 0;
    return subtotal * (taxRate / 100);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const taxAmount = calculateTaxAmount();
    const discountAmount = form.watch('discount_amount') || 0;
    return subtotal + taxAmount - discountAmount;
  };

  const getTotalItems = () => {
    const items = form.watch('items');
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  if (loadingOptions) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Package className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-sm text-muted-foreground">Loading form options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="-ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Record Purchase</h1>
            <p className="text-muted-foreground">Record a completed purchase and add items to inventory</p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Purchase Details */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Details</CardTitle>
              <CardDescription>
                Enter the basic information about this purchase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier *</FormLabel>
                      <FormControl>
                        <SupplierDropdown
                          value={field.value}
                          onChange={(supplierId, supplier) => {
                            field.onChange(supplierId);
                            // Update selected supplier for validation
                            setSelectedSupplier(supplier as any);
                          }}
                          placeholder="Search or select supplier"
                          fullWidth
                          searchable
                          clearable
                          showCode
                          error={!!form.formState.errors.supplier_id}
                          helperText={form.formState.errors.supplier_id?.message}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location *</FormLabel>
                      <FormControl>
                        <LocationSelector
                          locations={locations}
                          selectedLocationId={field.value || ''}
                          onSelect={(location) => {
                            field.onChange(location.id);
                          }}
                          placeholder="Select location"
                          allowedTypes={['WAREHOUSE', 'STORE']}
                          showActiveOnly={true}
                          compact={true}
                          className={cn(
                            "w-full",
                            form.formState.errors.location_id && "border-red-500"
                          )}
                          error={form.formState.errors.location_id?.message}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purchase_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Purchase Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
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
                        <Input placeholder="PO-001, Invoice #123, etc." {...field} />
                      </FormControl>
                      <FormDescription>
                        Optional reference for tracking this purchase
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tax_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Tax percentage applied to subtotal
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discount_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Amount (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Fixed discount amount in rupees
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                        className="resize-none"
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Purchase Items</CardTitle>
                  <CardDescription>
                    Add items that were purchased and their details
                  </CardDescription>
                </div>
                <Button type="button" onClick={addItem} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Form Validation Results */}
              {!formValidation.isValid && formValidation.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div>
                      <p className="font-medium">Please fix the following errors:</p>
                      <ul className="list-disc list-inside mt-2">
                        {formValidation.errors.map((error: string, index: number) => (
                          <li key={index} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Form Validation Warnings */}
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

              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">Item {index + 1}</h4>
                      {selectedItems[index]?.serial_number_required && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                          Serial Numbers Required
                        </Badge>
                      )}
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.item_id`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item</FormLabel>
                          <FormControl>
                            <ItemDropdown
                              value={field.value}
                              onChange={(itemId, item) => {
                                field.onChange(itemId);
                                
                                // Store full item data for serial number requirements
                                setSelectedItems(prev => ({
                                  ...prev,
                                  [index]: item || null
                                }));
                                
                                if (item) {
                                  // Auto-fill unit cost if available
                                  if (item.purchase_price) {
                                    form.setValue(`items.${index}.unit_cost`, item.purchase_price);
                                  }
                                  
                                  // Clear serial numbers when item changes
                                  form.setValue(`items.${index}.serial_numbers`, []);
                                }
                              }}
                              placeholder="Select item..."
                              showSku={true}
                              showPrice={true}
                              fullWidth
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.unit_cost`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Cost *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`items.${index}.condition`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condition *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ITEM_CONDITIONS.map((condition) => (
                                <SelectItem key={condition.value} value={condition.value}>
                                  <div className="flex flex-col">
                                    <span>{condition.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {condition.description}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Batch and Pricing Information */}
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <h5 className="text-sm font-medium mb-3">Batch & Pricing Information (Optional)</h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.batch_code`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Batch Code</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., BATCH-2024-001" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.sale_price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sale Price (₹)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.model_number`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Model Number</FormLabel>
                              <FormControl>
                                <Input placeholder="Model/Part number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.rental_rate_per_period`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rental Rate (₹/period)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.rental_period`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rental Period (days)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="1"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.security_deposit`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Security Deposit (₹)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.warranty_period_days`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Warranty Period (days)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormDescription>
                                Warranty period from purchase date
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.remarks`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Batch Remarks</FormLabel>
                              <FormControl>
                                <Input placeholder="Additional batch information..." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.notes`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Input placeholder="Item-specific notes..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Serial Number Input - Show only if item requires serial numbers */}
                  {selectedItems[index]?.serial_number_required && (
                    <div className="col-span-full">
                      <FormField
                        control={form.control}
                        name={`items.${index}.serial_numbers`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <SerialNumberInput
                                value={field.value || []}
                                onChange={field.onChange}
                                quantity={form.watch(`items.${index}.quantity`) || 1}
                                itemName={selectedItems[index]?.item_name || 'Selected Item'}
                                required={true}
                                error={form.formState.errors.items?.[index]?.serial_numbers?.message}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Item Total */}
                  <div className="flex justify-end pt-2 border-t">
                    <div className="text-sm text-muted-foreground">
                      Item Total: ₹{(form.watch(`items.${index}.quantity`) * form.watch(`items.${index}.unit_cost`)).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}

              {fields.length === 0 && (
                <Alert>
                  <AlertDescription>
                    No items added yet. Click &quot;Add Item&quot; to add purchase items.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Total Items:</span>
                    <span className="text-sm">{getTotalItems()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Subtotal:</span>
                    <span className="text-sm">${calculateSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Tax ({form.watch('tax_rate')}%):</span>
                    <span className="text-sm">${calculateTaxAmount().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Discount:</span>
                    <span className="text-sm">-${(form.watch('discount_amount') || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-lg font-bold">Total Amount:</span>
                    <span className="text-lg font-bold">${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Status</p>
                  <Badge>Ready to Record</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createPurchase.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createPurchase.isPending}
              className="min-w-[120px]"
            >
              {createPurchase.isPending ? (
                <>
                  <Package className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}