'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Calculator,
  Calendar,
  Package,
  TrendingDown,
  AlertCircle,
  Sparkles,
  DollarSign,
  Clock,
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { useCalculateRentalPricing } from '@/hooks/useRentalPricing';
import { inventoryItemsApi } from '@/services/api/inventory-items';
import { useQuery } from '@tanstack/react-query';
import type { InventoryItemSummary } from '@/types/inventory-items';

interface RentalCalculatorProps {
  preSelectedItemId?: string;
  onSelectItem?: (item: InventoryItemSummary, pricing: any) => void;
  embedded?: boolean;
}

export function RentalCalculator({ 
  preSelectedItemId, 
  onSelectItem,
  embedded = false 
}: RentalCalculatorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItemSummary | null>(null);
  const [rentalDays, setRentalDays] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculatePricing = useCalculateRentalPricing();

  // Fetch rentable items
  const { data: rentableItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['rentable-items', searchTerm],
    queryFn: () => inventoryItemsApi.getItems({ 
      is_rentable: true,
      search: searchTerm,
      limit: 20 
    }),
    staleTime: 5 * 60 * 1000,
  });

  // Auto-select item if preSelectedItemId is provided
  useEffect(() => {
    if (preSelectedItemId && rentableItems.length > 0) {
      const item = rentableItems.find(i => i.item_id === preSelectedItemId);
      if (item) {
        setSelectedItem(item);
      }
    }
  }, [preSelectedItemId, rentableItems]);

  // Calculate days when dates change
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days
      setRentalDays(diffDays.toString());
    }
  }, [startDate, endDate]);

  const handleCalculate = async () => {
    if (!selectedItem || !rentalDays) return;

    setIsCalculating(true);
    try {
      const result = await calculatePricing.mutateAsync({
        itemId: selectedItem.item_id,
        rentalDays: parseInt(rentalDays),
      });

      if (result) {
        const totalWithQuantity = {
          ...result,
          quantity: parseInt(quantity),
          total_cost_with_quantity: result.total_cost * parseInt(quantity),
        };
        setCalculationResult(totalWithQuantity);

        // Call callback if provided
        if (onSelectItem) {
          onSelectItem(selectedItem, totalWithQuantity);
        }
      }
    } catch (error) {
      console.error('Error calculating pricing:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleReset = () => {
    setSelectedItem(null);
    setRentalDays('');
    setStartDate('');
    setEndDate('');
    setQuantity('1');
    setCalculationResult(null);
    setSearchTerm('');
  };

  return (
    <Card className={embedded ? 'border-0 shadow-none' : ''}>
      {!embedded && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Rental Cost Calculator
          </CardTitle>
        </CardHeader>
      )}
      
      <CardContent className={embedded ? 'p-0' : ''}>
        <div className="space-y-4">
          {/* Item Selection */}
          {!preSelectedItemId && (
            <div className="space-y-2">
              <Label htmlFor="item-search">Select Rental Item</Label>
              <Input
                id="item-search"
                type="text"
                placeholder="Search for items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              
              {searchTerm && rentableItems.length > 0 && !selectedItem && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {rentableItems.map((item) => (
                    <button
                      key={item.item_id}
                      className="w-full text-left p-2 hover:bg-muted transition-colors"
                      onClick={() => {
                        setSelectedItem(item);
                        setSearchTerm('');
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-sm text-muted-foreground">
                            SKU: {item.sku} • {item.stock_summary?.available || 0} available
                          </p>
                        </div>
                        {item.rental_rate && (
                          <span className="text-sm font-medium">
                            {formatCurrencySync(item.rental_rate)}/day
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected Item Display */}
          {selectedItem && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedItem.item_name}</p>
                    <p className="text-sm text-muted-foreground">
                      SKU: {selectedItem.sku}
                    </p>
                  </div>
                </div>
                {!preSelectedItemId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedItem(null)}
                  >
                    Change
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Date Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>
          </div>

          {/* Duration and Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rental-days">Rental Duration (days)</Label>
              <div className="relative">
                <Input
                  id="rental-days"
                  type="number"
                  value={rentalDays}
                  onChange={(e) => setRentalDays(e.target.value)}
                  min="1"
                  className="pr-10"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                max={selectedItem?.stock_summary?.available || 999}
              />
            </div>
          </div>

          {/* Calculate Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleCalculate}
              disabled={!selectedItem || !rentalDays || isCalculating}
              className="flex-1"
            >
              {isCalculating ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Cost
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>

          {/* Calculation Result */}
          {calculationResult && (
            <div className="space-y-3">
              <Separator />
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Pricing Breakdown</h4>
                </div>

                <div className="space-y-2">
                  {/* Unit Cost */}
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="text-sm">Cost per unit:</span>
                    <span className="font-medium">
                      {formatCurrencySync(calculationResult.total_cost)}
                    </span>
                  </div>

                  {/* Quantity */}
                  {calculationResult.quantity > 1 && (
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <span className="text-sm">Quantity:</span>
                      <span className="font-medium">×{calculationResult.quantity}</span>
                    </div>
                  )}

                  {/* Total Cost */}
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                    <span className="font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Total Cost:
                    </span>
                    <span className="text-xl font-bold">
                      {formatCurrencySync(calculationResult.total_cost_with_quantity)}
                    </span>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="space-y-2 text-sm">
                  {calculationResult.recommended_tier && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Pricing tier:</span>
                      <Badge variant="secondary">
                        {calculationResult.recommended_tier.tier_name}
                      </Badge>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Daily equivalent:</span>
                    <span>{formatCurrencySync(calculationResult.daily_equivalent_rate)}/day</span>
                  </div>

                  {calculationResult.savings_compared_to_daily > 0 && (
                    <Alert className="border-green-200 bg-green-50">
                      <TrendingDown className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        You save {formatCurrencySync(calculationResult.savings_compared_to_daily * calculationResult.quantity)} 
                        {' '}compared to daily rates!
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Available Tiers Info */}
                {calculationResult.applicable_tiers?.length > 1 && (
                  <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Other available pricing options:</p>
                    <div className="space-y-1">
                      {calculationResult.applicable_tiers
                        .filter((tier: any) => tier.id !== calculationResult.recommended_tier?.id)
                        .slice(0, 3)
                        .map((tier: any) => (
                          <div key={tier.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{tier.tier_name}:</span>
                            <span>
                              {formatCurrencySync(tier.rate_per_period * Math.ceil(parseInt(rentalDays) / tier.period_days))}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}