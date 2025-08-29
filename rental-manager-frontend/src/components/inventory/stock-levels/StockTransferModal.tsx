'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { stockLevelsApi, type StockLevel, type StockTransferRequest } from '@/services/api/stock-levels';
import { locationsApi } from '@/services/api/locations';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, ArrowUpDown, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  stockLevel?: StockLevel | null;
}

interface TransferFormData {
  item_id: string;
  from_location_id: string;
  to_location_id: string;
  quantity: number;
  transfer_notes: string;
  requires_approval: boolean;
}

export function StockTransferModal({ isOpen, onClose, onComplete, stockLevel }: StockTransferModalProps) {
  const [formData, setFormData] = useState<TransferFormData>({
    item_id: '',
    from_location_id: '',
    to_location_id: '',
    quantity: 0,
    transfer_notes: '',
    requires_approval: false,
  });

  const [errors, setErrors] = useState<Partial<TransferFormData>>({});

  // Fetch locations for dropdowns
  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getAll(),
    staleTime: 1000 * 60 * 5,
  });

  // Stock transfer mutation
  const transferStockMutation = useMutation({
    mutationFn: (data: StockTransferRequest) => stockLevelsApi.transferStock(data),
    onSuccess: (response) => {
      toast({
        title: "Transfer Initiated",
        description: response.message || "Stock transfer has been initiated successfully.",
      });
      onComplete();
    },
    onError: (error) => {
      toast({
        title: "Transfer Failed",
        description: error instanceof Error ? error.message : "Failed to initiate stock transfer.",
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
        from_location_id: stockLevel.location_id,
        quantity: Math.min(1, stockLevel.quantity_available), // Default to 1 or max available
      }));
    }
  }, [stockLevel]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        item_id: '',
        from_location_id: '',
        to_location_id: '',
        quantity: 0,
        transfer_notes: '',
        requires_approval: false,
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Partial<TransferFormData> = {};

    if (!formData.from_location_id) {
      newErrors.from_location_id = 'Please select a source location';
    }

    if (!formData.to_location_id) {
      newErrors.to_location_id = 'Please select a destination location';
    }

    if (formData.from_location_id === formData.to_location_id) {
      newErrors.to_location_id = 'Source and destination locations must be different';
    }

    if (formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    }

    if (stockLevel && formData.quantity > stockLevel.quantity_available) {
      newErrors.quantity = `Quantity cannot exceed available stock (${stockLevel.quantity_available})`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const transferData: StockTransferRequest = {
      item_id: formData.item_id,
      from_location_id: formData.from_location_id,
      to_location_id: formData.to_location_id,
      quantity: formData.quantity,
      transfer_notes: formData.transfer_notes || undefined,
      requires_approval: formData.requires_approval,
    };

    transferStockMutation.mutate(transferData);
  };

  const getLocationName = (locationId: string) => {
    const location = locations.find(loc => loc.id === locationId);
    return location?.name || locationId;
  };

  const availableLocations = locations.filter(loc => loc.id !== formData.from_location_id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-blue-600" />
            Stock Transfer
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Stock Level Info */}
          {stockLevel && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Item Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Item:</p>
                  <p className="font-medium">{stockLevel.item_name}</p>
                  <p className="text-xs text-gray-500">{stockLevel.item_sku}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Current Location:</p>
                  <p className="font-medium">{stockLevel.location_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Stock:</p>
                  <p className="font-medium">{stockLevel.quantity_on_hand}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Available to Transfer:</p>
                  <p className="font-medium text-green-600">{stockLevel.quantity_available}</p>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* From Location */}
              <div>
                <Label htmlFor="from_location_id">From Location *</Label>
                <Select
                  value={formData.from_location_id}
                  onValueChange={(value) => setFormData({ ...formData, from_location_id: value })}
                  disabled={!!stockLevel} // Disabled if stock level is pre-selected
                >
                  <SelectTrigger className={errors.from_location_id ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Select source location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.from_location_id && (
                  <p className="text-sm text-red-600 mt-1">{errors.from_location_id}</p>
                )}
              </div>

              {/* To Location */}
              <div>
                <Label htmlFor="to_location_id">To Location *</Label>
                <Select
                  value={formData.to_location_id}
                  onValueChange={(value) => setFormData({ ...formData, to_location_id: value })}
                >
                  <SelectTrigger className={errors.to_location_id ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Select destination location" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.to_location_id && (
                  <p className="text-sm text-red-600 mt-1">{errors.to_location_id}</p>
                )}
              </div>
            </div>

            {/* Transfer Preview */}
            {formData.from_location_id && formData.to_location_id && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">From</p>
                    <p className="font-medium">{getLocationName(formData.from_location_id)}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-blue-600" />
                  <div className="text-center">
                    <p className="text-sm text-gray-600">To</p>
                    <p className="font-medium">{getLocationName(formData.to_location_id)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <Label htmlFor="quantity">Quantity to Transfer *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={stockLevel?.quantity_available || undefined}
                step="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                className={errors.quantity ? 'border-red-300' : ''}
              />
              {stockLevel && (
                <p className="text-xs text-gray-500 mt-1">
                  Maximum available: {stockLevel.quantity_available}
                </p>
              )}
              {errors.quantity && (
                <p className="text-sm text-red-600 mt-1">{errors.quantity}</p>
              )}
            </div>

            {/* Transfer Notes */}
            <div>
              <Label htmlFor="transfer_notes">Transfer Notes</Label>
              <Textarea
                id="transfer_notes"
                value={formData.transfer_notes}
                onChange={(e) => setFormData({ ...formData, transfer_notes: e.target.value })}
                placeholder="Optional notes about this transfer..."
                rows={3}
              />
            </div>

            {/* Requires Approval */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires_approval"
                checked={formData.requires_approval}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, requires_approval: checked as boolean })
                }
              />
              <Label htmlFor="requires_approval">
                Requires approval before execution
              </Label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={transferStockMutation.isPending}
              className="min-w-[140px]"
            >
              {transferStockMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Initiating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Initiate Transfer
                </div>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}