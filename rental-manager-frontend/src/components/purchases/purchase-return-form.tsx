'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { CalendarIcon, Plus, Trash2, ArrowLeft, RotateCcw, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useCreatePurchaseReturn, usePurchase, usePurchaseReturnValidation } from '@/hooks/use-purchases';
import { PurchaseValidator, PurchaseBusinessLogic } from '@/lib/purchase-validation';
import { cn } from '@/lib/utils';
import type { PurchaseReturnFormData, ReturnReason, ItemCondition } from '@/types/purchases';
import { RETURN_REASONS, ITEM_CONDITIONS } from '@/types/purchases';

const returnItemSchema = z.object({
  sku_id: z.string().min(1, 'SKU is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_cost: z.number().min(0, 'Unit cost must be positive'),
  return_reason: z.enum(['DEFECTIVE', 'WRONG_ITEM', 'OVERSTOCKED', 'QUALITY_ISSUE', 'OTHER']),
  condition: z.enum(['A', 'B', 'C', 'D']).optional(),
  notes: z.string().optional(),
});

const returnFormSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier is required'),
  original_purchase_id: z.string().min(1, 'Original purchase is required'),
  return_date: z.date(),
  refund_amount: z.number().min(0, 'Refund amount must be positive'),
  return_authorization: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(returnItemSchema).min(1, 'At least one item is required'),
});

type ReturnFormValues = z.infer<typeof returnFormSchema>;

interface PurchaseReturnFormProps {
  purchaseId?: string;
  onSuccess?: (returnRecord: any) => void;
  onCancel?: () => void;
}

export function PurchaseReturnForm({ 
  purchaseId: initialPurchaseId, 
  onSuccess, 
  onCancel 
}: PurchaseReturnFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramPurchaseId = searchParams.get('purchase_id');
  const purchaseId = initialPurchaseId || paramPurchaseId;

  const createReturn = useCreatePurchaseReturn();
  const validateReturn = usePurchaseReturnValidation();
  
  const { 
    data: originalPurchase, 
    isLoading: loadingPurchase 
  } = usePurchase(purchaseId || '');

  const [validationResult, setValidationResult] = useState<any>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [formValidation, setFormValidation] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>({ isValid: true, errors: [], warnings: [] });

  const form = useForm<ReturnFormValues>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: {
      supplier_id: '',
      original_purchase_id: purchaseId || '',
      return_date: new Date(),
      refund_amount: 0,
      return_authorization: '',
      notes: '',
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Update form when original purchase loads
  useEffect(() => {
    if (originalPurchase) {
      form.setValue('supplier_id', originalPurchase.supplier_id);
      form.setValue('original_purchase_id', originalPurchase.id);
      
      // Pre-populate with available items from original purchase
      if (fields.length === 0) {
        originalPurchase.items.forEach(item => {
          append({
            sku_id: item.sku_id,
            quantity: 1,
            unit_cost: item.unit_cost,
            return_reason: 'DEFECTIVE',
            condition: item.condition as ItemCondition,
            notes: '',
          });
        });
      }
    }
  }, [originalPurchase, form, fields.length, append]);

  const onSubmit = async (values: ReturnFormValues) => {
    try {
      const formData: PurchaseReturnFormData = {
        supplier_id: values.supplier_id,
        original_purchase_id: values.original_purchase_id,
        return_date: format(values.return_date, 'yyyy-MM-dd'),
        refund_amount: values.refund_amount,
        return_authorization: values.return_authorization,
        notes: values.notes,
        items: values.items.map(item => ({
          sku_id: item.sku_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          return_reason: item.return_reason as ReturnReason,
          condition: item.condition as ItemCondition,
          notes: item.notes,
        })),
      };

      const result = await createReturn.mutateAsync(formData);
      
      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/purchases/returns/${result.id}`);
      }
    } catch (error) {
      console.error('Return creation failed:', error);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const handleValidateReturn = async () => {
    const items = form.getValues('items');
    const purchaseId = form.getValues('original_purchase_id');
    
    if (!purchaseId || items.length === 0) return;

    try {
      const result = await validateReturn.mutateAsync({
        originalPurchaseId: purchaseId,
        items
      });
      setValidationResult(result);
      setShowValidation(true);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const addItem = () => {
    append({
      sku_id: '',
      quantity: 1,
      unit_cost: 0,
      return_reason: 'DEFECTIVE',
      condition: 'A',
      notes: '',
    });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const calculateTotalRefund = () => {
    const items = form.watch('items');
    return items.reduce((total, item) => total + (item.quantity * item.unit_cost), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  // Auto-calculate refund amount and validate when items change
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.items && originalPurchase) {
        // Calculate recommended refund
        const recommendedRefund = PurchaseBusinessLogic.getRecommendedRefundAmount(
          value.items as PurchaseReturnFormData['items'],
          originalPurchase
        );
        
        // Update refund amount if user hasn't manually set it
        const currentRefund = form.getValues('refund_amount');
        if (currentRefund === 0 || Math.abs(currentRefund - calculateTotalRefund()) < 0.01) {
          form.setValue('refund_amount', recommendedRefund);
        }
        
        // Validate form
        const formData = form.getValues() as any;
        if (formData.items && formData.items.length > 0) {
          const validation = PurchaseValidator.validatePurchaseReturnForm(
            formData,
            originalPurchase
          );
          setFormValidation(validation);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, originalPurchase]);

  if (loadingPurchase) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RotateCcw className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-sm text-muted-foreground">Loading purchase details...</p>
        </div>
      </div>
    );
  }

  if (!originalPurchase) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Original purchase not found. Please select a valid purchase to create a return.
        </AlertDescription>
      </Alert>
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
            <h1 className="text-2xl font-bold tracking-tight">Create Purchase Return</h1>
            <p className="text-muted-foreground">
              Return items to {originalPurchase.supplier?.display_name || 'supplier'}
            </p>
          </div>
        </div>
      </div>

      {/* Original Purchase Info */}
      <Card>
        <CardHeader>
          <CardTitle>Original Purchase</CardTitle>
          <CardDescription>
            Purchase being returned
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium">Reference</p>
              <p className="text-sm text-muted-foreground">
                {originalPurchase.reference_number || `#${originalPurchase.id.slice(0, 8)}`}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Purchase Date</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(originalPurchase.purchase_date), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Total Amount</p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(originalPurchase.total_amount)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Total Items</p>
              <p className="text-sm text-muted-foreground">
                {originalPurchase.total_items}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Return Details */}
          <Card>
            <CardHeader>
              <CardTitle>Return Details</CardTitle>
              <CardDescription>
                Enter the details about this return
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="return_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Return Date *</FormLabel>
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
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date(originalPurchase.purchase_date)
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="return_authorization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Return Authorization</FormLabel>
                      <FormControl>
                        <Input placeholder="RMA-001, etc." {...field} />
                      </FormControl>
                      <FormDescription>
                        Optional return authorization number from supplier
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
                        placeholder="Additional notes about this return..."
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

          {/* Return Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Return Items</CardTitle>
                  <CardDescription>
                    Select items to return to the supplier
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleValidateReturn}
                    disabled={validateReturn.isPending}
                  >
                    {validateReturn.isPending ? 'Validating...' : 'Validate Return'}
                  </Button>
                  <Button type="button" onClick={addItem} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
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

              {/* API Validation Results */}
              {showValidation && validationResult && (
                <Alert variant={validationResult.is_valid ? "default" : "destructive"}>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {validationResult.is_valid ? (
                      "Return validation passed. All items are available for return."
                    ) : (
                      <div>
                        <p>Return validation failed:</p>
                        <ul className="list-disc list-inside mt-2">
                          {validationResult.errors.map((error: string, index: number) => (
                            <li key={index} className="text-sm">{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Return Item {index + 1}</h4>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.sku_id`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select SKU" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {originalPurchase.items.map((item) => (
                                <SelectItem key={item.sku_id} value={item.sku_id}>
                                  <div className="flex flex-col">
                                    <span>{item.sku?.display_name || item.sku_id}</span>
                                    <span className="text-xs text-muted-foreground">
                                      Purchased: {item.quantity} @ {formatCurrency(item.unit_cost)}
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
                      name={`items.${index}.return_reason`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Return Reason *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {RETURN_REASONS.map((reason) => (
                                <SelectItem key={reason.value} value={reason.value}>
                                  <div className="flex flex-col">
                                    <span>{reason.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {reason.description}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.condition`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Condition</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select condition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ITEM_CONDITIONS.map((condition) => (
                                <SelectItem key={condition.value} value={condition.value}>
                                  {condition.label}
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

                  {/* Item Total */}
                  <div className="flex justify-end pt-2 border-t">
                    <div className="text-sm text-muted-foreground">
                      Item Refund: {formatCurrency(form.watch(`items.${index}.quantity`) * form.watch(`items.${index}.unit_cost`))}
                    </div>
                  </div>
                </div>
              ))}

              {fields.length === 0 && (
                <Alert>
                  <AlertDescription>
                    No items added yet. Click "Add Item" to add items to return.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Refund Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Refund Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Return Items</p>
                  <p className="text-2xl font-bold">
                    {form.watch('items').reduce((sum, item) => sum + item.quantity, 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Calculated Refund</p>
                  <p className="text-2xl font-bold">{formatCurrency(calculateTotalRefund())}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    <FormLabel htmlFor="refund_amount">Actual Refund Amount *</FormLabel>
                  </p>
                  <FormField
                    control={form.control}
                    name="refund_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            id="refund_amount"
                            type="number"
                            min="0"
                            step="0.01"
                            className="text-xl font-bold"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
              disabled={createReturn.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createReturn.isPending}
              className="min-w-[140px]"
            >
              {createReturn.isPending ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                  Creating Return...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Return
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}