'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, DollarSign, Save, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { formatCurrencySync } from '@/lib/currency-utils';
import { cn } from '@/lib/utils';
import type { SaleableItem } from '@/types/sales';

interface SetSalePriceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: SaleableItem | null;
  onConfirm: (price: number, saveToMaster: boolean) => Promise<void>;
  isLoading?: boolean;
}

export function SetSalePriceDialog({
  isOpen,
  onClose,
  item,
  onConfirm,
  isLoading = false,
}: SetSalePriceDialogProps) {
  const [salePrice, setSalePrice] = useState<string>('');
  const [saveToMaster, setSaveToMaster] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarkup, setSelectedMarkup] = useState<number | null>(null);

  // Reset state when dialog opens/closes or item changes
  useEffect(() => {
    if (isOpen && item) {
      setSalePrice('');
      setSaveToMaster(true);
      setError(null);
      setSelectedMarkup(null);
    }
  }, [isOpen, item]);

  if (!item) return null;

  const purchasePrice = item.purchase_price || 0;
  const hasPurchasePrice = purchasePrice > 0;

  // Calculate markup suggestions
  const markupSuggestions = hasPurchasePrice
    ? [
        { percentage: 20, price: purchasePrice * 1.2 },
        { percentage: 30, price: purchasePrice * 1.3 },
        { percentage: 50, price: purchasePrice * 1.5 },
        { percentage: 100, price: purchasePrice * 2 },
      ]
    : [];

  // Calculate profit margin
  const calculateProfitMargin = (price: number) => {
    if (!hasPurchasePrice || price <= 0) return 0;
    return ((price - purchasePrice) / price) * 100;
  };

  const calculateMarkup = (price: number) => {
    if (!hasPurchasePrice || price <= 0) return 0;
    return ((price - purchasePrice) / purchasePrice) * 100;
  };

  const handleSubmit = async () => {
    const price = parseFloat(salePrice);
    
    if (isNaN(price) || price <= 0) {
      setError('Please enter a valid price greater than 0');
      return;
    }

    if (hasPurchasePrice && price < purchasePrice) {
      setError(`Sale price should not be less than purchase price (${formatCurrencySync(purchasePrice)})`);
      return;
    }

    try {
      await onConfirm(price, saveToMaster);
      onClose();
    } catch (err) {
      setError('Failed to set price. Please try again.');
    }
  };

  const handleMarkupClick = (markup: number, price: number) => {
    setSalePrice(price.toFixed(2));
    setSelectedMarkup(markup);
    setError(null);
  };

  const currentPrice = parseFloat(salePrice) || 0;
  const profitMargin = calculateProfitMargin(currentPrice);
  const markup = calculateMarkup(currentPrice);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-700">
            <DollarSign className="h-5 w-5" />
            Set Sale Price
          </DialogTitle>
          <DialogDescription className="pt-2">
            Update the price for <strong>{item.item_name}</strong> ({item.sku}). 
            {!item.sale_price ? 
              "This item doesn't have a master price set." : 
              `Current master price: ${formatCurrencySync(item.sale_price)}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Purchase Price Reference */}
          {hasPurchasePrice ? (
            <div className="rounded-lg bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Purchase Price:</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrencySync(purchasePrice)}
                </span>
              </div>
              
              {/* Markup Suggestions */}
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Quick Markup Options:</Label>
                <div className="grid grid-cols-4 gap-2">
                  {markupSuggestions.map((suggestion) => (
                    <Button
                      key={suggestion.percentage}
                      type="button"
                      variant={selectedMarkup === suggestion.percentage ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleMarkupClick(suggestion.percentage, suggestion.price)}
                      className="text-xs"
                    >
                      +{suggestion.percentage}%
                      <br />
                      {formatCurrencySync(suggestion.price)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No purchase price available for reference. Please enter the sale price manually.
              </AlertDescription>
            </Alert>
          )}

          {/* Manual Price Entry */}
          <div className="space-y-2">
            <Label htmlFor="sale-price">
              Sale Price <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <Input
                id="sale-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter sale price"
                value={salePrice}
                onChange={(e) => {
                  setSalePrice(e.target.value);
                  setSelectedMarkup(null);
                  setError(null);
                }}
                className={cn(
                  "pl-8",
                  error && "border-red-500 focus:ring-red-500"
                )}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          {/* Profit Margin Display */}
          {currentPrice > 0 && hasPurchasePrice && (
            <div className="rounded-lg bg-green-50 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700">Profit Margin:</span>
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {profitMargin.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700">Markup:</span>
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {markup.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-green-700">Profit Amount:</span>
                <span className="text-green-800">
                  {formatCurrencySync(currentPrice - purchasePrice)}
                </span>
              </div>
            </div>
          )}

          {/* Save to Master Checkbox */}
          <div className="flex items-center space-x-2 rounded-lg bg-blue-50 p-3">
            <Checkbox
              id="save-to-master"
              checked={saveToMaster}
              onCheckedChange={(checked) => setSaveToMaster(checked as boolean)}
            />
            <Label 
              htmlFor="save-to-master" 
              className="text-sm font-medium text-blue-900 cursor-pointer"
            >
              Save this price to item master for future use
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !salePrice || parseFloat(salePrice) <= 0}
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Setting Price...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Set Price
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}