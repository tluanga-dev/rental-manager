'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  Settings,
  Truck,
  Clock,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { formatCurrencySync } from '@/lib/currency-utils';
import { RentalStatusIndicator } from '@/components/rental-blocking/RentalStatusIndicator';
import RentalStatusBadge from '@/components/rentals/RentalStatusBadge';
import { inventoryItemsApi } from '@/services/api/inventory-items';
import { useItemPricingTiers } from '@/hooks/useRentalPricing';
import type { RentalStatusBlockProps, CurrentRentalInfo } from './RentalStatusBlock.types';

export function RentalStatusBlock({ 
  item, 
  onManagePricing, 
  onManageRental 
}: RentalStatusBlockProps) {
  // Fetch current rental status for this item
  const {
    data: currentRentals = [],
    isLoading: isLoadingRentals,
  } = useQuery({
    queryKey: ['item-current-rentals', item.item_id],
    queryFn: () => inventoryItemsApi.getCurrentRentalStatus(item.item_id),
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!item.item_id && item.is_rentable,
  });

  // Fetch pricing tiers for enhanced pricing display
  const { data: pricingTiers = [] } = useItemPricingTiers(item.item_id);

  const totalUnits = item.stock_summary?.total || 0;
  const availableUnits = item.stock_summary?.available || 0;
  const rentedUnits = item.stock_summary?.rented || 0;

  // Calculate rental utilization
  const rentalUtilization = totalUnits > 0 ? (rentedUnits / totalUnits) * 100 : 0;

  // Determine overall rental status
  const isRentalBlocked = item.is_rental_blocked || false;
  const hasActiveRentals = currentRentals.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Rental Status & Configuration
          </CardTitle>
          <div className="flex items-center gap-2">
            {onManagePricing && item.is_rentable && (
              <Button
                variant="outline"
                size="sm"
                onClick={onManagePricing}
                className="flex items-center gap-1"
              >
                <DollarSign className="h-4 w-4" />
                Pricing
              </Button>
            )}
            {onManageRental && (
              <Button
                variant="outline"
                size="sm"
                onClick={onManageRental}
                className="flex items-center gap-1"
              >
                <Settings className="h-4 w-4" />
                Manage
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rental Availability Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">Rental Availability</h4>
            <RentalStatusIndicator
              isBlocked={isRentalBlocked}
              reason={item.rental_block_reason}
              entityType="ITEM"
              size="md"
            />
          </div>
          
          {isRentalBlocked && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-800">Rental Blocked</p>
                <p className="text-xs text-red-700">
                  {item.rental_block_reason || 'No reason specified'}
                </p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Current Rental Status */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Current Rental Status</h4>
          
          <div className="grid grid-cols-3 gap-4">
            {/* Units Overview */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Available: {availableUnits}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm">On Rent: {rentedUnits}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-sm">Total: {totalUnits}</span>
              </div>
            </div>

            {/* Utilization */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Utilization Rate</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(rentalUtilization, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{rentalUtilization.toFixed(1)}%</span>
              </div>
            </div>

            {/* Active Rentals Count */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Active Rentals</p>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {isLoadingRentals ? '...' : currentRentals.length}
                </span>
              </div>
            </div>
          </div>

          {/* Active Rentals List */}
          {hasActiveRentals && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Current Rentals:</p>
              <div className="space-y-2">
                {currentRentals.slice(0, 3).map((rental: CurrentRentalInfo) => (
                  <div 
                    key={rental.rental_id}
                    className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <RentalStatusBadge status={rental.rental_status} size="sm" />
                      <div>
                        <p className="text-sm font-medium">{rental.customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {rental.units_rented}/{rental.total_units} units • 
                          {rental.days_remaining > 0 ? `${rental.days_remaining} days left` : 
                           rental.is_overdue ? `${Math.abs(rental.days_remaining)} days overdue` : 'Due today'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrencySync(rental.total_rental_value)}</p>
                      <p className="text-xs text-muted-foreground">Total Value</p>
                    </div>
                  </div>
                ))}
                {currentRentals.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{currentRentals.length - 3} more active rentals
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Rental Configuration */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Rental Configuration</h4>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Pricing Configuration */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Pricing</span>
                {pricingTiers.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {pricingTiers.length} tier{pricingTiers.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              
              {pricingTiers.length > 0 ? (
                /* Display Tiered Pricing */
                (() => {
                  const defaultTier = pricingTiers.find(tier => tier.is_default) || pricingTiers[0];
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{defaultTier.tier_name}:</span>
                        <span className="text-sm font-medium">
                          {formatCurrencySync(defaultTier.daily_equivalent_rate || defaultTier.rate_per_period / defaultTier.period_days)}/day
                        </span>
                      </div>
                      {item.security_deposit && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Deposit:</span>
                          <span className="text-sm font-medium">{formatCurrencySync(item.security_deposit)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : item.rental_rate ? (
                /* Display Basic Pricing */
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Daily Rate:</span>
                    <span className="text-sm font-medium">{formatCurrencySync(item.rental_rate)}</span>
                  </div>
                  {item.security_deposit && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Deposit:</span>
                      <span className="text-sm font-medium">{formatCurrencySync(item.security_deposit)}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* No Pricing */
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">No pricing configured</span>
                </div>
              )}
            </div>

            {/* Delivery Configuration */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Delivery</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Service:</span>
                  <Badge variant="outline" className="text-xs">
                    Available
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Charge:</span>
                  <span className="text-sm font-medium">Calculated per order</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rental Period Configuration */}
        {item.is_rentable && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Rental Period Settings</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Period Limits</span>
                  </div>
                  <div className="space-y-1 ml-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Minimum:</span>
                      <span className="text-sm">1 day</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Maximum:</span>
                      <span className="text-sm">365 days</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Requirements</span>
                  </div>
                  <div className="space-y-1 ml-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Agreement:</span>
                      <span className="text-sm">Required</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Deposit:</span>
                      <span className="text-sm">
                        {item.security_deposit ? formatCurrencySync(item.security_deposit) : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Not Rentable State */}
        {!item.is_rentable && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <Info className="h-4 w-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-700">Item Not Available for Rental</p>
              <p className="text-xs text-gray-600">
                This item is configured for sale only. Contact administrator to enable rental functionality.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}