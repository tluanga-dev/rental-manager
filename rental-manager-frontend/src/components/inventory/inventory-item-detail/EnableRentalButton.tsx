'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  DollarSign, 
  Settings, 
  Check, 
  Info,
  Loader2 
} from 'lucide-react';
import { inventoryItemsApi } from '@/services/api/inventory-items';
import type { InventoryItemDetail } from '@/types/inventory-items';

interface EnableRentalButtonProps {
  item: InventoryItemDetail;
  onRentalEnabled?: (updatedItem: InventoryItemDetail) => void;
  onOpenPricingModal?: () => void;
}

export function EnableRentalButton({ 
  item, 
  onRentalEnabled,
  onOpenPricingModal 
}: EnableRentalButtonProps) {
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Defensive checks - validate item data
  if (!item) {
    console.warn('EnableRentalButton: item prop is null or undefined');
    return null;
  }

  if (!item.item_id) {
    console.warn('EnableRentalButton: item.item_id is missing or empty');
    return null;
  }

  if (!item.sku) {
    console.warn('EnableRentalButton: item.sku is missing or empty');
    return null;
  }

  if (!item.item_name) {
    console.warn('EnableRentalButton: item.item_name is missing or empty');
    return null;
  }

  const enableRentalMutation = useMutation({
    mutationFn: () => {
      // Additional validation before API call
      if (!item.item_id || typeof item.item_id !== 'string' || item.item_id.trim() === '') {
        throw new Error('Invalid item ID for rental status update');
      }
      
      console.log(`🔄 EnableRentalButton: Attempting to enable rental for item ${item.item_id} (${item.sku})`);
      return inventoryItemsApi.updateRentableStatus(item.item_id, true);
    },
    onSuccess: (updatedItem) => {
      console.log('✅ EnableRentalButton: Rental status enabled successfully', updatedItem);
      
      // Validate response before proceeding
      if (!updatedItem) {
        console.warn('EnableRentalButton: API returned null/undefined updatedItem');
        return;
      }

      // Update the cache with both identifiers
      if (item.item_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['inventory-item', item.item_id] 
        });
      }
      
      if (item.sku) {
        queryClient.invalidateQueries({ 
          queryKey: ['inventory-item', item.sku] 
        });
      }
      
      // Call the callback with validation
      if (onRentalEnabled && typeof onRentalEnabled === 'function') {
        onRentalEnabled(updatedItem);
      }
      
      // Show success dialog
      setShowConfirmDialog(false);
      setShowSuccessDialog(true);
    },
    onError: (error) => {
      console.error('❌ EnableRentalButton: Failed to enable rental status:', error);
      
      // Enhanced error logging
      console.error('Error details:', {
        itemId: item?.item_id,
        sku: item?.sku,
        errorMessage: error?.message || 'Unknown error',
        errorStack: error?.stack
      });
    }
  });

  const handleEnableRental = () => {
    // Final validation before mutation
    if (!item?.item_id) {
      console.error('EnableRentalButton: Cannot enable rental - item_id is missing');
      return;
    }
    
    if (enableRentalMutation.isPending) {
      console.warn('EnableRentalButton: Mutation already in progress, ignoring duplicate request');
      return;
    }

    enableRentalMutation.mutate();
  };

  const handleSuccessClose = () => {
    setShowSuccessDialog(false);
    // Auto-open pricing modal after enabling rental
    if (onOpenPricingModal && typeof onOpenPricingModal === 'function') {
      setTimeout(() => {
        onOpenPricingModal();
      }, 200);
    }
  };

  // Don't show button if already rentable
  if (item.is_rentable) {
    return null;
  }

  return (
    <>
      {/* Enable Rental Button */}
      <Button
        variant="outline"
        onClick={() => setShowConfirmDialog(true)}
        className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300"
      >
        <DollarSign className="h-4 w-4" />
        Configure for Rental
      </Button>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Enable Rental Configuration
            </DialogTitle>
            <DialogDescription>
              Configure <strong>{item.item_name || 'this item'}</strong> (SKU: {item.sku || 'N/A'}) for rental?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This will enable rental functionality for this item. You'll be able to:
                <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
                  <li>Set daily rental rates</li>
                  <li>Configure tiered pricing for weekly/monthly discounts</li>
                  <li>Track rental availability and bookings</li>
                  <li>Generate rental contracts and invoices</li>
                </ul>
              </AlertDescription>
            </Alert>

            {enableRentalMutation.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  Failed to enable rental configuration. Please try again.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={enableRentalMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEnableRental}
              disabled={enableRentalMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {enableRentalMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enabling...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Enable Rental
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <Check className="h-5 w-5" />
              Rental Configuration Enabled
            </DialogTitle>
            <DialogDescription>
              <strong>{item.item_name || 'This item'}</strong> is now configured for rental.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Rental functionality has been successfully enabled. You can now set up pricing tiers
                and rental rates for this item.
              </AlertDescription>
            </Alert>

            <div className="text-sm text-muted-foreground">
              <p>Next steps:</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Configure daily rental rates</li>
                <li>Set up tiered pricing for longer rentals</li>
                <li>Review rental availability settings</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSuccessClose} className="bg-green-600 hover:bg-green-700">
              <Settings className="h-4 w-4 mr-2" />
              Configure Pricing Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}