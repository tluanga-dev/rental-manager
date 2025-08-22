'use client';

import React from 'react';
import { IndianRupee } from 'lucide-react';

interface PaymentAmountInputProps {
  value: number;
  onChange: (amount: number) => void;
  maxAmount?: number;
  minAmount?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  showMaxButton?: boolean;
  error?: string;
}

export const PaymentAmountInput: React.FC<PaymentAmountInputProps> = ({
  value,
  onChange,
  maxAmount,
  minAmount = 0,
  disabled = false,
  className = '',
  placeholder = 'Enter amount',
  showMaxButton = true,
  error
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = parseFloat(e.target.value) || 0;
    
    // Validate against min/max
    let validatedValue = Math.max(minAmount, inputValue);
    if (maxAmount !== undefined) {
      validatedValue = Math.min(maxAmount, validatedValue);
    }
    
    onChange(validatedValue);
  };

  const setMaxAmount = () => {
    if (maxAmount !== undefined) {
      onChange(maxAmount);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Input with currency symbol */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <IndianRupee className="h-4 w-4 text-gray-500" />
        </div>
        <input
          type="number"
          value={value || ''}
          onChange={handleInputChange}
          min={minAmount}
          max={maxAmount}
          step="0.01"
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            error 
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
              : 'border-gray-300'
          } ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
          }`}
        />
      </div>

      {/* Quick actions */}
      {showMaxButton && maxAmount && maxAmount > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={setMaxAmount}
            disabled={disabled}
            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Max: {formatCurrency(maxAmount)}
          </button>
          {maxAmount > 100 && (
            <button
              type="button"
              onClick={() => onChange(Math.min(maxAmount / 2, Math.ceil(maxAmount / 2)))}
              disabled={disabled}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              50%
            </button>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Amount validation info */}
      {(minAmount > 0 || maxAmount) && !error && (
        <p className="text-xs text-gray-500">
          {minAmount > 0 && maxAmount ? (
            <>Range: {formatCurrency(minAmount)} - {formatCurrency(maxAmount)}</>
          ) : maxAmount ? (
            <>Maximum: {formatCurrency(maxAmount)}</>
          ) : (
            <>Minimum: {formatCurrency(minAmount)}</>
          )}
        </p>
      )}
    </div>
  );
};