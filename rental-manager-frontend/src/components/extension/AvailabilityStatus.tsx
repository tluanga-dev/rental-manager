'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  Calendar,
  Package,
  IndianRupee
} from 'lucide-react';
import { format } from 'date-fns';

export interface ConflictInfo {
  item_id: string;
  item_name: string;
  conflicting_rental_id: string;
  conflicting_customer: string;
  conflict_start: string;
  conflict_end: string;
}

interface PeriodDetails {
  startDate: string;
  endDate: string;
  totalDays: number;
}

interface AvailabilityStatusProps {
  checking: boolean;
  available: boolean | null;
  conflicts?: ConflictInfo[];
  calculatedRate: number;
  periodDetails: PeriodDetails;
  itemCount: number;
  className?: string;
}

export const AvailabilityStatus: React.FC<AvailabilityStatusProps> = ({
  checking,
  available,
  conflicts = [],
  calculatedRate,
  periodDetails,
  itemCount,
  className = ''
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  if (checking) {
    return (
      <Card className={`${className} border-blue-200 bg-blue-50`}>
        <CardContent className="py-6">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-blue-900 font-medium">
              Checking availability for your selected period...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (available === null && !checking) {
    return (
      <Card className={`${className} border-gray-200`}>
        <CardContent className="py-6">
          <div className="text-center text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium mb-2">
              Ready to Check Availability
            </p>
            <p className="text-xs text-gray-400">
              Enter the number of rental periods above and the system will automatically check if the items are available
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {available ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-900">Available for Extension</span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-900">Not Available</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Availability Status */}
        {available ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900">All items available!</AlertTitle>
            <AlertDescription className="text-green-700">
              Your {itemCount} item{itemCount !== 1 ? 's are' : ' is'} available for the entire extension period
              from {formatDateDisplay(periodDetails.startDate)} to {formatDateDisplay(periodDetails.endDate)}.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-red-200 bg-red-50">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-900">Booking Conflict Detected</AlertTitle>
            <AlertDescription className="text-red-700">
              Some items have booking conflicts during your selected period.
              Please choose a different period or reduce the extension duration.
            </AlertDescription>
          </Alert>
        )}

        {/* Conflict Details */}
        {conflicts.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Conflict Details
            </h4>
            <div className="space-y-2">
              {conflicts.map((conflict, index) => (
                <div
                  key={`${conflict.item_id}-${index}`}
                  className="bg-orange-50 border border-orange-200 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm text-orange-900">
                        {conflict.item_name}
                      </p>
                      <p className="text-xs text-orange-700">
                        Booked by: {conflict.conflicting_customer}
                      </p>
                      <p className="text-xs text-orange-600">
                        Conflict period: {formatDateDisplay(conflict.conflict_start)} - {formatDateDisplay(conflict.conflict_end)}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-orange-300 text-orange-700">
                      Unavailable
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extension Summary */}
        {available && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Extension Summary
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Extension Period</p>
                <p className="font-medium text-gray-900">
                  {periodDetails.totalDays} days
                </p>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 mb-1">Items</p>
                <p className="font-medium text-gray-900">
                  {itemCount} item{itemCount !== 1 ? 's' : ''}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 mb-1">Start Date</p>
                <p className="font-medium text-gray-900">
                  {formatDateDisplay(periodDetails.startDate)}
                </p>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 mb-1">End Date</p>
                <p className="font-medium text-gray-900">
                  {formatDateDisplay(periodDetails.endDate)}
                </p>
              </div>
            </div>

            {/* Total Cost */}
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-700">Total Extension Cost</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  {formatCurrency(calculatedRate)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Availability Tips */}
        {!available && conflicts.length > 0 && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900">Suggestions</AlertTitle>
            <AlertDescription className="text-blue-700 space-y-1">
              <p>• Try reducing the extension period</p>
              <p>• Check availability for a different date range</p>
              <p>• Contact support if you need assistance</p>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};