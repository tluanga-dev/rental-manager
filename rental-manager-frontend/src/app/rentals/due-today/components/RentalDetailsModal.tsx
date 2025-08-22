'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Package,
  IndianRupee,
  Clock,
  AlertTriangle,
  FileText,
  ExternalLink,
  CheckCircle,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import type { DueTodayRental } from '@/types/rentals';

interface RentalDetailsModalProps {
  rental: DueTodayRental | null;
  isOpen: boolean;
  onClose: () => void;
  onExtendRental?: (rentalId: string) => void;
  onMarkReturned?: (rentalId: string) => void;
  onViewFullDetails?: (rentalId: string) => void;
}

export function RentalDetailsModal({
  rental,
  isOpen,
  onClose,
  onExtendRental,
  onMarkReturned,
  onViewFullDetails,
}: RentalDetailsModalProps) {
  if (!rental) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString()}`;
  };

  const getStatusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue) return 'text-red-600 bg-red-50 border-red-200';
    
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'CONFIRMED':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'IN_PROGRESS':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-blue-600" />
              <div>
                <span className="text-xl font-bold">Rental Details</span>
                <p className="text-sm text-gray-600 font-normal">
                  {rental.transaction_number}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                className={`${getStatusColor(rental.status, rental.is_overdue)} border`}
                variant="outline"
              >
                {rental.is_overdue ? 'Overdue' : rental.status}
              </Badge>
              {rental.is_overdue && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {rental.days_overdue}d overdue
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">
                    {rental.customer_name}
                  </h3>
                  <p className="text-sm text-gray-600">Customer ID: {rental.customer_id}</p>
                </div>
                <div className="space-y-2">
                  {rental.customer_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{rental.customer_phone}</span>
                    </div>
                  )}
                  {rental.customer_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span>{rental.customer_email}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rental Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                Rental Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Location</label>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">{rental.location_name}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Rental Period</label>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Start:</span>
                        <span className="font-medium">{formatDate(rental.rental_start_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Due:</span>
                        <span className={`font-medium ${rental.is_overdue ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatDate(rental.rental_end_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Financial Summary</label>
                    <div className="mt-1 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Amount:</span>
                        <span className="font-semibold text-lg">{formatCurrency(rental.total_amount)}</span>
                      </div>
                      {rental.deposit_amount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Deposit:</span>
                          <span className="font-medium">{formatCurrency(rental.deposit_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Payment Status:</span>
                        <Badge variant={rental.payment_status === 'PAID' ? 'default' : 'destructive'}>
                          {rental.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rental Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  Rental Items
                </div>
                <Badge variant="secondary">
                  {rental.items_count} item{rental.items_count !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rental.items.map((item, index) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">{item.item_name}</h4>
                          {item.sku && (
                            <Badge variant="outline" className="text-xs">
                              {item.sku}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-3 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Quantity:</span> {item.quantity}
                          </div>
                          <div>
                            <span className="font-medium">Rate:</span> {formatCurrency(item.unit_price)}
                          </div>
                          <div>
                            <span className="font-medium">Period:</span> {item.rental_period_value} {item.rental_period_unit.toLowerCase()}
                          </div>
                        </div>
                        {item.notes && (
                          <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Notes:</span> {item.notes}
                          </div>
                        )}
                      </div>
                      {item.current_rental_status && (
                        <Badge variant="outline" className="ml-4">
                          {item.current_rental_status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Last updated: {new Date(rental.updated_at).toLocaleString()}</span>
            </div>
            
            <div className="flex items-center gap-3">
              {onViewFullDetails && (
                <Button
                  variant="outline"
                  onClick={() => onViewFullDetails(rental.id)}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Full Details
                </Button>
              )}
              
              {onExtendRental && !rental.is_overdue && (
                <Button
                  variant="outline"
                  onClick={() => onExtendRental(rental.id)}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Extend Rental
                </Button>
              )}
              
              {onMarkReturned && (
                <Button
                  onClick={() => onMarkReturned(rental.id)}
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as Returned
                </Button>
              )}
              
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RentalDetailsModal;