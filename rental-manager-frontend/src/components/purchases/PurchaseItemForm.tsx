'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Package, MapPin, Loader2, Package2 } from 'lucide-react';
import { formatCurrencySync, getCurrencySymbol, getCurrentCurrency } from '@/lib/currency-utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { ItemDropdown } from '@/components/items/ItemDropdown';
import { SerialNumberInput } from '@/components/purchases/SerialNumberInput';
import { cn } from '@/lib/utils';
import { ITEM_CONDITIONS } from '@/types/purchases';
import type { Location } from '@/types/location';
import type { Item } from '@/types/item';

const purchaseItemFormSchema = z.object({
  item_id: z.string().min(1, 'Item is required'),
  item_name: z.string().optional(),
  sku: z.string().optional(),  
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_cost: z.number().min(0.01, 'Unit cost is required and must be greater than 0'),
  tax_rate: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  discount_amount: z.number().min(0, 'Discount amount cannot be negative'),
  condition: z.enum(['A', 'B', 'C', 'D']),
  notes: z.string().optional(),
  serial_numbers: z.array(z.string()).optional(),
  serial_number_required: z.boolean().optional(),
}).refine((data) => {
  // If serial numbers are required, validate that they match quantity
  if (data.serial_number_required) {
    const validSerials = (data.serial_numbers || []).filter(s => s.trim().length > 0);
    return validSerials.length === data.quantity;
  }
  return true;
}, {
  message: "All serial numbers must be provided when required",
  path: ["serial_numbers"],
});

type PurchaseItemFormData = z.infer<typeof purchaseItemFormSchema>;

interface PurchaseItemFormProps {
  initialData?: Partial<PurchaseItemFormData>;
  locations: Location[];
  onSubmit: (data: PurchaseItemFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  resetTrigger?: boolean; // Add reset trigger to force form reset
}

export function PurchaseItemForm({
  initialData,
  locations,
  onSubmit,
  onCancel,
  isSubmitting = false,
  resetTrigger = false,
}: PurchaseItemFormProps) {
  const [currencySymbol, setCurrencySymbol] = useState('₹'); // Default to INR
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);


  const form = useForm<PurchaseItemFormData>({
    resolver: zodResolver(purchaseItemFormSchema),
    defaultValues: {
      item_id: initialData?.item_id || '',
      item_name: initialData?.item_name || '',
      sku: initialData?.sku || '',
      quantity: initialData?.quantity || 0,
      unit_cost: initialData?.unit_cost || 0,
      tax_rate: initialData?.tax_rate || 0,
      discount_amount: initialData?.discount_amount || 0,
      condition: initialData?.condition || 'A',
      notes: initialData?.notes || '',
      serial_numbers: initialData?.serial_numbers || [],
      serial_number_required: initialData?.serial_number_required || false,
    },
  });

  // Reset form when resetTrigger changes or when switching to new mode
  useEffect(() => {
    if (resetTrigger || (!initialData || !initialData.item_id)) {
      form.reset({
        item_id: '',
        item_name: '',
        sku: '',
        quantity: 0,
        unit_cost: 0,
        tax_rate: 0,
        discount_amount: 0,
        condition: 'A',
        notes: '',
        serial_numbers: [],
        serial_number_required: false,
      });
      setSelectedItem(null);
    }
  }, [resetTrigger, initialData, form]);

  // Load currency symbol
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const currency = await getCurrentCurrency();
        setCurrencySymbol(currency.symbol);
      } catch (error) {
        console.error('Failed to load currency:', error);
        setCurrencySymbol('₹'); // Keep INR as fallback
      }
    };
    loadCurrency();
  }, []);

  const handleSubmit = async (data: PurchaseItemFormData) => {
    console.log('Form submitted with data:', data);
    onSubmit(data);
  };

  // Enhanced input handlers for better UX with zero values
  const isNewMode = !initialData || !initialData.item_id;
  
  const handleFocusWithClear = (field: any, fieldName: string) => {
    return (e: React.FocusEvent<HTMLInputElement>) => {
      // In new mode, clear default values when focused
      if (isNewMode) {
        if (fieldName === 'unit_cost' && field.value === 0) {
          field.onChange('');
          e.target.value = '';
        } else if ((fieldName === 'quantity' || fieldName === 'tax_rate' || fieldName === 'discount_amount') && field.value === 0) {
          e.target.select();
        }
      } else {
        // In edit mode, just select the current value
        e.target.select();
      }
    };
  };

  const handleBlurWithDefault = (field: any, fieldName: string, defaultValue: number) => {
    return (e: React.FocusEvent<HTMLInputElement>) => {
      if (!e.target.value || e.target.value === '') {
        // For unit_cost, don't set a default if empty (will trigger validation)
        if (fieldName === 'unit_cost') {
          field.onChange(0);
        } else {
          field.onChange(defaultValue);
        }
      }
    };
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-2">
          {/* Main Form Section */}
          <div className="lg:col-span-2 space-y-8">
            {/* Item Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Package className="h-4 w-4 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Item Selection</h3>
              </div>
              <FormField
                control={form.control}
                name="item_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Select Item *</FormLabel>
                    <FormControl>
                      <ItemDropdown
                        value={field.value}
                        onChange={(itemId, item?) => {
                          field.onChange(itemId);
                          setSelectedItem(item || null);
                          
                          // Store item details for form submission
                          if (item) {
                            form.setValue('item_name', item.item_name || '');
                            form.setValue('sku', item.sku || '');
                            form.setValue('serial_number_required', item.serial_number_required || false);
                            
                            // Clear serial numbers when changing items
                            form.setValue('serial_numbers', []);
                          } else {
                            // Clear fields when item is cleared
                            form.setValue('item_name', '');
                            form.setValue('sku', '');
                            form.setValue('serial_number_required', false);
                            form.setValue('serial_numbers', []);
                          }
                          
                          // Note: Unit cost is not auto-populated, user must enter manually
                        }}
                        placeholder="Search and select an item..."
                        showSku={true}
                        showPrice={true}
                        showStock={true}
                        fullWidth
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Core Purchase Details */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <Package2 className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Purchase Details</h3>
              </div>
              
              {/* Financial Details - 4 Column */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Quantity *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          className="h-8 text-sm bg-white border-gray-200 focus:border-slate-500 focus:ring-slate-500/20"
                          {...field}
                          onFocus={handleFocusWithClear(field, 'quantity')}
                          onBlur={handleBlurWithDefault(field, 'quantity', 1)}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Unit Cost *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">{currencySymbol}</span>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            className="h-8 pl-6 text-sm bg-white border-gray-200 focus:border-slate-500 focus:ring-slate-500/20"
                            {...field}
                            onFocus={handleFocusWithClear(field, 'unit_cost')}
                            onBlur={handleBlurWithDefault(field, 'unit_cost', 0)}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tax_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Tax Rate</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="0.00"
                            className="h-8 pr-6 text-sm bg-white border-gray-200 focus:border-green-500 focus:ring-green-500/20"
                            {...field}
                            onFocus={handleFocusWithClear(field, 'tax_rate')}
                            onBlur={handleBlurWithDefault(field, 'tax_rate', 0)}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                          <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discount_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Discount Amount</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">{currencySymbol}</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="h-8 pl-6 text-sm bg-white border-gray-200 focus:border-orange-500 focus:ring-orange-500/20"
                            {...field}
                            onFocus={handleFocusWithClear(field, 'discount_amount')}
                            onBlur={handleBlurWithDefault(field, 'discount_amount', 0)}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Item Properties & Notes - Same Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Condition *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-8 text-sm bg-white border-gray-200 focus:border-slate-500 focus:ring-slate-500/20">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ITEM_CONDITIONS.map((condition) => (
                            <SelectItem key={condition.value} value={condition.value}>
                              <div className="flex flex-col">
                                <span className="font-medium">{condition.label}</span>
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
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Optional notes about this item..."
                          rows={3}
                          className="resize-none bg-white border-gray-200 focus:border-purple-500 focus:ring-purple-500/20"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Serial Numbers - Conditional Display */}
              {selectedItem?.serial_number_required && (
                <div>
                  <FormField
                    control={form.control}
                    name="serial_numbers"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <SerialNumberInput
                            value={field.value || []}
                            onChange={field.onChange}
                            quantity={form.watch('quantity') || 1}
                            itemName={selectedItem?.item_name || 'Selected Item'}
                            required={true}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Live Calculation Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/30 border border-slate-200/60 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-sm">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Cost Breakdown</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                    <span className="text-sm font-medium text-slate-600">Base Cost</span>
                    <span className="font-mono text-base font-semibold text-slate-800">
                      {formatCurrencySync(form.watch('quantity') * form.watch('unit_cost'))}
                    </span>
                  </div>
                  
                  {form.watch('discount_amount') > 0 && (
                    <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-orange-50/50 hover:bg-orange-100/50 transition-colors">
                      <span className="text-sm font-medium text-orange-700">Discount</span>
                      <span className="font-mono text-base font-semibold text-orange-600">
                        -{formatCurrencySync(form.watch('discount_amount'))}
                      </span>
                    </div>
                  )}
                  
                  {form.watch('tax_rate') > 0 && (
                    <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors">
                      <span className="text-sm font-medium text-emerald-700">Tax ({form.watch('tax_rate')}%)</span>
                      <span className="font-mono text-base font-semibold text-emerald-600">
                        +{formatCurrencySync((form.watch('quantity') * form.watch('unit_cost') - form.watch('discount_amount')) * (form.watch('tax_rate') / 100))}
                      </span>
                    </div>
                  )}
                  
                  <div className="border-t border-slate-200 pt-4 mt-5">
                    <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50 border border-slate-200/50">
                      <span className="text-base font-bold text-slate-800">Total Cost</span>
                      <span className="text-2xl font-black font-mono text-slate-700 drop-shadow-sm">
                        {formatCurrencySync(
                          (form.watch('quantity') * form.watch('unit_cost')) - 
                          form.watch('discount_amount') + 
                          ((form.watch('quantity') * form.watch('unit_cost') - form.watch('discount_amount')) * (form.watch('tax_rate') / 100))
                        )}
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-3 mt-4 border-t border-slate-200">
                    <div className="text-xs text-slate-500 text-center">
                      Live calculation • Updates automatically
                    </div>
                  </div>
                </div>
                
                {/* Form Actions */}
                <div className="mt-6 space-y-3">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 text-base font-medium bg-slate-600 hover:bg-slate-700 focus:ring-slate-500/20 shadow-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding Item...
                      </>
                    ) : (
                      'Add to Purchase'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="w-full h-11 text-base font-medium border-gray-300 hover:bg-gray-50 focus:ring-gray-500/20"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </form>
    </Form>
  );
}