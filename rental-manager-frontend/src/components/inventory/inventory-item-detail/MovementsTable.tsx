'use client';

import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Package,
  ShoppingCart,
  RefreshCw,
  Wrench,
  AlertTriangle,
  Edit3,
  MapPin,
  User,
  Calendar,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StockMovementDetail, MovementType } from '@/types/inventory-items';

interface MovementsTableProps {
  movements: StockMovementDetail[];
  isLoading?: boolean;
}

const MOVEMENT_TYPE_CONFIG: Record<MovementType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  direction: 'in' | 'out' | 'neutral';
}> = {
  PURCHASE: {
    label: 'Purchase',
    icon: ArrowDownRight,
    className: 'bg-green-100 text-green-800 border-green-200',
    direction: 'in',
  },
  SALE: {
    label: 'Sale',
    icon: ShoppingCart,
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    direction: 'out',
  },
  RENTAL_OUT: {
    label: 'Rental Out',
    icon: ArrowUpRight,
    className: 'bg-purple-100 text-purple-800 border-purple-200',
    direction: 'out',
  },
  RENTAL_RETURN: {
    label: 'Rental Return',
    icon: RefreshCw,
    className: 'bg-purple-100 text-purple-800 border-purple-200',
    direction: 'in',
  },
  TRANSFER: {
    label: 'Transfer',
    icon: ArrowRight,
    className: 'bg-orange-100 text-orange-800 border-orange-200',
    direction: 'neutral',
  },
  ADJUSTMENT: {
    label: 'Adjustment',
    icon: Edit3,
    className: 'bg-gray-100 text-gray-800 border-gray-200',
    direction: 'neutral',
  },
  DAMAGE: {
    label: 'Damage',
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-800 border-red-200',
    direction: 'out',
  },
  REPAIR: {
    label: 'Repair',
    icon: Wrench,
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    direction: 'in',
  },
  WRITE_OFF: {
    label: 'Write Off',
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-800 border-red-200',
    direction: 'out',
  },
};

export function MovementsTable({ movements, isLoading }: MovementsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Activity className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-muted-foreground">No movements recorded</p>
        <p className="text-sm text-muted-foreground mt-1">
          Stock movements will appear here when inventory changes occur
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
          <ArrowDownRight className="h-4 w-4 text-green-600" />
          <div>
            <p className="text-xs text-muted-foreground">Inbound</p>
            <p className="font-semibold">
              {movements.filter(m => m.quantity_change > 0).length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
          <ArrowUpRight className="h-4 w-4 text-red-600" />
          <div>
            <p className="text-xs text-muted-foreground">Outbound</p>
            <p className="font-semibold">
              {movements.filter(m => m.quantity_change < 0).length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <Edit3 className="h-4 w-4 text-gray-600" />
          <div>
            <p className="text-xs text-muted-foreground">Adjustments</p>
            <p className="font-semibold">
              {movements.filter(m => m.movement_type === 'ADJUSTMENT').length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
          <Activity className="h-4 w-4 text-blue-600" />
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-semibold">{movements.length}</p>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Before → After</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => {
              // Handle string movement_type from backend
              const movementType = movement.movement_type as string;
              const typeConfig = MOVEMENT_TYPE_CONFIG[movementType as MovementType] || {
                label: movementType,
                icon: Package,
                className: 'bg-gray-100 text-gray-800 border-gray-200',
                direction: 'neutral' as const,
              };
              const Icon = typeConfig.icon;
              const isPositive = movement.quantity_change > 0;
              
              return (
                <TableRow key={movement.id}>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>{new Date(movement.created_at).toLocaleDateString()}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(movement.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'flex items-center gap-1 w-fit',
                        typeConfig.className
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {typeConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className={cn(
                      'font-semibold',
                      isPositive ? 'text-green-600' : 'text-red-600'
                    )}>
                      {isPositive ? '+' : ''}{movement.quantity_change}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {movement.quantity_before}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {movement.quantity_after}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {movement.location_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {movement.created_by ? (
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {movement.created_by}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                      {movement.notes || '-'}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}