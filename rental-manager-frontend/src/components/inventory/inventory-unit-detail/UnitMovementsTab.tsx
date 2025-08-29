'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, ArrowRight, Package } from 'lucide-react';
import { inventoryUnitsApi } from '@/services/api/inventory-units';

interface UnitMovementsTabProps {
  unitId: string;
}

const MOVEMENT_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  PURCHASE: { label: 'Purchase', className: 'bg-green-100 text-green-800' },
  SALE: { label: 'Sale', className: 'bg-blue-100 text-blue-800' },
  TRANSFER_IN: { label: 'Transfer In', className: 'bg-purple-100 text-purple-800' },
  TRANSFER_OUT: { label: 'Transfer Out', className: 'bg-orange-100 text-orange-800' },
  ADJUSTMENT: { label: 'Adjustment', className: 'bg-yellow-100 text-yellow-800' },
  RENTAL_OUT: { label: 'Rental Out', className: 'bg-indigo-100 text-indigo-800' },
  RENTAL_RETURN: { label: 'Rental Return', className: 'bg-teal-100 text-teal-800' },
  DAMAGE: { label: 'Damage', className: 'bg-red-100 text-red-800' },
  REPAIR: { label: 'Repair', className: 'bg-cyan-100 text-cyan-800' },
};

export function UnitMovementsTab({ unitId }: UnitMovementsTabProps) {
  const { 
    data: movements, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['unit-movements', unitId],
    queryFn: () => inventoryUnitsApi.getUnitMovements(unitId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading movements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading movements</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const movementsList = movements || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Stock Movement History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {movementsList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2" />
              <p>No movements recorded for this unit</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From Location</TableHead>
                    <TableHead>To Location</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementsList.map((movement: any, index: number) => {
                    const typeConfig = MOVEMENT_TYPE_CONFIG[movement.movement_type] || {
                      label: movement.movement_type,
                      className: 'bg-gray-100 text-gray-800',
                    };
                    
                    return (
                      <TableRow key={movement.id || index}>
                        <TableCell>
                          {new Date(movement.movement_date || movement.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={typeConfig.className}>
                            {typeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {movement.from_location || '-'}
                        </TableCell>
                        <TableCell>
                          {movement.to_location || movement.location || '-'}
                        </TableCell>
                        <TableCell>
                          {movement.quantity || movement.quantity_change || 1}
                        </TableCell>
                        <TableCell>
                          {movement.performed_by || movement.user || '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {movement.notes || movement.reason || '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}