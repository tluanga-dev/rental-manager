'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calculator,
  DollarSign,
  Calendar,
  TrendingDown,
  Settings,
  ChevronRight
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { useItemPricingSummary, useCalculateRentalPricing } from '@/hooks/useRentalPricing';
import type { InventoryItemDetail } from '@/types/inventory-items';

interface PricingInfoCardProps {
  item: InventoryItemDetail;
  onManagePricing?: () => void;
}

export function PricingInfoCard({ item, onManagePricing }: PricingInfoCardProps) {
  const [calculatorDays, setCalculatorDays] = useState<string>('');
  const [calculationResult, setCalculationResult] = useState<any>(null);
  
  const { data: pricingSummary, isLoading } = useItemPricingSummary(item.item_id);
  const calculatePricing = useCalculateRentalPricing();

  const handleCalculate = async () => {
    const days = parseInt(calculatorDays);
    if (days > 0) {
      const result = await calculatePricing.mutateAsync({
        itemId: item.item_id,
        rentalDays: days
      });
      setCalculationResult(result);
    }
  };

  if (!item.is_rentable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Rental Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This item is not configured for rental.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Rental Pricing
          </CardTitle>
          {onManagePricing && (
            <Button
              variant="outline"
              size="sm"
              onClick={onManagePricing}
              className="flex items-center gap-1"
            >
              <Settings className="h-4 w-4" />
              Manage Pricing
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Pricing Display */}
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        ) : pricingSummary ? (
          <div className="space-y-3">
            {/* Daily Rate Range */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Daily Rate Range:</span>
              <span className="font-medium">
                {formatCurrencySync(pricingSummary.daily_rate_range[0])} - {formatCurrencySync(pricingSummary.daily_rate_range[1])}/day
              </span>
            </div>

            {/* Available Pricing Tiers */}
            {pricingSummary.available_tiers.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Available Pricing Tiers:</div>
                <div className="grid gap-2">
                  {pricingSummary.available_tiers.map((tier) => (
                    <div key={tier.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{tier.tier_name}</span>
                        {tier.is_default && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">{formatCurrencySync(tier.rate_per_period)}</span>
                        <span className="text-muted-foreground">/{tier.period_days} day{tier.period_days > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pricingSummary.has_tiered_pricing && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <TrendingDown className="h-4 w-4" />
                <span>Volume discounts available for longer rentals</span>
              </div>
            )}
          </div>
        ) : item.rental_rate ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Default Daily Rate:</span>
              <span className="font-medium">{formatCurrencySync(item.rental_rate)}/day</span>
            </div>
            <p className="text-xs text-muted-foreground">
              No tiered pricing configured. Using default rate for all rental durations.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No rental pricing configured for this item.
          </p>
        )}

        {/* Quick Calculator */}
        {(pricingSummary || item.rental_rate) && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Quick Calculator</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="rental-days" className="sr-only">
                  Rental Days
                </Label>
                <Input
                  id="rental-days"
                  type="number"
                  placeholder="Enter rental days"
                  value={calculatorDays}
                  onChange={(e) => setCalculatorDays(e.target.value)}
                  min="1"
                />
              </div>
              <Button
                onClick={handleCalculate}
                disabled={!calculatorDays || parseInt(calculatorDays) <= 0 || calculatePricing.isPending}
              >
                Calculate
              </Button>
            </div>
            
            {/* Calculation Result */}
            {calculationResult && (
              <div className="mt-3 p-3 bg-muted/50 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Cost:</span>
                  <span className="font-semibold text-lg">
                    {formatCurrencySync(calculationResult.total_cost)}
                  </span>
                </div>
                {calculationResult.recommended_tier && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Using tier:</span>
                    <span>{calculationResult.recommended_tier.tier_name}</span>
                  </div>
                )}
                {calculationResult.daily_equivalent_rate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Daily rate:</span>
                    <span>{formatCurrencySync(calculationResult.daily_equivalent_rate)}/day</span>
                  </div>
                )}
                {calculationResult.savings_compared_to_daily > 0 && (
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <TrendingDown className="h-3 w-3" />
                    <span>Save {formatCurrencySync(calculationResult.savings_compared_to_daily)} vs daily rate</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}