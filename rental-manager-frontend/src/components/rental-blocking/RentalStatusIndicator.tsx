'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Package, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RentalStatusIndicatorProps } from '@/types/rental-blocking';

export function RentalStatusIndicator({
  isBlocked,
  reason,
  entityType,
  showTooltip = true,
  size = 'md'
}: RentalStatusIndicatorProps) {
  const getIcon = () => {
    if (isBlocked) {
      return <AlertTriangle className={cn(
        "text-red-600",
        size === 'sm' && "h-3 w-3",
        size === 'md' && "h-4 w-4", 
        size === 'lg' && "h-5 w-5"
      )} />;
    }
    return <CheckCircle className={cn(
      "text-green-600",
      size === 'sm' && "h-3 w-3",
      size === 'md' && "h-4 w-4",
      size === 'lg' && "h-5 w-5"
    )} />;
  };

  const getBadgeVariant = () => {
    return isBlocked ? "destructive" : "success";
  };

  const getStatusText = () => {
    if (isBlocked) {
      return entityType === 'ITEM' ? 'All Units Blocked' : 'Unit Blocked';
    }
    return 'Available for Rental';
  };

  const getTooltipContent = () => {
    if (isBlocked && reason) {
      return (
        <div className="space-y-1">
          <div className="font-medium">
            {entityType === 'ITEM' ? 'Item' : 'Unit'} blocked from rental
          </div>
          <div className="text-sm opacity-90">
            Reason: {reason}
          </div>
        </div>
      );
    }
    
    if (isBlocked) {
      return `${entityType === 'ITEM' ? 'Item' : 'Unit'} is blocked from rental`;
    }
    
    return `${entityType === 'ITEM' ? 'Item' : 'Unit'} is available for rental`;
  };

  const badge = (
    <Badge 
      variant={getBadgeVariant()} 
      className={cn(
        "flex items-center gap-1.5",
        size === 'sm' && "text-xs px-2 py-0.5",
        size === 'md' && "text-sm px-2.5 py-1",
        size === 'lg' && "text-base px-3 py-1.5"
      )}
    >
      {getIcon()}
      <span>{getStatusText()}</span>
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default RentalStatusIndicator;