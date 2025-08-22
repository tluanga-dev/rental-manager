'use client';

import React from 'react';
import { format } from 'date-fns';
import { PaymentRecord, PaymentMethodInfo, PaymentHistoryItem } from '@/types/payment';
import { Printer, Download, X, Receipt } from 'lucide-react';

interface PaymentReceiptProps {
  payment: PaymentRecord | PaymentHistoryItem;
  rentalInfo?: {
    transaction_number: string;
    customer_name: string;
    rental_id: string;
  };
  companyInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
    gstin?: string;
  };
  receiptNumber?: string;
  onClose?: () => void;
  onPrint?: () => void;
  onDownload?: () => void;
}

export const PaymentReceipt: React.FC<PaymentReceiptProps> = ({
  payment,
  rentalInfo,
  companyInfo = {
    name: 'Rental Management System',
    address: '123 Business Street, City - 123456',
    phone: '+91 12345 67890',
    email: 'info@rentalsystem.com'
  },
  receiptNumber,
  onClose,
  onPrint,
  onDownload
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm:ss');
  };

  const getPaymentDate = () => {
    if ('date' in payment) {
      return payment.date;
    }
    return payment.recorded_at;
  };

  const getPaymentId = () => {
    if ('id' in payment) {
      return payment.id;
    }
    return Date.now().toString();
  };

  const getPaymentType = () => {
    if ('payment_type' in payment) {
      return payment.payment_type;
    }
    return 'PAYMENT';
  };

  const generateReceiptNumber = () => {
    if (receiptNumber) return receiptNumber;
    const date = format(new Date(), 'yyyyMMdd');
    const time = format(new Date(), 'HHmmss');
    return `PMT-${date}-${time}`;
  };

  const handlePrint = () => {
    window.print();
    onPrint?.();
  };

  const handleDownload = () => {
    // Generate PDF download logic would go here
    // For now, we'll trigger print which can be saved as PDF
    window.print();
    onDownload?.();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header Actions */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 print:hidden">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Payment Receipt
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-1 px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            )}
          </div>
        </div>

        {/* Receipt Content */}
        <div className="p-6 space-y-6">
          {/* Company Header */}
          <div className="text-center border-b border-gray-200 pb-4">
            <h1 className="text-2xl font-bold text-gray-900">{companyInfo.name}</h1>
            <p className="text-gray-600 mt-1">{companyInfo.address}</p>
            <div className="flex justify-center gap-4 mt-2 text-sm text-gray-600">
              <span>📞 {companyInfo.phone}</span>
              <span>✉️ {companyInfo.email}</span>
            </div>
            {companyInfo.gstin && (
              <p className="text-sm text-gray-600 mt-1">GSTIN: {companyInfo.gstin}</p>
            )}
          </div>

          {/* Receipt Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Receipt Details</h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Receipt No:</span>
                  <span className="font-medium">{generateReceiptNumber()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">{formatDateTime(getPaymentDate())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Type:</span>
                  <span className="font-medium">{getPaymentType()}</span>
                </div>
              </div>
            </div>

            {rentalInfo && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Rental Information</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transaction:</span>
                    <span className="font-medium">{rentalInfo.transaction_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{rentalInfo.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rental ID:</span>
                    <span className="font-medium">{rentalInfo.rental_id}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Payment Details</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-medium flex items-center gap-1">
                  {PaymentMethodInfo[payment.method].icon}
                  {PaymentMethodInfo[payment.method].label}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Amount Received:</span>
                <span className="text-green-600">{formatCurrency(payment.amount)}</span>
              </div>
              
              {payment.reference && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Reference/Transaction ID:</span>
                  <span className="font-medium font-mono">{payment.reference}</span>
                </div>
              )}
              
              {payment.notes && (
                <div>
                  <span className="text-gray-600">Notes:</span>
                  <p className="mt-1 text-gray-900 bg-gray-50 p-2 rounded text-sm">
                    {payment.notes}
                  </p>
                </div>
              )}
              
              {'recorded_by' in payment && payment.recorded_by && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Received By:</span>
                  <span className="font-medium">{payment.recorded_by}</span>
                </div>
              )}
            </div>
          </div>

          {/* Amount in Words */}
          <div className="border-t border-gray-200 pt-4">
            <div className="bg-gray-50 p-3 rounded">
              <span className="text-sm text-gray-600">Amount in words:</span>
              <p className="font-medium text-gray-900 mt-1">
                {/* This would ideally use a number-to-words converter */}
                {formatCurrency(payment.amount)} only
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs text-gray-500">
                  This is a computer-generated receipt.
                </p>
                <p className="text-xs text-gray-500">
                  Receipt ID: {getPaymentId()}
                </p>
              </div>
              <div className="text-right">
                <div className="border-t border-gray-300 mt-8 pt-2 w-48">
                  <p className="text-sm font-medium">Authorized Signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};