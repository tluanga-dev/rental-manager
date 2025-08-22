'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  CalendarDaysIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BanknotesIcon as CurrencyIcon,
  ArrowLeftIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { format, addDays, differenceInDays } from 'date-fns';
import axios from '@/lib/axios';
import { ExtensionDialog } from '@/components/dialogs/ExtensionDialog';

interface RentalItem {
  line_id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  rental_end_date: string;
  can_extend?: boolean;
  max_extension_date?: string;
}

interface ExtensionAvailability {
  can_extend: boolean;
  conflicts: Record<string, any>;
  extension_charges: number;
  current_balance: number;
  total_with_extension: number;
  payment_required: boolean;
  items: Array<{
    line_id: string;
    item_id: string;
    item_name: string;
    current_end_date: string;
    can_extend_to?: string;
    max_extension_date?: string;
    has_conflict: boolean;
  }>;
}

interface RentalDetails {
  id: string;
  transaction_number: string;
  customer_name: string;
  rental_start_date: string;
  rental_end_date: string;
  total_amount: number;
  paid_amount: number;
  extension_count: number;
  items: RentalItem[];
}

export default function RentalExtensionPage() {
  const params = useParams();
  const router = useRouter();
  const rentalId = params?.id as string;

  const [rental, setRental] = useState<RentalDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newEndDate, setNewEndDate] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemActions, setItemActions] = useState<Record<string, string>>({});
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [availability, setAvailability] = useState<ExtensionAvailability | null>(null);
  
  const [paymentOption, setPaymentOption] = useState<'PAY_NOW' | 'PAY_LATER'>('PAY_LATER');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  
  // Extension Dialog state
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);
  const [selectedItemForExtension, setSelectedItemForExtension] = useState<RentalItem | null>(null);

  useEffect(() => {
    if (rentalId) {
      fetchRentalDetails();
    }
  }, [rentalId]);

  useEffect(() => {
    if (rental) {
      // Set default new end date to 7 days after current end date
      const currentEnd = new Date(rental.rental_end_date);
      const defaultNewEnd = addDays(currentEnd, 7);
      setNewEndDate(format(defaultNewEnd, 'yyyy-MM-dd'));
      
      // Select all items by default
      const allItemIds = new Set(rental.items.map(item => item.line_id));
      setSelectedItems(allItemIds);
      
      // Set default actions to EXTEND
      const defaultActions: Record<string, string> = {};
      rental.items.forEach(item => {
        defaultActions[item.line_id] = 'EXTEND';
      });
      setItemActions(defaultActions);
    }
  }, [rental]);

  const fetchRentalDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/transactions/rentals/${rentalId}`);
      setRental(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load rental details');
    } finally {
      setLoading(false);
    }
  };

  const checkAvailability = async () => {
    if (!newEndDate) {
      setError('Please select a new end date');
      return;
    }

    try {
      setChecking(true);
      setError(null);
      
      const response = await axios.get(
        `/transactions/rentals/${rentalId}/extension-availability`,
        { params: { new_end_date: newEndDate } }
      );
      
      setAvailability(response.data);
      
      if (!response.data.can_extend) {
        setError('Extension not available due to booking conflicts');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to check availability');
    } finally {
      setChecking(false);
    }
  };

  const processExtension = async () => {
    if (!availability || !availability.can_extend) {
      setError('Please check availability first');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      
      // Prepare items for extension
      const items = Array.from(selectedItems).map(lineId => {
        const item = rental?.items.find(i => i.line_id === lineId);
        const action = itemActions[lineId] || 'EXTEND';
        
        return {
          line_id: lineId,
          action: action,
          extend_quantity: action === 'EXTEND' ? item?.quantity : 0,
          return_quantity: returnQuantities[lineId] || 0,
          new_end_date: newEndDate,
          return_condition: action === 'PARTIAL_RETURN' ? 'GOOD' : null
        };
      });
      
      const payload = {
        new_end_date: newEndDate,
        items: items,
        payment_option: paymentOption,
        payment_amount: paymentOption === 'PAY_NOW' ? paymentAmount : 0,
        payment_method: paymentOption === 'PAY_NOW' && paymentMethod ? paymentMethod : undefined,
        payment_reference: paymentOption === 'PAY_NOW' && paymentReference ? paymentReference : undefined,
        payment_notes: paymentOption === 'PAY_NOW' && paymentNotes ? paymentNotes : undefined,
        notes: `Extension processed on ${new Date().toLocaleDateString()}`
      };
      
      const response = await axios.post(
        `/transactions/rentals/${rentalId}/extend`,
        payload
      );
      
      if (response.data.success) {
        // Show success message and redirect
        alert(`Extension successful! New end date: ${response.data.new_end_date}`);
        router.push(`/rentals/${rentalId}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to process extension');
    } finally {
      setProcessing(false);
    }
  };

  const handleItemActionChange = (lineId: string, action: string) => {
    setItemActions(prev => ({ ...prev, [lineId]: action }));
    
    // If changing to partial return, ensure item is selected
    if (action === 'PARTIAL_RETURN' && !selectedItems.has(lineId)) {
      setSelectedItems(prev => new Set([...prev, lineId]));
    }
  };

  const handleReturnQuantityChange = (lineId: string, quantity: number) => {
    setReturnQuantities(prev => ({ ...prev, [lineId]: quantity }));
  };

  const toggleItemSelection = (lineId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineId)) {
        newSet.delete(lineId);
      } else {
        newSet.add(lineId);
      }
      return newSet;
    });
  };

  const handleOpenExtensionDialog = (item: RentalItem) => {
    setSelectedItemForExtension(item);
    setShowExtensionDialog(true);
  };

  const handleCloseExtensionDialog = () => {
    setShowExtensionDialog(false);
    setSelectedItemForExtension(null);
  };

  const handleConfirmItemExtension = (extensionData: any) => {
    // Auto-select the item
    setSelectedItems(prev => new Set([...prev, extensionData.line_id]));
    
    // Set action to EXTEND
    setItemActions(prev => ({ ...prev, [extensionData.line_id]: 'EXTEND' }));
    
    // Set the new end date for bulk operations
    setNewEndDate(extensionData.new_end_date);
    
    // Handle payment information if provided
    if (extensionData.payment) {
      setPaymentOption('PAY_NOW');
      setPaymentAmount(extensionData.payment.amount);
      setPaymentMethod(extensionData.payment.method);
      setPaymentReference(extensionData.payment.reference || '');
      setPaymentNotes(extensionData.payment.notes || '');
      
      // Store payment method for later API call
      console.log('Payment method selected:', extensionData.payment.method);
    }
    
    // Show success message (optional)
    console.log('Item extension configured:', extensionData);
    
    // Close dialog
    handleCloseExtensionDialog();
  };

  const calculateExtensionDays = () => {
    if (!rental || !newEndDate) return 0;
    const currentEnd = new Date(rental.rental_end_date);
    const newEnd = new Date(newEndDate);
    return differenceInDays(newEnd, currentEnd);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !rental) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!rental) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Rental Details
        </button>
        
        <h1 className="text-2xl font-bold text-gray-900">
          Extend Rental #{rental.transaction_number}
        </h1>
        <p className="text-gray-600 mt-1">
          Customer: {rental.customer_name} | 
          Current End Date: {format(new Date(rental.rental_end_date), 'MMM dd, yyyy')} |
          Extensions: {rental.extension_count}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Extension Date Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <CalendarDaysIcon className="w-5 h-5 mr-2" />
          Extension Details
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New End Date
            </label>
            <input
              type="date"
              value={newEndDate}
              min={format(addDays(new Date(rental.rental_end_date), 1), 'yyyy-MM-dd')}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Extension Period
            </label>
            <div className="px-3 py-2 bg-gray-50 rounded-md">
              {calculateExtensionDays()} days
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              &nbsp;
            </label>
            <button
              onClick={checkAvailability}
              disabled={checking || !newEndDate}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {checking ? 'Checking...' : 'Check Availability'}
            </button>
          </div>
        </div>
      </div>

      {/* Items Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          Select Items to Extend
        </h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Select
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Item
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Current End Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quick Extend
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rental.items.map((item) => {
                const itemAvailability = availability?.items.find(
                  i => i.line_id === item.line_id
                );
                const hasConflict = itemAvailability?.has_conflict;
                
                return (
                  <tr key={item.line_id}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.line_id)}
                        onChange={() => toggleItemSelection(item.line_id)}
                        disabled={hasConflict}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {item.item_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {format(new Date(item.rental_end_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={itemActions[item.line_id] || 'EXTEND'}
                        onChange={(e) => handleItemActionChange(item.line_id, e.target.value)}
                        disabled={!selectedItems.has(item.line_id) || hasConflict}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="EXTEND">Extend</option>
                        {item.quantity >= 2 && (
                          <option value="PARTIAL_RETURN">Partial Return</option>
                        )}
                        <option value="FULL_RETURN">Full Return</option>
                      </select>
                      
                      {itemActions[item.line_id] === 'PARTIAL_RETURN' && (
                        <input
                          type="number"
                          min="1"
                          max={item.quantity - 1}
                          value={returnQuantities[item.line_id] || 1}
                          onChange={(e) => handleReturnQuantityChange(
                            item.line_id, 
                            parseInt(e.target.value)
                          )}
                          className="mt-2 w-20 text-sm border border-gray-300 rounded px-2 py-1"
                          placeholder="Return qty"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {hasConflict ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                          Conflict
                        </span>
                      ) : itemAvailability ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircleIcon className="w-3 h-3 mr-1" />
                          Available
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleOpenExtensionDialog(item)}
                        disabled={hasConflict}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        Extend
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Summary */}
      {availability && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <CurrencyIcon className="w-5 h-5 mr-2" />
            Financial Summary
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Current Balance:</span>
                <span className="font-medium">₹{availability.current_balance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Extension Charges:</span>
                <span className="font-medium">₹{availability.extension_charges.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 text-lg font-semibold">
                <span>Total with Extension:</span>
                <span>₹{availability.total_with_extension.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium mb-3">Payment Option</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="PAY_LATER"
                    checked={paymentOption === 'PAY_LATER'}
                    onChange={(e) => setPaymentOption('PAY_LATER')}
                    className="mr-2"
                  />
                  <span>Pay at Return (Standard)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="PAY_NOW"
                    checked={paymentOption === 'PAY_NOW'}
                    onChange={(e) => setPaymentOption('PAY_NOW')}
                    className="mr-2"
                  />
                  <span>Pay Now (Optional)</span>
                </label>
                
                {paymentOption === 'PAY_NOW' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Amount
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                        max={availability.total_with_extension}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Enter amount"
                      />
                      <button
                        onClick={() => setPaymentAmount(availability.extension_charges)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                      >
                        Extension Only
                      </button>
                      <button
                        onClick={() => setPaymentAmount(availability.total_with_extension)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                      >
                        Full Balance
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Information Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex">
          <InformationCircleIcon className="w-5 h-5 text-blue-400 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Extension Information:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Extensions are unlimited unless there are booking conflicts</li>
              <li>Payment is optional at extension time</li>
              <li>You can extend some items while returning others</li>
              <li>Different items can have different extension end dates if needed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={processExtension}
          disabled={!availability?.can_extend || processing || selectedItems.size === 0}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
        >
          {processing ? 'Processing...' : `Confirm Extension${paymentOption === 'PAY_NOW' && paymentAmount > 0 ? ` (Pay ₹${paymentAmount})` : ''}`}
        </button>
      </div>

      {/* Extension Dialog */}
      {selectedItemForExtension && (
        <ExtensionDialog
          isOpen={showExtensionDialog}
          onClose={handleCloseExtensionDialog}
          item={selectedItemForExtension}
          rentalId={rentalId}
          onConfirm={handleConfirmItemExtension}
        />
      )}
    </div>
  );
}