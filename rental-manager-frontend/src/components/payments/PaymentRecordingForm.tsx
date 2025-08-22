'use client';

import React, { useState, useEffect } from 'react';
import { PaymentMethod, PaymentMethodInfo, PaymentRecord } from '@/types/payment';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { PaymentAmountInput } from './PaymentAmountInput';
import { CreditCard, Receipt, AlertCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { 
  validatePayment, 
  getPaymentMethodGuidance,
  PaymentValidationResult
} from '@/utils/payment-validation';

interface PaymentRecordingFormProps {
  maxAmount?: number;
  minAmount?: number;
  onPaymentChange: (payment: PaymentRecord | null) => void;
  showReference?: boolean;
  label?: string;
  disabled?: boolean;
  initialAmount?: number;
}

export const PaymentRecordingForm: React.FC<PaymentRecordingFormProps> = ({
  maxAmount,
  minAmount = 0,
  onPaymentChange,
  showReference = true,
  label = 'Record Payment',
  disabled = false,
  initialAmount = 0
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [amount, setAmount] = useState<number>(initialAmount);
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<PaymentValidationResult | null>(null);
  const [showGuidance, setShowGuidance] = useState(false);

  // Enhanced validation with business rules
  useEffect(() => {
    if (amount > 0 && paymentMethod) {
      const paymentData: Partial<PaymentRecord> = {
        method: paymentMethod,
        amount,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        recorded_at: new Date().toISOString()
      };
      
      // Apply enhanced validation with custom rules
      const customRules = {
        minAmount: Math.max(minAmount, 0),
        maxAmount: maxAmount || undefined,
      };
      
      const result = validatePayment(paymentData, customRules);
      setValidationResult(result);
      setErrors(result.errors);
      
      // Create payment record if valid
      if (result.isValid) {
        const paymentRecord: PaymentRecord = {
          method: paymentMethod,
          amount,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
          recorded_at: new Date().toISOString()
        };
        onPaymentChange(paymentRecord);
      } else {
        onPaymentChange(null);
      }
    } else {
      setValidationResult(null);
      setErrors({});
      onPaymentChange(null);
    }
  }, [paymentMethod, amount, reference, notes, maxAmount, minAmount, onPaymentChange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const requiresReference = paymentMethod && PaymentMethodInfo[paymentMethod]?.requiresReference;

  return (
    <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-white">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-blue-600" />
        <h3 className="font-medium text-gray-900">{label}</h3>
      </div>

      {/* Payment Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payment Amount
        </label>
        <PaymentAmountInput
          value={amount}
          onChange={setAmount}
          maxAmount={maxAmount}
          minAmount={minAmount}
          disabled={disabled}
          error={errors.amount}
          showMaxButton={!!maxAmount}
        />
      </div>

      {/* Payment Method */}
      {amount > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Payment Method <span className="text-red-500">*</span>
            </label>
            {paymentMethod && (
              <button
                type="button"
                onClick={() => setShowGuidance(!showGuidance)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <HelpCircle className="w-3 h-3" />
                Guidance
              </button>
            )}
          </div>
          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            disabled={disabled}
          />
          {errors.method && (
            <p className="text-sm text-red-600 mt-1">{errors.method}</p>
          )}
          
          {/* Payment Method Guidance */}
          {showGuidance && paymentMethod && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                {PaymentMethodInfo[paymentMethod].label} Guidelines:
              </h4>
              <ul className="text-xs text-blue-800 space-y-1">
                {getPaymentMethodGuidance(paymentMethod).map((guidance, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-600 mr-1">•</span>
                    {guidance}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Reference/Transaction ID */}
      {showReference && amount > 0 && paymentMethod && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reference/Transaction ID {requiresReference && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <Receipt className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={disabled}
              placeholder="Enter transaction reference"
              className={`w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.reference 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300'
              } ${
                disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
              }`}
            />
          </div>
          {errors.reference && (
            <p className="text-sm text-red-600 mt-1">{errors.reference}</p>
          )}
        </div>
      )}

      {/* Notes */}
      {amount > 0 && paymentMethod && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={disabled}
            rows={2}
            placeholder="Additional payment notes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100"
          />
        </div>
      )}

      {/* Validation Warnings */}
      {validationResult?.warnings && validationResult.warnings.length > 0 && Object.keys(errors).length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-900">Validation Warnings</p>
              <ul className="text-sm text-yellow-800 mt-1 space-y-1">
                {validationResult.warnings.map((warning, index) => (
                  <li key={index} className="list-disc list-inside">• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Payment Summary */}
      {amount > 0 && paymentMethod && Object.keys(errors).length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">Payment Ready to Record</p>
              <div className="text-sm text-green-800 mt-1 space-y-1">
                <div>Amount: <span className="font-medium">{formatCurrency(amount)}</span></div>
                <div>Method: <span className="font-medium">{PaymentMethodInfo[paymentMethod].icon} {PaymentMethodInfo[paymentMethod].label}</span></div>
                {reference && <div>Reference: <span className="font-medium">{reference}</span></div>}
              </div>
              {validationResult?.warnings && validationResult.warnings.length > 0 && (
                <div className="mt-2 pt-2 border-t border-green-200">
                  <p className="text-xs text-green-700">
                    ⚠️ {validationResult.warnings.length} warning(s) detected
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Summary */}
      {Object.keys(errors).length > 0 && amount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900">Please correct the following:</p>
              <ul className="text-sm text-red-800 mt-1 space-y-1">
                {Object.values(errors).map((error, index) => (
                  <li key={index} className="list-disc list-inside">• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};