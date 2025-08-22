'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { CalendarIcon, Plus, Save, ArrowLeft, AlertTriangle, Package2, Package, User } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PastelCalendar } from '@/components/ui/pastel-calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

import { CustomerDropdown } from '@/components/customers/CustomerDropdown/CustomerDropdown';
import { SaleItemsTable } from '@/components/sales/SaleItemsTable';
import { SaleItemFormImproved } from '@/components/sales/SaleItemFormImproved';
import { salesApi } from '@/services/api/sales';
import { cn } from '@/lib/utils';
import type { CreateSaleRequest } from '@/types/sales';

const saleItemSchema = z.object({
  item_id: z.string().min(1, 'Item is required'),
  item_name: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_price: z.number().min(0, 'Unit price must be positive'),
  tax_rate: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  discount_amount: z.number().min(0, 'Discount amount cannot be negative'),
  notes: z.string().optional(),
  available_quantity: z.number().optional(),
});

const saleFormSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  transaction_date: z.date(),
  notes: z.string().optional(),
  reference_number: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
});

type SaleFormValues = z.infer<typeof saleFormSchema>;
type SaleItem = z.infer<typeof saleItemSchema>;

interface SaleFormProps {
  onSuccess?: (saleId: string, transactionNumber: string) => void;
  onCancel?: () => void;
  initialData?: Partial<SaleFormValues>;
  className?: string;
}

export function SaleForm({ 
  onSuccess, 
  onCancel, 
  initialData,
  className 
}: SaleFormProps) {
  const router = useRouter();
  
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
  
  const [selectedCustomer, setSelectedCustomer] = useState<any>();

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      customer_id: initialData?.customer_id || '',
      transaction_date: initialData?.transaction_date || new Date(),
      notes: initialData?.notes || '',
      reference_number: initialData?.reference_number || '',
      items: initialData?.items || [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Calculation functions for sale totals
  const calculateTotalTaxAmount = () => {
    return fields.reduce((sum, item) => {
      const unitPrice = (item as any).unit_price || (item as any).unit_cost || 0;
      const subtotal = item.quantity * unitPrice;
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
    return fields.reduce((sum, item) => {
      const unitPrice = (item as any).unit_price || (item as any).unit_cost || 0;
      return sum + (item.quantity * unitPrice);
    }, 0);
  };

  const calculateGrandTotal = () => {
    const totalAmount = calculateTotalAmount();
    const taxAmount = calculateTotalTaxAmount();
    const discountAmount = calculateAggregatedDiscountAmount();
    return totalAmount + taxAmount - discountAmount;
  };

  const onSubmit = async (values: SaleFormValues) => {
    if (!formValidation.isValid && formValidation.errors.length > 0) {
      console.warn('Form has validation errors:', formValidation.errors);
      return;
    }

    try {
      // Log raw form values first
      console.log('🚀 === SALE FORM SUBMISSION START ===');
      console.log('📋 Raw Form Values:', JSON.stringify(values, null, 2));
      console.log('📊 Form Fields Array:', values.items);
      console.log('💰 Calculated Totals:');
      console.log('  - Total Amount:', calculateTotalAmount());
      console.log('  - Tax Amount:', calculateTotalTaxAmount());
      console.log('  - Discount Amount:', calculateAggregatedDiscountAmount());
      console.log('  - Grand Total:', calculateGrandTotal());

      // Fix the payload structure to match API specification
      const formData: CreateSaleRequest = {
        customer_id: values.customer_id,
        transaction_date: format(values.transaction_date, 'yyyy-MM-dd'),
        reference_number: values.reference_number,
        notes: values.notes,
        items: values.items.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          unit_cost: (item as any).unit_price || (item as any).unit_cost || 0, // Backend expects unit_cost
          tax_rate: item.tax_rate || 0,
          discount_amount: item.discount_amount || 0,
          notes: item.notes,
        })),
      };

      console.log('📦 === FINAL SALE RECORD PAYLOAD ===');
      console.log('🔥 Complete JSON Payload being sent to API:');
      console.log(JSON.stringify(formData, null, 2));
      console.log('');
      console.log('📝 Payload Summary:');
      console.log('  - Customer ID:', formData.customer_id);
      console.log('  - Transaction Date:', formData.transaction_date);
      console.log('  - Reference Number:', formData.reference_number);
      console.log('  - Notes:', formData.notes);
      console.log('  - Number of Items:', formData.items.length);
      console.log('');
      console.log('🛍️ Detailed Items Breakdown:');
      formData.items.forEach((item, index) => {
        const itemTotal = item.quantity * item.unit_cost;
        const itemTax = (itemTotal - (item.discount_amount || 0)) * ((item.tax_rate || 0) / 100);
        const itemGrandTotal = itemTotal + itemTax - (item.discount_amount || 0);
        
        console.log(`  📋 Item ${index + 1}:`);
        console.log(`    - Item ID: ${item.item_id}`);
        console.log(`    - Quantity: ${item.quantity}`);
        console.log(`    - Unit Cost: ₹${item.unit_cost}`);
        console.log(`    - Tax Rate: ${item.tax_rate}%`);
        console.log(`    - Discount Amount: ₹${item.discount_amount}`);
        console.log(`    - Notes: ${item.notes || 'None'}`);
        console.log(`    - Item Total (before tax/discount): ₹${itemTotal.toFixed(2)}`);
        console.log(`    - Item Tax Amount: ₹${itemTax.toFixed(2)}`);
        console.log(`    - Item Grand Total: ₹${itemGrandTotal.toFixed(2)}`);
        console.log('');
      });
      console.log('💸 Overall Financial Summary:');
      console.log(`  - Subtotal (all items): ₹${calculateTotalAmount().toFixed(2)}`);
      console.log(`  - Total Tax: ₹${calculateTotalTaxAmount().toFixed(2)}`);
      console.log(`  - Total Discount: ₹${calculateAggregatedDiscountAmount().toFixed(2)}`);
      console.log(`  - GRAND TOTAL: ₹${calculateGrandTotal().toFixed(2)}`);
      console.log('');
      console.log('🌐 API Request Details:');
      console.log('  - Endpoint: POST /transactions/sales/new');
      console.log('  - Content-Type: application/json');
      console.log('  - Timestamp:', new Date().toISOString());
      console.log('==============================================');

      const result = await salesApi.createNewSale(formData);
      
      console.log('✅ === SALE CREATION SUCCESS ===');
      console.log('🎉 Server Response:', JSON.stringify(result, null, 2));
      console.log('📋 Created Sale ID:', result?.transaction_id);
      console.log('=======================================');
      
      if (onSuccess) {
        onSuccess(result.transaction_id, result.transaction_number);
      } else {
        router.push(`/sales/${result.transaction_id}`);
      }
    } catch (error) {
      console.log('❌ === SALE CREATION FAILED ===');
      console.error('💥 Error Details:', error);
      console.error('🔍 Error Message:', error?.message);
      console.error('📡 Error Response:', error?.response?.data);
      console.error('🌐 Error Status:', error?.response?.status);
      console.log('=====================================');
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

  const handleEditItem = (index: number, item: SaleItem) => {
    setEditingItemIndex(index);
    setIsItemFormOpen(true);
  };

  const handleRemoveItem = (index: number) => {
    remove(index);
  };

  const handleItemFormSubmit = (itemData: any) => {
    try {
      const saleItem: SaleItem = {
        item_id: itemData.item_id,
        item_name: itemData.item_name || '',
        sku: itemData.sku || '',
        quantity: itemData.quantity,
        unit_price: itemData.unit_price || itemData.unit_cost || 0, // Support both field names
        tax_rate: itemData.tax_rate || 0,
        discount_amount: itemData.discount_amount || 0,
        notes: itemData.notes,
        available_quantity: itemData.available_quantity,
      };

      if (editingItemIndex !== null) {
        update(editingItemIndex, saleItem);
      } else {
        append(saleItem);
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

  return (
    <div className="container mx-auto p-6 space-y-6" style={{ maxWidth: '1382px' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Record Sale</h1>
          <p className="text-muted-foreground">Create a new sales transaction with items</p>
        </div>
        <Button variant="ghost" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Sale Details */}
          <Card>
            <CardHeader>
              <CardTitle>Sale Details</CardTitle>
              <CardDescription>Basic information about this sale</CardDescription>
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
                            setSelectedCustomer(customer);
                          }}
                          placeholder="Select customer..."
                          fullWidth
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transaction_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sale Date *</FormLabel>
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

                <FormField
                  control={form.control}
                  name="reference_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Invoice-12345, Receipt-67890..." {...field} />
                      </FormControl>
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
                        Total discount from sale items
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
                        placeholder="Additional notes about this sale..."
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

          {/* Sale Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Sale Items</h2>
                <p className="text-muted-foreground">Add items to this sale</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleAddExistingItem}
                  variant="default"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Sale Item
                </Button>
              </div>
            </div>

            <SaleItemsTable
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
              disabled={fields.length === 0}
            >
              {false ? (
                <>
                  <Package2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording Sale...
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
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto border-0 shadow-2xl backdrop-blur-sm bg-white/95" style={{ maxWidth: '1400px' }}>
          <DialogHeader className="space-y-2 pb-4 border-b border-gray-100">
            <DialogTitle className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-slate-50 rounded-lg">
                <Package className="h-5 w-5 text-slate-600" />
              </div>
              {editingItemIndex !== null ? 'Edit Sale Item' : 'Add Sale Item'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-base leading-relaxed">
              {editingItemIndex !== null 
                ? 'Update the details for this sale item with pricing information.'
                : 'Select items from your inventory and add them to this sale.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <SaleItemFormImproved
            initialData={editingItemIndex !== null ? fields[editingItemIndex] : undefined}
            onSubmit={handleItemFormSubmit}
            onCancel={handleItemFormCancel}
            isSubmitting={false}
            resetTrigger={formResetTrigger}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}