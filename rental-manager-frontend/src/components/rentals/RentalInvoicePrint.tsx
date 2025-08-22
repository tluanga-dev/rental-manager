'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { calculateRentalItemTotal } from '@/utils/calculations';

interface RentalInvoicePrintProps {
  rental: any;
  onClose: () => void;
}

export function RentalInvoicePrint({ rental, onClose }: RentalInvoicePrintProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
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

  const calculateItemTotal = (item: any) => {
    // Calculate the correct total with rental period multiplication
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
    const damageCharges = (item.damage_charges || 0);
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
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Print Controls - Hidden when printing */}
        <div className="print:hidden p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Rental Invoice Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Print
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="p-8 print:p-0">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">RENTAL INVOICE</h1>
            <p className="text-gray-600">Equipment Rental Services</p>
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold mb-3">Invoice Details</h3>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">Invoice Number:</span>
                  <span className="ml-2">{rental.transaction_number || `RNT-${rental.id.slice(0, 8)}`}</span>
                </div>
                <div>
                  <span className="font-medium">Invoice Date:</span>
                  <span className="ml-2">{formatDate(rental.created_at)}</span>
                </div>
                <div>
                  <span className="font-medium">Status:</span>
                  <span className="ml-2">
                    <Badge variant="outline" className="print:border print:border-gray-400">
                      {rental.status?.transaction_status || rental.status || 'Active'}
                    </Badge>
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Customer Information</h3>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">Name:</span>
                  <span className="ml-2">{rental.customer?.name || rental.customer_name || 'N/A'}</span>
                </div>
                {(rental.customer?.code) && (
                  <div>
                    <span className="font-medium">Customer Code:</span>
                    <span className="ml-2">{rental.customer.code}</span>
                  </div>
                )}
                {(rental.customer?.email || rental.customer_email) && (
                  <div>
                    <span className="font-medium">Email:</span>
                    <span className="ml-2">{rental.customer?.email || rental.customer_email}</span>
                  </div>
                )}
                {(rental.customer?.phone || rental.customer_phone) && (
                  <div>
                    <span className="font-medium">Phone:</span>
                    <span className="ml-2">{rental.customer?.phone || rental.customer_phone}</span>
                  </div>
                )}
                {rental.customer?.address && (
                  <div>
                    <span className="font-medium">Address:</span>
                    <span className="ml-2">{rental.customer.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>



          {/* Items Table */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3">Rental Items</h3>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs">Item</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs">SKU</th>
                  <th className="border border-gray-300 px-2 py-1 text-left text-xs">Rental Period</th>
                  <th className="border border-gray-300 px-2 py-1 text-center text-xs">Qty</th>
                  <th className="border border-gray-300 px-2 py-1 text-right text-xs">Rate</th>
                  <th className="border border-gray-300 px-2 py-1 text-right text-xs">Late Fee</th>
                  <th className="border border-gray-300 px-2 py-1 text-right text-xs">Extra Charges</th>
                  <th className="border border-gray-300 px-2 py-1 text-right text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {(rental.rental_items || rental.items || []).map((item: any, index: number) => (
                  <tr key={index}>
                    <td className="border border-gray-300 px-2 py-1">
                      <div className="font-medium text-xs">{item.item?.name || item.name || item.item_name || item.description}</div>
                      {(item.item?.description || item.description) && (
                        <div className="text-xs text-gray-600">{item.item?.description || item.description}</div>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-xs">{item.item?.sku || item.sku || 'N/A'}</td>
                    <td className="border border-gray-300 px-2 py-1">
                      {item.rental_start_date && item.rental_end_date ? (
                        <div className="text-xs">
                          <div className="font-medium">
                            {formatDate(item.rental_start_date)} - {formatDate(item.rental_end_date)}
                          </div>
                          <div className="text-gray-600">
                            {item.rental_duration_days || Math.ceil((new Date(item.rental_end_date).getTime() - new Date(item.rental_start_date).getTime()) / (1000 * 60 * 60 * 24))} days
                          </div>
                          {item.is_rental_overdue && (
                            <div className="text-red-600 font-medium">
                              Overdue by {item.days_overdue || Math.ceil((new Date().getTime() - new Date(item.rental_end_date).getTime()) / (1000 * 60 * 60 * 24))} days
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">No dates set</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      <div className="text-xs font-medium">{item.quantity}</div>
                      {(item.quantity_returned || item.returned_quantity) > 0 && (
                        <div className="text-xs text-green-600">({item.quantity_returned || item.returned_quantity} ret.)</div>
                      )}
                      {item.quantity_damaged > 0 && (
                        <div className="text-xs text-red-600">({item.quantity_damaged} dmg.)</div>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {item.rental_rate ? (
                        <div>
                          <div className="text-xs">{formatCurrency(item.rental_rate.unit_rate)}</div>
                          <div className="text-xs text-gray-600">
                            per {item.rental_rate.period_value} {item.rental_rate.period_type}
                          </div>
                        </div>
                      ) : item.daily_rate ? (
                        <div>
                          <div className="text-xs">{formatCurrency(item.daily_rate)}</div>
                          <div className="text-xs text-gray-600">per day</div>
                        </div>
                      ) : (
                        <span className="text-xs">{formatCurrency(item.unit_price || 0)}</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {(item.late_fee || item.late_fees) ? (
                        <div className="text-red-600 font-medium">
                          <div className="text-xs">{formatCurrency(item.late_fee || item.late_fees)}</div>
                          {item.is_rental_overdue && (
                            <div className="text-xs text-red-500 mt-1">
                              {item.days_overdue || Math.ceil((new Date().getTime() - new Date(item.rental_end_date).getTime()) / (1000 * 60 * 60 * 24))} days late
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {(item.damage_charges || item.extra_charges || item.additional_charges) ? (
                        <div className="text-xs space-y-1">
                          {item.damage_charges && (
                            <div className="text-red-600">
                              <div className="text-xs">Damage:</div>
                              <div className="text-xs">{formatCurrency(item.damage_charges)}</div>
                            </div>
                          )}
                          {(item.extra_charges || item.additional_charges) && (
                            <div className="text-orange-600">
                              <div className="text-xs">Extra:</div>
                              <div className="text-xs">{formatCurrency(item.extra_charges || item.additional_charges)}</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-medium text-xs">
                      {formatCurrency(calculateItemTotal(item))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              {rental.location && (
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">Location</h3>
                  <p>{rental.location.name}</p>
                </div>
              )}
              
              {rental.notes && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Notes</h3>
                  <p className="text-sm whitespace-pre-wrap">{rental.notes}</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Financial Summary</h3>
              <div className="space-y-2">
                {rental.financial_summary || rental.financial ? (
                  (() => {
                    // Recalculate correct totals from line items
                    const items = rental.rental_items || rental.items || [];
                    const calculatedSubtotal = items.reduce((sum: number, item: any) => sum + calculateItemTotal(item), 0);
                    const financialSummary = rental.financial_summary || rental.financial;
                    
                    // Use calculated subtotal if different from backend
                    const displaySubtotal = Math.abs(calculatedSubtotal - financialSummary.subtotal) > 0.01 
                      ? calculatedSubtotal 
                      : financialSummary.subtotal;
                    
                    const discountAmount = financialSummary.discount_amount || 0;
                    const taxAmount = financialSummary.tax_amount || 0;
                    const lateFees = financialSummary.late_fees || 0;
                    const damageCharges = financialSummary.damage_charges || 0;
                    
                    // Recalculate total with correct subtotal
                    const calculatedTotal = displaySubtotal - discountAmount + taxAmount + lateFees + damageCharges;
                    
                    return (
                      <>
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(displaySubtotal)}</span>
                        </div>
                    
                    {(rental.financial_summary || rental.financial).discount_amount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span>-{formatCurrency((rental.financial_summary || rental.financial).discount_amount)}</span>
                      </div>
                    )}
                    
                    {(rental.financial_summary || rental.financial).tax_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>{formatCurrency((rental.financial_summary || rental.financial).tax_amount)}</span>
                      </div>
                    )}
                    
                    {(rental.financial_summary || rental.financial).late_fees > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Late Fees:</span>
                        <span>{formatCurrency((rental.financial_summary || rental.financial).late_fees)}</span>
                      </div>
                    )}
                    
                    {(rental.financial_summary || rental.financial).damage_charges > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Damage Charges:</span>
                        <span>{formatCurrency((rental.financial_summary || rental.financial).damage_charges)}</span>
                      </div>
                    )}
                    
                    <Separator className="my-2" />
                    
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total Amount:</span>
                          <span>{formatCurrency(calculatedTotal)}</span>
                        </div>
                    
                    <div className="flex justify-between text-green-600">
                      <span>Paid Amount:</span>
                      <span>{formatCurrency((rental.financial_summary || rental.financial).paid_amount || 0)}</span>
                    </div>
                    
                    <div className={`flex justify-between font-medium ${(rental.financial_summary || rental.financial).balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <span>Balance Due:</span>
                      <span>{formatCurrency((rental.financial_summary || rental.financial).balance_due || 0)}</span>
                    </div>
                    
                    {(rental.financial_summary || rental.financial).deposit_amount > 0 && (
                      <>
                        <Separator className="my-2" />
                        <div className="flex justify-between">
                          <span>Deposit Amount:</span>
                          <span>{formatCurrency((rental.financial_summary || rental.financial).deposit_amount)}</span>
                        </div>
                        
                        {(rental.financial_summary || rental.financial).refundable_deposit && (
                          <div className="flex justify-between text-blue-600">
                            <span>Refundable Deposit:</span>
                            <span>{formatCurrency((rental.financial_summary || rental.financial).refundable_deposit)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
                })()
              ) : (
                // Fallback: Calculate totals from line items if financial summary is missing
                (() => {
                  const items = rental.rental_items || rental.items || [];
                  const calculatedTotal = items.reduce((sum: number, item: any) => sum + calculateItemTotal(item), 0);
                  return (
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Amount:</span>
                      <span>{formatCurrency(calculatedTotal || rental.total_amount || 0)}</span>
                    </div>
                  );
                })()
              )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-300 text-center text-sm text-gray-600">
            <p>Thank you for your business!</p>
            <p className="mt-2">Generated on {formatDateTime(new Date().toISOString())}</p>
          </div>
        </div>
      </div>
    </div>
  );
}