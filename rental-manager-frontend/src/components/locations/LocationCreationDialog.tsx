'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LocationForm } from './location-form';
import type { Location } from '@/types/location';

interface LocationCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>;
}

export function LocationCreationDialog({
  open,
  onOpenChange,
  onSubmit,
}: LocationCreationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    setError(undefined);
    
    try {
      await onSubmit(data);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to create location');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setError(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Location</DialogTitle>
          <DialogDescription>
            Add a new location to manage inventory and operations.
          </DialogDescription>
        </DialogHeader>
        <LocationForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
          error={error}
        />
      </DialogContent>
    </Dialog>
  );
}