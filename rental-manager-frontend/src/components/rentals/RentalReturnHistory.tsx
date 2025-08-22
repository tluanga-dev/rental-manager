'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  History, 
  Package, 
  Calendar, 
  User, 
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface ReturnHistoryItem {
  id: string;
  return_date: string;
  return_number?: string;
  items_returned: number;
  total_items: number;
  return_type: 'COMPLETE_RETURN' | 'PARTIAL_RETURN';
  return_status: string;
  processed_by?: string;
  late_fees?: number;
  damage_charges?: number;
  refund_amount?: number;
  notes?: string;
  items?: Array<{
    item_name: string;
    quantity_returned: number;
    condition: string;
  }>;
}

interface RentalReturnHistoryProps {
  returnHistory: ReturnHistoryItem[];
  rentalId: string;
  onViewReceipt?: (returnId: string) => void;
}

export function RentalReturnHistory({ 
  returnHistory, 
  rentalId,
  onViewReceipt 
}: RentalReturnHistoryProps) {
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETE_RETURN':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'PARTIAL_RETURN':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'LATE_RETURN':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'COMPLETE_RETURN':
        return 'default';
      case 'PARTIAL_RETURN':
        return 'secondary';
      case 'LATE_RETURN':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (!returnHistory || returnHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Return History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No returns have been processed yet</p>
            <p className="text-gray-400 text-xs mt-1">
              Returns will appear here once items are returned
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Return History
            <Badge variant="secondary" className="ml-2">
              {returnHistory.length} Return{returnHistory.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {returnHistory.map((returnItem, index) => (
            <div key={returnItem.id} className="relative">
              {/* Timeline connector */}
              {index < returnHistory.length - 1 && (
                <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200"></div>
              )}
              
              <div className="flex gap-4">
                {/* Timeline dot */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  {getStatusIcon(returnItem.return_type)}
                </div>
                
                {/* Return content */}
                <div className="flex-1 bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          Return #{returnItem.return_number || returnItem.id.slice(0, 8)}
                        </span>
                        <Badge variant={getStatusBadgeVariant(returnItem.return_type)} className="text-xs">
                          {returnItem.return_type === 'COMPLETE_RETURN' ? 'Complete' : 'Partial'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateTime(returnItem.return_date)}
                        </span>
                        {returnItem.processed_by && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {returnItem.processed_by}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {onViewReceipt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewReceipt(returnItem.id)}
                        className="text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Receipt
                      </Button>
                    )}
                  </div>
                  
                  <Separator className="my-2" />
                  
                  {/* Return details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500">Items Returned</span>
                      <p className="font-medium">
                        {returnItem.items_returned} of {returnItem.total_items}
                      </p>
                    </div>
                    
                    {returnItem.late_fees && returnItem.late_fees > 0 && (
                      <div>
                        <span className="text-gray-500">Late Fees</span>
                        <p className="font-medium text-red-600">
                          {formatCurrency(returnItem.late_fees)}
                        </p>
                      </div>
                    )}
                    
                    {returnItem.damage_charges && returnItem.damage_charges > 0 && (
                      <div>
                        <span className="text-gray-500">Damage Charges</span>
                        <p className="font-medium text-red-600">
                          {formatCurrency(returnItem.damage_charges)}
                        </p>
                      </div>
                    )}
                    
                    {returnItem.refund_amount !== undefined && (
                      <div>
                        <span className="text-gray-500">
                          {returnItem.refund_amount >= 0 ? 'Refund' : 'Amount Due'}
                        </span>
                        <p className={`font-medium ${returnItem.refund_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(returnItem.refund_amount))}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Item details if available */}
                  {returnItem.items && returnItem.items.length > 0 && (
                    <>
                      <Separator className="my-2" />
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-700 mb-1">Items:</p>
                        {returnItem.items.map((item, idx) => (
                          <div key={idx} className="text-xs text-gray-600 flex items-center justify-between">
                            <span>{item.item_name}</span>
                            <span>
                              Qty: {item.quantity_returned} • {item.condition}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  
                  {/* Notes */}
                  {returnItem.notes && (
                    <>
                      <Separator className="my-2" />
                      <p className="text-xs text-gray-600 italic">
                        Note: {returnItem.notes}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}