'use client';

import React from 'react';
import { format, differenceInDays } from 'date-fns';
import { Calendar, MapPin, User, AlertCircle, Package } from 'lucide-react';
import { RentalTransaction } from '@/types/rentals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RentalStatusBadge } from '@/components/rentals';

interface RentalCardProps {
  rental: RentalTransaction;
  onClick?: (rental: RentalTransaction) => void;
  className?: string;
}

export const RentalCard: React.FC<RentalCardProps> = ({ 
  rental, 
  onClick,
  className 
}) => {
  const isOverdue = rental.is_overdue || (rental.days_overdue && rental.days_overdue > 0);
  const daysRemaining = differenceInDays(new Date(rental.rental_end_date), new Date());
  const balance = rental.total_amount - rental.paid_amount;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-lg hover:border-blue-200",
        isOverdue && "border-red-200 bg-red-50/50",
        className
      )}
      onClick={() => onClick?.(rental)}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-500" />
            {rental.transaction_number}
          </CardTitle>
          <div className="flex flex-col gap-1">
            <RentalStatusBadge status={rental.current_rental_status} size="sm" />
            {isOverdue && (
              <Badge variant="destructive" className="gap-1 text-xs">
                <AlertCircle className="w-3 h-3" />
                Overdue
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Customer Info */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="w-4 h-4" />
          <span>Customer: {rental.customer_id.slice(0, 8)}...</span>
        </div>
        
        {/* Location Info */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4" />
          <span>Location: {rental.location_id.slice(0, 8)}...</span>
        </div>
        
        {/* Rental Period */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>
            {formatDate(rental.rental_start_date)} - {formatDate(rental.rental_end_date)}
          </span>
        </div>
        
        {/* Rental Duration */}
        {rental.rental_period && rental.rental_period_unit && (
          <div className="text-sm text-gray-600">
            Duration: {rental.rental_period} {rental.rental_period_unit.toLowerCase()}
            {rental.rental_period > 1 ? 's' : ''}
          </div>
        )}
        
        {/* Days Remaining / Overdue */}
        {rental.current_rental_status === 'ACTIVE' && (
          <div className={cn(
            "text-sm font-medium",
            isOverdue ? "text-red-600" : daysRemaining <= 3 ? "text-yellow-600" : "text-gray-600"
          )}>
            {isOverdue ? (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {rental.days_overdue} days overdue
              </span>
            ) : (
              <span>{daysRemaining} days remaining</span>
            )}
          </div>
        )}
        
        {/* Financial Summary */}
        <div className="pt-3 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Amount</span>
            <span className="font-medium">{formatCurrency(rental.total_amount)}</span>
          </div>
          
          {rental.deposit_amount && (
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Deposit</span>
              <span className={cn(
                "font-medium",
                rental.deposit_paid ? "text-green-600" : "text-orange-600"
              )}>
                {formatCurrency(rental.deposit_amount)}
                {rental.deposit_paid && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Paid
                  </Badge>
                )}
              </span>
            </div>
          )}
          
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Balance Due</span>
            <span className={cn(
              "font-medium",
              balance > 0 ? "text-red-600" : "text-green-600"
            )}>
              {formatCurrency(balance)}
            </span>
          </div>
        </div>
        
        {/* Delivery/Pickup Info */}
        {(rental.delivery_required || rental.pickup_required) && (
          <div className="pt-3 border-t">
            <div className="text-xs text-gray-500 space-y-1">
              {rental.delivery_required && (
                <div className="flex items-center gap-1">
                  <span>🚚 Delivery required</span>
                  {rental.delivery_date && (
                    <span>on {formatDate(rental.delivery_date)}</span>
                  )}
                </div>
              )}
              {rental.pickup_required && (
                <div className="flex items-center gap-1">
                  <span>📦 Pickup required</span>
                  {rental.pickup_date && (
                    <span>on {formatDate(rental.pickup_date)}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Lifecycle Info */}
        {rental.lifecycle && (
          <div className="pt-3 border-t text-xs text-gray-500">
            Last updated: {format(new Date(rental.lifecycle.last_status_change), 'MMM dd, yyyy h:mm a')}
          </div>
        )}
        
        {/* Transaction Date */}
        <div className="text-xs text-gray-400">
          Created: {format(new Date(rental.created_at), 'MMM dd, yyyy h:mm a')}
        </div>
      </CardContent>
    </Card>
  );
};

export default RentalCard;