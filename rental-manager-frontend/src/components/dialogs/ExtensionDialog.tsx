'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, AlertTriangle, Check, IndianRupee } from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { rentalExtensionService, ExtensionAvailabilityResponse } from '@/services/api/rental-extensions';
import { PaymentRecordingForm } from '@/components/payments/PaymentRecordingForm';
import { PaymentRecord } from '@/types/payment';

interface RentalItem {
  line_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  rental_end_date: string;
  sku?: string;
  category?: string;
}

interface ExtensionData {
  line_id: string;
  new_end_date: string;
  extend_quantity: number;
  extension_charges: number;
  payment?: PaymentRecord;
}

interface ExtensionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: RentalItem;
  rentalId: string;
  onConfirm: (extensionData: ExtensionData) => void;
}

export const ExtensionDialog: React.FC<ExtensionDialogProps> = ({
  isOpen,
  onClose,
  item,
  rentalId,
  onConfirm
}) => {
  const [newEndDate, setNewEndDate] = useState<string>('');
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState<ExtensionAvailabilityResponse | null>(null);
  const [showConflict, setShowConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentRecord, setPaymentRecord] = useState<PaymentRecord | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    if (item && isOpen) {
      // Set default new end date to 7 days after current end date
      const currentEnd = new Date(item.rental_end_date);
      const defaultNewEnd = addDays(currentEnd, 7);
      setNewEndDate(format(defaultNewEnd, 'yyyy-MM-dd'));
      
      // Reset state
      setAvailability(null);
      setShowConflict(false);
      setError(null);
      setPaymentRecord(null);
      setShowPayment(false);
    }
  }, [item, isOpen]);

  const checkAvailability = async () => {
    if (!newEndDate) {
      setError('Please select a new end date');
      return;
    }

    setIsChecking(true);
    setError(null);
    
    try {
      const response = await rentalExtensionService.checkAvailability(
        rentalId,
        newEndDate
      );
      setAvailability(response);
      setShowConflict(!response.can_extend);
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to check availability');
    } finally {
      setIsChecking(false);
    }
  };

  const calculateExtensionDays = () => {
    if (!newEndDate) return 0;
    return differenceInDays(
      new Date(newEndDate),
      new Date(item.rental_end_date)
    );
  };

  const calculateCharges = () => {
    const days = calculateExtensionDays();
    return item.unit_price * item.quantity * days;
  };

  const handleConfirm = () => {
    if (!availability?.can_extend) {
      setError('Please check availability first');
      return;
    }

    const extensionData: ExtensionData = {
      line_id: item.line_id,
      new_end_date: newEndDate,
      extend_quantity: item.quantity,
      extension_charges: calculateCharges(),
      payment: paymentRecord || undefined
    };

    onConfirm(extensionData);
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const handleQuickExtend = (days: number) => {
    const newDate = addDays(new Date(item.rental_end_date), days);
    setNewEndDate(format(newDate, 'yyyy-MM-dd'));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Extend Rental Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Item Details */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Item Details</h4>
            <div className="space-y-2">
              <p className="font-medium">{item.item_name}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Quantity:</span>
                  <span className="ml-2 font-medium">{item.quantity}</span>
                </div>
                <div>
                  <span className="text-gray-500">Daily Rate:</span>
                  <span className="ml-2 font-medium">{formatCurrency(item.unit_price)}</span>
                </div>
                {item.sku && (
                  <div>
                    <span className="text-gray-500">SKU:</span>
                    <span className="ml-2">{item.sku}</span>
                  </div>
                )}
                {item.category && (
                  <div>
                    <span className="text-gray-500">Category:</span>
                    <span className="ml-2">{item.category}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Current End Date */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Current End Date
            </label>
            <div className="mt-1 p-3 bg-gray-100 rounded-md">
              <div className="font-medium">
                {format(new Date(item.rental_end_date), 'EEEE, MMMM dd, yyyy')}
              </div>
            </div>
          </div>

          {/* New End Date Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              New End Date
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={newEndDate}
                min={format(
                  addDays(new Date(item.rental_end_date), 1),
                  'yyyy-MM-dd'
                )}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                onClick={checkAvailability}
                disabled={isChecking || !newEndDate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isChecking ? 'Checking...' : 'Check'}
              </Button>
            </div>
          </div>

          {/* Quick Duration Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Quick select:</span>
            {[3, 7, 14, 30].map(days => (
              <Button
                key={days}
                variant="outline"
                size="sm"
                onClick={() => handleQuickExtend(days)}
                className="text-xs px-3 py-1"
              >
                +{days} days
              </Button>
            ))}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Availability Status */}
          {availability && (
            <div className={`p-4 rounded-lg border ${
              availability.can_extend 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                {availability.can_extend ? (
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`font-medium text-sm mb-1 ${
                    availability.can_extend ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {availability.can_extend 
                      ? '✓ Available for extension' 
                      : '⚠ Conflict detected'}
                  </p>
                  {!availability.can_extend && Object.keys(availability.conflicts).length > 0 && (
                    <div className="text-xs text-red-600 space-y-1">
                      <p>The following conflicts were found:</p>
                      <ul className="list-disc list-inside ml-2 space-y-1">
                        {Object.entries(availability.conflicts).map(([key, conflict]: [string, any]) => (
                          <li key={key}>
                            {conflict.item_name}: Booked from {format(
                              new Date(conflict.earliest_conflict_date),
                              'MMM dd, yyyy'
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Extension Charges */}
          {newEndDate && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-sm text-blue-900 mb-3 flex items-center gap-2">
                <IndianRupee className="w-4 h-4" />
                Extension Charges
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Extension Period:</span>
                  <span className="font-medium">{calculateExtensionDays()} days</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Calculation:</span>
                  <span className="font-medium">
                    {item.quantity} × {formatCurrency(item.unit_price)} × {calculateExtensionDays()} days
                  </span>
                </div>
                <div className="pt-2 border-t border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Total Charges:</span>
                    <span className="font-bold text-xl text-blue-900">
                      {formatCurrency(calculateCharges())}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Section */}
          {newEndDate && calculateCharges() > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">Record Payment (Optional)</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPayment(!showPayment)}
                  className="text-sm"
                >
                  {showPayment ? 'Hide Payment' : 'Add Payment'}
                </Button>
              </div>
              
              {showPayment && (
                <PaymentRecordingForm
                  maxAmount={calculateCharges()}
                  onPaymentChange={setPaymentRecord}
                  label="Extension Payment"
                  showReference={true}
                />
              )}
            </div>
          )}

          {/* Information Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex gap-2">
              <div className="w-4 h-4 bg-amber-400 rounded-full flex-shrink-0 mt-0.5"></div>
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Extension Information:</p>
                <ul className="text-xs space-y-1">
                  <li>• Extension charges will be added to your rental balance</li>
                  <li>• Payment is optional at extension time</li>
                  <li>• You can pay now or when returning the item</li>
                  <li>• Original rental rates apply to extensions</li>
                  {paymentRecord && (
                    <li className="text-green-700 font-medium">• Payment of {formatCurrency(paymentRecord.amount)} will be recorded</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!availability?.can_extend || calculateExtensionDays() <= 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {paymentRecord 
              ? `Confirm Extension + Payment (${formatCurrency(paymentRecord.amount)})`
              : 'Confirm Extension'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};