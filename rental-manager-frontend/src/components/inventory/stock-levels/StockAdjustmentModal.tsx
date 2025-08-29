'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { stockLevelsApi, type StockLevel, type StockAdjustmentRequest } from '@/services/api/stock-levels';
import { itemsApi } from '@/services/api/items';
import { locationsApi } from '@/services/api/locations';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Package, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  stockLevel?: StockLevel | null;
}

interface AdjustmentFormData {
  item_id: string;
  location_id: string;
  adjustment_type: 'ADD' | 'REMOVE' | 'SET';
  quantity: number;
  reason: string;
  notes: string;
  cost_per_unit: number;
}

const adjustmentReasons = [
  { value: 'STOCK_COUNT', label: 'Physical Stock Count' },
  { value: 'DAMAGED_GOODS', label: 'Damaged Goods' },
  { value: 'LOST_ITEMS', label: 'Lost Items' },
  { value: 'FOUND_ITEMS', label: 'Found Items' },
  { value: 'SUPPLIER_ADJUSTMENT', label: 'Supplier Adjustment' },
  { value: 'QUALITY_CONTROL', label: 'Quality Control' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'SYSTEM_CORRECTION', label: 'System Correction' },
  { value: 'OTHER', label: 'Other (specify in notes)' },
];

export function StockAdjustmentModal({ isOpen, onClose, onComplete, stockLevel }: StockAdjustmentModalProps) {
  const [formData, setFormData] = useState<AdjustmentFormData>({
    item_id: '',
    location_id: '',
    adjustment_type: 'ADD',
    quantity: 0,
    reason: '',
    notes: '',
    cost_per_unit: 0,
  });

  const [errors, setErrors] = useState<Partial<AdjustmentFormData>>({});

  // Fetch items and locations for dropdowns (only if stockLevel is not provided)
  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: () => itemsApi.getAll(),
    enabled: !stockLevel,
    staleTime: 1000 * 60 * 5,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getAll(),
    enabled: !stockLevel,
    staleTime: 1000 * 60 * 5,
  });

  // Stock adjustment mutation
  const adjustStockMutation = useMutation({
    mutationFn: (data: StockAdjustmentRequest) => stockLevelsApi.adjustStock(data),
    onSuccess: () => {
      toast({
        title: "Stock Adjusted",
        description: "Stock levels have been successfully updated.",
      });
      onComplete();
    },
    onError: (error) => {
      toast({
        title: "Adjustment Failed",
        description: error instanceof Error ? error.message : "Failed to adjust stock levels.",
        variant: "destructive",
      });
    },
  });

  // Initialize form data when stockLevel changes
  useEffect(() => {
    if (stockLevel) {
      setFormData(prev => ({
        ...prev,
        item_id: stockLevel.item_id,
        location_id: stockLevel.location_id,
      }));
    }
  }, [stockLevel]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        item_id: '',
        location_id: '',
        adjustment_type: 'ADD',
        quantity: 0,
        reason: '',
        notes: '',
        cost_per_unit: 0,
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Partial<AdjustmentFormData> = {};

    if (!formData.item_id) {
      newErrors.item_id = 'Please select an item';
    }

    if (!formData.location_id) {
      newErrors.location_id = 'Please select a location';
    }

    if (formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }

    if (!formData.reason) {
      newErrors.reason = 'Please select a reason for adjustment';
    }

    if (formData.reason === 'OTHER' && !formData.notes.trim()) {
      newErrors.notes = 'Please provide details when selecting "Other"';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const adjustmentData: StockAdjustmentRequest = {
      item_id: formData.item_id,
      location_id: formData.location_id,
      adjustment_type: formData.adjustment_type,
      quantity: formData.quantity,
      reason: formData.reason,
      notes: formData.notes || undefined,
      cost_per_unit: formData.cost_per_unit > 0 ? formData.cost_per_unit : undefined,
    };

    adjustStockMutation.mutate(adjustmentData);
  };

  const getAdjustmentTypeColor = (type: string) => {
    switch (type) {
      case 'ADD':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'REMOVE':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'SET':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Stock Adjustment
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Stock Level Info */}
          {stockLevel && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Current Stock Level</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Item:</p>
                  <p className="font-medium">{stockLevel.item_name}</p>
                  <p className="text-xs text-gray-500">{stockLevel.item_sku}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location:</p>
                  <p className="font-medium">{stockLevel.location_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">On Hand:</p>
                  <p className="font-medium">{stockLevel.quantity_on_hand}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Available:</p>
                  <p className="font-medium text-green-600">{stockLevel.quantity_available}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Item Selection (if not pre-selected) */}
            {!stockLevel && (
              <div>
                <Label htmlFor="item_id">Item *</Label>
                <Select
                  value={formData.item_id}
                  onValueChange={(value) => setFormData({ ...formData, item_id: value })}
                >
                  <SelectTrigger className={errors.item_id ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.item_id && (
                  <p className="text-sm text-red-600 mt-1">{errors.item_id}</p>
                )}
              </div>
            )}

            {/* Location Selection (if not pre-selected) */}
            {!stockLevel && (
              <div>
                <Label htmlFor="location_id">Location *</Label>
                <Select
                  value={formData.location_id}
                  onValueChange={(value) => setFormData({ ...formData, location_id: value })}
                >
                  <SelectTrigger className={errors.location_id ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.location_id && (
                  <p className="text-sm text-red-600 mt-1">{errors.location_id}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Adjustment Type */}
            <div>
              <Label htmlFor="adjustment_type">Adjustment Type *</Label>
              <Select
                value={formData.adjustment_type}
                onValueChange={(value: 'ADD' | 'REMOVE' | 'SET') => 
                  setFormData({ ...formData, adjustment_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADD">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        ADD
                      </Badge>
                      <span>Add to stock</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="REMOVE">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        REMOVE
                      </Badge>
                      <span>Remove from stock</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="SET">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        SET
                      </Badge>
                      <span>Set exact quantity</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                className={errors.quantity ? 'border-red-300' : ''}
              />
              {errors.quantity && (
                <p className="text-sm text-red-600 mt-1">{errors.quantity}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Reason */}
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Select
                value={formData.reason}
                onValueChange={(value) => setFormData({ ...formData, reason: value })}
              >
                <SelectTrigger className={errors.reason ? 'border-red-300' : ''}>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {adjustmentReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.reason && (
                <p className="text-sm text-red-600 mt-1">{errors.reason}</p>
              )}
            </div>

            {/* Cost per unit (optional) */}
            <div>
              <Label htmlFor="cost_per_unit">Cost per Unit</Label>
              <Input
                id="cost_per_unit"
                type="number"
                min="0"
                step="0.01"
                value={formData.cost_per_unit}
                onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: For tracking adjustment costs
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional details about this adjustment..."
              rows={3}
              className={errors.notes ? 'border-red-300' : ''}
            />
            {errors.notes && (
              <p className="text-sm text-red-600 mt-1">{errors.notes}</p>
            )}
            {formData.reason === 'OTHER' && (
              <p className="text-xs text-amber-600 mt-1">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Please provide details when selecting "Other" as the reason
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={adjustStockMutation.isPending}
              className="min-w-[120px]"
            >
              {adjustStockMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Adjusting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Adjust Stock
                </div>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}