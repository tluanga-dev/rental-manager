'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  Clock,
  Package,
  AlertCircle,
  AlertTriangle,
  CheckSquare,
  Calendar,
  PlayCircle,
  Eye,
} from 'lucide-react';
import type { RentalStatus } from '@/types/rentals';
import { getRentalStatusConfig } from '@/types/rentals';

interface RentalStatusBadgeProps {
  status: RentalStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showTooltip?: boolean;
  className?: string;
}

const RentalStatusBadge: React.FC<RentalStatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  showTooltip = false,
  className,
}) => {
  const config = getRentalStatusConfig(status);

  // Icon mapping for each status
  const statusIcons = {
    RESERVED: Calendar,
    CONFIRMED: CheckCircle,
    PICKED_UP: PlayCircle,
    ACTIVE: CheckCircle,
    EXTENDED: Clock,
    PARTIAL_RETURN: Package,
    OVERDUE: AlertCircle,
    LATE: AlertCircle,
    LATE_PARTIAL_RETURN: AlertTriangle,
    RETURNED: CheckSquare,
    COMPLETED: CheckCircle,
  };

  // Color variants mapping
  const colorVariants = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  // Size variants
  const sizeVariants = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  // Icon size mapping
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const Icon = statusIcons[status] || Eye;
  const colorClass = colorVariants[config.color as keyof typeof colorVariants] || colorVariants.gray;
  const sizeClass = sizeVariants[size];
  const iconClass = iconSizes[size];

  const badgeContent = (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 font-medium border',
        colorClass,
        sizeClass,
        className
      )}
      title={showTooltip ? config.description : undefined}
    >
      {showIcon && <Icon className={iconClass} />}
      {config.label}
    </Badge>
  );

  return badgeContent;
};

// Export additional utility components for specific use cases
export const CompactRentalStatusBadge: React.FC<Omit<RentalStatusBadgeProps, 'size' | 'showIcon'>> = (props) => (
  <RentalStatusBadge {...props} size="sm" showIcon={false} />
);

export const DetailedRentalStatusBadge: React.FC<Omit<RentalStatusBadgeProps, 'size' | 'showTooltip'>> = (props) => (
  <RentalStatusBadge {...props} size="lg" showTooltip={true} />
);

// Status-specific badge components for convenience
export const LateStatusBadge: React.FC<Omit<RentalStatusBadgeProps, 'status'>> = (props) => (
  <RentalStatusBadge {...props} status="LATE" />
);

export const OverdueStatusBadge: React.FC<Omit<RentalStatusBadgeProps, 'status'>> = (props) => (
  <RentalStatusBadge {...props} status="OVERDUE" />
);

export const ActiveStatusBadge: React.FC<Omit<RentalStatusBadgeProps, 'status'>> = (props) => (
  <RentalStatusBadge {...props} status="ACTIVE" />
);

export const CompletedStatusBadge: React.FC<Omit<RentalStatusBadgeProps, 'status'>> = (props) => (
  <RentalStatusBadge {...props} status="COMPLETED" />
);

// Helper function to get appropriate status badge variant based on priority
export const getStatusBadgeVariant = (status: RentalStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const config = getRentalStatusConfig(status);
  
  if (config.color === 'red') return 'destructive';
  if (config.color === 'gray') return 'secondary';
  if (config.color === 'orange') return 'outline';
  return 'default';
};

export default RentalStatusBadge;