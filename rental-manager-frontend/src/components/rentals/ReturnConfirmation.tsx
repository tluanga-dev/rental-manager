'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  Package,
  AlertCircle,
  Info,
  RefreshCw,
  User,
  Calendar,
  IndianRupee,
  FileText,
  Printer,
} from 'lucide-react';
import { format } from 'date-fns';

import { RentalStatusBadge, StatusHistory } from '@/components/rentals';
import { RentalReturnPrint } from './RentalReturnPrint';
import type { RentalStatus } from '@/types/rentals';

interface ReturnConfirmationProps {
  transactionId: string;
  onClose?: () => void;
  className?: string;
}

interface TransactionData {
  id: string;
  transaction_number: string;
  current_rental_status: RentalStatus;
  customer: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  financial_summary: {
    total_amount: number;
    paid_amount: number;
    balance_due: number;
    deposit_amount: number;
    deposit_refund?: number;
  };
  transaction_lines: Array<{
    id: string;
    description: string;
    quantity: number;
    quantity_returned: number;
    current_rental_status: RentalStatus;
    sku: string;
    item_name?: string;
  }>;
  return_summary?: {
    return_date: string;
    total_returned: number;
    total_items: number;
    late_fees: number;
    damage_charges: number;
    refund_amount: number;
    processed_by: string;
  };
  updated_at: string;
}

// Mock function to fetch transaction data - replace with actual API call
const fetchTransaction = async (transactionId: string): Promise<TransactionData> => {
  // This would be replaced with actual API call
  // await transactionsApi.getById(transactionId);
  
  // Mock data for demonstration
  return {
    id: transactionId,
    transaction_number: 'RNT-2024-001',
    current_rental_status: 'PARTIAL_RETURN',
    customer: {
      id: 'cust-001',
      name: 'John Smith',
      email: 'john@example.com',
      phone: '+1-555-0123',
    },
    financial_summary: {
      total_amount: 1500,
      paid_amount: 1200,
      balance_due: 300,
      deposit_amount: 500,
      deposit_refund: 400,
    },
    transaction_lines: [
      {
        id: 'line-1',
        description: 'Professional Camera Kit',
        quantity: 2,
        quantity_returned: 1,
        current_rental_status: 'PARTIAL_RETURN',
        sku: 'CAM-001',
        item_name: 'Canon EOS R5 Kit',
      },
      {
        id: 'line-2', 
        description: 'Tripod Set',
        quantity: 3,
        quantity_returned: 3,
        current_rental_status: 'RETURNED',
        sku: 'TRP-001',
        item_name: 'Carbon Fiber Tripod',
      },
    ],
    return_summary: {
      return_date: new Date().toISOString(),
      total_returned: 4,
      total_items: 5,
      late_fees: 0,
      damage_charges: 0,
      refund_amount: 400,
      processed_by: 'Sarah Wilson',
    },
    updated_at: new Date().toISOString(),
  };
};

const ReturnConfirmation: React.FC<ReturnConfirmationProps> = ({
  transactionId,
  onClose,
  className,
}) => {
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  const { data: transaction, isLoading, refetch } = useQuery({
    queryKey: ['transaction', transactionId],
    queryFn: () => fetchTransaction(transactionId),
    refetchInterval: 5000, // Poll for status updates every 5 seconds
  });

  // Auto-refresh to catch status updates
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 3000);

    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading || !transaction) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading transaction status...</span>
        </CardContent>
      </Card>
    );
  }

  const isPartialReturn = transaction.current_rental_status === 'PARTIAL_RETURN' || 
                         transaction.current_rental_status === 'LATE_PARTIAL_RETURN';
  const isCompleted = transaction.current_rental_status === 'COMPLETED';
  const hasOutstandingBalance = transaction.financial_summary.balance_due > 0;

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Success Header */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-6 w-6" />
              Return Processed Successfully
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium text-green-700">Transaction Number</Label>
                <p className="text-lg font-semibold text-green-900">{transaction.transaction_number}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-green-700">Customer</Label>
                <p className="text-lg font-semibold text-green-900">{transaction.customer.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Update */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Transaction Status Updated
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Label>Current Status:</Label>
              <RentalStatusBadge status={transaction.current_rental_status} size="lg" />
              <span className="text-sm text-muted-foreground">
                Status automatically calculated based on return
              </span>
            </div>

            {/* Status explanation */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  {isPartialReturn && (
                    <p>
                      <strong>Partial Return:</strong> Some items have been returned. Remaining items are still on rent 
                      and the customer can return them later.
                    </p>
                  )}
                  {isCompleted && (
                    <p>
                      <strong>Completed:</strong> All rented items have been successfully returned. The rental transaction is complete.
                    </p>
                  )}
                  {!isPartialReturn && !isCompleted && (
                    <p>
                      The rental status has been automatically updated based on the return processing and business rules.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Outstanding items warning */}
            {isPartialReturn && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">Outstanding Items Reminder</p>
                    <p>
                      The customer still has items that need to be returned. Please schedule a follow-up 
                      or remind the customer about the remaining items.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Item Status */}
        <Card>
          <CardHeader>
            <CardTitle>Item Return Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {transaction.transaction_lines.map((line) => (
                <div key={line.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{line.description}</p>
                    <p className="text-sm text-muted-foreground">
                      SKU: {line.sku} • Returned: {line.quantity_returned}/{line.quantity}
                    </p>
                  </div>
                  <RentalStatusBadge status={line.current_rental_status} size="sm" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Return Summary */}
        {transaction.return_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Return Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Return Date
                  </Label>
                  <p className="text-sm">
                    {format(new Date(transaction.return_summary.return_date), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    Items Returned
                  </Label>
                  <p className="text-sm">
                    {transaction.return_summary.total_returned} of {transaction.return_summary.total_items}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <IndianRupee className="h-4 w-4" />
                    Refund Amount
                  </Label>
                  <p className="text-sm font-medium">
                    ₹{transaction.return_summary.refund_amount.toLocaleString()}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Processed By
                  </Label>
                  <p className="text-sm">{transaction.return_summary.processed_by}</p>
                </div>
              </div>

              {/* Additional charges */}
              {(transaction.return_summary.late_fees > 0 || transaction.return_summary.damage_charges > 0) && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <Label>Additional Charges</Label>
                    {transaction.return_summary.late_fees > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Late Fees:</span>
                        <span>₹{transaction.return_summary.late_fees.toLocaleString()}</span>
                      </div>
                    )}
                    {transaction.return_summary.damage_charges > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Damage Charges:</span>
                        <span>₹{transaction.return_summary.damage_charges.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Financial Summary */}
        {hasOutstandingBalance && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800">Outstanding Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-orange-700">Total Amount</Label>
                  <p className="text-lg font-semibold text-orange-900">
                    ₹{transaction.financial_summary.total_amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-orange-700">Paid Amount</Label>
                  <p className="text-lg font-semibold text-orange-900">
                    ₹{transaction.financial_summary.paid_amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-orange-700">Balance Due</Label>
                  <p className="text-lg font-semibold text-orange-900">
                    ₹{transaction.financial_summary.balance_due.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status History */}
        <StatusHistory transactionId={transactionId} />

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setShowPrintModal(true)}>
            <Printer className="h-4 w-4 mr-2" />
            Print Return Receipt
          </Button>
          
          {onClose && (
            <Button onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Print Modal */}
      {showPrintModal && transaction && (
        <RentalReturnPrint 
          returnData={{
            rental: transaction,
            items: transaction.transaction_lines?.map((line: any) => ({
              ...line,
              item: {
                name: line.item_name || line.description,
                sku: line.sku
              },
              item_name: line.item_name || line.description,
              return_quantity: line.quantity_returned,
              return_action: line.quantity_returned === line.quantity ? 'COMPLETE_RETURN' : 'PARTIAL_RETURN',
              condition_notes: 'Good condition',
              late_fee: 0,
              damage_penalty: 0
            })) || [],
            notes: `Return processed on ${format(new Date(transaction.updated_at), 'PPP')}`,
          }}
          onClose={() => setShowPrintModal(false)} 
        />
      )}
    </div>
  );
};

export default ReturnConfirmation;