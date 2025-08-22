'use client';

import React, { useState } from 'react';
import { 
  IndianRupee as RupeeIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Clock as ClockIcon,
  AlertTriangle as AlertTriangleIcon,
  CreditCard as PaymentIcon
} from 'lucide-react';
import { FinancialImpact, ReturnableRental } from '../../types/rental-return';
import { PaymentRecordingForm } from '@/components/payments/PaymentRecordingForm';
import { PaymentRecord } from '@/types/payment';

interface FinancialTabProps {
  financialPreview: FinancialImpact | null;
  returnData: ReturnableRental;
  selectedItemsCount: number;
  onPaymentRecorded?: (payment: PaymentRecord | null) => void;
}

export default function FinancialTab({
  financialPreview,
  returnData,
  selectedItemsCount,
  onPaymentRecorded
}: FinancialTabProps) {
  const [showAdditionalPaymentForm, setShowAdditionalPaymentForm] = useState(false);
  const [showRefundPaymentForm, setShowRefundPaymentForm] = useState(false);
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!financialPreview) {
    return (
      <div className="space-y-6">
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-2xl font-bold text-gray-900">Financial Impact</h1>
          <p className="mt-1 text-gray-600">
            View financial calculations and refund details
          </p>
        </div>

        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <RupeeIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Items Selected</h3>
          <p className="mt-2 text-gray-500">
            Select items in the "Rental Items" tab to view financial impact
          </p>
        </div>
      </div>
    );
  }

  const hasLateFeesOrPenalties = financialPreview.late_fees > 0 || financialPreview.damage_penalties > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Impact</h1>
            <p className="mt-1 text-gray-600">
              Review financial calculations for {selectedItemsCount} selected items
            </p>
          </div>
          
          {hasLateFeesOrPenalties && (
            <div className="flex items-center bg-yellow-50 text-yellow-800 px-4 py-2 rounded-lg border border-yellow-200">
              <AlertTriangleIcon className="w-5 h-5 mr-2" />
              <span className="font-medium">Additional Charges Apply</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Financial Preview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
          <RupeeIcon className="mx-auto h-8 w-8 text-gray-600 mb-2" />
          <p className="text-sm text-gray-500">Original Deposit</p>
          <p className="text-xl font-bold text-gray-900">
            ₹{financialPreview.deposit_amount.toFixed(2)}
          </p>
        </div>

        <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
          <TrendingDownIcon className="mx-auto h-8 w-8 text-red-600 mb-2" />
          <p className="text-sm text-gray-500">Late Fees</p>
          <p className="text-xl font-bold text-red-600">
            ₹{financialPreview.late_fees.toFixed(2)}
          </p>
        </div>

        <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
          <AlertTriangleIcon className="mx-auto h-8 w-8 text-orange-600 mb-2" />
          <p className="text-sm text-gray-500">Damage Penalties</p>
          <p className="text-xl font-bold text-orange-600">
            ₹{financialPreview.damage_penalties.toFixed(2)}
          </p>
        </div>

        <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <ClockIcon className="mx-auto h-8 w-8 text-yellow-600 mb-2" />
          <p className="text-sm text-gray-500">Days Late</p>
          <p className="text-xl font-bold text-yellow-800">
            {financialPreview.days_late}
          </p>
        </div>

        <div className="text-center p-4 bg-green-50 rounded-lg border-2 border-green-300">
          <TrendingUpIcon className="mx-auto h-8 w-8 text-green-600 mb-2" />
          <p className="text-sm text-gray-500">Refund Amount</p>
          <p className="text-3xl font-bold text-green-600">
            ₹{financialPreview.total_refund.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Financial Breakdown</h3>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Original Deposit</span>
            <span className="font-semibold text-gray-900">
              +₹{financialPreview.deposit_amount.toFixed(2)}
            </span>
          </div>
          
          {financialPreview.late_fees > 0 && (
            <div className="flex justify-between items-center py-2 border-t border-gray-100">
              <span className="text-red-600">Late Fees ({financialPreview.days_late} days)</span>
              <span className="font-semibold text-red-600">
                -₹{financialPreview.late_fees.toFixed(2)}
              </span>
            </div>
          )}
          
          {financialPreview.damage_penalties > 0 && (
            <div className="flex justify-between items-center py-2 border-t border-gray-100">
              <span className="text-orange-600">Damage Penalties</span>
              <span className="font-semibold text-orange-600">
                -₹{financialPreview.damage_penalties.toFixed(2)}
              </span>
            </div>
          )}
          
          <div className="flex justify-between items-center py-3 border-t-2 border-gray-300">
            <span className="text-lg font-semibold text-gray-900">Final Refund</span>
            <span className="text-2xl font-bold text-green-600">
              ₹{financialPreview.total_refund.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Rental Details Summary */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rental Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Customer</span>
            <p className="font-medium text-gray-900">{returnData.customer_name}</p>
          </div>
          <div>
            <span className="text-gray-500">Transaction</span>
            <p className="font-medium text-gray-900">{returnData.transaction_number}</p>
          </div>
          <div>
            <span className="text-gray-500">Rental Period</span>
            <p className="font-medium text-gray-900">
              {formatDate(returnData.rental_start_date)} - {formatDate(returnData.rental_end_date)}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Payment Method</span>
            <p className="font-medium text-gray-900">{returnData.payment_method}</p>
          </div>
        </div>
      </div>

      {/* Payment Collection Section */}
      {financialPreview && (financialPreview.late_fees > 0 || financialPreview.damage_penalties > 0) && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <PaymentIcon className="w-5 h-5 text-red-600 mr-2" />
                <h3 className="text-lg font-semibold text-red-900">Additional Payment Required</h3>
              </div>
              <span className="text-2xl font-bold text-red-600">
                ₹{(financialPreview.late_fees + financialPreview.damage_penalties).toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-red-700 text-sm">
              Late fees and damage penalties must be collected before return processing
            </p>
          </div>
          
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Record Additional Payment</h4>
              <button
                onClick={() => setShowAdditionalPaymentForm(!showAdditionalPaymentForm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                {showAdditionalPaymentForm ? 'Hide Payment Form' : 'Record Payment'}
              </button>
            </div>
            
            {showAdditionalPaymentForm && (
              <PaymentRecordingForm
                maxAmount={financialPreview.late_fees + financialPreview.damage_penalties}
                minAmount={0}
                onPaymentChange={onPaymentRecorded}
                label="Additional Payment Collection"
                initialAmount={financialPreview.late_fees + financialPreview.damage_penalties}
                showReference={true}
              />
            )}
          </div>
        </div>
      )}

      {/* Refund Payment Section */}
      {financialPreview && financialPreview.total_refund > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-green-50 border-b border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingUpIcon className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="text-lg font-semibold text-green-900">Refund Processing</h3>
              </div>
              <span className="text-2xl font-bold text-green-600">
                ₹{financialPreview.total_refund.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-green-700 text-sm">
              Refund amount to be processed to customer
            </p>
          </div>
          
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Record Refund Payment (Optional)</h4>
              <button
                onClick={() => setShowRefundPaymentForm(!showRefundPaymentForm)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
              >
                {showRefundPaymentForm ? 'Hide Payment Form' : 'Record Refund'}
              </button>
            </div>
            
            {showRefundPaymentForm && (
              <PaymentRecordingForm
                maxAmount={financialPreview.total_refund}
                minAmount={0}
                onPaymentChange={onPaymentRecorded}
                label="Refund Payment Record"
                initialAmount={financialPreview.total_refund}
                showReference={true}
              />
            )}
          </div>
        </div>
      )}

      {/* Important Notes */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">💡 Financial Notes</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Refund calculations are updated in real-time based on selected items</li>
          <li>• Late fees are calculated based on overdue days</li>
          <li>• Damage penalties are applied per item as specified</li>
          <li>• Additional payments can be recorded for late fees and damage penalties</li>
          <li>• Refund payments can be recorded for tracking purposes</li>
        </ul>
      </div>
    </div>
  );
}