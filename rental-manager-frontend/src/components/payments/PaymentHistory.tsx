'use client';

import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { PaymentHistoryItem, PaymentMethodInfo, PaymentSummary } from '@/types/payment';
import { History, TrendingUp, TrendingDown, Receipt } from 'lucide-react';

interface PaymentHistoryProps {
  paymentHistory: PaymentHistoryItem[];
  paymentSummary?: PaymentSummary;
  showSummary?: boolean;
  className?: string;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  paymentHistory,
  paymentSummary,
  showSummary = true,
  className = ''
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getPaymentTypeInfo = (type: string) => {
    switch (type) {
      case 'ORIGINAL':
        return { label: 'Original Payment', color: 'bg-blue-100 text-blue-800', icon: '🏷️' };
      case 'EXTENSION':
        return { label: 'Extension Payment', color: 'bg-purple-100 text-purple-800', icon: '📅' };
      case 'RETURN':
        return { label: 'Return Payment', color: 'bg-green-100 text-green-800', icon: '↩️' };
      case 'ADJUSTMENT':
        return { label: 'Adjustment', color: 'bg-orange-100 text-orange-800', icon: '⚖️' };
      default:
        return { label: 'Payment', color: 'bg-gray-100 text-gray-800', icon: '💳' };
    }
  };

  const sortedHistory = useMemo(() => 
    [...paymentHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    ), [paymentHistory]
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Cards */}
      {showSummary && paymentSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Total Paid</span>
            </div>
            <p className="text-2xl font-bold text-green-900 mt-1">
              {formatCurrency(paymentSummary.total_paid)}
            </p>
          </div>

          <div className={`border rounded-lg p-4 ${
            paymentSummary.outstanding_balance > 0 
              ? 'bg-red-50 border-red-200' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              <TrendingDown className={`w-5 h-5 ${
                paymentSummary.outstanding_balance > 0 ? 'text-red-600' : 'text-gray-600'
              }`} />
              <span className={`text-sm font-medium ${
                paymentSummary.outstanding_balance > 0 ? 'text-red-900' : 'text-gray-900'
              }`}>Outstanding</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              paymentSummary.outstanding_balance > 0 ? 'text-red-900' : 'text-gray-900'
            }`}>
              {formatCurrency(paymentSummary.outstanding_balance)}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Transactions</span>
            </div>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {paymentHistory.length}
            </p>
          </div>
        </div>
      )}

      {/* Payment Methods Summary */}
      {showSummary && paymentSummary?.payment_methods_used && paymentSummary.payment_methods_used.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Payment Methods Used</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {paymentSummary.payment_methods_used.map((methodSummary) => (
              <div key={methodSummary.method} className="text-center p-2 bg-gray-50 rounded">
                <div className="text-lg">{PaymentMethodInfo[methodSummary.method]?.icon}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {PaymentMethodInfo[methodSummary.method]?.label}
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {formatCurrency(methodSummary.total_amount)}
                </div>
                <div className="text-xs text-gray-500">
                  {methodSummary.transaction_count} transaction{methodSummary.transaction_count !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Payment History</h3>
          </div>
        </div>

        {paymentHistory.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-gray-400 mb-2">
              <Receipt className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-gray-500">No payments recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sortedHistory.map((payment) => {
              const typeInfo = getPaymentTypeInfo(payment.payment_type);
              const methodInfo = PaymentMethodInfo[payment.method];
              
              return (
                <div key={payment.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(payment.date), 'MMM dd, yyyy - HH:mm')}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <span>{methodInfo.icon}</span>
                        <span className="font-medium text-gray-900">{methodInfo.label}</span>
                        {payment.reference && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600">Ref: {payment.reference}</span>
                          </>
                        )}
                      </div>

                      {payment.notes && (
                        <p className="text-sm text-gray-600 mt-1">{payment.notes}</p>
                      )}

                      {payment.recorded_by && (
                        <p className="text-xs text-gray-500 mt-1">
                          Recorded by: {payment.recorded_by}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(payment.amount)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};