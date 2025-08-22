'use client';

import React, { useRef } from 'react';
import { format } from 'date-fns';
import { X, Printer, Download, Check, AlertCircle } from 'lucide-react';

interface ReturnedItem {
  line_id: string;
  item_name: string;
  sku: string;
  original_quantity: number;
  returned_quantity: number;
  remaining_quantity: number;
  return_date: string;
  new_status: string;
  condition_notes?: string;
}

interface FinancialImpact {
  deposit_refunded: number;
  late_fees_charged: number;
  damage_fees_charged: number;
  total_refund: number;
  payment_method?: string;
}

interface RentalReturnReceiptProps {
  isOpen: boolean;
  onClose: () => void;
  returnData: {
    success: boolean;
    message: string;
    rental_id: string;
    transaction_number: string;
    return_date: string;
    items_returned: ReturnedItem[];
    rental_status: string;
    financial_impact: FinancialImpact;
    timestamp: string;
  };
  companyInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  customerInfo?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
}

export function RentalReturnReceipt({
  isOpen,
  onClose,
  returnData,
  companyInfo = {
    name: 'Your Rental Company',
    address: '123 Business Street, City, State 12345',
    phone: '(555) 123-4567',
    email: 'info@yourrental.com'
  },
  customerInfo
}: RentalReturnReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Return Receipt - ${returnData.transaction_number}</title>
          <style>
            @media print {
              body { margin: 0; }
              .no-print { display: none !important; }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
              color: #000;
              background: white;
            }
            .receipt-container {
              width: 58mm;
              max-width: 100%;
              margin: 0 auto;
              padding: 5mm;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-bold { font-weight: bold; }
            .text-lg { font-size: 14px; }
            .text-xl { font-size: 16px; }
            .text-sm { font-size: 10px; }
            .mb-1 { margin-bottom: 4px; }
            .mb-2 { margin-bottom: 8px; }
            .mb-3 { margin-bottom: 12px; }
            .border-top { border-top: 1px dashed #000; padding-top: 8px; }
            .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .double-border { border-top: 3px double #000; border-bottom: 3px double #000; padding: 8px 0; margin: 8px 0; }
            table { width: 100%; }
            .item-row { margin: 4px 0; }
            .item-name { font-weight: bold; }
            .item-details { margin-left: 8px; font-size: 10px; }
            .summary-row { display: flex; justify-content: space-between; margin: 4px 0; }
            .status-badge { 
              display: inline-block; 
              padding: 2px 6px; 
              background: #000; 
              color: white; 
              font-size: 10px;
              margin: 2px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'RENTAL_COMPLETED':
        return 'COMPLETED';
      case 'RENTAL_PARTIAL_RETURN':
        return 'PARTIAL';
      case 'RENTAL_LATE':
        return 'LATE';
      default:
        return status.replace('RENTAL_', '');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
        {/* Header with actions */}
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between no-print">
          <h3 className="text-lg font-semibold">Return Receipt</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Print Receipt"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-4">
          <div className="receipt-container">
            {/* Success Header */}
            <div className="text-center mb-3">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-2">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-xl text-bold">RETURN PROCESSED</div>
              <div className="text-sm text-gray-600 mt-1">Successfully Completed</div>
            </div>

            {/* Company Info */}
            <div className="text-center mb-3 border-bottom">
              <div className="text-lg text-bold">{companyInfo.name}</div>
              <div className="text-sm">{companyInfo.address}</div>
              <div className="text-sm">Tel: {companyInfo.phone}</div>
              <div className="text-sm mb-2">{companyInfo.email}</div>
            </div>

            {/* Transaction Info */}
            <div className="mb-3">
              <div className="text-center text-bold mb-2">RETURN RECEIPT</div>
              <div className="summary-row">
                <span>Trans #:</span>
                <span className="text-bold">{returnData.transaction_number}</span>
              </div>
              <div className="summary-row">
                <span>Return Date:</span>
                <span>{format(new Date(returnData.return_date), 'dd/MM/yyyy')}</span>
              </div>
              <div className="summary-row">
                <span>Time:</span>
                <span>{format(new Date(returnData.timestamp), 'HH:mm:ss')}</span>
              </div>
            </div>

            {/* Customer Info */}
            {customerInfo && (
              <div className="mb-3 border-top">
                <div className="text-bold mb-1">CUSTOMER:</div>
                <div className="text-sm">{customerInfo.name}</div>
                {customerInfo.phone && <div className="text-sm">Ph: {customerInfo.phone}</div>}
              </div>
            )}

            {/* Returned Items */}
            <div className="mb-3 border-top">
              <div className="text-bold mb-2">RETURNED ITEMS:</div>
              {returnData.items_returned.map((item, index) => (
                <div key={item.line_id} className="mb-2">
                  <div className="item-row">
                    <div className="item-name">{index + 1}. {item.item_name}</div>
                    <div className="item-details">
                      SKU: {item.sku}
                    </div>
                    <div className="item-details">
                      Qty: {item.returned_quantity} of {item.original_quantity} returned
                    </div>
                    {item.remaining_quantity > 0 && (
                      <div className="item-details text-bold">
                        ({item.remaining_quantity} still on rent)
                      </div>
                    )}
                    {item.condition_notes && (
                      <div className="item-details">
                        Note: {item.condition_notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="mb-3 border-top">
              <div className="text-bold mb-2">FINANCIAL SUMMARY:</div>
              
              {returnData.financial_impact.deposit_refunded > 0 && (
                <div className="summary-row">
                  <span>Deposit Refund:</span>
                  <span>{formatCurrency(returnData.financial_impact.deposit_refunded)}</span>
                </div>
              )}
              
              {returnData.financial_impact.late_fees_charged > 0 && (
                <div className="summary-row text-red-600">
                  <span>Late Fees:</span>
                  <span>-{formatCurrency(returnData.financial_impact.late_fees_charged)}</span>
                </div>
              )}
              
              {returnData.financial_impact.damage_fees_charged > 0 && (
                <div className="summary-row text-red-600">
                  <span>Damage Fees:</span>
                  <span>-{formatCurrency(returnData.financial_impact.damage_fees_charged)}</span>
                </div>
              )}
              
              <div className="double-border">
                <div className="summary-row text-lg text-bold">
                  <span>TOTAL REFUND:</span>
                  <span>{formatCurrency(returnData.financial_impact.total_refund)}</span>
                </div>
              </div>
            </div>

            {/* Rental Status */}
            <div className="mb-3 border-top">
              <div className="text-center">
                <div className="text-sm mb-1">Rental Status:</div>
                <span className="status-badge">
                  {getStatusDisplay(returnData.rental_status)}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center border-top text-sm">
              <div className="mb-2">Thank you for your business!</div>
              <div className="text-sm">
                Please keep this receipt for your records
              </div>
              {returnData.rental_status !== 'RENTAL_COMPLETED' && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <AlertCircle className="w-4 h-4 text-yellow-600 inline mr-1" />
                  <span className="text-sm">Some items are still on rent</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-3 no-print">
          <button
            onClick={handlePrint}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}