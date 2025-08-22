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
import { CheckCircle, MapPin, Building2, Mail, Phone, Plus, List } from 'lucide-react';
import type { Location } from '@/types/location';

interface LocationSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location | null;
  onCreateAnother: () => void;
  onViewLocations: () => void;
}

export function LocationSuccessDialog({
  open,
  onOpenChange,
  location,
  onCreateAnother,
  onViewLocations,
}: LocationSuccessDialogProps) {
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
      // Auto-close and navigate to locations list
      onViewLocations();
    }
  }, [countdown, onViewLocations]);

  if (!location) return null;

  const getLocationTypeLabel = (type: string) => {
    switch (type) {
      case 'WAREHOUSE':
        return 'Warehouse';
      case 'STORE':
        return 'Store';
      case 'SERVICE_CENTER':
        return 'Service Center';
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Location Created Successfully!</DialogTitle>
              <DialogDescription className="mt-1">
                The new location has been added to your system.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Location Details */}
          <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{location.location_name || location.name}</p>
                <p className="text-sm text-gray-600">Code: {location.location_code || location.code}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gray-500" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  Type: <span className="font-medium">{getLocationTypeLabel(location.location_type)}</span>
                </p>
              </div>
            </div>

            {location.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    {location.address}
                    {location.city && `, ${location.city}`}
                    {location.state && `, ${location.state}`}
                    {location.country && `, ${location.country}`}
                    {location.postal_code && ` ${location.postal_code}`}
                  </p>
                </div>
              </div>
            )}

            {location.contact_number || location.email ? (
              <div className="space-y-2 pt-2 border-t">
                {location.contact_number && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <p className="text-sm text-gray-600">{location.contact_number}</p>
                  </div>
                )}
                {location.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <p className="text-sm text-gray-600">{location.email}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Auto-close countdown */}
          {countdown !== null && (
            <p className="text-sm text-center text-gray-500">
              Redirecting to locations list in {countdown} seconds...
            </p>
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
            Create Another
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onViewLocations();
            }}
            className="flex items-center gap-2"
          >
            <List className="h-4 w-4" />
            View Locations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}