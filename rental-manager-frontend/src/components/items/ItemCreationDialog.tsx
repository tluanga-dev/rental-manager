'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, Package2, Package } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryDropdown } from '@/components/categories/CategoryDropdown';
import { BrandDropdown } from '@/components/brands/BrandDropdown';
import { useCreateItem } from '@/components/items/hooks/useItems';

// Simplified schema for quick item creation
const quickItemSchema = z.object({
  sku: z.string().max(100).transform(val => val.toUpperCase()).optional(), // SKU is optional, backend will generate
  item_name: z.string().min(1, 'Item name is required').max(255).transform(val => val.trim()),
  category_id: z.string().min(1, 'Category is required'),
  brand_id: z.string().optional(),
  description: z.string().max(1000).optional(),
  barcode: z.string().max(100).regex(/^[a-zA-Z0-9]*$/, 'Barcode must be alphanumeric').transform(val => val.toUpperCase()).optional(),
  model_number: z.string().max(100).optional(),
  weight: z.number().min(0).optional(),
  is_serialized: z.boolean().default(false),
  is_rentable: z.boolean().default(false),
  is_saleable: z.boolean().default(true),
  rental_base_price: z.number().min(0).optional(),
  sale_base_price: z.number().min(0).optional(),
  min_rental_days: z.number().min(1).default(1),
  rental_period: z.number().min(1).default(1),
  max_rental_days: z.number().min(1).optional(),
});

type QuickItemFormData = z.infer<typeof quickItemSchema>;

interface ItemCreationDialogProps {
  onItemCreated: (item: any) => void;
  triggerButton?: React.ReactNode;
  defaultValues?: Partial<QuickItemFormData>;
}

export function ItemCreationDialog({ 
  onItemCreated, 
  triggerButton,
  defaultValues = {}
}: ItemCreationDialogProps) {
  const [open, setOpen] = useState(false);
  const createItem = useCreateItem();

  const form = useForm<QuickItemFormData>({
    resolver: zodResolver(quickItemSchema),
    defaultValues: {
      sku: undefined, // SKU will be auto-generated
      item_name: '',
      category_id: '',
      brand_id: '',
      description: '',
      barcode: '',
      model_number: '',
      weight: undefined,
      is_serialized: false,
      is_rentable: false,
      is_saleable: true,
      rental_base_price: undefined,
      sale_base_price: undefined,
      min_rental_days: 1,
      rental_period: 1,
      max_rental_days: undefined,
      ...defaultValues,
    },
  });

  const { handleSubmit, formState: { errors }, watch, setValue, reset } = form;

  // Auto-calculate rental price based on sale price
  const salePrice = watch('sale_base_price');
  const isRentable = watch('is_rentable');
  React.useEffect(() => {
    if (isRentable && salePrice && salePrice > 0) {
      // Set rental price as 10% of sale price per day
      const rentalPrice = salePrice * 0.1;
      setValue('rental_base_price', parseFloat(rentalPrice.toFixed(2)));
    }
  }, [salePrice, isRentable, setValue]);


  const onSubmit = async (data: QuickItemFormData) => {
    try {
      // Remove SKU from data since backend will generate it
      const { sku, ...submitData } = data;
      const result = await createItem.mutateAsync(submitData);
      onItemCreated(result);
      setOpen(false);
      reset();
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create New Item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5" />
            Create New Item
          </DialogTitle>
          <DialogDescription>
            Quickly create a new item for your purchase. You can edit the full details later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package2 className="h-4 w-4" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="item_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter item name..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label>
                      SKU
                      <span className="text-xs text-muted-foreground ml-1">(Auto-generated)</span>
                    </Label>
                    <Input
                      readOnly
                      className="bg-gray-50 cursor-not-allowed"
                      placeholder="Will be auto-generated by system"
                    />
                    <p className="text-xs text-muted-foreground">
                      A unique SKU will be automatically generated when you create the item.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <FormControl>
                          <CategoryDropdown
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select category..."
                            leafCategoriesOnly={true}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="brand_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand</FormLabel>
                        <FormControl>
                          <BrandDropdown
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select brand..."
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
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Barcode</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter barcode (alphanumeric only)..." 
                            {...field}
                            onChange={(e) => {
                              // Only allow alphanumeric characters
                              const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter model number..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (kg)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            placeholder="0.000"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = e.target.value ? parseFloat(e.target.value) : undefined;
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of the item..."
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

            {/* Pricing */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sale_base_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sale Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = e.target.value ? parseFloat(e.target.value) : undefined;
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rental_base_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rental Price (per day)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = e.target.value ? parseFloat(e.target.value) : undefined;
                              field.onChange(value);
                            }}
                            disabled={!form.watch('is_rentable')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Rental Period Settings */}
                {form.watch('is_rentable') && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="min_rental_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min Rental Days</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              step="1"
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
                      name="rental_period"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Rental Period</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              step="1"
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
                      name="max_rental_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Rental Days</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="No limit"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const value = e.target.value ? parseInt(e.target.value) : undefined;
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="is_serialized"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Serialized Item</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Track individual units with serial numbers
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="is_rentable"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Available for Rent</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="is_saleable"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Available for Sale</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={createItem.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createItem.isPending}
              >
                {createItem.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Item'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}