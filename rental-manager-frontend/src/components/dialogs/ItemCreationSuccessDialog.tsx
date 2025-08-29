'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  Package, 
  Eye, 
  Plus,
  List,
  Clock,
  Barcode,
  DollarSign,
  Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItemCreationSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemData: {
    id: string;
    item_name: string;
    sku?: string;
    is_rentable?: boolean;
    is_salable?: boolean;
    rental_rate_per_day?: number;
    sale_price?: number;
  };
  onViewItem: () => void;
  onCreateAnother: () => void;
  onGoToList: () => void;
  autoRedirectSeconds?: number;
}

export function ItemCreationSuccessDialog({
  open,
  onOpenChange,
  itemData,
  onViewItem,
  onCreateAnother,
  onGoToList,
  autoRedirectSeconds = 5,
}: ItemCreationSuccessDialogProps) {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (open && autoRedirectSeconds > 0) {
      setCountdown(autoRedirectSeconds);
    } else {
      setCountdown(null);
    }
  }, [open, autoRedirectSeconds]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Auto-redirect to view item
      onViewItem();
    }
  }, [countdown, onViewItem]);

  const handleViewItem = () => {
    setCountdown(null); // Stop countdown
    onViewItem();
  };

  const handleCreateAnother = () => {
    setCountdown(null); // Stop countdown
    onCreateAnother();
  };

  const handleGoToList = () => {
    setCountdown(null); // Stop countdown
    onGoToList();
  };

  // Determine item type badge
  const getItemTypeBadge = () => {
    if (itemData.is_rentable && itemData.is_salable) {
      return <Badge className="bg-purple-100 text-purple-700">Rentable & Salable</Badge>;
    } else if (itemData.is_rentable) {
      return <Badge className="bg-blue-100 text-blue-700">Rentable Only</Badge>;
    } else if (itemData.is_salable) {
      return <Badge className="bg-green-100 text-green-700">Salable Only</Badge>;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl">
                Item Created Successfully!
              </DialogTitle>
              <DialogDescription className="mt-1">
                Your new item has been added to the inventory.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Item Details Summary */}
        <div className="mt-4 space-y-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-gray-600" />
                  <span className="font-semibold text-lg">{itemData.item_name}</span>
                </div>
                
                {itemData.sku && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Barcode className="h-4 w-4" />
                    <span>SKU: {itemData.sku}</span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {getItemTypeBadge()}
                </div>

                {/* Pricing Information */}
                <div className="flex flex-wrap gap-4 pt-2">
                  {itemData.is_rentable && itemData.rental_rate_per_day !== undefined && (
                    <div className="flex items-center gap-1 text-sm">
                      <Tag className="h-4 w-4 text-blue-600" />
                      <span className="text-gray-600">Rental Rate:</span>
                      <span className="font-semibold">${itemData.rental_rate_per_day}/day</span>
                    </div>
                  )}
                  {itemData.is_salable && itemData.sale_price !== undefined && (
                    <div className="flex items-center gap-1 text-sm">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-gray-600">Sale Price:</span>
                      <span className="font-semibold">${itemData.sale_price}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Success Message */}
          <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium">What's next?</p>
              <ul className="mt-1 space-y-1 text-green-700">
                <li>• View the item details to add stock or configure additional settings</li>
                <li>• Create another item to continue building your inventory</li>
                <li>• Go to the items list to manage all your products</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Auto-redirect countdown */}
        {countdown !== null && countdown > 0 && (
          <div className="flex items-center justify-center gap-2 py-3 bg-blue-50 rounded-lg">
            <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
            <p className="text-sm text-blue-700">
              Redirecting to item details in <span className="font-semibold">{countdown}</span> seconds...
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleGoToList}
            className="flex items-center gap-2"
          >
            <List className="h-4 w-4" />
            Go to Items List
          </Button>
          <Button
            variant="outline"
            onClick={handleCreateAnother}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Another
          </Button>
          <Button
            onClick={handleViewItem}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Eye className="h-4 w-4" />
            View Item Details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}