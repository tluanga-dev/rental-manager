'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LocationForm } from '@/components/locations/location-form';
import { LocationSuccessDialog } from '@/components/dialogs/LocationSuccessDialog';
import { LocationErrorDialog } from '@/components/dialogs/LocationErrorDialog';
import { locationsApi } from '@/services/api/locations';
import { useAppStore } from '@/stores/app-store';
import type { Location } from '@/types/location';

export default function NewLocationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addNotification } = useAppStore();
  
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [createdLocation, setCreatedLocation] = useState<Location | null>(null);
  const [lastError, setLastError] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create location mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Data now comes with backend field names directly, no transformation needed
      return locationsApi.create(data);
    },
    onSuccess: (data) => {
      // Invalidate locations query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      
      // Set the created location data
      setCreatedLocation(data);
      
      // Show success dialog
      setShowSuccessDialog(true);
      
      // Hide any error dialog
      setShowErrorDialog(false);
      setLastError(null);
    },
    onError: (error: any) => {
      // Set the error
      setLastError(error);
      
      // Show error dialog
      setShowErrorDialog(true);
      
      // Log error for debugging
      console.error('Failed to create location:', error);
    },
  });

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/inventory/locations');
  };

  const handleCreateAnother = () => {
    // Reset the form by refreshing the page
    setCreatedLocation(null);
    setShowSuccessDialog(false);
    window.location.reload();
  };

  const handleViewLocations = () => {
    router.push('/inventory/locations');
  };

  const handleTryAgain = () => {
    // Close error dialog and let user try again
    setShowErrorDialog(false);
    setLastError(null);
  };

  const handleCancelError = () => {
    // Close error dialog and navigate back
    setShowErrorDialog(false);
    router.push('/inventory/locations');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Page Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/inventory/locations')}
          className="hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="h-8 w-8 text-primary" />
            Add New Location
          </h1>
          <p className="text-gray-600 mt-1">
            Create a new location to manage inventory and operations
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Location Details</CardTitle>
          <CardDescription>
            Fill in the information below to create a new location. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LocationForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
            error={lastError && !showErrorDialog ? lastError : undefined}
          />
        </CardContent>
      </Card>

      {/* Success Dialog */}
      <LocationSuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        location={createdLocation}
        onCreateAnother={handleCreateAnother}
        onViewLocations={handleViewLocations}
      />

      {/* Error Dialog */}
      <LocationErrorDialog
        open={showErrorDialog}
        onOpenChange={setShowErrorDialog}
        error={lastError}
        onTryAgain={handleTryAgain}
        onCancel={handleCancelError}
      />
    </div>
  );
}