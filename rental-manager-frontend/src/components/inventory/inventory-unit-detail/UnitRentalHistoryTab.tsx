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
import { Calendar, User, MapPin, DollarSign } from 'lucide-react';
import { inventoryUnitsApi } from '@/services/api/inventory-units';
import { formatCurrencySync } from '@/lib/currency-utils';

interface UnitRentalHistoryTabProps {
  unitId: string;
}

const RENTAL_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-green-100 text-green-800' },
  COMPLETED: { label: 'Completed', className: 'bg-blue-100 text-blue-800' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
  OVERDUE: { label: 'Overdue', className: 'bg-orange-100 text-orange-800' },
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
};

export function UnitRentalHistoryTab({ unitId }: UnitRentalHistoryTabProps) {
  const { 
    data: rentalHistory, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['unit-rental-history', unitId],
    queryFn: () => inventoryUnitsApi.getUnitRentalHistory(unitId),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading rental history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading rental history</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rentals = rentalHistory || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Rental History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rentals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2" />
              <p>No rental history for this unit</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rental ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Return Condition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentals.map((rental: any, index: number) => {
                    const statusConfig = RENTAL_STATUS_CONFIG[rental.status] || {
                      label: rental.status,
                      className: 'bg-gray-100 text-gray-800',
                    };
                    
                    return (
                      <TableRow key={rental.id || index}>
                        <TableCell className="font-mono">
                          {rental.rental_number || `RNT-${rental.id}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {rental.customer_name || rental.customer || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {rental.start_date ? new Date(rental.start_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          {rental.end_date ? new Date(rental.end_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig.className}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rental.total_amount ? formatCurrencySync(rental.total_amount) : '-'}
                        </TableCell>
                        <TableCell>
                          {rental.return_condition || '-'}
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

      {/* Rental Statistics */}
      {rentals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{rentals.length}</div>
              <p className="text-xs text-muted-foreground">Total Rentals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {rentals.filter((r: any) => r.status === 'ACTIVE').length}
              </div>
              <p className="text-xs text-muted-foreground">Active Rentals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {formatCurrencySync(
                  rentals.reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0)
                )}
              </div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {rentals.filter((r: any) => r.status === 'COMPLETED').length}
              </div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}