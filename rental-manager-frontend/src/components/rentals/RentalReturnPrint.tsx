'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { calculateRentalItemTotal } from '@/utils/calculations';

interface RentalReturnPrintProps {
  returnData: any;
  onClose: () => void;
}

export function RentalReturnPrint({ returnData, onClose }: RentalReturnPrintProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatReceiptDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const getReturnActionLabel = (action: string) => {
    switch (action) {
      case 'COMPLETE_RETURN':
        return 'Complete Return';
      case 'PARTIAL_RETURN':
        return 'Partial Return';
      case 'MARK_LATE':
        return 'Mark as Late';
      case 'MARK_DAMAGED':
        return 'Mark as Damaged';
      default:
        return action;
    }
  };

  const getReturnActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'COMPLETE_RETURN':
        return 'default';
      case 'PARTIAL_RETURN':
        return 'secondary';
      case 'MARK_LATE':
        return 'destructive';
      case 'MARK_DAMAGED':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const calculateItemTotal = (item: any) => {
    // Calculate the correct total with rental period multiplication (same logic as RentalInvoicePrint)
    const quantity = item.quantity || 1;
    let unitRate = 0;
    let rentalPeriod = 1;

    // Determine unit rate and rental period
    if (item.rental_rate?.unit_rate) {
      unitRate = item.rental_rate.unit_rate;
      rentalPeriod = item.rental_rate.period_value || 1;
    } else if (item.daily_rate) {
      unitRate = item.daily_rate;
      // Use rental_period field if available, otherwise calculate from dates
      if (item.rental_period && item.rental_period > 0) {
        rentalPeriod = item.rental_period;
      } else if (item.rental_start_date && item.rental_end_date) {
        rentalPeriod = Math.ceil(
          (new Date(item.rental_end_date).getTime() - new Date(item.rental_start_date).getTime()) / 
          (1000 * 60 * 60 * 24)
        );
      }
    } else if (item.unit_price) {
      unitRate = item.unit_price;
      // Use rental_period field if available, otherwise calculate from dates
      if (item.rental_period && item.rental_period > 0) {
        rentalPeriod = item.rental_period;
      } else if (item.rental_start_date && item.rental_end_date) {
        rentalPeriod = Math.ceil(
          (new Date(item.rental_end_date).getTime() - new Date(item.rental_start_date).getTime()) / 
          (1000 * 60 * 60 * 24)
        );
      }
    }

    // Calculate base total with proper rental period multiplication
    const baseTotal = calculateRentalItemTotal(quantity, unitRate, rentalPeriod, 0);

    // Add additional charges
    const lateFeesTotal = (item.late_fee || item.late_fees || 0);
    const damageCharges = (item.damage_charges || item.damage_penalty || 0);
    const extraCharges = (item.extra_charges || item.additional_charges || 0);

    return baseTotal + lateFeesTotal + damageCharges + extraCharges;
  };

  const handlePrint = () => {
    window.print();
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Print Controls - Hidden when printing */}
        <div className="print:hidden p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Rental Return Receipt</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>

        {/* Receipt Content - Compact Style */}
        <div className="print:p-2 p-6 print:max-w-none max-w-lg mx-auto font-mono text-sm">
          <style jsx global>{`
            @media print {
              body { 
                margin: 0; 
                font-family: 'Courier New', monospace; 
                font-size: 10pt;
                line-height: 1.2;
              }
              .print-receipt {
                width: 58mm !important;
                max-width: 58mm !important;
                margin: 0 auto;
                font-size: 9pt !important;
              }
            }
          `}</style>
          
          <div className="print-receipt">
            {/* Header */}
            <div className="text-center border-b-2 border-dashed border-gray-400 pb-2 mb-3">
              <div className="font-bold text-base">RENTAL RETURN</div>
              <div className="text-xs">RECEIPT</div>
              <div className="text-xs mt-1">Equipment Return Processing</div>
            </div>

            {/* Transaction Info */}
            <div className="space-y-1 mb-3 text-xs">
              <div className="flex justify-between">
                <span>TXN#:</span>
                <span className="font-bold">{returnData.rental?.transaction_number || `RNT-${returnData.rental?.id?.slice(0, 8)}`}</span>
              </div>
              <div className="flex justify-between">
                <span>Return Date:</span>
                <span>{formatReceiptDate(new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between">
                <span>Rental Start:</span>
                <span>{returnData.rental?.rental_start_date ? formatReceiptDate(returnData.rental.rental_start_date) : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Expected:</span>
                <span>{returnData.rental?.rental_end_date ? formatReceiptDate(returnData.rental.rental_end_date) : 'N/A'}</span>
              </div>
            </div>

            {/* Customer Info */}
            <div className="border-t border-dashed border-gray-300 pt-2 mb-3">
              <div className="font-bold text-xs mb-1">CUSTOMER</div>
              <div className="text-xs">
                <div className="truncate">{returnData.rental?.customer?.name || returnData.rental?.customer_name || 'N/A'}</div>
                {(returnData.rental?.customer?.phone || returnData.rental?.customer_phone) && (
                  <div className="text-gray-600">{returnData.rental?.customer?.phone || returnData.rental?.customer_phone}</div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="border-t border-dashed border-gray-300 pt-2 mb-3">
              <div className="font-bold text-xs mb-2">RETURNED ITEMS</div>
              {(returnData.items || []).map((item: any, index: number) => (
                <div key={index} className="mb-3 text-xs">
                  <div className="font-medium truncate">
                    {item.item?.name || item.item_name || item.description}
                  </div>
                  <div className="text-gray-600 text-xs">
                    SKU: {item.item?.sku || item.sku || 'N/A'}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Qty:</span>
                    <span>{item.return_quantity || item.quantity_returned || item.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Action:</span>
                    <span className="text-xs">
                      {(() => {
                        const action = item.return_action || 'COMPLETE_RETURN';
                        switch (action) {
                          case 'COMPLETE_RETURN': return 'Complete';
                          case 'PARTIAL_RETURN': return 'Partial';
                          case 'MARK_LATE': return 'Late';
                          case 'MARK_DAMAGED': return 'Damaged';
                          default: return action;
                        }
                      })()}
                    </span>
                  </div>
                  {(item.condition_notes || (item.return_action === 'MARK_DAMAGED' ? 'Damaged' : 'Good')) && (
                    <div className="flex justify-between">
                      <span>Condition:</span>
                      <span className="text-xs truncate">
                        {item.condition_notes || (item.return_action === 'MARK_DAMAGED' ? 'Damaged' : 'Good')}
                      </span>
                    </div>
                  )}
                  {item.late_fee > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Late Fee:</span>
                      <span className="font-medium">{formatCurrency(item.late_fee)}</span>
                    </div>
                  )}
                  {item.damage_penalty > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Damage:</span>
                      <span className="font-medium">{formatCurrency(item.damage_penalty)}</span>
                    </div>
                  )}
                  <div className="border-b border-dotted border-gray-300 mt-1"></div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="border-t-2 border-dashed border-gray-400 pt-2 mb-3">
              <div className="font-bold text-xs mb-2">FINANCIAL SUMMARY</div>
              {(() => {
                const rentalSubtotal = (returnData.items || []).reduce((sum: number, item: any) => {
                  const baseTotal = calculateItemTotal(item);
                  return sum + (baseTotal - (item.late_fee || 0) - (item.damage_penalty || 0));
                }, 0);
                
                const lateFees = (returnData.items || []).reduce((sum: number, item: any) => sum + (item.late_fee || 0), 0);
                const damagePenalties = (returnData.items || []).reduce((sum: number, item: any) => sum + (item.damage_penalty || 0), 0);
                const totalAmount = rentalSubtotal + lateFees + damagePenalties;
                const depositAmount = returnData.rental?.deposit_amount || 0;
                const balanceAmount = totalAmount - depositAmount;
                
                return (
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Rental Total:</span>
                      <span>{formatCurrency(rentalSubtotal)}</span>
                    </div>
                    
                    {lateFees > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Late Fees:</span>
                        <span>+{formatCurrency(lateFees)}</span>
                      </div>
                    )}
                    
                    {damagePenalties > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Damage:</span>
                        <span>+{formatCurrency(damagePenalties)}</span>
                      </div>
                    )}
                    
                    <div className="border-t border-dotted border-gray-300 pt-1 mt-1">
                      <div className="flex justify-between font-bold">
                        <span>TOTAL:</span>
                        <span>{formatCurrency(totalAmount)}</span>
                      </div>
                    </div>
                    
                    {depositAmount > 0 && (
                      <>
                        <div className="flex justify-between text-blue-600">
                          <span>Deposit Paid:</span>
                          <span>-{formatCurrency(depositAmount)}</span>
                        </div>
                        
                        <div className="border-t border-dotted border-gray-300 pt-1 mt-1">
                          <div className={`flex justify-between font-bold text-sm ${balanceAmount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            <span>{balanceAmount >= 0 ? 'AMOUNT DUE:' : 'REFUND:'}</span>
                            <span>{formatCurrency(Math.abs(balanceAmount))}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Return Notes */}
            {returnData.notes && (
              <div className="border-t border-dashed border-gray-300 pt-2 mb-3">
                <div className="font-bold text-xs mb-1">NOTES</div>
                <div className="text-xs text-gray-700 whitespace-pre-wrap">
                  {returnData.notes}
                </div>
              </div>
            )}

            {/* Processing Info */}
            <div className="border-t border-dashed border-gray-300 pt-2 mb-3 text-xs">
              <div className="flex justify-between">
                <span>Processed:</span>
                <span>{formatDateTime(new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between">
                <span>By:</span>
                <span>System User</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold">PROCESSED</span>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t-2 border-dashed border-gray-400 pt-2 text-center text-xs">
              <div className="font-bold mb-1">Thank You!</div>
              <div className="text-gray-600">
                Equipment Return Completed
              </div>
              <div className="text-gray-500 text-xs mt-2">
                Receipt: {formatDateTime(new Date().toISOString())}
              </div>
              <div className="mt-2 text-xs">
                {(returnData.items || []).length} item(s) | {(returnData.items || []).reduce((sum: number, item: any) => sum + (item.return_quantity || item.quantity), 0)} unit(s)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}