'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Package, Package2, Loader2, AlertCircle, Edit2 } from 'lucide-react';
import { formatCurrencySync, getCurrencySymbol, getCurrentCurrency } from '@/lib/currency-utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useDebounce } from '@/hooks/useDebounce';
import { salesApi } from '@/services/api/sales';
import { itemsApi } from '@/services/api/items';
import { cn } from '@/lib/utils';
import type { SaleableItem } from '@/types/sales';

// Import components
import { SaleableItemDropdown } from '@/components/sales/SaleableItemDropdown';
import { SetSalePriceDialog } from '@/components/sales/SetSalePriceDialog';

const saleItemFormSchema = z.object({
  item_id: z.string().min(1, 'Item is required'),
  item_name: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_price: z.number().min(0, 'Unit price must be positive'),
  tax_rate: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  discount_amount: z.number().min(0, 'Discount amount cannot be negative'),
  notes: z.string().optional(),
  available_quantity: z.number().optional(),
}).refine((data) => {
  // Validate quantity doesn't exceed available stock
  if (data.available_quantity !== undefined && data.quantity > data.available_quantity) {
    return false;
  }
  return true;
}, {
  message: "Quantity cannot exceed available stock",
  path: ["quantity"],
});

type SaleItemFormData = z.infer<typeof saleItemFormSchema>;

interface SaleItemFormImprovedProps {
  initialData?: Partial<SaleItemFormData>;
  onSubmit: (data: SaleItemFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  resetTrigger?: boolean;
}

export function SaleItemFormImproved({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  resetTrigger = false,
}: SaleItemFormImprovedProps) {
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [selectedItem, setSelectedItem] = useState<SaleableItem | null>(null);
  const [stockStatus, setStockStatus] = useState<'available' | 'low' | 'out' | null>(null);
  const [priceNeedsManualEntry, setPriceNeedsManualEntry] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);

  const form = useForm<SaleItemFormData>({
    resolver: zodResolver(saleItemFormSchema),
    defaultValues: {
      item_id: initialData?.item_id || '',
      item_name: initialData?.item_name || '',
      sku: initialData?.sku || '',
      quantity: initialData?.quantity || 1,
      unit_price: initialData?.unit_price || 0,
      tax_rate: initialData?.tax_rate || 0,
      discount_amount: initialData?.discount_amount || 0,
      notes: initialData?.notes || '',
      available_quantity: initialData?.available_quantity || 0,
    },
  });

  // Reset form when resetTrigger changes
  useEffect(() => {
    if (resetTrigger || (!initialData || !initialData.item_id)) {
      form.reset({
        item_id: '',
        item_name: '',
        sku: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: 0,
        discount_amount: 0,
        notes: '',
        available_quantity: 0,
      });
      setSelectedItem(null);
      setStockStatus(null);
      setPriceNeedsManualEntry(false);
      setShowPriceDialog(false);
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
        setCurrencySymbol('₹');
      }
    };
    loadCurrency();
  }, []);

  // Update stock status when item changes
  useEffect(() => {
    if (selectedItem) {
      if (selectedItem.available_quantity === 0) {
        setStockStatus('out');
      } else if (selectedItem.available_quantity < 10) {
        setStockStatus('low');
      } else {
        setStockStatus('available');
      }
    }
  }, [selectedItem]);

  const handleSubmit = async (data: SaleItemFormData) => {
    console.log('Sale item form submitted:', data);
    onSubmit(data);
  };

  const handlePriceConfirm = async (price: number, saveToMaster: boolean) => {
    setIsUpdatingPrice(true);
    
    try {
      // Set the price in the form
      form.setValue('unit_price', price);
      setPriceNeedsManualEntry(false);
      
      // If user wants to save to master, update the item master
      if (saveToMaster && selectedItem) {
        try {
          await itemsApi.updateSalePrice(selectedItem.id, price);
          console.log(`✅ Updated sale price for item ${selectedItem.id} to ₹${price}`);
          
          // Update the selected item's price for consistency
          selectedItem.sale_price = price;
        } catch (error) {
          console.warn('⚠️ Failed to update item master:', error);
          // Don't throw - the price is still set in the form
        }
      }
      
      setShowPriceDialog(false);
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  // Smart input handlers
  const isNewMode = !initialData || !initialData.item_id;
  
  const handleFocusWithClear = (field: any, fieldName: string) => {
    return (e: React.FocusEvent<HTMLInputElement>) => {
      if (isNewMode) {
        if (fieldName === 'unit_price' && field.value === 0) {
          field.onChange('');
          e.target.value = '';
        } else if ((fieldName === 'quantity' || fieldName === 'tax_rate' || fieldName === 'discount_amount') && field.value === 0) {
          e.target.select();
        }
      } else {
        e.target.select();
      }
    };
  };

  const handleBlurWithDefault = (field: any, fieldName: string, defaultValue: number) => {
    return (e: React.FocusEvent<HTMLInputElement>) => {
      if (!e.target.value || e.target.value === '') {
        field.onChange(defaultValue);
      }
    };
  };

  // Calculate totals
  const watchedValues = form.watch();
  const baseAmount = watchedValues.quantity * watchedValues.unit_price;
  const discountAmount = watchedValues.discount_amount || 0;
  const taxableAmount = baseAmount - discountAmount;
  const taxAmount = taxableAmount * (watchedValues.tax_rate / 100);
  const totalAmount = taxableAmount + taxAmount;

  return (
    <>
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
                      <SaleableItemDropdown
                        value={field.value}
                        onChange={(itemId, item?) => {
                          field.onChange(itemId);
                          setSelectedItem(item || null);
                          
                          if (item) {
                            form.setValue('item_name', item.item_name || '');
                            form.setValue('sku', item.sku || '');
                            
                            // Set the price from item master (can be 0 or null)
                            const itemPrice = item.sale_price ?? 0;
                            form.setValue('unit_price', itemPrice);
                            
                            // Don't auto-show dialog - allow zero prices for saleable items
                            // User can manually update price if needed
                            setPriceNeedsManualEntry(false);
                            setShowPriceDialog(false);
                            
                            form.setValue('tax_rate', item.tax_rate || 0);
                            form.setValue('available_quantity', item.available_quantity || 0);
                            
                            // Set max quantity to available stock
                            if (form.getValues('quantity') > item.available_quantity) {
                              form.setValue('quantity', item.available_quantity);
                            }
                          } else {
                            form.setValue('item_name', '');
                            form.setValue('sku', '');
                            form.setValue('unit_price', 0);
                            form.setValue('available_quantity', 0);
                            setPriceNeedsManualEntry(false);
                          }
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

              {/* Stock Status Alert */}
              {selectedItem && stockStatus && (
                <Alert className={cn(
                  "mt-4",
                  stockStatus === 'out' && "border-red-200 bg-red-50",
                  stockStatus === 'low' && "border-orange-200 bg-orange-50",
                  stockStatus === 'available' && "border-green-200 bg-green-50"
                )}>
                  <AlertCircle className={cn(
                    "h-4 w-4",
                    stockStatus === 'out' && "text-red-600",
                    stockStatus === 'low' && "text-orange-600",
                    stockStatus === 'available' && "text-green-600"
                  )} />
                  <AlertDescription>
                    {stockStatus === 'out' && "This item is currently out of stock"}
                    {stockStatus === 'low' && `Low stock: Only ${selectedItem.available_quantity} units available`}
                    {stockStatus === 'available' && `In stock: ${selectedItem.available_quantity} units available`}
                  </AlertDescription>
                </Alert>
              )}
              
            </div>

            {/* Sales Details */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <Package2 className="h-4 w-4 text-slate-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Sales Details</h3>
              </div>
              
              {/* Financial Details - 4 Column Grid */}
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
                          min="1"
                          max={selectedItem?.available_quantity || undefined}
                          step="1"
                          placeholder="1"
                          className="h-8 text-sm bg-white border-gray-200 focus:border-slate-500 focus:ring-slate-500/20"
                          {...field}
                          onFocus={handleFocusWithClear(field, 'quantity')}
                          onBlur={handleBlurWithDefault(field, 'quantity', 1)}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 1;
                            if (selectedItem && value > selectedItem.available_quantity) {
                              field.onChange(selectedItem.available_quantity);
                            } else {
                              field.onChange(value);
                            }
                          }}
                          disabled={!selectedItem || stockStatus === 'out'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Unit Price *
                        {selectedItem && field.value === 0 && (
                          <span className="text-xs text-gray-500 ml-2">(Free)</span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">{currencySymbol}</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="h-8 pl-6 pr-10 text-sm bg-white border-gray-200 focus:border-slate-500 focus:ring-slate-500/20"
                            {...field}
                            onFocus={handleFocusWithClear(field, 'unit_price')}
                            onBlur={handleBlurWithDefault(field, 'unit_price', 0)}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                          {/* Optional price update button */}
                          {selectedItem && (
                            <button
                              type="button"
                              onClick={() => setShowPriceDialog(true)}
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-slate-600 hover:bg-gray-100 rounded transition-colors"
                              title="Update price with suggestions"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </FormControl>
                      {selectedItem && !selectedItem.sale_price && (
                        <p className="text-xs text-gray-500 mt-1">
                          No master price set. You can enter a custom price or click the edit icon for suggestions.
                        </p>
                      )}
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
                      <FormLabel className="text-sm font-medium text-gray-700">Discount</FormLabel>
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

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Optional notes about this sale item..."
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
          </div>

          {/* Live Calculation Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/30 border border-slate-200/60 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-sm">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Price Breakdown</h3>
                </div>
                
                <div className="space-y-3">
                  {/* Base Cost */}
                  <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                    <span className="text-sm font-medium text-slate-600">Base Amount</span>
                    <span className="font-mono text-base font-semibold text-slate-800">
                      {formatCurrencySync(baseAmount)}
                    </span>
                  </div>
                  
                  {/* Discount */}
                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-orange-50/50 hover:bg-orange-100/50 transition-colors">
                      <span className="text-sm font-medium text-orange-700">Discount</span>
                      <span className="font-mono text-base font-semibold text-orange-600">
                        -{formatCurrencySync(discountAmount)}
                      </span>
                    </div>
                  )}
                  
                  {/* Tax */}
                  {watchedValues.tax_rate > 0 && (
                    <div className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors">
                      <span className="text-sm font-medium text-emerald-700">Tax ({watchedValues.tax_rate}%)</span>
                      <span className="font-mono text-base font-semibold text-emerald-600">
                        +{formatCurrencySync(taxAmount)}
                      </span>
                    </div>
                  )}
                  
                  {/* Total */}
                  <div className="border-t border-slate-200 pt-4 mt-5">
                    <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50 border border-slate-200/50">
                      <span className="text-base font-bold text-slate-800">Total Amount</span>
                      <span className="text-2xl font-black font-mono text-slate-700 drop-shadow-sm">
                        {formatCurrencySync(totalAmount)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Stock Info */}
                  {selectedItem && (
                    <div className="pt-3 mt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-slate-500">Available Stock</span>
                        <Badge variant={stockStatus === 'out' ? 'destructive' : stockStatus === 'low' ? 'secondary' : 'default'} className="text-xs">
                          {selectedItem.available_quantity} {selectedItem.unit_abbreviation}
                        </Badge>
                      </div>
                    </div>
                  )}
                  
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
                    disabled={
                      isSubmitting || 
                      !selectedItem || 
                      stockStatus === 'out'
                      // Allow zero prices for saleable items
                    }
                    className="w-full h-11 text-base font-medium bg-slate-600 hover:bg-slate-700 focus:ring-slate-500/20 shadow-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding Item...
                      </>
                    ) : (
                      'Add to Sale'
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

    {/* Price Setting Dialog */}
    <SetSalePriceDialog
      isOpen={showPriceDialog}
      onClose={() => setShowPriceDialog(false)}
      item={selectedItem}
      onConfirm={handlePriceConfirm}
      isLoading={isUpdatingPrice}
    />
    </>
  );
}