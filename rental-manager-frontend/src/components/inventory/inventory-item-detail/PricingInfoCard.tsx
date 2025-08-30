'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { EnableRentalButton } from './EnableRentalButton';
import { useItemPricingTiers } from '@/hooks/useRentalPricing';
import type { InventoryItemDetail } from '@/types/inventory-items';

interface PricingInfoCardProps {
  item: InventoryItemDetail;
  onManagePricing?: () => void;
  onItemUpdate?: (updatedItem: InventoryItemDetail) => void;
}

export function PricingInfoCard({ item, onManagePricing, onItemUpdate }: PricingInfoCardProps) {
  // Defensive check for item
  if (!item) {
    console.warn('PricingInfoCard: item prop is null or undefined');
    return null;
  }

  // Fetch pricing tiers for this item
  const { data: pricingTiers = [], isLoading: isLoadingTiers } = useItemPricingTiers(item.item_id);

  if (!item.is_rentable) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Rental Pricing
            </CardTitle>
            <EnableRentalButton 
              item={item} 
              onRentalEnabled={onItemUpdate}
              onOpenPricingModal={onManagePricing}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This item is not currently configured for rental. Enable rental functionality to:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
              <li>Set daily and tiered rental rates</li>
              <li>Track rental availability and bookings</li>
              <li>Generate rental contracts and invoices</li>
              <li>Monitor rental performance analytics</li>
            </ul>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> You can enable rental configuration at any time. 
                This won't affect the item's sale functionality.
              </p>
            </div>
          </div>
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
        {isLoadingTiers ? (
          <div className="space-y-2">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        ) : pricingTiers.length > 0 ? (
          /* Display Tiered Pricing */
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Tiered Pricing Configured</span>
              <Badge variant="secondary" className="text-xs">
                {pricingTiers.length} tier{pricingTiers.length > 1 ? 's' : ''}
              </Badge>
            </div>
            
            {/* Show default tier */}
            {(() => {
              const defaultTier = pricingTiers.find(tier => tier.is_default) || pricingTiers[0];
              return defaultTier ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {defaultTier.tier_name} Rate:
                    </span>
                    <span className="font-medium text-lg">
                      {formatCurrencySync(defaultTier.daily_equivalent_rate || defaultTier.rate_per_period / (defaultTier.period_days || 1))}/day
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Period: {defaultTier.period_value || defaultTier.period_days || defaultTier.period_hours || 1}{' '}
                      {defaultTier.period_unit === 'HOUR' ? 
                        `hour${(defaultTier.period_value || defaultTier.period_hours || 1) > 1 ? 's' : ''}` :
                        `day${(defaultTier.period_value || defaultTier.period_days || 1) > 1 ? 's' : ''}`
                      }
                    </span>
                    <span>Total: {formatCurrencySync(defaultTier.rate_per_period)}</span>
                  </div>
                </div>
              ) : null;
            })()}
            
            <p className="text-xs text-muted-foreground">
              Multiple pricing tiers available. Use "Manage Pricing" to view all tiers and rates.
            </p>
          </div>
        ) : item.rental_rate ? (
          /* Display Basic Rental Rate */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Daily Rental Rate:</span>
              <span className="font-medium text-lg">{formatCurrencySync(item.rental_rate)}/day</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Basic rental rate configured. Use "Manage Pricing" to set up advanced pricing tiers.
            </p>
          </div>
        ) : (
          /* No Pricing Configured */
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              No rental pricing configured for this item.
            </p>
            <p className="text-xs text-muted-foreground">
              Use "Manage Pricing" to configure daily rates and advanced pricing options.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}