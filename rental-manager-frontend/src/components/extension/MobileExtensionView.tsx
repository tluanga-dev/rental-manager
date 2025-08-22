'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar, 
  Package, 
  CreditCard, 
  Check, 
  AlertTriangle,
  IndianRupee
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';

interface RentalItem {
  line_id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  rental_end_date: string;
  sku?: string;
  category?: string;
}

interface MobileExtensionViewProps {
  rental: {
    id: string;
    transaction_number: string;
    customer_name: string;
    items: RentalItem[];
  };
  onProcess: (extensionData: any) => void;
}

export const MobileExtensionView: React.FC<MobileExtensionViewProps> = ({ 
  rental, 
  onProcess 
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [newEndDate, setNewEndDate] = useState<string>('');
  const [paymentOption, setPaymentOption] = useState<'PAY_NOW' | 'PAY_LATER'>('PAY_LATER');
  const [paymentAmount, setPaymentAmount] = useState(0);

  const steps = [
    { id: 'select', title: 'Select Items', icon: <Package className="w-4 h-4" /> },
    { id: 'date', title: 'Choose Date', icon: <Calendar className="w-4 h-4" /> },
    { id: 'payment', title: 'Payment', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'confirm', title: 'Confirm', icon: <Check className="w-4 h-4" /> }
  ];

  useEffect(() => {
    // Set default selections
    if (rental?.items?.length > 0) {
      setSelectedItems(new Set(rental.items.map(item => item.line_id)));
      const defaultDate = addDays(new Date(), 7);
      setNewEndDate(format(defaultDate, 'yyyy-MM-dd'));
    }
  }, [rental]);

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

  const calculateTotalCharges = () => {
    if (!newEndDate) return 0;
    
    return Array.from(selectedItems).reduce((total, lineId) => {
      const item = rental.items.find(i => i.line_id === lineId);
      if (!item) return total;
      
      const days = differenceInDays(new Date(newEndDate), new Date(item.rental_end_date));
      return total + (item.unit_price * item.quantity * Math.max(0, days));
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 0: return selectedItems.size > 0;
      case 1: return newEndDate !== '';
      case 2: return true;
      case 3: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Process extension
      const extensionData = {
        new_end_date: newEndDate,
        items: Array.from(selectedItems).map(lineId => ({
          line_id: lineId,
          action: 'EXTEND',
          extend_quantity: rental.items.find(i => i.line_id === lineId)?.quantity || 0
        })),
        payment_option: paymentOption,
        payment_amount: paymentOption === 'PAY_NOW' ? paymentAmount : 0
      };
      onProcess(extensionData);
    }
  };

  const handleQuickExtend = (item: RentalItem, days: number) => {
    const extensionDate = format(addDays(new Date(item.rental_end_date), days), 'yyyy-MM-dd');
    setNewEndDate(extensionDate);
    setSelectedItems(new Set([item.line_id]));
    setCurrentStep(2); // Skip to payment step
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Item Selection
        return (
          <div className="space-y-3">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Select Items to Extend</h2>
              <p className="text-sm text-gray-600 mt-1">Choose which items you want to extend</p>
            </div>
            
            {rental.items.map((item) => (
              <MobileItemCard
                key={item.line_id}
                item={item}
                isSelected={selectedItems.has(item.line_id)}
                onToggle={() => toggleItemSelection(item.line_id)}
                onQuickExtend={handleQuickExtend}
              />
            ))}
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center">
              <p className="text-sm text-blue-800">
                <strong>{selectedItems.size}</strong> of <strong>{rental.items.length}</strong> items selected
              </p>
            </div>
          </div>
        );
        
      case 1: // Date Selection
        return (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Choose Extension Date</h2>
              <p className="text-sm text-gray-600 mt-1">Select the new end date for your items</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New End Date
              </label>
              <input
                type="date"
                value={newEndDate}
                min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Quick Duration Buttons */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Quick select:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { days: 3, label: '3 days' },
                  { days: 7, label: '1 week' },
                  { days: 14, label: '2 weeks' },
                  { days: 30, label: '1 month' }
                ].map(({ days, label }) => (
                  <button
                    key={days}
                    onClick={() => {
                      const date = addDays(new Date(), days);
                      setNewEndDate(format(date, 'yyyy-MM-dd'));
                    }}
                    className="py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 focus:ring-2 focus:ring-blue-500"
                  >
                    +{label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Extension Summary */}
            {newEndDate && (
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-900 mb-2">Extension Summary</h3>
                <div className="space-y-1 text-sm text-green-800">
                  <div>Items: {selectedItems.size}</div>
                  <div>Extension period: {differenceInDays(new Date(newEndDate), new Date())} days</div>
                  <div className="font-bold text-lg">{formatCurrency(calculateTotalCharges())}</div>
                </div>
              </div>
            )}
          </div>
        );
        
      case 2: // Payment Options
        return (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Payment Options</h2>
              <p className="text-sm text-gray-600 mt-1">Choose when to pay for the extension</p>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="PAY_LATER"
                  checked={paymentOption === 'PAY_LATER'}
                  onChange={() => setPaymentOption('PAY_LATER')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">Pay at Return (Recommended)</div>
                  <div className="text-sm text-gray-600">Pay extension charges when you return the items</div>
                </div>
              </label>
              
              <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="PAY_NOW"
                  checked={paymentOption === 'PAY_NOW'}
                  onChange={() => setPaymentOption('PAY_NOW')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">Pay Now (Optional)</div>
                  <div className="text-sm text-gray-600">Pay full or partial amount immediately</div>
                </div>
              </label>
            </div>
            
            {paymentOption === 'PAY_NOW' && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Payment Amount
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  max={calculateTotalCharges()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  placeholder="Enter amount to pay now"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setPaymentAmount(calculateTotalCharges() * 0.5)}
                    className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 rounded text-sm"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => setPaymentAmount(calculateTotalCharges())}
                    className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 rounded text-sm"
                  >
                    Full Amount
                  </button>
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <IndianRupee className="w-4 h-4" />
                Payment Summary
              </h3>
              <div className="space-y-1 text-sm text-blue-800">
                <div className="flex justify-between">
                  <span>Extension charges:</span>
                  <span>{formatCurrency(calculateTotalCharges())}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pay now:</span>
                  <span>{formatCurrency(paymentOption === 'PAY_NOW' ? paymentAmount : 0)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-blue-200">
                  <span>Balance at return:</span>
                  <span>{formatCurrency(calculateTotalCharges() - (paymentOption === 'PAY_NOW' ? paymentAmount : 0))}</span>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 3: // Confirmation
        return (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Confirm Extension</h2>
              <p className="text-sm text-gray-600 mt-1">Review your extension details</p>
            </div>
            
            <div className="space-y-4">
              {/* Selected Items */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Selected Items ({selectedItems.size})</h3>
                <div className="space-y-2">
                  {Array.from(selectedItems).map(lineId => {
                    const item = rental.items.find(i => i.line_id === lineId);
                    if (!item) return null;
                    return (
                      <div key={lineId} className="flex justify-between text-sm">
                        <span>{item.item_name}</span>
                        <span>Qty: {item.quantity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Extension Details */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-3">Extension Details</h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex justify-between">
                    <span>New end date:</span>
                    <span>{format(new Date(newEndDate), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Extension period:</span>
                    <span>{differenceInDays(new Date(newEndDate), new Date())} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Extension charges:</span>
                    <span>{formatCurrency(calculateTotalCharges())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment option:</span>
                    <span>{paymentOption === 'PAY_NOW' ? 'Pay Now' : 'Pay Later'}</span>
                  </div>
                  {paymentOption === 'PAY_NOW' && paymentAmount > 0 && (
                    <div className="flex justify-between font-bold pt-2 border-t border-blue-200">
                      <span>Paying now:</span>
                      <span>{formatCurrency(paymentAmount)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile Header */}
      <div className="bg-white border-b sticky top-0 z-10 flex-shrink-0">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-gray-900">Extend Rental</h1>
            <p className="text-sm text-gray-500">#{rental.transaction_number}</p>
          </div>
          <div className="w-8" /> {/* Spacer */}
        </div>
        
        {/* Progress Steps */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium ${
                    index <= currentStep 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {index < currentStep ? <Check className="w-5 h-5" /> : step.icon}
                  </div>
                  <span className="text-xs text-gray-600 mt-1">{step.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      
      {/* Step Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {renderStepContent()}
      </div>
      
      {/* Bottom Action Bar */}
      <div className="bg-white border-t p-4 flex-shrink-0">
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex-1 py-3"
            >
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceedToNext()}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700"
          >
            {currentStep < steps.length - 1 ? 'Next' : 'Confirm Extension'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Mobile Item Card Component
interface MobileItemCardProps {
  item: RentalItem;
  isSelected: boolean;
  onToggle: () => void;
  onQuickExtend: (item: RentalItem, days: number) => void;
}

const MobileItemCard: React.FC<MobileItemCardProps> = ({ 
  item, 
  isSelected, 
  onToggle, 
  onQuickExtend 
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className={`border rounded-lg p-4 ${
      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
    }`}>
      {/* Main Card Content */}
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        <button
          onClick={onToggle}
          className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
          }`}
        >
          {isSelected && <Check className="w-4 h-4 text-white" />}
        </button>
        
        {/* Item Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{item.item_name}</h3>
          <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-500">
            <span>Qty: {item.quantity}</span>
            <span>₹{item.unit_price}/day</span>
            <span>Due: {format(new Date(item.rental_end_date), 'MMM dd')}</span>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => onQuickExtend(item, 7)}
              className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full"
            >
              +7 days
            </button>
            <button
              onClick={() => onQuickExtend(item, 14)}
              className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
            >
              +14 days
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-1 bg-gray-100 text-gray-800 text-xs rounded-full"
            >
              {showDetails ? 'Less' : 'More'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Expandable Details */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {item.category && (
              <div>
                <span className="text-gray-500">Category:</span>
                <span className="ml-1">{item.category}</span>
              </div>
            )}
            {item.sku && (
              <div>
                <span className="text-gray-500">SKU:</span>
                <span className="ml-1">{item.sku}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};