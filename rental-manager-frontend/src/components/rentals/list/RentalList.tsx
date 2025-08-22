'use client';

import React from 'react';
import { format, differenceInDays } from 'date-fns';
import { AlertCircle, Package, Calendar, Eye } from 'lucide-react';
import { RentalTransaction } from '@/types/rentals';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { RentalStatusBadge } from '@/components/rentals';

interface RentalListProps {
  rentals: RentalTransaction[];
  isLoading?: boolean;
  onRentalClick?: (rental: RentalTransaction) => void;
  className?: string;
}

export const RentalList: React.FC<RentalListProps> = ({
  rentals,
  isLoading = false,
  onRentalClick,
  className,
}) => {
  const router = useRouter();
  
  const handleRowClick = (rental: RentalTransaction) => {
    if (onRentalClick) {
      onRentalClick(rental);
    } else {
      router.push(`/rentals/${rental.id}`);
    }
  };
  
  const getOverdueBadge = (rental: RentalTransaction) => {
    if (rental.is_overdue || rental.days_overdue && rental.days_overdue > 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          {rental.days_overdue ? `${rental.days_overdue}d overdue` : 'Overdue'}
        </Badge>
      );
    }
    return null;
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };
  
  if (isLoading) {
    return <RentalListSkeleton className={className} />;
  }
  
  if (rentals.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">No rentals found</p>
        <p className="text-sm text-gray-400 mt-2">Try adjusting your filters</p>
      </div>
    );
  }
  
  return (
    <div className={cn("rounded-lg border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Rental Period</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rentals.map((rental) => {
            const daysRemaining = differenceInDays(
              new Date(rental.rental_end_date),
              new Date()
            );
            const balance = rental.total_amount - rental.paid_amount;
            const isOverdue = rental.is_overdue || (rental.days_overdue && rental.days_overdue > 0);
            
            return (
              <TableRow
                key={rental.id}
                className={cn(
                  "cursor-pointer hover:bg-gray-50 transition-colors",
                  isOverdue && "bg-red-50/50 hover:bg-red-100/50"
                )}
                onClick={() => handleRowClick(rental)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {rental.transaction_number}
                    {isOverdue && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <div>
                    <p className="font-medium">Customer #{rental.customer_id.slice(0, 8)}...</p>
                    <p className="text-sm text-gray-500">{rental.customer_id}</p>
                  </div>
                </TableCell>
                
                <TableCell>
                  <div>
                    <p className="font-medium">Location #{rental.location_id.slice(0, 8)}...</p>
                    <p className="text-sm text-gray-500">{rental.location_id}</p>
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {formatDate(rental.rental_start_date)} - {formatDate(rental.rental_end_date)}
                    </div>
                    {rental.rental_period && rental.rental_period_unit && (
                      <p className="text-xs text-gray-500">
                        {rental.rental_period} {rental.rental_period_unit.toLowerCase()}
                        {rental.rental_period > 1 ? 's' : ''}
                      </p>
                    )}
                    {daysRemaining > 0 && rental.current_rental_status === 'ACTIVE' && (
                      <p className="text-xs text-gray-500">
                        {daysRemaining} days remaining
                      </p>
                    )}
                    {isOverdue && (
                      <p className="text-xs text-red-600 font-medium">
                        {rental.days_overdue} days overdue
                      </p>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <RentalStatusBadge status={rental.current_rental_status} size="sm" />
                    {getOverdueBadge(rental)}
                  </div>
                </TableCell>
                
                <TableCell className="text-right">
                  <div>
                    <p className="font-medium">{formatCurrency(rental.total_amount)}</p>
                    {rental.deposit_amount && (
                      <p className="text-xs text-gray-500">
                        Deposit: {formatCurrency(rental.deposit_amount)}
                      </p>
                    )}
                  </div>
                </TableCell>
                
                <TableCell className="text-right">
                  <span className={cn(
                    "font-medium",
                    balance > 0 ? "text-red-600" : "text-green-600"
                  )}>
                    {formatCurrency(balance)}
                  </span>
                  {rental.deposit_paid && balance <= 0 && (
                    <p className="text-xs text-green-600">Paid</p>
                  )}
                </TableCell>
                
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(rental);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

// Skeleton loader
const RentalListSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("rounded-lg border", className)}>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference #</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Rental Period</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
            <TableCell><Skeleton className="h-4 w-36" /></TableCell>
            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export default RentalList;