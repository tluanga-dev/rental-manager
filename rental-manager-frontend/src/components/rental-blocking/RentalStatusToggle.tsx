'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { RentalStatusDialog } from '@/components/dialogs/RentalStatusDialog';
import { RentalStatusIndicator } from './RentalStatusIndicator';
import { cn } from '@/lib/utils';
import type { RentalStatusToggleProps } from '@/types/rental-blocking';

export function RentalStatusToggle({
  entityId,
  entityType,
  entityName,
  currentStatus,
  currentReason,
  onStatusChange,
  disabled = false,
  size = 'md'
}: RentalStatusToggleProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (blocked: boolean, remarks: string) => {
    setIsUpdating(true);
    try {
      await onStatusChange(blocked, remarks);
      toast.success(
        `${entityType === 'ITEM' ? 'Item' : 'Unit'} ${blocked ? 'blocked' : 'unblocked'} successfully`
      );
    } catch (error) {
      toast.error(
        `Failed to ${blocked ? 'block' : 'unblock'} ${entityType === 'ITEM' ? 'item' : 'unit'}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
      throw error; // Re-throw to let dialog handle it
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleClick = () => {
    if (disabled || isUpdating) return;
    setIsDialogOpen(true);
  };

  if (size === 'sm') {
    return (
      <>
        <div className="flex items-center gap-2">
          <RentalStatusIndicator
            isBlocked={currentStatus}
            reason={currentReason}
            entityType={entityType}
            size="sm"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleClick}
            disabled={disabled || isUpdating}
            className="h-6 w-6 p-0"
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Settings className="h-3 w-3" />
            )}
          </Button>
        </div>

        <RentalStatusDialog
          entityType={entityType}
          entityId={entityId}
          entityName={entityName}
          currentStatus={currentStatus}
          currentReason={currentReason}
          onStatusChange={handleStatusChange}
          onClose={() => setIsDialogOpen(false)}
          isOpen={isDialogOpen}
          isLoading={isUpdating}
        />
      </>
    );
  }

  if (size === 'lg') {
    return (
      <>
        <div className="flex items-center gap-4">
          <RentalStatusIndicator
            isBlocked={currentStatus}
            reason={currentReason}
            entityType={entityType}
            size="lg"
          />
          <Button
            variant="outline"
            onClick={handleToggleClick}
            disabled={disabled || isUpdating}
            className="flex items-center gap-2"
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
            Change Status
          </Button>
        </div>

        <RentalStatusDialog
          entityType={entityType}
          entityId={entityId}
          entityName={entityName}
          currentStatus={currentStatus}
          currentReason={currentReason}
          onStatusChange={handleStatusChange}
          onClose={() => setIsDialogOpen(false)}
          isOpen={isDialogOpen}
          isLoading={isUpdating}
        />
      </>
    );
  }

  // Default medium size with switch-like interface
  return (
    <>
      <div className="flex items-center gap-3">
        <RentalStatusIndicator
          isBlocked={currentStatus}
          reason={currentReason}
          entityType={entityType}
          size="md"
        />
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <Switch
                  checked={!currentStatus} // Switch is "on" when NOT blocked
                  onCheckedChange={handleToggleClick}
                  disabled={disabled || isUpdating}
                  className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-red-600"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Click to {currentStatus ? 'unblock' : 'block'} from rental
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isUpdating && (
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        )}
      </div>

      <RentalStatusDialog
        entityType={entityType}
        entityId={entityId}
        entityName={entityName}
        currentStatus={currentStatus}
        currentReason={currentReason}
        onStatusChange={handleStatusChange}
        onClose={() => setIsDialogOpen(false)}
        isOpen={isDialogOpen}
        isLoading={isUpdating}
      />
    </>
  );
}

export default RentalStatusToggle;