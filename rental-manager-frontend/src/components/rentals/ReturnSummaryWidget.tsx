'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Package, 
  ArrowRightLeft,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ReturnSummaryWidgetProps {
  rentalId: string;
  totalItems: number;
  returnedItems: number;
  pendingItems: number;
  rentalStatus: string;
  canProcessReturn: boolean;
  lastReturnDate?: string;
  dueDate?: string;
  isOverdue?: boolean;
}

export function ReturnSummaryWidget({
  rentalId,
  totalItems,
  returnedItems,
  pendingItems,
  rentalStatus,
  canProcessReturn,
  lastReturnDate,
  dueDate,
  isOverdue
}: ReturnSummaryWidgetProps) {
  const router = useRouter();
  const returnProgress = totalItems > 0 ? (returnedItems / totalItems) * 100 : 0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = () => {
    if (rentalStatus === 'RENTAL_COMPLETED' || returnProgress === 100) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Fully Returned
        </Badge>
      );
    } else if (returnedItems > 0) {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          Partial Return
        </Badge>
      );
    } else if (isOverdue) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline">
          <Package className="w-3 h-3 mr-1" />
          Active Rental
        </Badge>
      );
    }
  };

  const handleProcessReturn = () => {
    router.push(`/rentals/${rentalId}/return`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Return Summary
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Return Progress</span>
            <span className="font-medium">{Math.round(returnProgress)}%</span>
          </div>
          <Progress value={returnProgress} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{returnedItems} returned</span>
            <span>{totalItems} total</span>
          </div>
        </div>

        <Separator />

        {/* Item Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="space-y-1">
            <Package className="w-8 h-8 mx-auto text-gray-400" />
            <p className="text-2xl font-bold">{totalItems}</p>
            <p className="text-xs text-gray-500">Total Items</p>
          </div>
          <div className="space-y-1">
            <CheckCircle className="w-8 h-8 mx-auto text-green-500" />
            <p className="text-2xl font-bold text-green-600">{returnedItems}</p>
            <p className="text-xs text-gray-500">Returned</p>
          </div>
          <div className="space-y-1">
            <Clock className="w-8 h-8 mx-auto text-yellow-500" />
            <p className="text-2xl font-bold text-yellow-600">{pendingItems}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
        </div>

        <Separator />

        {/* Dates */}
        <div className="space-y-2 text-sm">
          {dueDate && (
            <div className="flex justify-between">
              <span className="text-gray-600">Due Date:</span>
              <span className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                {formatDate(dueDate)}
                {isOverdue && ' (Overdue)'}
              </span>
            </div>
          )}
          {lastReturnDate && (
            <div className="flex justify-between">
              <span className="text-gray-600">Last Return:</span>
              <span className="font-medium">{formatDate(lastReturnDate)}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {pendingItems > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <Button
                onClick={handleProcessReturn}
                disabled={!canProcessReturn}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Process Return
                {pendingItems > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-white text-purple-600">
                    {pendingItems}
                  </Badge>
                )}
              </Button>
              {isOverdue && (
                <p className="text-xs text-red-600 text-center">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  This rental is overdue. Late fees may apply.
                </p>
              )}
            </div>
          </>
        )}

        {/* Completion Message */}
        {pendingItems === 0 && (
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
            <p className="text-sm font-medium text-green-800">
              All items have been returned
            </p>
            <p className="text-xs text-green-600 mt-1">
              This rental is complete
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}