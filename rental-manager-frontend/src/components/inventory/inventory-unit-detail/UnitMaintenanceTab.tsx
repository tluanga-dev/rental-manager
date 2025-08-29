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
import { Wrench, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { inventoryUnitsApi } from '@/services/api/inventory-units';
import { formatCurrencySync } from '@/lib/currency-utils';

interface UnitMaintenanceTabProps {
  unitId: string;
}

export function UnitMaintenanceTab({ unitId }: UnitMaintenanceTabProps) {
  const { 
    data: maintenanceHistory, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['unit-maintenance', unitId],
    queryFn: () => inventoryUnitsApi.getUnitMaintenanceHistory(unitId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading maintenance history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Wrench className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading maintenance history</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maintenanceList = maintenanceHistory || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {maintenanceList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-8 w-8 mx-auto mb-2" />
              <p>No maintenance records for this unit</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Service</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceList.map((maintenance: any, index: number) => (
                    <TableRow key={maintenance.id || index}>
                      <TableCell>
                        {maintenance.date ? new Date(maintenance.date).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {maintenance.type || 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {maintenance.description || '-'}
                      </TableCell>
                      <TableCell>
                        {maintenance.technician || '-'}
                      </TableCell>
                      <TableCell>
                        {maintenance.cost ? formatCurrencySync(maintenance.cost) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={maintenance.status === 'COMPLETED' ? 'default' : 'secondary'}>
                          {maintenance.status || 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {maintenance.next_service_date ? new Date(maintenance.next_service_date).toLocaleDateString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warranty Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Warranty & Service Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Warranty Status</p>
              <Badge variant="outline">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Warranty Expiry</p>
              <p className="font-medium">-</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Next Scheduled Maintenance</p>
              <p className="font-medium">-</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Maintenance Cost</p>
              <p className="font-medium text-lg">
                {formatCurrencySync(
                  maintenanceList.reduce((sum: number, m: any) => sum + (m.cost || 0), 0)
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}