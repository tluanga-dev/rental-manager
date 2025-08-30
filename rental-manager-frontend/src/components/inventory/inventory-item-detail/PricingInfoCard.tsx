'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DollarSign,
  Settings,
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { EnableRentalButton } from './EnableRentalButton';
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
        {/* Simplified Current Pricing Display */}
        {item.rental_rate ? (
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