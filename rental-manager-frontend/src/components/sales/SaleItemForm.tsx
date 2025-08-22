'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Search, Package, AlertTriangle, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

import { useDebounce } from '@/hooks/useDebounce';
import { salesApi } from '@/services/api/sales';
import { cn } from '@/lib/utils';
import type { SaleableItem } from '@/types/sales';

const saleItemFormSchema = z.object({
  item_id: z.string().min(1, 'Item is required'),
  item_name: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_cost: z.number().min(0, 'Unit cost must be positive'),
  tax_rate: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  discount_amount: z.number().min(0, 'Discount amount cannot be negative'),
  notes: z.string().optional(),
});

type SaleItemFormValues = z.infer<typeof saleItemFormSchema>;

interface SaleItemFormProps {
  initialData?: Partial<SaleItemFormValues>;
  onSubmit: (data: SaleItemFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  resetTrigger?: boolean;
}


export function SaleItemForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  resetTrigger
}: SaleItemFormProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SaleableItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SaleableItem | null>(null);
  const [showSearch, setShowSearch] = useState(!initialData?.item_id);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const form = useForm<SaleItemFormValues>({
    resolver: zodResolver(saleItemFormSchema),
    defaultValues: {
      item_id: initialData?.item_id || '',
      item_name: initialData?.item_name || '',
      sku: initialData?.sku || '',
      quantity: initialData?.quantity || 1,
      unit_cost: initialData?.unit_cost || 0,
      tax_rate: initialData?.tax_rate || 0,
      discount_amount: initialData?.discount_amount || 0,
      notes: initialData?.notes || '',
    },
  });

  const { watch, setValue, reset } = form;
  const formValues = watch();

  // Reset form when resetTrigger changes
  useEffect(() => {
    if (resetTrigger && !initialData?.item_id) {
      reset({
        item_id: '',
        item_name: '',
        sku: '',
        quantity: 1,
        unit_cost: 0,
        tax_rate: 0,
        discount_amount: 0,
        notes: '',
      });
      setSelectedItem(null);
      setShowSearch(true);
      setSearchQuery('');
    }
  }, [resetTrigger, reset, initialData]);

  // Search for items
  const searchItems = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await salesApi.searchSaleableItems(query, 20, {
        in_stock_only: !showOutOfStock
      });
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching items:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Effect for debounced search
  useEffect(() => {
    if (showSearch) {
      searchItems(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, showSearch, showOutOfStock]);

  const handleItemSelect = (item: SaleableItem) => {
    setSelectedItem(item);
    setValue('item_id', item.id);
    setValue('item_name', item.item_name);
    setValue('sku', item.sku);
    setValue('unit_cost', item.sale_price || 0);
    setValue('tax_rate', item.tax_rate || 0);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleBackToSearch = () => {
    setShowSearch(true);
    setSelectedItem(null);
    setValue('item_id', '');
    setValue('item_name', '');
    setValue('sku', '');
  };

  const calculateLineTotal = () => {
    const subtotal = formValues.quantity * formValues.unit_cost;
    const discount = formValues.discount_amount || 0;
    const taxableAmount = subtotal - discount;
    const tax = taxableAmount * ((formValues.tax_rate || 0) / 100);
    return taxableAmount + tax;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (showSearch && !initialData?.item_id) {
    return (
      <div className="space-y-6">
        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Stock filter toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="show-out-of-stock"
                checked={showOutOfStock}
                onChange={(e) => setShowOutOfStock(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="show-out-of-stock" className="text-sm text-gray-600">
                Show out of stock items
              </label>
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {isSearching ? (
                  <div className="text-center py-4 text-gray-500">
                    Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between p-3 border rounded-lg cursor-pointer",
                        item.available_quantity > 0 
                          ? "hover:bg-gray-50" 
                          : "bg-gray-50 opacity-75"
                      )}
                      onClick={() => item.available_quantity > 0 && handleItemSelect(item)}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-sm text-gray-500">
                          SKU: {item.sku} • {formatCurrency(item.sale_price || 0)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {item.available_quantity > 0 ? (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                              In Stock ({item.available_quantity} {item.unit_abbreviation})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                              Out of Stock
                            </Badge>
                          )}
                          {item.category_name && (
                            <Badge variant="outline" className="text-xs">
                              {item.category_name}
                            </Badge>
                          )}
                          {item.brand_name && (
                            <Badge variant="outline" className="text-xs">
                              {item.brand_name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {item.available_quantity > 0 && (
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    No items found {!showOutOfStock && "(showing in-stock items only)"}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Selected Item Info */}
        {selectedItem && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium">{selectedItem.item_name}</h3>
                  <p className="text-sm text-gray-500">SKU: {selectedItem.sku}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                      Available: {selectedItem.available_quantity} {selectedItem.unit_abbreviation}
                    </Badge>
                    {selectedItem.category_name && (
                      <Badge variant="outline" className="text-xs">
                        {selectedItem.category_name}
                      </Badge>
                    )}
                    {selectedItem.brand_name && (
                      <Badge variant="outline" className="text-xs">
                        {selectedItem.brand_name}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleBackToSearch}>
                  Change Item
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Item Details Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Item Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max={selectedItem?.available_quantity || undefined}
                        {...field}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          if (selectedItem && value > selectedItem.available_quantity) {
                            field.onChange(selectedItem.available_quantity);
                          } else {
                            field.onChange(value);
                          }
                        }}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    {selectedItem && field.value > selectedItem.available_quantity && (
                      <p className="text-sm text-red-600 mt-1">
                        Maximum available: {selectedItem.available_quantity}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_cost"
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
                        disabled={isSubmitting}
                      />
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
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        disabled={isSubmitting}
                      />
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
                    <FormLabel>Discount Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        disabled={isSubmitting}
                      />
                    </FormControl>
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
                      placeholder="Optional notes for this item"
                      rows={3}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Line Total Preview */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Subtotal:</span>
                  <p className="font-medium">{formatCurrency(formValues.quantity * formValues.unit_cost)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Tax:</span>
                  <p className="font-medium">{formatCurrency((formValues.quantity * formValues.unit_cost - (formValues.discount_amount || 0)) * ((formValues.tax_rate || 0) / 100))}</p>
                </div>
                <div>
                  <span className="text-gray-600">Discount:</span>
                  <p className="font-medium text-red-600">-{formatCurrency(formValues.discount_amount || 0)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Line Total:</span>
                  <p className="font-bold text-lg">{formatCurrency(calculateLineTotal())}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !formValues.item_id}>
            {isSubmitting ? 'Adding...' : initialData?.item_id ? 'Update Item' : 'Add Item'}
          </Button>
        </div>
      </form>
    </Form>
  );
}