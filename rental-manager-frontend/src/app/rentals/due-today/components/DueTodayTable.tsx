'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Eye,
  Phone,
  Mail,
  MapPin,
  Package,
  Calendar,
  AlertTriangle,
  Clock
} from 'lucide-react';
import type { DueTodayRental } from '@/types/rentals';

interface DueTodayTableProps {
  rentals: DueTodayRental[];
  onRentalClick: (rental: DueTodayRental) => void;
  isLoading?: boolean;
  className?: string;
}

type SortField = 'customer_name' | 'transaction_number' | 'location_name' | 'rental_end_date' | 'total_amount' | 'items_count';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export function DueTodayTable({ 
  rentals, 
  onRentalClick, 
  isLoading = false, 
  className = '' 
}: DueTodayTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ 
    field: 'rental_end_date', 
    direction: 'asc' 
  });

  // Sort rentals based on current sort configuration
  const sortedRentals = useMemo(() => {
    if (!rentals.length) return [];

    return [...rentals].sort((a, b) => {
      const { field, direction } = sortConfig;
      let aValue: any = a[field];
      let bValue: any = b[field];

      // Handle different data types
      if (field === 'rental_end_date') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (field === 'total_amount' || field === 'items_count') {
        aValue = Number(aValue);
        bValue = Number(bValue);
      } else {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rentals, sortConfig]);

  // Handle column sorting
  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get sort icon for column header
  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get status badge variant
  const getStatusVariant = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'destructive';
    
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return 'default';
      case 'CONFIRMED':
        return 'secondary';
      case 'IN_PROGRESS':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return <DueTodayTableLoading className={className} />;
  }

  if (!rentals.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Rentals Due Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No rentals due today
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Great news! There are no rental returns scheduled for today. 
              Check back tomorrow or view upcoming rentals.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Rentals Due Today
            <Badge variant="secondary" className="ml-2">
              {rentals.length} rental{rentals.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('customer_name')}
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                  >
                    Customer
                    {getSortIcon('customer_name')}
                  </Button>
                </TableHead>
                <TableHead className="w-[150px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('transaction_number')}
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                  >
                    Transaction #
                    {getSortIcon('transaction_number')}
                  </Button>
                </TableHead>
                <TableHead className="w-[150px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('location_name')}
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                  >
                    Location
                    {getSortIcon('location_name')}
                  </Button>
                </TableHead>
                <TableHead className="w-[120px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('rental_end_date')}
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                  >
                    Due Date
                    {getSortIcon('rental_end_date')}
                  </Button>
                </TableHead>
                <TableHead className="w-[100px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('items_count')}
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                  >
                    Items
                    {getSortIcon('items_count')}
                  </Button>
                </TableHead>
                <TableHead className="w-[120px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('total_amount')}
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                  >
                    Amount
                    {getSortIcon('total_amount')}
                  </Button>
                </TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRentals.map((rental) => (
                <TableRow
                  key={rental.id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => onRentalClick(rental)}
                >
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900">
                        {rental.customer_name}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        {rental.customer_phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{rental.customer_phone}</span>
                          </div>
                        )}
                        {rental.customer_email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">
                              {rental.customer_email}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="font-mono text-sm">
                      {rental.transaction_number}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      <span className="text-sm">{rental.location_name}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span className="text-sm">
                          {formatDate(rental.rental_end_date)}
                        </span>
                      </div>
                      {rental.is_overdue && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="text-xs font-medium">
                            {rental.days_overdue}d overdue
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Package className="w-3 h-3 text-gray-400" />
                      <span className="text-sm font-medium">
                        {rental.items_count}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm font-semibold">
                      ₹{rental.total_amount.toLocaleString()}
                    </div>
                    {rental.deposit_amount > 0 && (
                      <div className="text-xs text-gray-600">
                        Deposit: ₹{rental.deposit_amount.toLocaleString()}
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <Badge 
                      variant={getStatusVariant(rental.status, rental.is_overdue)}
                      className="text-xs"
                    >
                      {rental.is_overdue ? 'Overdue' : rental.status}
                    </Badge>
                  </TableCell>
                  
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRentalClick(rental);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function DueTodayTableLoading({ className = '' }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Skeleton className="w-5 h-5" />
          <Skeleton className="w-32 h-6" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Customer</TableHead>
                <TableHead className="w-[150px]">Transaction #</TableHead>
                <TableHead className="w-[150px]">Location</TableHead>
                <TableHead className="w-[120px]">Due Date</TableHead>
                <TableHead className="w-[100px]">Items</TableHead>
                <TableHead className="w-[120px]">Amount</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default DueTodayTable;