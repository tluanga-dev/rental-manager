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
import { CheckCircle, Package, ShoppingCart, Receipt, Calendar, Plus, History } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrencySync } from '@/lib/currency-utils';

interface Purchase {
  id: string;
  reference_number?: string;
  total_amount: number;
  items_count?: number;
  purchase_date?: string;
  supplier_name?: string;
  location_name?: string;
  transaction_number?: string;
}

interface PurchaseSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: Purchase | null;
  onCreateAnother: () => void;
  onViewHistory: () => void;
}

export function PurchaseSuccessDialog({
  open,
  onOpenChange,
  purchase,
  onCreateAnother,
  onViewHistory,
}: PurchaseSuccessDialogProps) {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      // Start countdown from 5 seconds
      setCountdown(5);
    } else {
      setCountdown(null);
    }
  }, [open]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Auto-close and navigate to purchase history
      onViewHistory();
    }
  }, [countdown, onViewHistory]);

  if (!purchase) return null;

  const formattedAmount = formatCurrencySync(purchase.total_amount);
  const formattedDate = purchase.purchase_date 
    ? format(new Date(purchase.purchase_date), 'dd MMM yyyy')
    : format(new Date(), 'dd MMM yyyy');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Purchase Recorded Successfully!</DialogTitle>
              <DialogDescription className="mt-1">
                Your purchase transaction has been saved to the system.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Purchase Details */}
          <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Receipt className="h-5 w-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {purchase.reference_number || purchase.transaction_number || `Purchase #${purchase.id.slice(0, 8)}`}
                </p>
                <p className="text-sm text-gray-600">Reference Number</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-gray-500" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  Total Amount: <span className="font-semibold text-gray-900">{formattedAmount}</span>
                </p>
              </div>
            </div>

            {purchase.items_count && (
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    Items: <span className="font-medium">{purchase.items_count} items</span>
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-500" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  Date: <span className="font-medium">{formattedDate}</span>
                </p>
              </div>
            </div>

            {purchase.supplier_name && (
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 bg-gray-300 rounded-full mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    Supplier: <span className="font-medium">{purchase.supplier_name}</span>
                  </p>
                </div>
              </div>
            )}

            {purchase.location_name && (
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 bg-gray-300 rounded-full mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    Location: <span className="font-medium">{purchase.location_name}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Auto-close countdown */}
          {countdown !== null && (
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Redirecting to purchase history in {countdown} seconds...
              </p>
              <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onCreateAnother();
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Record Another Purchase
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onViewHistory();
            }}
            className="flex items-center gap-2"
          >
            <History className="h-4 w-4" />
            View Purchase History
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}