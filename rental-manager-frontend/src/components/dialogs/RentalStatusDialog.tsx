'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Package, Wrench, Info } from 'lucide-react';
import type { RentalStatusDialogProps, RentalStatusFormData } from '@/types/rental-blocking';

// Validation schema
const rentalStatusSchema = z.object({
  is_rental_blocked: z.boolean(),
  remarks: z.string()
    .min(10, 'Remarks must be at least 10 characters long')
    .max(1000, 'Remarks cannot exceed 1000 characters')
    .refine(value => value.trim().length >= 10, {
      message: 'Remarks must contain at least 10 non-whitespace characters'
    })
});

export function RentalStatusDialog({
  entityType,
  entityId,
  entityName,
  currentStatus,
  currentReason,
  onStatusChange,
  onClose,
  isOpen,
  isLoading = false
}: RentalStatusDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid }
  } = useForm<RentalStatusFormData>({
    resolver: zodResolver(rentalStatusSchema),
    defaultValues: {
      is_rental_blocked: !currentStatus, // Toggle the current status
      remarks: ''
    }
  });

  const isBlocking = watch('is_rental_blocked');

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      reset({
        is_rental_blocked: !currentStatus,
        remarks: ''
      });
      setError(null);
    }
  }, [isOpen, currentStatus, reset]);

  const handleFormSubmit = async (data: RentalStatusFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onStatusChange(data.is_rental_blocked, data.remarks.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rental status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEntityIcon = () => {
    return entityType === 'ITEM' ? Package : Wrench;
  };

  const getStatusChangeDescription = () => {
    const action = isBlocking ? 'block' : 'unblock';
    const target = entityType === 'ITEM' ? 'item' : 'unit';
    return `${action} this ${target} from rental`;
  };

  const getImpactDescription = () => {
    if (entityType === 'ITEM') {
      return isBlocking 
        ? 'This will block ALL inventory units of this item from rental'
        : 'This will allow inventory units of this item to be rented (if not individually blocked)';
    } else {
      return isBlocking
        ? 'This will block only this specific unit from rental'
        : 'This will allow this unit to be rented (if the parent item is not blocked)';
    }
  };

  const EntityIcon = getEntityIcon();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <EntityIcon className="h-5 w-5 text-blue-600" />
            <div>
              <DialogTitle>
                Change Rental Status
              </DialogTitle>
              <DialogDescription>
                {getStatusChangeDescription()} &quot;{entityName}&quot;
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Current Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Current Status</Label>
            <div className="flex items-center gap-2">
              <Badge variant={currentStatus ? "destructive" : "success"}>
                {currentStatus ? "🔴 Blocked" : "🟢 Available"}
              </Badge>
              {currentReason && (
                <span className="text-sm text-gray-600">
                  Reason: {currentReason}
                </span>
              )}
            </div>
          </div>

          {/* New Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">New Status</Label>
            <div className="flex items-center gap-2">
              <Badge variant={isBlocking ? "destructive" : "success"}>
                {isBlocking ? "🔴 Blocked" : "🟢 Available"}
              </Badge>
              <span className="text-sm text-gray-600">
                Will {isBlocking ? 'block' : 'unblock'} from rental
              </span>
            </div>
          </div>

          {/* Impact Warning */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {getImpactDescription()}
            </AlertDescription>
          </Alert>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks" className="text-sm font-medium text-gray-700">
              Remarks <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="remarks"
              placeholder="Enter the reason for this status change (minimum 10 characters)..."
              className="min-h-[100px] resize-none"
              {...register('remarks')}
            />
            {errors.remarks && (
              <p className="text-sm text-red-600">{errors.remarks.message}</p>
            )}
            <p className="text-xs text-gray-500">
              This information will be recorded in the audit history.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting || isLoading}
              className={isBlocking ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isBlocking ? 'Block' : 'Unblock'} {entityType === 'ITEM' ? 'Item' : 'Unit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}