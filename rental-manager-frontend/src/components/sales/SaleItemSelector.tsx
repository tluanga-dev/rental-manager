'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, Plus, X, AlertTriangle, Package, IndianRupee } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDebounce } from '@/hooks/useDebounce';
import { salesApi } from '@/services/api/sales';
import { SaleValidator } from '@/lib/sale-validation';
import { cn } from '@/lib/utils';
import type { SaleFormItem, SaleableItem, ItemAvailabilityCheck } from '@/types/sales';

interface SaleItemSelectorProps {
  items: SaleFormItem[];
  onItemsChange: (items: SaleFormItem[]) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  disabled?: boolean;
  className?: string;
}

interface SearchedItem extends SaleableItem {
  availability?: ItemAvailabilityCheck;
}

export function SaleItemSelector({
  items,
  onItemsChange,
  onValidationChange,
  disabled = false,
  className
}: SaleItemSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchedItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Search for items
  const searchItems = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await salesApi.searchSaleableItems(query, 20);
      
      // Check availability for each item
      const resultsWithAvailability = await Promise.all(
        results.map(async (item: SaleableItem) => {
          try {
            const availability = await salesApi.checkItemAvailability(item.id, 1);
            return { ...item, availability };
          } catch (error) {
            return { ...item, availability: undefined };
          }
        })
      );

      setSearchResults(resultsWithAvailability);
    } catch (error) {
      console.error('Error searching items:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Effect for debounced search
  useEffect(() => {
    searchItems(debouncedSearchQuery);
  }, [debouncedSearchQuery, searchItems]);

  // Validate items and notify parent
  useEffect(() => {
    const errors: string[] = [];
    
    items.forEach((item, index) => {
      const discountValidation = SaleValidator.validateDiscountAmount(item);
      if (!discountValidation.isValid) {
        errors.push(`Item ${index + 1}: ${discountValidation.message}`);
      }
    });

    setValidationErrors(errors);
    onValidationChange?.(errors.length === 0, errors);
  }, [items, onValidationChange]);

  const handleItemSelect = (searchedItem: SearchedItem) => {
    setSelectedItem(searchedItem);
    setShowAddForm(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAddItem = (formData: {
    quantity: number;
    unit_cost: number;
    tax_rate: number;
    discount_amount: number;
    notes: string;
  }) => {
    if (!selectedItem) return;

    const newItem: SaleFormItem = {
      item_id: selectedItem.id,
      item_name: selectedItem.item_name,
      item_sku: selectedItem.sku,
      quantity: formData.quantity,
      unit_cost: formData.unit_cost,
      tax_rate: formData.tax_rate,
      discount_amount: formData.discount_amount,
      notes: formData.notes,
    };

    // Calculate line totals for display
    const lineTotals = SaleValidator.calculateItemLineTotals(newItem);
    newItem.subtotal = lineTotals.subtotal;
    newItem.tax_amount = lineTotals.taxAmount;
    newItem.line_total = lineTotals.lineTotal;

    onItemsChange([...items, newItem]);
    setShowAddForm(false);
    setSelectedItem(null);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    onItemsChange(updatedItems);
  };

  const handleUpdateItem = (index: number, updates: Partial<SaleFormItem>) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], ...updates };
    
    // Recalculate line totals
    const lineTotals = SaleValidator.calculateItemLineTotals(updatedItems[index]);
    updatedItems[index].subtotal = lineTotals.subtotal;
    updatedItems[index].tax_amount = lineTotals.taxAmount;
    updatedItems[index].line_total = lineTotals.lineTotal;

    onItemsChange(updatedItems);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Add Items to Sale
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
              disabled={disabled}
            />
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
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleItemSelect(item)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{item.item_name}</div>
                      <div className="text-sm text-gray-500">
                        SKU: {item.sku} • {formatCurrency(item.sale_price)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {item.availability && (
                          <Badge 
                            variant={item.availability.available ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {item.availability.available 
                              ? `${item.availability.current_available} in stock`
                              : 'Out of stock'
                            }
                          </Badge>
                        )}
                        {item.is_saleable && (
                          <Badge variant="outline" className="text-xs">
                            Saleable
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No items found
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Item Form */}
      {showAddForm && selectedItem && (
        <AddItemForm
          item={selectedItem}
          onSubmit={handleAddItem}
          onCancel={() => {
            setShowAddForm(false);
            setSelectedItem(null);
          }}
        />
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Selected Items List */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Sale Items ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item, index) => (
                <SaleItemRow
                  key={`${item.item_id}-${index}`}
                  item={item}
                  index={index}
                  onUpdate={(updates) => handleUpdateItem(index, updates)}
                  onRemove={() => handleRemoveItem(index)}
                  disabled={disabled}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {items.length > 0 && (
        <SaleSummary items={items} />
      )}
    </div>
  );
}

// Add Item Form Component
interface AddItemFormProps {
  item: SearchedItem;
  onSubmit: (data: {
    quantity: number;
    unit_cost: number;
    tax_rate: number;
    discount_amount: number;
    notes: string;
  }) => void;
  onCancel: () => void;
}

function AddItemForm({ item, onSubmit, onCancel }: AddItemFormProps) {
  const [formData, setFormData] = useState({
    quantity: 1,
    unit_cost: item.sale_price || 0,
    tax_rate: item.tax_rate || 0,
    discount_amount: 0,
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.quantity < 1) {
      newErrors.quantity = 'Quantity must be at least 1';
    }

    if (item.availability && formData.quantity > item.availability.current_available) {
      newErrors.quantity = `Only ${item.availability.current_available} units available`;
    }

    if (formData.unit_cost < 0) {
      newErrors.unit_cost = 'Unit cost cannot be negative';
    }

    if (formData.tax_rate < 0 || formData.tax_rate > 100) {
      newErrors.tax_rate = 'Tax rate must be between 0% and 100%';
    }

    const subtotal = formData.quantity * formData.unit_cost;
    if (formData.discount_amount > subtotal) {
      newErrors.discount_amount = 'Discount cannot exceed subtotal';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const subtotal = formData.quantity * formData.unit_cost;
  const taxAmount = (subtotal - formData.discount_amount) * (formData.tax_rate / 100);
  const lineTotal = subtotal + taxAmount - formData.discount_amount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Add: {item.item_name}</span>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                className={errors.quantity ? 'border-red-500' : ''}
              />
              {errors.quantity && (
                <p className="text-sm text-red-500 mt-1">{errors.quantity}</p>
              )}
            </div>

            <div>
              <Label htmlFor="unit_cost">Unit Cost *</Label>
              <Input
                id="unit_cost"
                type="number"
                min="0"
                step="0.01"
                value={formData.unit_cost}
                onChange={(e) => setFormData(prev => ({ ...prev, unit_cost: parseFloat(e.target.value) || 0 }))}
                className={errors.unit_cost ? 'border-red-500' : ''}
              />
              {errors.unit_cost && (
                <p className="text-sm text-red-500 mt-1">{errors.unit_cost}</p>
              )}
            </div>

            <div>
              <Label htmlFor="tax_rate">Tax Rate (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.tax_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                className={errors.tax_rate ? 'border-red-500' : ''}
              />
              {errors.tax_rate && (
                <p className="text-sm text-red-500 mt-1">{errors.tax_rate}</p>
              )}
            </div>

            <div>
              <Label htmlFor="discount_amount">Discount Amount</Label>
              <Input
                id="discount_amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.discount_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, discount_amount: parseFloat(e.target.value) || 0 }))}
                className={errors.discount_amount ? 'border-red-500' : ''}
              />
              {errors.discount_amount && (
                <p className="text-sm text-red-500 mt-1">{errors.discount_amount}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes for this item"
            />
          </div>

          {/* Line Total Preview */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Subtotal:</span>
                <p className="font-medium">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(subtotal)}</p>
              </div>
              <div>
                <span className="text-gray-600">Tax:</span>
                <p className="font-medium">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(taxAmount)}</p>
              </div>
              <div>
                <span className="text-gray-600">Discount:</span>
                <p className="font-medium text-red-600">-{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(formData.discount_amount)}</p>
              </div>
              <div>
                <span className="text-gray-600">Line Total:</span>
                <p className="font-bold text-lg">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(lineTotal)}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              Add Item
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Sale Item Row Component
interface SaleItemRowProps {
  item: SaleFormItem;
  index: number;
  onUpdate: (updates: Partial<SaleFormItem>) => void;
  onRemove: () => void;
  disabled?: boolean;
}

function SaleItemRow({ item, index, onUpdate, onRemove, disabled }: SaleItemRowProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium">{item.item_name}</h4>
          <p className="text-sm text-gray-500">SKU: {item.item_sku}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={disabled}
          className="text-red-500 hover:text-red-700"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div>
          <Label>Quantity</Label>
          <Input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => onUpdate({ quantity: parseInt(e.target.value) || 1 })}
            disabled={disabled}
            size="sm"
          />
        </div>
        <div>
          <Label>Unit Cost</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={item.unit_cost}
            onChange={(e) => onUpdate({ unit_cost: parseFloat(e.target.value) || 0 })}
            disabled={disabled}
            size="sm"
          />
        </div>
        <div>
          <Label>Tax Rate (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={item.tax_rate}
            onChange={(e) => onUpdate({ tax_rate: parseFloat(e.target.value) || 0 })}
            disabled={disabled}
            size="sm"
          />
        </div>
        <div>
          <Label>Discount</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={item.discount_amount}
            onChange={(e) => onUpdate({ discount_amount: parseFloat(e.target.value) || 0 })}
            disabled={disabled}
            size="sm"
          />
        </div>
        <div>
          <Label>Line Total</Label>
          <div className="font-bold text-lg mt-1">
            {formatCurrency(item.line_total || 0)}
          </div>
        </div>
      </div>

      {item.notes && (
        <div>
          <Label>Notes</Label>
          <Input
            value={item.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            disabled={disabled}
            placeholder="Item notes"
            size="sm"
          />
        </div>
      )}
    </div>
  );
}

// Sale Summary Component
interface SaleSummaryProps {
  items: SaleFormItem[];
}

function SaleSummary({ items }: SaleSummaryProps) {
  const totals = SaleValidator.calculateSaleTotals(items);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5" />
          Sale Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-medium">{SaleValidator.formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax:</span>
            <span className="font-medium">{SaleValidator.formatCurrency(totals.totalTax)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discount:</span>
            <span className="font-medium text-red-600">-{SaleValidator.formatCurrency(totals.totalDiscount)}</span>
          </div>
          <div className="border-t pt-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">Grand Total:</span>
              <span className="text-xl font-bold">{SaleValidator.formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {totals.itemCount} item{totals.itemCount !== 1 ? 's' : ''}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}