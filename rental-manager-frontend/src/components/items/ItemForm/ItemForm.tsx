'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CategoryDropdown } from '@/components/categories/CategoryDropdown';
import { BrandDropdown } from '@/components/brands/BrandDropdown';
import { UnitOfMeasurementDropdown } from '@/components/units-of-measurement/UnitOfMeasurementDropdown';
import { 
  Package, 
  Info,
  Calculator,
  Barcode,
  FileText,
  Warehouse,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { itemFormSchema, type ItemFormData } from './ItemForm.validation';
import type { Item } from '@/types/item';
import { useAppStore } from '@/stores/app-store';
// Default rental period constants
const DEFAULT_RENTAL_PERIOD = 'DAILY';
const DEFAULT_RENTAL_PERIOD_VALUE = 1;
const getRentalPeriodOptions = () => [
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

interface ItemFormProps {
  initialData?: Partial<Item>;
  onSubmit: (data: ItemFormData) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  className?: string;
  mode?: 'create' | 'edit';
  hideButtons?: boolean;
  formId?: string;
}

export function ItemForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = 'Save Item',
  cancelLabel = 'Cancel',
  className,
  mode = 'create',
  hideButtons = false,
  formId = 'item-form',
}: ItemFormProps) {
  const { addNotification } = useAppStore();
  
  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      item_name: initialData?.item_name || '',
      item_status: initialData?.item_status || 'ACTIVE',
      category_id: initialData?.category_id || '',
      brand_id: initialData?.brand_id || '',
      unit_of_measurement_id: initialData?.unit_of_measurement_id || '',
      description: initialData?.description || '',
      specifications: initialData?.specifications || '',
      model_number: initialData?.model_number || '',
      rental_rate_per_period: initialData?.rental_rate_per_period || undefined,
      rental_period: initialData?.rental_period ? parseInt(initialData.rental_period.toString()) : DEFAULT_RENTAL_PERIOD_VALUE,
      sale_price: initialData?.sale_price || undefined,
      purchase_price: initialData?.purchase_price || undefined,
      initial_stock_quantity: initialData?.initial_stock_quantity || 0,
      security_deposit: initialData?.security_deposit || undefined,
      serial_number_required: initialData?.serial_number_required || false,
      warranty_period_days: initialData?.warranty_period_days ? parseInt(initialData.warranty_period_days.toString()) : 0,
      reorder_point: initialData?.reorder_point || 0,
      is_rentable: initialData?.is_rentable ?? true,
      is_salable: initialData?.is_salable ?? false,
    },
  });

  const { handleSubmit, formState: { errors }, watch, setValue, reset } = form;

  // Watch form values for real-time validation
  const watchedValues = watch();
  const { item_name, is_rentable, is_salable, rental_period, sale_price } = watchedValues;

  // Check if all mandatory fields are filled
  const isFormValid = React.useMemo(() => {
    // Item name is always required
    if (!item_name || item_name.trim() === '') {
      return false;
    }

    // If rental is enabled, rental period is required
    if (is_rentable && (!rental_period || rental_period < 1)) {
      return false;
    }

    // Sale price is now optional - can be 0 or null for saleable items

    return true;
  }, [item_name, is_rentable, rental_period]);

  const isRentable = watch('is_rentable');
  const isSalable = watch('is_salable');

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      reset({
        item_name: initialData.item_name || '',
        item_status: initialData.item_status || 'ACTIVE',
        category_id: initialData.category_id || '',
        brand_id: initialData.brand_id || '',
        unit_of_measurement_id: initialData.unit_of_measurement_id || '',
        description: initialData.description || '',
        specifications: initialData.specifications || '',
        model_number: initialData.model_number || '',
        rental_rate_per_period: initialData.rental_rate_per_period || undefined,
        rental_period: initialData.rental_period ? parseInt(initialData.rental_period.toString()) : DEFAULT_RENTAL_PERIOD_VALUE,
        sale_price: initialData.sale_price || undefined,
        purchase_price: initialData.purchase_price || undefined,
        initial_stock_quantity: initialData.initial_stock_quantity || 0,
        security_deposit: initialData.security_deposit || undefined,
        serial_number_required: initialData.serial_number_required || false,
        warranty_period_days: initialData.warranty_period_days ? parseInt(initialData.warranty_period_days.toString()) : 0,
        reorder_point: initialData.reorder_point || 0,
        is_rentable: initialData.is_rentable ?? true,
        is_salable: initialData.is_salable ?? false,
      });
    }
  }, [initialData, reset]);


  const handleFormSubmit = (data: ItemFormData) => {
    // Transform form data to match backend API schema
    const apiPayload = {
      item_name: data.item_name,
      status: mode === 'create' ? 'ACTIVE' : data.item_status,
      brand_id: data.brand_id && data.brand_id.trim() !== '' ? data.brand_id : null,
      category_id: data.category_id && data.category_id.trim() !== '' ? data.category_id : null,
      unit_of_measurement_id: data.unit_of_measurement_id && data.unit_of_measurement_id.trim() !== '' ? data.unit_of_measurement_id : null,
      rental_rate_per_day: data.rental_rate_per_period && data.rental_rate_per_period > 0 ? data.rental_rate_per_period : null,
      sale_price: isNaN(data.sale_price) ? null : (data.sale_price || 0),
      cost_price: data.purchase_price && data.purchase_price > 0 ? data.purchase_price : null,
      reorder_level: data.reorder_point || null,
      security_deposit: isNaN(data.security_deposit) ? null : (data.security_deposit && data.security_deposit > 0 ? data.security_deposit : null),
      description: data.description && data.description.trim() !== '' ? data.description.trim() : null,
      notes: data.specifications && data.specifications.trim() !== '' ? data.specifications.trim() : null,
      requires_serial_number: data.serial_number_required || false,
      is_rentable: data.is_rentable ?? true,
      is_salable: data.is_salable ?? false,
    };
    
    onSubmit(apiPayload);
  };

  return (
    <form id={formId} onSubmit={handleSubmit(handleFormSubmit)} className={cn('space-y-4', className)}>
      {/* Basic Information */}
      <div className="space-y-4">
        {/* Item name and availability */}
        <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item_name">Item Name *</Label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    id="item_name"
                    data-testid="item-name-input"
                    {...form.register('item_name')}
                    placeholder="e.g., DeWalt Drill"
                    className={errors.item_name ? 'border-red-500' : ''}
                  />
                </div>
                
                <div className="border border-gray-400 rounded-md px-3 py-2 bg-transparent h-9 flex items-center">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_rentable"
                      data-testid="is-rentable-checkbox"
                      checked={watch('is_rentable')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          form.setValue('is_rentable', true);
                          form.setValue('is_salable', false);
                          // Clear sale_price when switching to rentable
                          form.setValue('sale_price', undefined);
                        } else {
                          form.setValue('is_rentable', false);
                          // Clear rental fields when unchecked
                          form.setValue('rental_rate_per_period', undefined);
                          form.setValue('rental_period', DEFAULT_RENTAL_PERIOD_VALUE);
                          form.setValue('security_deposit', undefined);
                        }
                      }}
                    />
                    <Label htmlFor="is_rentable" className="cursor-pointer font-normal text-sm">
                      Available for Rental
                    </Label>
                  </div>
                </div>
                
                <div className="border border-gray-400 rounded-md px-3 py-2 bg-transparent h-9 flex items-center">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_saleable"
                      data-testid="is-salable-checkbox"
                      checked={watch('is_salable')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          form.setValue('is_salable', true);
                          form.setValue('is_rentable', false);
                          // Clear rental fields when switching to saleable
                          form.setValue('rental_rate_per_period', undefined);
                          form.setValue('rental_period', DEFAULT_RENTAL_PERIOD_VALUE);
                          form.setValue('security_deposit', undefined);
                        } else {
                          form.setValue('is_salable', false);
                          // Clear sale_price when unchecked
                          form.setValue('sale_price', undefined);
                        }
                      }}
                    />
                    <Label htmlFor="is_saleable" className="cursor-pointer font-normal text-sm">
                      Available for Sale
                    </Label>
                  </div>
                </div>

                <div className="border border-gray-400 rounded-md px-3 py-2 bg-transparent h-9 flex items-center">
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm font-medium">Serial No.</Label>
                    <Checkbox
                      id="serial_number_required"
                      checked={watch('serial_number_required')}
                      onCheckedChange={(checked) => form.setValue('serial_number_required', checked as boolean)}
                    />
                    <Label htmlFor="serial_number_required" className="cursor-pointer font-normal text-sm">
                      Required
                    </Label>
                  </div>
                </div>
              </div>
              {errors.item_name && (
                <p className="text-sm text-red-600">{errors.item_name.message}</p>
              )}
            </div>

            {/* Categories and dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <div className="h-9">
                  <CategoryDropdown
                    data-testid="category-dropdown"
                    value={watch('category_id')}
                    onChange={(categoryId) => form.setValue('category_id', categoryId)}
                    error={!!errors.category_id}
                    helperText={errors.category_id?.message}
                    fullWidth
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Brand</Label>
                <div className="h-9">
                  <BrandDropdown
                    data-testid="brand-dropdown"
                    value={watch('brand_id')}
                    onChange={(brandId) => form.setValue('brand_id', brandId || '')}
                    error={!!errors.brand_id}
                    helperText={errors.brand_id?.message}
                    fullWidth
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Unit of Measurement *</Label>
                <div className="h-9">
                  <UnitOfMeasurementDropdown
                    data-testid="unit-dropdown"
                    value={watch('unit_of_measurement_id')}
                    onChange={(unitId) => form.setValue('unit_of_measurement_id', unitId || '')}
                    error={!!errors.unit_of_measurement_id}
                    helperText={errors.unit_of_measurement_id?.message}
                    fullWidth
                  />
                </div>
              </div>
            </div>

            {/* SKU section */}
            {initialData?.sku && (
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">SKU:</Label>
                  <span className="text-sm font-medium">{initialData.sku}</span>
                </div>
              </div>
            )}

            {/* Model, Warranty, and Specifications */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="model_number">Model Number</Label>
                <Input
                  id="model_number"
                  {...form.register('model_number')}
                  placeholder="e.g., DWD110K"
                  className={cn('h-9', errors.model_number ? 'border-red-500' : '')}
                />
                {errors.model_number && (
                  <p className="text-sm text-red-600">{errors.model_number.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="warranty_period_days">Warranty (days)</Label>
                <Input
                  id="warranty_period_days"
                  type="number"
                  min="0"
                  step="1"
                  {...form.register('warranty_period_days', {
                    valueAsNumber: true,
                    setValueAs: (value) => {
                      const num = parseInt(value);
                      return isNaN(num) ? 0 : Math.max(0, num);
                    }
                  })}
                  onFocus={(e) => {
                    // Clear field if it contains the default value
                    if (e.target.value === '0') {
                      e.target.select();
                    }
                  }}
                  placeholder="e.g., 365"
                  className={cn('h-9', errors.warranty_period_days ? 'border-red-500' : '')}
                />
                {errors.warranty_period_days && (
                  <p className="text-sm text-red-600">{errors.warranty_period_days.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="specifications">Specifications</Label>
                <Input
                  id="specifications"
                  {...form.register('specifications')}
                  placeholder="Tech specs..."
                  className={cn('h-9', errors.specifications ? 'border-red-500' : '')}
                />
                {errors.specifications && (
                  <p className="text-sm text-red-600">{errors.specifications.message}</p>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* Pricing & Details */}
      <div>
          <div className="space-y-4">
            {/* Purchase Price, Sale Price, and Initial Stock Quantity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Purchase Price (₹)</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  step="1"
                  min="0"
                  {...form.register('purchase_price')}
                  placeholder="Enter purchase price (optional)"
                  className={cn('h-9', errors.purchase_price ? 'border-red-500' : '')}
                />
                {errors.purchase_price && (
                  <p className="text-sm text-red-600">{errors.purchase_price.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sale_price">
                  Sale Price (₹) <span className="text-gray-500 text-xs font-normal">(Optional - can be 0 for free items)</span>
                </Label>
                <Input
                  id="sale_price"
                  type="number"
                  step="1"
                  min="0"
                  {...form.register('sale_price')}
                  placeholder="0"
                  className={cn('h-9', errors.sale_price ? 'border-red-500' : '')}
                />
                {errors.sale_price && (
                  <p className="text-sm text-red-600">{errors.sale_price.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="initial_stock_quantity">Initial Stock Qty *</Label>
                <Input
                  id="initial_stock_quantity"
                  type="number"
                  min="0"
                  {...form.register('initial_stock_quantity')}
                  placeholder="0"
                  className={cn('h-9', errors.initial_stock_quantity ? 'border-red-500' : '')}
                />
                {errors.initial_stock_quantity && (
                  <p className="text-sm text-red-600">{errors.initial_stock_quantity.message}</p>
                )}
              </div>
            </div>

            {/* Reorder Point */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="reorder_point" className="flex items-center space-x-2">
                  <span>Reorder Point</span>
                  <div className="group relative">
                    <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <div className="invisible group-hover:visible absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 text-xs text-white bg-gray-900 rounded shadow-lg">
                      Stock level at which to reorder this item. Alert will be triggered when stock drops to this level.
                    </div>
                  </div>
                </Label>
                <Input
                  id="reorder_point"
                  type="number"
                  min="0"
                  step="1"
                  {...form.register('reorder_point')}
                  placeholder="5"
                  className={cn('h-9', errors.reorder_point ? 'border-red-500' : '')}
                />
                {errors.reorder_point && (
                  <p className="text-sm text-red-600">{errors.reorder_point.message}</p>
                )}
                {!errors.reorder_point && form.watch('initial_stock_quantity') && form.watch('reorder_point') && (
                  <p className="text-xs text-gray-500">
                    Alert when stock drops to {form.watch('reorder_point')} units
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {/* Reorder Point Suggestions */}
                {form.watch('initial_stock_quantity') && (
                  <div className="mt-6 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <h4 className="text-xs font-semibold text-slate-800 mb-2">💡 Suggestion</h4>
                    <div className="text-xs text-slate-700">
                      <div>
                        Recommended: {Math.ceil(Number(form.watch('initial_stock_quantity')) * 0.2)} 
                        <span className="text-slate-600"> (20% of initial stock)</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        This ensures you're alerted before running out of stock
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rental and Security Deposit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rental_rate_per_period" className="flex items-center gap-1">
                  Rental Rate (₹)
                </Label>
                <Input
                  id="rental_rate_per_period"
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!isRentable}
                  {...form.register('rental_rate_per_period')}
                  placeholder={isRentable ? "" : "Not applicable"}
                  className={cn(
                    'h-9', 
                    errors.rental_rate_per_period ? 'border-red-500' : '',
                    !isRentable ? 'bg-gray-100 text-gray-500' : ''
                  )}
                />
                {errors.rental_rate_per_period && (
                  <p className="text-sm text-red-600">{errors.rental_rate_per_period.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rental_period" className="flex items-center gap-1">
                  Rental Period in Days
                  {isRentable && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="rental_period"
                  type="number"
                  min="1"
                  step="1"
                  disabled={!isRentable}
                  {...form.register('rental_period', {
                    valueAsNumber: true,
                    setValueAs: (value) => {
                      const num = parseInt(value);
                      return isNaN(num) ? 1 : Math.max(1, num);
                    }
                  })}
                  onFocus={(e) => {
                    // Clear field if it contains the default value
                    if (e.target.value === '1' || e.target.value === '0') {
                      e.target.select();
                    }
                  }}
                  placeholder={isRentable ? "1" : "Not applicable"}
                  className={cn(
                    'h-9', 
                    errors.rental_period ? 'border-red-500' : '',
                    !isRentable ? 'bg-gray-100 text-gray-500' : ''
                  )}
                />
                {errors.rental_period && (
                  <p className="text-sm text-red-600">{errors.rental_period.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="security_deposit">Security Deposit (₹)</Label>
                <Input
                  id="security_deposit"
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!isRentable}
                  {...form.register('security_deposit')}
                  placeholder={isRentable ? "0.00" : "Not applicable"}
                  className={cn(
                    'h-9', 
                    errors.security_deposit ? 'border-red-500' : '',
                    !isRentable ? 'bg-gray-100 text-gray-500' : ''
                  )}
                />
                {errors.security_deposit && (
                  <p className="text-sm text-red-600">{errors.security_deposit.message}</p>
                )}
              </div>
            </div>
          </div>
      </div>

      {/* Description and Status - Final Row */}
      <div className="flex gap-6">
        {/* Description */}
        <div className="flex-1 space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...form.register('description')}
            placeholder="Enter item description..."
            className={cn('min-h-[80px] border-gray-600', errors.description ? 'border-red-500' : '')}
          />
          {errors.description && (
            <p className="text-sm text-red-600">{errors.description.message}</p>
          )}
        </div>

        {/* Status */}
        <div className="w-80 space-y-2">
          <Label>Status</Label>
          <div className="border border-gray-400 rounded-md px-3 py-2 bg-transparent">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="active"
                  name="item_status"
                  value="ACTIVE"
                  checked={watch('item_status') === 'ACTIVE'}
                  onChange={(e) => form.setValue('item_status', e.target.value as any)}
                  className="h-3 w-3"
                />
                <Label htmlFor="active" className="cursor-pointer font-normal text-sm">
                  Active
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="inactive"
                  name="item_status"
                  value="INACTIVE"
                  checked={watch('item_status') === 'INACTIVE'}
                  onChange={(e) => form.setValue('item_status', e.target.value as any)}
                  className="h-3 w-3"
                />
                <Label htmlFor="inactive" className="cursor-pointer font-normal text-sm">
                  Inactive
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="discontinued"
                  name="item_status"
                  value="DISCONTINUED"
                  checked={watch('item_status') === 'DISCONTINUED'}
                  onChange={(e) => form.setValue('item_status', e.target.value as any)}
                  className="h-3 w-3"
                />
                <Label htmlFor="discontinued" className="cursor-pointer font-normal text-sm">
                  Discontinued
                </Label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Status */}
      {!isFormValid && (
        <Alert className="mt-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">Required fields missing:</span>
            <ul className="mt-1 ml-4 list-disc">
              {!item_name?.trim() && <li>Item name</li>}
              {is_rentable && (!rental_period || rental_period < 1) && <li>Rental period (when available for rental)</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Form Actions */}
      {!hideButtons && (
        <div className="flex items-center justify-end space-x-4 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className={cn(
              "min-w-[120px] transition-colors duration-200",
              isFormValid && !isSubmitting 
                ? "bg-green-600 hover:bg-green-700 text-white" 
                : "bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <>
                <Calculator className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      )}
    </form>
  );
}