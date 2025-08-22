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
  Edit3,
  ArrowRight,
  Clock,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldChange } from '@/utils/item-change-detector';
import { groupChangesByCategory, getChangeSummary } from '@/utils/item-change-detector';

interface ItemUpdateSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  changes: FieldChange[];
  onViewItem: () => void;
  onContinueEditing: () => void;
  autoRedirectSeconds?: number;
}

export function ItemUpdateSuccessDialog({
  open,
  onOpenChange,
  itemName,
  changes,
  onViewItem,
  onContinueEditing,
  autoRedirectSeconds = 10,
}: ItemUpdateSuccessDialogProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const groupedChanges = groupChangesByCategory(changes);
  const changeSummary = getChangeSummary(changes);

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

  const handleContinueEditing = () => {
    setCountdown(null); // Stop countdown
    onContinueEditing();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl flex items-center gap-2">
                Item Updated Successfully!
                <Badge variant="outline" className="text-xs">
                  {changeSummary}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-1">
                <span className="font-medium">{itemName}</span> has been updated with the following changes:
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Changes List */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-4 px-1">
          {changes.length === 0 ? (
            <div className="text-center py-8">
              <Info className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No changes were detected.</p>
              <p className="text-sm text-gray-500 mt-1">The item data remains unchanged.</p>
            </div>
          ) : (
            Object.entries(groupedChanges).map(([category, categoryChanges]) => (
              <div key={category} className="space-y-2">
                {/* Category Header */}
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-700">{category}</h3>
                  <div className="flex-1">
                    <Separator className="bg-gray-200" />
                  </div>
                </div>

                {/* Changes in this category */}
                <div className="space-y-2 pl-6">
                  {categoryChanges.map((change) => (
                    <div
                      key={change.field}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-700 mb-1">
                          {change.label}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={cn(
                            "px-2 py-0.5 rounded",
                            change.oldDisplay === 'Not set' 
                              ? "text-gray-500 bg-gray-100" 
                              : "text-red-700 bg-red-50 line-through"
                          )}>
                            {change.oldDisplay}
                          </span>
                          <ArrowRight className="h-3 w-3 text-gray-400" />
                          <span className={cn(
                            "px-2 py-0.5 rounded font-medium",
                            change.newDisplay === 'Not set'
                              ? "text-gray-600 bg-gray-100"
                              : "text-green-700 bg-green-50"
                          )}>
                            {change.newDisplay}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Auto-redirect countdown */}
        {countdown !== null && countdown > 0 && (
          <div className="flex items-center justify-center gap-2 py-3 bg-blue-50 rounded-lg mt-4">
            <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
            <p className="text-sm text-blue-700">
              Redirecting to item details in <span className="font-semibold">{countdown}</span> seconds...
            </p>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 mt-4">
          <Button
            variant="outline"
            onClick={handleContinueEditing}
            className="flex items-center gap-2"
          >
            <Edit3 className="h-4 w-4" />
            Continue Editing
          </Button>
          <Button
            onClick={handleViewItem}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Eye className="h-4 w-4" />
            View Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}