'use client';

import { format } from 'date-fns';
import { 
  User, 
  Calendar, 
  MapPin, 
  Package, 
  Truck, 
  CreditCard, 
  FileText, 
  CheckCircle,
  Edit,
  AlertCircle
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { WizardData } from '../RentalCreationWizard';

interface ReviewStepProps {
  data: WizardData;
  onUpdate: (data: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function ReviewStep({ 
  data, 
  onBack, 
  onSubmit, 
  isSubmitting 
}: ReviewStepProps) {
  
  // Calculate totals
  const getItemsSubtotal = () => {
    return data.items.reduce((total, item) => {
      const periods = item.rental_periods || 1;
      return total + (item.quantity * item.rental_rate * periods - (item.discount_value || 0));
    }, 0);
  };

  const getDeliverySubtotal = () => {
    let cost = 0;
    if (data.delivery_required) cost += 25;
    if (data.pickup_required) cost += 25;
    return cost;
  };

  const getDiscountAmount = () => {
    return data.discount_amount || 0;
  };

  const getSubtotal = () => {
    return getItemsSubtotal() + getDeliverySubtotal() - getDiscountAmount();
  };

  const getTaxAmount = () => {
    return (getSubtotal() * data.tax_rate) / 100;
  };

  const getGrandTotal = () => {
    return getSubtotal() + getTaxAmount();
  };

  const getRemainingBalance = () => {
    return getGrandTotal() - data.deposit_amount;
  };

  const getRentalDuration = () => {
    const diffTime = Math.abs(data.rental_end_date.getTime() - data.rental_start_date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Rental</h2>
        <p className="text-gray-600">
          Please review all details below before confirming your rental
        </p>
      </div>

      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-900">{data.customer?.name}</h4>
              <p className="text-sm text-gray-600">{data.customer?.email}</p>
              <p className="text-sm text-gray-600">{data.customer?.phone}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-green-600 border-green-300">
                {data.customer?.status}
              </Badge>
              <span className="text-sm text-gray-500">
                {data.customer?.totalRentals} previous rentals
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rental Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Rental Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900">Transaction Date</h4>
                <p className="text-sm text-gray-600">{format(data.transaction_date, 'PPP')}</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Rental Period</h4>
                <p className="text-sm text-gray-600">
                  {format(data.rental_start_date, 'PPP')} - {format(data.rental_end_date, 'PPP')}
                </p>
                <Badge variant="outline" className="mt-1">
                  {getRentalDuration()} {getRentalDuration() === 1 ? 'day' : 'days'}
                </Badge>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900">Location</h4>
                <p className="text-sm text-gray-600">{data.location?.name}</p>
                <p className="text-xs text-gray-500">{data.location?.address}</p>
              </div>
              {data.reference_number && (
                <div>
                  <h4 className="font-medium text-gray-900">Reference Number</h4>
                  <p className="text-sm text-gray-600">{data.reference_number}</p>
                </div>
              )}
            </div>
          </div>
          {data.notes && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
              <p className="text-sm text-gray-600">{data.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rental Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            Rental Items ({data.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Quantity</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.item?.name}</div>
                      <div className="text-sm text-gray-500">{item.item?.category}</div>
                      {item.notes && (
                        <div className="text-xs text-gray-400 mt-1">{item.notes}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">₹{item.rental_rate}/day</TableCell>
                  <TableCell className="text-right">
                    {item.discount_value ? `₹${item.discount_value}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₹{(item.quantity * item.rental_rate * (item.rental_periods || 1) - (item.discount_value || 0)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delivery & Pickup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            Delivery & Pickup Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.delivery_required || data.pickup_required ? (
            <div className="space-y-4">
              {data.delivery_required && (
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-green-900">Delivery Service</h4>
                    <p className="text-sm text-green-700 mt-1">
                      {format(data.delivery_date!, 'PPP')} at {data.delivery_time}
                    </p>
                    <p className="text-sm text-green-600 mt-1">{data.delivery_address}</p>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    ₹25.00
                  </Badge>
                </div>
              )}
              
              {data.pickup_required && (
                <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-orange-900">Pickup Service</h4>
                    <p className="text-sm text-orange-700 mt-1">
                      {format(data.pickup_date!, 'PPP')} at {data.pickup_time}
                    </p>
                    <p className="text-sm text-orange-600 mt-1">
                      From delivery address
                    </p>
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    ₹25.00
                  </Badge>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <p>Customer will pick up and return items at the rental location</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Summary */}
      <Card className="border-indigo-200 bg-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-900">
            <CreditCard className="w-5 h-5" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-indigo-800">
              <span>Items Subtotal</span>
              <span>₹{getItemsSubtotal().toFixed(2)}</span>
            </div>
            
            {(data.delivery_required || data.pickup_required) && (
              <div className="flex justify-between text-indigo-800">
                <span>Services</span>
                <span>₹{getDeliverySubtotal().toFixed(2)}</span>
              </div>
            )}

            {data.discount_amount! > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-₹{getDiscountAmount().toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-indigo-800">
              <span>Tax ({data.tax_rate}%)</span>
              <span>₹{getTaxAmount().toFixed(2)}</span>
            </div>

            <Separator />

            <div className="flex justify-between text-lg font-semibold text-indigo-900">
              <span>Grand Total</span>
              <span>₹{getGrandTotal().toFixed(2)}</span>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="text-center p-3 bg-indigo-100 rounded-lg">
                <div className="text-lg font-bold text-indigo-800">
                  ₹{data.deposit_amount.toFixed(2)}
                </div>
                <div className="text-sm text-indigo-600">Deposit Due Now</div>
              </div>
              <div className="text-center p-3 bg-slate-100 rounded-lg">
                <div className="text-lg font-bold text-slate-800">
                  ₹{getRemainingBalance().toFixed(2)}
                </div>
                <div className="text-sm text-slate-600">Balance Due Later</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Important Notes */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> Please review all information carefully. 
          Once confirmed, this rental agreement will be processed and you'll receive 
          a confirmation email with all the details.
        </AlertDescription>
      </Alert>

      <Separator />

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          Back to Payment
        </Button>
        
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            disabled={isSubmitting}
          >
            <Edit className="w-4 h-4" />
            Edit Details
          </Button>
          
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" variant="white" />
                Creating Rental...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirm & Create Rental
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
